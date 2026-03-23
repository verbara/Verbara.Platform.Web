import { useState, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { Upload, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Label } from '@/core/ui/label';
import type { CampaignFormValues } from '../campaign-wizard';

const CONTACT_FIELDS = ['name', 'phone', 'email', 'company', 'custom1', 'custom2'] as const;

const MOCK_CSV_COLUMNS = ['Full Name', 'Phone Number', 'Email Address', 'Company'];

const MOCK_PREVIEW = [
  { 'Full Name': 'Alice Johnson', 'Phone Number': '+1-555-0101', 'Email Address': 'alice@example.com', 'Company': 'Acme Corp' },
  { 'Full Name': 'Bob Smith', 'Phone Number': '+1-555-0102', 'Email Address': 'bob@example.com', 'Company': 'Globex Inc' },
  { 'Full Name': 'Carol Davis', 'Phone Number': '+1-555-0103', 'Email Address': 'carol@example.com', 'Company': 'Initech' },
  { 'Full Name': 'Dan Wilson', 'Phone Number': '+1-555-0104', 'Email Address': 'dan@example.com', 'Company': 'Umbrella' },
  { 'Full Name': 'Eva Martinez', 'Phone Number': '+1-555-0105', 'Email Address': 'eva@example.com', 'Company': 'Cyberdyne' },
  { 'Full Name': 'Frank Lee', 'Phone Number': '+1-555-0106', 'Email Address': 'frank@example.com', 'Company': 'Stark Ind' },
  { 'Full Name': 'Grace Chen', 'Phone Number': '+1-555-0107', 'Email Address': 'grace@example.com', 'Company': 'Wayne Ent' },
  { 'Full Name': 'Hank Brown', 'Phone Number': '+1-555-0108', 'Email Address': '', 'Company': 'Oscorp' },
  { 'Full Name': 'Iris Patel', 'Phone Number': '+1-555-0109', 'Email Address': 'iris@example.com', 'Company': 'LexCorp' },
  { 'Full Name': 'Jack Rivera', 'Phone Number': '+1-555-0110', 'Email Address': 'jack@example.com', 'Company': 'CHOAM' },
];

const MOCK_VALIDATION = { loaded: 500, skipped: 12, duplicates: 3 };

export default function ContactsStep() {
  const { watch, setValue } = useFormContext<CampaignFormValues>();
  const [uploaded, setUploaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const columnMapping = watch('columnMapping') ?? {};

  const simulateUpload = useCallback(() => {
    setValue('contactFile', 'contacts-q2-outbound.csv');
    // Set default mapping
    const defaultMapping: Record<string, string> = {
      'Full Name': 'name',
      'Phone Number': 'phone',
      'Email Address': 'email',
      'Company': 'company',
    };
    setValue('columnMapping', defaultMapping);
    setUploaded(true);
  }, [setValue]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      simulateUpload();
    },
    [simulateUpload],
  );

  const updateMapping = (csvCol: string, field: string) => {
    setValue('columnMapping', { ...columnMapping, [csvCol]: field });
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
          <Button type="button" variant="outline" size="sm" onClick={simulateUpload}>
            <FileText className="mr-1.5 h-4 w-4" />
            Select File
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Validation Report */}
      <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
        <div className="text-sm">
          <p className="font-medium">File processed: contacts-q2-outbound.csv</p>
          <p className="mt-1 text-muted-foreground">
            <span className="font-medium text-foreground">{MOCK_VALIDATION.loaded}</span> contacts loaded
            {' '}&middot;{' '}
            <span className="text-amber-600">{MOCK_VALIDATION.skipped} skipped</span> (no phone)
            {' '}&middot;{' '}
            <span className="text-amber-600">{MOCK_VALIDATION.duplicates} duplicates</span>
          </p>
        </div>
      </div>

      {/* Column Mapping */}
      <div className="space-y-3">
        <Label>Column Mapping</Label>
        <div className="space-y-2">
          {MOCK_CSV_COLUMNS.map((col) => (
            <div key={col} className="flex items-center gap-3">
              <span className="w-40 text-sm text-muted-foreground">{col}</span>
              <AlertTriangle className="h-4 w-4 text-muted-foreground/50" />
              <select
                value={columnMapping[col] ?? ''}
                onChange={(e) => updateMapping(col, e.target.value)}
                className="h-8 w-48 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
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
        <Label>Contact Preview (first 10 rows)</Label>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {MOCK_CSV_COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_PREVIEW.map((row, i) => (
                <tr key={i} className="border-t">
                  {MOCK_CSV_COLUMNS.map((col) => (
                    <td key={col} className="px-3 py-1.5 text-muted-foreground">
                      {row[col as keyof typeof row] || <span className="italic text-muted-foreground/50">empty</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Re-upload */}
      <Button type="button" variant="outline" size="sm" onClick={() => setUploaded(false)}>
        <Upload className="mr-1.5 h-4 w-4" />
        Upload Different File
      </Button>
    </div>
  );
}
