// R5.2 PB.2 — admin impersonation session-management page.
//
// PlatformAdmin-only surface (gated by `security.impersonation.manage`,
// seeded P0.9 + wired in `router.tsx`). Provides:
//   - Active sessions DataTable with live countdown to auto-timeout (ticks
//     every 5s client-side; the server returns a fresh `timeRemainingSeconds`
//     once a minute via React Query refetchInterval).
//   - Manual revoke flow with a Reason input that is logged in the audit
//     trail (`impersonation.session.revoked`).
//   - History view (toggleable tab) with duration + outcome (manual revoke,
//     auto-timeout, completed).
//
// Brownfield audit:
//   - DataTable + StatusBadge primitives ship from R5.1 (Phase 0/2).
//   - PageHeader + LazyLoad scaffolding identical to the MFA / Audit pages.

import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ShieldAlert, ShieldOff, Clock, LogOut, History as HistoryIcon } from 'lucide-react';

import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/core/ui/dialog';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { useFormatDate } from '@/core/i18n/use-format';
import {
  useActiveImpersonationSessions,
  useImpersonationSessionHistory,
  useRevokeImpersonationSession,
  type ImpersonationSessionDto,
  type ImpersonationSessionStatus,
} from './use-impersonation-sessions';

const col = createColumnHelper<ImpersonationSessionDto>();

interface CountdownProps {
  readonly session: ImpersonationSessionDto;
  readonly nowMs: number;
  readonly t: TFunction;
}

/**
 * Live remaining-time pill. Anchored to the page's `nowMs` tick (shared by
 * every row to keep all countdowns in lockstep). Falls back to "—" when the
 * server didn't compute a remaining value (auto-timeout disabled for tenant).
 *
 * Simple model: each server poll returns `timeRemainingSeconds` derived from
 * `(startedAt + autoTimeoutMinutes) - serverNow`. Between polls we tick down
 * client-side from the (cached) deadline = `serverPollMs + remaining*1000`.
 * To stay numerically stable we re-derive deadline from the immutable
 * `startedAt` plus the remaining-budget snapshot recorded at first render.
 */
function CountdownCell({ session, nowMs, t }: CountdownProps) {
  if (session.expiresAt === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  // Server-provided absolute deadline keeps the countdown stable across
  // re-renders without per-component refs (drift was the bug from the
  // earlier `timeRemainingSeconds + nowMs` formulation).
  const deadlineMs = Date.parse(session.expiresAt);
  const remaining = Math.max(0, Math.floor((deadlineMs - nowMs) / 1000));

  if (remaining <= 0) {
    return (
      <Badge variant="destructive" data-testid={`impersonation-countdown-${session.id}`}>
        <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
        {t('admin:security_admin.impersonation.live.expired')}
      </Badge>
    );
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const label = minutes > 0
    ? t('admin:security_admin.impersonation.live.minutes_remaining', { minutes })
    : t('admin:security_admin.impersonation.live.seconds_remaining', { seconds });

  return (
    <span
      className="font-mono text-sm text-muted-foreground"
      data-testid={`impersonation-countdown-${session.id}`}
    >
      {label}
    </span>
  );
}

interface OutcomeBadgeProps {
  readonly status: ImpersonationSessionStatus;
  readonly t: TFunction;
}

function OutcomeBadge({ status, t }: OutcomeBadgeProps) {
  const map: Record<ImpersonationSessionStatus, {
    variant: 'default' | 'secondary' | 'destructive';
    key: string;
    icon: typeof ShieldAlert;
  }> = {
    Active: {
      variant: 'default',
      key: 'admin:security_admin.impersonation.tabs.active',
      icon: ShieldAlert,
    },
    Completed: {
      variant: 'secondary',
      key: 'admin:security_admin.impersonation.outcome.completed',
      icon: ShieldOff,
    },
    ManuallyRevoked: {
      variant: 'destructive',
      key: 'admin:security_admin.impersonation.outcome.manually_revoked',
      icon: LogOut,
    },
    AutoTimedOut: {
      variant: 'destructive',
      key: 'admin:security_admin.impersonation.outcome.auto_timed_out',
      icon: Clock,
    },
  };
  const cfg = map[status];
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} data-testid={`impersonation-outcome-${status}`}>
      <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
      {t(cfg.key)}
    </Badge>
  );
}

interface RevokeDialogProps {
  readonly target: ImpersonationSessionDto | null;
  readonly onClose: () => void;
  readonly onConfirm: (reason: string) => void;
  readonly isPending: boolean;
  readonly t: TFunction;
}

