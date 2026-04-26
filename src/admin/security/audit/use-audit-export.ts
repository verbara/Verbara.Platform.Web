// R5.2 PB.1 — audit export mutation hook.
//
// Triggers GET /api/v1/admin/audit/export with the active filter shape and
// streams the response into a Blob, then forces a browser download with a
// timestamped filename. The backend sets `Content-Disposition` already, but
// we re-derive the filename so the UX still works on browsers that strip the
// header (some embedded webviews).

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import type { AuditEventsFilter } from './use-audit-events';

export type AuditExportFormat = 'csv' | 'json';

export interface AuditExportArgs {
  readonly format: AuditExportFormat;
  readonly filter: AuditEventsFilter;
}

function buildExportSearchParams(args: AuditExportArgs): URLSearchParams {
  const { format, filter } = args;
  const params = new URLSearchParams();
  params.set('format', format);
  if (filter.actionPrefix) params.set('actionPrefix', filter.actionPrefix);
  if (filter.actor) params.set('actor', filter.actor);
  if (filter.target) params.set('target', filter.target);
  if (filter.from) params.set('from', filter.from);
  if (filter.to) params.set('to', filter.to);
  if (filter.tenantId) params.set('tenantId', filter.tenantId);
  return params;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportAuditEvents(args: AuditExportArgs): Promise<void> {
  const params = buildExportSearchParams(args);
  const url = `/api/v1/admin/audit/export?${params.toString()}`;

  const { accessToken } = useAuthStore.getState();
  const { activeTenantId } = useTenantStore.getState();
  const tenantId = activeTenantId ?? useAuthStore.getState().tenantId;

  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (tenantId) headers['X-Tenant-Id'] = tenantId;

  const response = await fetch(url, { method: 'GET', headers, credentials: 'include' });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail ?? `Audit export failed: ${response.status}`);
  }

  const blob = await response.blob();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = args.format === 'json' ? 'json' : 'csv';
  downloadBlob(blob, `audit-export-${stamp}.${ext}`);
}

export function useAuditExport() {
  return useMutation({
    mutationFn: exportAuditEvents,
    onSuccess: () => toast.success('Audit export downloaded.'),
    onError: (err: Error) => toast.error(err.message),
  });
}
