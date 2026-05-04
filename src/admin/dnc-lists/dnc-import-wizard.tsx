import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, CircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/core/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { Label } from '@/core/ui/label';
import { useImportDncEntries } from '@/core/api/hooks/use-dnc-lists';

interface DncImportWizardProps {
  listId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'upload' | 'preview' | 'result';

export function DncImportWizard({ listId, open, onOpenChange }: DncImportWizardProps) {
  const { t } = useTranslation('admin');
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [phoneColumn, setPhoneColumn] = useState('0');
  const [reasonColumn, setReasonColumn] = useState<string | undefined>(undefined);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [allDataRows, setAllDataRows] = useState<string[][]>([]);
  const [importResult, setImportResult] = useState<{ total: number; imported: number } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importEntries = useImportDncEntries();

  const previewRows = allDataRows.slice(0, 10);

  const resetState = () => {
    setStep('upload');
    setFileName('');
    setPhoneColumn('0');
    setReasonColumn(undefined);
    setRawHeaders([]);
    setAllDataRows([]);
    setImportResult(null);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) resetState();
    onOpenChange(o);
  };

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) return;

      const firstLine = lines[0] ?? '';
      const delimiter = firstLine.includes(',') ? ',' : '\t';
      const rows = lines.map((l) =>
        l.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, '')),
      );

      const headers = rows[0] ?? [];
      const dataRows = rows.slice(1);

      setRawHeaders(headers);
      setAllDataRows(dataRows);
      setStep('preview');
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleImport = () => {
    const phoneIdx = Number(phoneColumn);
    const reasonIdx = reasonColumn !== undefined ? Number(reasonColumn) : undefined;

    const entries = allDataRows
      .map((row) => ({
        phoneNumber: row[phoneIdx] ?? '',
        reason: reasonIdx !== undefined ? row[reasonIdx] : undefined,
      }))
      .filter((e) => e.phoneNumber.trim());

    importEntries.mutate(
      { listId, entries },
      {
        onSuccess: () => {
          setImportResult({ total: entries.length, imported: entries.length });
          setStep('result');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('dnc-lists.import_wizard.title')}</DialogTitle>
          <DialogDescription>
            {step === 'upload' && t('dnc-lists.import_wizard.step_upload')}
            {step === 'preview' && t('dnc-lists.import_wizard.step_preview')}
            {step === 'result' && t('dnc-lists.import_wizard.step_result')}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-muted-foreground/50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t('dnc-lists.import_wizard.drop_hint')}
            </p>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              {t('dnc-lists.import_wizard.browse')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
              <span className="text-muted-foreground">
                {t('dnc-lists.import_wizard.preview_count', {
                  total: allDataRows.length,
                  shown: previewRows.length,
                })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('dnc-lists.import_wizard.phone_column')}</Label>
                <Select value={phoneColumn} onValueChange={(v) => setPhoneColumn(v ?? '0')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rawHeaders.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('dnc-lists.import_wizard.reason_column')}</Label>
                <Select
                  value={reasonColumn ?? ''}
                  onValueChange={(v) => setReasonColumn(v || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('dnc-lists.import_wizard.none_option')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('dnc-lists.import_wizard.none_option')}</SelectItem>
                    {rawHeaders.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="max-h-48 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {rawHeaders.map((h, i) => (
                      <th
                        key={i}
                        className="px-2 py-1.5 text-left font-medium text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className="border-t">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2 py-1">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 'result' && importResult && (
          <div className="flex flex-col items-center gap-3 py-4">
            <CircleCheck className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-medium">
              {t('dnc-lists.import_wizard.imported_count', { count: importResult.imported })}
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                {t('dnc-lists.import_wizard.back')}
              </Button>
              <Button onClick={handleImport} disabled={importEntries.isPending}>
                {importEntries.isPending
                  ? t('dnc-lists.import_wizard.importing')
                  : t('dnc-lists.import_wizard.import')}
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button onClick={() => handleOpenChange(false)}>
              {t('dnc-lists.import_wizard.done')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
