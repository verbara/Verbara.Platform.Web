import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { toast } from 'sonner';

/**
 * Kept hand-written (openapi-typed-client-agent): `POST /media/upload` declares a `content?: never`
 * 200 response (no response schema), and this hook bypasses `customFetch` for a raw multipart
 * `fetch().json()` — there is nothing generated to swap onto.
 */
export interface MediaUploadResult {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
}

async function uploadFile(file: File): Promise<MediaUploadResult> {
  const { accessToken, tenantId: authTenantId } = useAuthStore.getState();
  const { activeTenantId } = useTenantStore.getState();
  const tenantId = activeTenantId ?? authTenantId;

  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (tenantId) headers['X-Tenant-Id'] = tenantId;

  const response = await fetch('/api/v1/media/upload', {
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
  return `/api/v1/media/${id}/download`;
}
