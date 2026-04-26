// R5.2 PC.1 — retention admin hooks backing the DryRun toggle + per-target
// overview + manual run-now flows. Wraps GET/POST/PATCH /management/retention/*.
//
// Backend gates: retention.read (list/config) + retention.manage (run-now/patch).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/core/auth/auth-store';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RetentionTargetDto {
  readonly name: string;
  readonly schema: string;
  readonly table: string;
  readonly windowDays: number;
  readonly lastExecutionAt: string | null;
  readonly lastRowsPurged: number | null;
  readonly lastStatus: string | null;
  readonly lastWasDryRun: boolean;
}

export interface RetentionConfigDto {
  readonly dryRun: boolean;
  readonly defaultWindowDays: number;
  readonly batchSize: number;
  readonly cronExpression: string;
  readonly registeredTargetCount: number;
}

export interface RetentionRunTargetOutcomeDto {
  readonly name: string;
  readonly status: string;
  readonly rowsPurged: number;
  readonly errorMessage: string | null;
  readonly durationMs: number;
}

export interface RetentionRunResultDto {
  readonly dryRun: boolean;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly targets: ReadonlyArray<RetentionRunTargetOutcomeDto>;
}

// ─── Query keys ──────────────────────────────────────────────────────────────

export const retentionKeys = {
  all: ['retention'] as const,
  targets: () => [...retentionKeys.all, 'targets'] as const,
  config: () => [...retentionKeys.all, 'config'] as const,
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useRetentionTargets() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: retentionKeys.targets(),
    queryFn: async (): Promise<ReadonlyArray<RetentionTargetDto>> => {
      const res = await fetch('/api/v1/management/retention/targets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to load retention targets: ${res.status}`);
      return (await res.json()) as ReadonlyArray<RetentionTargetDto>;
    },
    enabled: !!token,
  });
}

export function useRetentionConfig() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: retentionKeys.config(),
    queryFn: async (): Promise<RetentionConfigDto> => {
      const res = await fetch('/api/v1/management/retention/config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to load retention config: ${res.status}`);
      return (await res.json()) as RetentionConfigDto;
    },
    enabled: !!token,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useRunRetentionNow() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dryRun,
      target,
    }: {
      dryRun: boolean;
      target?: string;
    }): Promise<RetentionRunResultDto> => {
      const url = new URL('/api/v1/management/retention/run-now', window.location.origin);
      url.searchParams.set('dryRun', String(dryRun));
      if (target) url.searchParams.set('target', target);
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to run retention: ${res.status}`);
      return (await res.json()) as RetentionRunResultDto;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: retentionKeys.targets() });
    },
  });
}

export function useToggleDryRun() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (newValue: boolean): Promise<RetentionConfigDto> => {
      const res = await fetch('/api/v1/management/retention/config', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun: newValue }),
      });
      if (!res.ok) throw new Error(`Failed to toggle DryRun: ${res.status}`);
      return (await res.json()) as RetentionConfigDto;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: retentionKeys.config() });
    },
  });
}
