import { useEffect, useState, useCallback } from 'react';
import { Shield, X } from 'lucide-react';
import { useAuthStore } from './auth-store';
import { useEndImpersonate } from '@/core/api/hooks/use-impersonation';

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function ImpersonationBanner() {
  const impersonation = useAuthStore((s) => s.impersonation);
  const endImpersonationStore = useAuthStore((s) => s.endImpersonation);
  const endImpersonate = useEndImpersonate();
  const [remaining, setRemaining] = useState(0);

  const handleEnd = useCallback(() => {
    endImpersonate.mutate(undefined, {
      onError: () => {
        // Even if the API call fails, restore the original token
        endImpersonationStore();
      },
    });
  }, [endImpersonate, endImpersonationStore]);

  useEffect(() => {
    if (!impersonation?.active) return;

    const update = () => {
      const left = impersonation.expiresAt - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        endImpersonationStore();
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [impersonation?.active, impersonation?.expiresAt, endImpersonationStore]);

  if (!impersonation?.active) return null;

  return (
    <div
      data-testid="impersonation-banner"
      className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-white"
    >
      <Shield className="h-4 w-4" />
      <span>
        Operating as <strong>{impersonation.targetTenantName}</strong>
      </span>
      {impersonation.readOnly && (
        <span className="rounded bg-amber-700 px-1.5 py-0.5 text-xs">Read-Only</span>
      )}
      <span className="font-mono">{formatTimeRemaining(remaining)}</span>
      <button
        onClick={handleEnd}
        className="ml-2 inline-flex items-center gap-1 rounded bg-amber-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
      >
        <X className="h-3 w-3" />
        End Impersonation
      </button>
    </div>
  );
}
