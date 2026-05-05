import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/core/api/hooks/use-media', () => ({
  useUploadMedia: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  mediaDownloadUrl: (id: string) => `/api/v1/media/${id}/download`,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const table: Record<string, string> = {
        'mediaDiagnostic.title': 'Media Diagnostic',
        'mediaDiagnostic.description': 'Test media upload and download capabilities.',
        'mediaDiagnostic.upload.label': 'Upload test file',
        'mediaDiagnostic.upload.success': 'Upload successful',
        'mediaDiagnostic.upload.error': 'Upload failed',
        'mediaDiagnostic.download.label': 'Download',
        'mediaDiagnostic.download.noFiles': 'No media files available.',
        'mediaDiagnostic.status.ready': 'Ready',
        'mediaDiagnostic.status.uploading': 'Uploading...',
        'mediaDiagnostic.status.error': 'Error',
      };
      return table[key] ?? key;
    },
  }),
}));

import MediaDiagnosticPage from './media-diagnostic-page';

describe('MediaDiagnosticPage', () => {
  it('should_RenderPageHeader_WhenPageMounts', () => {
    render(<MediaDiagnosticPage />);
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
    expect(screen.getByText('Media Diagnostic')).toBeInTheDocument();
    expect(screen.getByText('Test media upload and download capabilities.')).toBeInTheDocument();
  });

  it('should_ShowReadyBadge_WhenNotUploading', () => {
    render(<MediaDiagnosticPage />);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Ready');
  });

  it('should_ShowNoFilesMessage_WhenNoUploads', () => {
    render(<MediaDiagnosticPage />);
    expect(screen.getByTestId('no-files-message')).toHaveTextContent('No media files available.');
  });

  it('should_RenderUploadButton_WhenPageMounts', () => {
    render(<MediaDiagnosticPage />);
    expect(screen.getByTestId('upload-button')).toBeInTheDocument();
    expect(screen.getByTestId('upload-button')).toHaveTextContent('Upload test file');
  });
});
