import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload } from 'lucide-react';
import { PageHeader } from '@/core/ui/page-header';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import {
  useUploadMedia,
  mediaDownloadUrl,
  type MediaUploadResult,
} from '@/core/api/hooks/use-media';

function formatFileSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function MediaDiagnosticPage() {
  const { t } = useTranslation('admin');
  const upload = useUploadMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploaded, setUploaded] = useState<MediaUploadResult[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    upload.mutate(file, {
      onSuccess: (data) => {
        setUploaded((prev) => [...prev, data]);
      },
    });
    e.target.value = '';
  };

  const status = upload.isPending
    ? t('mediaDiagnostic.status.uploading')
    : upload.isError
      ? t('mediaDiagnostic.status.error')
      : t('mediaDiagnostic.status.ready');

  const statusVariant = upload.isPending ? 'secondary' : upload.isError ? 'destructive' : 'default';

  return (
    <div className="space-y-6" data-testid="media-diagnostic-page">
      <PageHeader title={t('mediaDiagnostic.title')} description={t('mediaDiagnostic.description')}>
        <Badge variant={statusVariant} data-testid="status-badge">
          {status}
        </Badge>
      </PageHeader>

      <div className="rounded-lg border bg-card p-4" data-testid="upload-section">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          data-testid="file-input"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
          data-testid="upload-button"
        >
          <Upload className="size-4" />
          {t('mediaDiagnostic.upload.label')}
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4" data-testid="results-section">
        {uploaded.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="no-files-message">
            {t('mediaDiagnostic.download.noFiles')}
          </p>
        ) : (
          <ul className="divide-y">
            {uploaded.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {file.contentType} &middot; {formatFileSize(file.size)}
                  </p>
                </div>
                <a
                  href={mediaDownloadUrl(file.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`download-link-${file.id}`}
                >
                  <Button variant="outline" size="sm">
                    <Download className="size-3" />
                    {t('mediaDiagnostic.download.label')}
                  </Button>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
