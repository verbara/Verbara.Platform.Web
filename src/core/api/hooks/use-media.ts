import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { toast } from 'sonner';

export interface MediaUploadResult {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
}

async function uploadFile(file: File): Promise<MediaUploadResult> {
  const { apiKey, tenantId: authTenantId } = useAuthStore.getState();
  const { activeTenantId } = useTenantStore.getState();
  const tenantId = activeTenantId ?? authTenantId;

  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  if (tenantId) headers['X-Tenant-Id'] = tenantId;

  const response = await fetch('/api/media/upload', {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }
  return response.json();
}

export function useUploadMedia() {
  return useMutation({
    mutationFn: (file: File) => uploadFile(file),
    onError: (err: Error) => toast.error(`Upload failed: ${err.message}`),
  });
}

export function mediaDownloadUrl(id: string): string {
  return `/api/media/${id}/download`;
}