function RevokeDialog({ target, onClose, onConfirm, isPending, t }: RevokeDialogProps) {
  const [reason, setReason] = useState('');
  // Reset textarea when the dialog gets a different target or closes. Legitimate
  // because the parent may force-close by setting target=null after revoke
  // settles, which doesn't fire Dialog's onOpenChange.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (target === null) setReason('');
  }, [target]);

  const open = target !== null;
  const disabled = isPending || reason.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('admin:security_admin.impersonation.actions.revoke')}
          </DialogTitle>
          <DialogDescription>
            {target
              ? `${target.actorUserId} → ${target.targetTenantId}`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="impersonation-revoke-reason" className="text-xs">
            {t('admin:security_admin.impersonation.confirm.reason_label')}
          </Label>
          <Input
            id="impersonation-revoke-reason"
            data-testid="impersonation-revoke-reason"
            placeholder={t('admin:security_admin.impersonation.confirm.reason_placeholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            data-testid="impersonation-revoke-confirm"
            onClick={() => onConfirm(reason.trim())}
            disabled={disabled}
          >
            {t('admin:security_admin.impersonation.actions.revoke')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type TabKey = 'active' | 'history';

export default function ImpersonationAdminPage() {
  const { t } = useTranslation(['admin']);
  const { formatDate, formatRelative } = useFormatDate();

  const [tab, setTab] = useState<TabKey>('active');
  const [revokeTarget, setRevokeTarget] = useState<ImpersonationSessionDto | null>(null);

  const active = useActiveImpersonationSessions({ page: 1, pageSize: 50 });
  const history = useImpersonationSessionHistory({ page: 1, pageSize: 50 });
  const revoke = useRevokeImpersonationSession();

  // Shared client-side clock for countdown rendering. Ticks every 5s.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (tab !== 'active') return;
    const id = globalThis.setInterval(() => setNowMs(Date.now()), 5_000);
    return () => globalThis.clearInterval(id);
  }, [tab]);

  const activeSessions = active.data?.items ?? [];
  const historySessions = history.data?.items ?? [];

  const activeColumns = useMemo<ColumnDef<ImpersonationSessionDto>[]>(
    () => [
      col.accessor('actorUserId', {
        header: () => t('admin:security_admin.impersonation.columns.actor'),
        cell: (info) => (
          <div
            className="flex flex-col"
            data-testid={`impersonation-actor-${info.row.original.id}`}
          >
            <span className="font-medium">{info.getValue()}</span>
            <span className="text-xs text-muted-foreground">{info.row.original.actorTenantId}</span>
          </div>
        ),
      }),
      col.accessor('targetTenantId', {
        header: () => t('admin:security_admin.impersonation.columns.target'),
        cell: (info) => (
          <span
            className="text-sm text-muted-foreground"
            data-testid={`impersonation-target-${info.row.original.id}`}
          >
            {info.getValue()}
          </span>
        ),
      }),
      col.accessor('startedAt', {
        header: () => t('admin:security_admin.impersonation.columns.started'),
        cell: (info) => (
          <span title={formatDate(info.getValue())}>
            {formatRelative(info.getValue())}
          </span>
        ),
      }),
      col.accessor('reason', {
        header: () => t('admin:security_admin.impersonation.columns.reason'),
        cell: (info) => {
          const value = info.getValue();
          return value
            ? <span className="text-sm">{value}</span>
            : <span className="text-muted-foreground">—</span>;
        },
      }),
      col.display({
        id: 'time-remaining',
        header: () => t('admin:security_admin.impersonation.columns.time_remaining'),
        cell: ({ row }) => <CountdownCell session={row.original} nowMs={nowMs} t={t} />,
      }),
      col.display({
        id: 'actions',
        header: () => t('admin:security_admin.impersonation.columns.actions'),
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive hover:text-destructive"
            onClick={() => setRevokeTarget(row.original)}
            data-testid={`impersonation-revoke-${row.original.id}`}
            aria-label={t('admin:security_admin.impersonation.actions.revoke')}
          >
            <LogOut className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {t('admin:security_admin.impersonation.actions.revoke')}
          </Button>
        ),
      }),
    ] as unknown as ColumnDef<ImpersonationSessionDto>[],
    [t, nowMs, formatDate, formatRelative],
  );

  const historyColumns = useMemo<ColumnDef<ImpersonationSessionDto>[]>(
    () => [
      col.accessor('actorUserId', {
        header: () => t('admin:security_admin.impersonation.columns.actor'),
        cell: (info) => (
          <div className="flex flex-col">
            <span className="font-medium">{info.getValue()}</span>
            <span className="text-xs text-muted-foreground">{info.row.original.actorTenantId}</span>
          </div>
        ),
      }),
      col.accessor('targetTenantId', {
        header: () => t('admin:security_admin.impersonation.columns.target'),
        cell: (info) => <span className="text-sm text-muted-foreground">{info.getValue()}</span>,
      }),
      col.accessor('startedAt', {
        header: () => t('admin:security_admin.impersonation.columns.started'),
        cell: (info) => <span title={formatDate(info.getValue())}>{formatRelative(info.getValue())}</span>,
      }),
      col.accessor('endedAt', {
        header: () => t('admin:security_admin.impersonation.columns.ended'),
        cell: (info) => {
          const value = info.getValue();
          return value
            ? <span title={formatDate(value)}>{formatRelative(value)}</span>
            : <span className="text-muted-foreground">—</span>;
        },
      }),
      col.display({
        id: 'duration',
        header: () => t('admin:security_admin.impersonation.columns.duration'),
        cell: ({ row }) => {
          const start = Date.parse(row.original.startedAt);
          const end = row.original.endedAt ? Date.parse(row.original.endedAt) : Number.NaN;
          if (Number.isNaN(end)) return <span className="text-muted-foreground">—</span>;
          const seconds = Math.max(0, Math.round((end - start) / 1000));
          const minutes = Math.floor(seconds / 60);
          return (
            <span className="font-mono text-sm">
              {minutes >= 1 ? `${minutes}m` : `${seconds}s`}
            </span>
          );
        },
      }),
      col.accessor('status', {
        header: () => t('admin:security_admin.impersonation.columns.outcome'),
        cell: (info) => <OutcomeBadge status={info.getValue()} t={t} />,
      }),
    ] as unknown as ColumnDef<ImpersonationSessionDto>[],
    [t, formatDate, formatRelative],
  );

  return (
    <div className="space-y-6" data-testid="impersonation-admin-page">
      <PageHeader
        title={t('admin:security_admin.impersonation.title')}
        description={t('admin:security_admin.impersonation.description')}
      />

      {/* Tab toggle (active vs history) — minimal segmented control to avoid
          pulling in another primitive just for two tabs. */}
      <div className="flex gap-1 rounded-lg border bg-card p-1 text-sm shadow-sm w-fit"
        data-testid="impersonation-admin-tabs">
        <button
          type="button"
          data-testid="impersonation-admin-tab-active"
          onClick={() => setTab('active')}
          className={
            tab === 'active'
              ? 'rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground'
              : 'rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground'
          }
        >
          <ShieldAlert className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          {t('admin:security_admin.impersonation.tabs.active')}
        </button>
        <button
          type="button"
          data-testid="impersonation-admin-tab-history"
          onClick={() => setTab('history')}
          className={
            tab === 'history'
              ? 'rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground'
              : 'rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground'
          }
        >
          <HistoryIcon className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          {t('admin:security_admin.impersonation.tabs.history')}
        </button>
      </div>

      {tab === 'active' && (
        <ActiveSection
          isLoading={active.isLoading}
          sessions={activeSessions}
          columns={activeColumns}
          t={t}
        />
      )}
      {tab === 'history' && (
        <HistorySection
          isLoading={history.isLoading}
          sessions={historySessions}
          columns={historyColumns}
          t={t}
        />
      )}

      <RevokeDialog
        target={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={(reason) => {
          if (revokeTarget === null) return;
          revoke.mutate(
            { id: revokeTarget.id, reason },
            { onSettled: () => setRevokeTarget(null) },
          );
        }}
        isPending={revoke.isPending}
        t={t}
      />
    </div>
  );
}

interface SectionProps {
  readonly isLoading: boolean;
  readonly sessions: ReadonlyArray<ImpersonationSessionDto>;
  readonly columns: ColumnDef<ImpersonationSessionDto>[];
  readonly t: TFunction;
}

function ActiveSection({ isLoading, sessions, columns, t }: SectionProps) {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="impersonation-admin-loading">
        {t('admin:security_admin.impersonation.loading')}
      </p>
    );
  }
  if (sessions.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center"
        data-testid="impersonation-admin-empty-active"
      >
        <ShieldOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {t('admin:security_admin.impersonation.empty_active')}
        </p>
      </div>
    );
  }
  return <DataTable data={[...sessions]} columns={columns} />;
}

function HistorySection({ isLoading, sessions, columns, t }: SectionProps) {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="impersonation-admin-loading">
        {t('admin:security_admin.impersonation.loading')}
      </p>
    );
  }
  if (sessions.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center"
        data-testid="impersonation-admin-empty-history"
      >
        <HistoryIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {t('admin:security_admin.impersonation.empty_history')}
        </p>
      </div>
    );
  }
  return <DataTable data={[...sessions]} columns={columns} />;
}
