import { useState, useCallback, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { Upload, FileText, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Label } from '@/core/ui/label';
import type { CampaignFormValues } from '../campaign-wizard';
import type { ContactImportRow } from '@/core/api/hooks/use-campaigns';

// Contact fields the API accepts
const CONTACT_FIELDS = ['firstName', 'lastName', 'phone', 'phoneType', 'metadata.email', 'metadata.company', 'metadata.custom1', 'metadata.custom2'] as const;
type ContactField = (typeof CONTACT_FIELDS)[number];

interface ParseResult {
  columns: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

/** Lightweight RFC-4180 CSV parser (no external deps). */
function parseCsv(text: string): ParseResult {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length < 2) return { columns: [], rows: [], totalRows: 0 };

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        fields.push(field); field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field);
    return fields;
  };

  const columns = parseRow(nonEmpty[0]!);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < nonEmpty.length; i++) {
    const values = parseRow(nonEmpty[i]!);
    const row: Record<string, string> = {};
    columns.forEach((col, idx) => { row[col] = values[idx] ?? ''; });
    rows.push(row);
  }

  return { columns, rows, totalRows: rows.length };
}

/** Build auto-mapping by matching CSV column names heuristically. */
function buildAutoMapping(columns: string[]): Record<string, string> {
  const lower = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const heuristics: Record<string, ContactField> = {
    firstname: 'firstName', first: 'firstName',
    lastname: 'lastName', last: 'lastName',
    fullname: 'firstName', name: 'firstName',
    phone: 'phone', phonenumber: 'phone', mobile: 'phone', cell: 'phone', telephone: 'phone',
    phonetype: 'phoneType', type: 'phoneType',
    email: 'metadata.email', emailaddress: 'metadata.email',
    company: 'metadata.company', organization: 'metadata.company', org: 'metadata.company',
  };

  const mapping: Record<string, string> = {};
  columns.forEach((col) => {
    const key = lower(col);
    if (heuristics[key]) mapping[col] = heuristics[key];
  });
  return mapping;
}

/** Apply column mapping to parsed rows to produce API-ready ContactImportRow[]. */
function applyMapping(rows: Record<string, string>[], mapping: Record<string, string>): ContactImportRow[] {
  return rows
    .map((row) => {
      const contact: Partial<ContactImportRow> & { metadata?: Record<string, string> } = {};
      Object.entries(mapping).forEach(([csvCol, field]) => {
        const value = row[csvCol]?.trim() ?? '';
        if (!value) return;
        if (field === 'firstName') contact.firstName = value;
        else if (field === 'lastName') contact.lastName = value;
        else if (field === 'phone') contact.phone = value;
        else if (field === 'phoneType') contact.phoneType = value;
        else if (field.startsWith('metadata.')) {
          if (!contact.metadata) contact.metadata = {};
          contact.metadata[field.slice('metadata.'.length)] = value;
        }
      });
      return contact as ContactImportRow;
    })
    .filter((c) => !!c.firstName && !!c.phone);
}

interface ValidationSummary {
  loaded: number;
  skipped: number;
  duplicates: number;
}

function computeValidation(rows: Record<string, string>[], mapping: Record<string, string>): ValidationSummary {
  const phoneCol = Object.entries(mapping).find(([, f]) => f === 'phone')?.[0];
  const phones = new Set<string>();
  let skipped = 0;
  let duplicates = 0;
  let loaded = 0;

  rows.forEach((row) => {
    const phone = phoneCol ? row[phoneCol]?.trim() : '';
    if (!phone) { skipped++; return; }
    if (phones.has(phone)) { duplicates++; return; }
    phones.add(phone);
    loaded++;
  });

  return { loaded, skipped, duplicates };
}

export default function ContactsStep() {
  const { watch, setValue } = useFormContext<CampaignFormValues>();
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const columnMapping = watch('columnMapping') ?? {};
  const contactFile = watch('contactFile');
  const uploaded = parseResult !== null;

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const result = parseCsv(text);
        setParseResult(result);

        const autoMapping = buildAutoMapping(result.columns);
        setValue('contactFile', file.name);
        setValue('columnMapping', autoMapping);

        // Immediately compute mapped contacts and store in form
        const contacts = applyMapping(result.rows, autoMapping);
        setValue('parsedContacts', contacts);
      };
      reader.readAsText(file);
    },
    [setValue],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const updateMapping = useCallback(
    (csvCol: string, field: string) => {
      const next = { ...columnMapping, [csvCol]: field };
      setValue('columnMapping', next);
      // Recompute parsed contacts whenever mapping changes
      if (parseResult) {
        const contacts = applyMapping(parseResult.rows, next);
        setValue('parsedContacts', contacts);
      }
    },
    [columnMapping, parseResult, setValue],
  );

  const handleReset = () => {
    setParseResult(null);
    setValue('contactFile', '');
    setValue('columnMapping', {});
    setValue('parsedContacts', []);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!uploaded) {
    return (
      <div className="space-y-4">
        <Label>Upload Contact List</Label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
          }`}
        >
          <Upload className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag and drop a CSV file here, or click to browse
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileText className="mr-1.5 h-4 w-4" />
            Select File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      </div>
    );
  }

  const validation = computeValidation(parseResult.rows, columnMapping);
  const previewRows = parseResult.rows.slice(0, 10);
  const previewCols = parseResult.columns.slice(0, 6); // cap columns for readability

  return (
    <div className="space-y-6">
      {/* Validation Report */}
      <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
        <div className="flex-1 text-sm">
          <p className="font-medium">File processed: {contactFile}</p>
          <p className="mt-1 text-muted-foreground">
            <span className="font-medium text-foreground">{validation.loaded}</span> contacts loaded
            {' '}&middot;{' '}
            <span className="text-amber-600">{validation.skipped} skipped</span> (no phone)
            {' '}&middot;{' '}
            <span className="text-amber-600">{validation.duplicates} duplicates</span>
            {' '}&middot;{' '}
            <span className="text-muted-foreground">{parseResult.totalRows} total rows</span>
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Column Mapping */}
      <div className="space-y-3">
        <Label>Column Mapping</Label>
        <div className="space-y-2">
          {parseResult.columns.map((col) => (
            <div key={col} className="flex items-center gap-3">
              <span className="w-40 truncate text-sm text-muted-foreground" title={col}>{col}</span>
              <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              <select
                value={columnMapping[col] ?? ''}
                onChange={(e) => updateMapping(col, e.target.value)}
                className="h-8 w-52 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="">-- skip --</option>
                {CONTACT_FIELDS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Table */}
      <div className="space-y-3">
        <Label>Contact Preview (first {Math.min(10, parseResult.rows.length)} rows)</Label>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {previewCols.map((col) => (
                  <th key={col} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {col}
                  </th>
                ))}
                {parseResult.columns.length > 6 && (
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    +{parseResult.columns.length - 6} more
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className="border-t">
                  {previewCols.map((col) => (
                    <td key={col} className="px-3 py-1.5 text-muted-foreground">
                      {row[col] || <span className="italic text-muted-foreground/50">empty</span>}
                    </td>
                  ))}
                  {parseResult.columns.length > 6 && <td className="px-3 py-1.5" />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Re-upload */}
      <Button type="button" variant="outline" size="sm" onClick={handleReset}>
        <Upload className="mr-1.5 h-4 w-4" />
        Upload Different File
      </Button>
    </div>
  );
}
