// P2 Web — Trunk connectivity-test result panel.
//
// Renders the diagnostic returned by `useTestTrunkConnectivity` as a clear
// semáforo (overall green/red verdict) plus per-check rows, then the raw
// server `messages[]` list verbatim (they are Spanish diagnostics, NOT i18n
// keys). The visible per-check rows depend on the resolved `authMode`:
//   - `register`  → show the Registro (registered) row.
//   - `ip-acl`    → show the IP-ACL identify (identifyPresent) row.
//   - `none`      → neither auth row (only Endpoint + Reachable).
// Every tri-state check renders ✓ (true) / ✗ (false) / — (null = "no aplica").

import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, MinusCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/core/ui/dialog';
import type { TrunkConnectivityResult } from '@/core/api/hooks/use-trunks';

export interface TrunkConnectivityDialogProps {
  /** Null closes the dialog; a non-null id opens it (anchored to that trunk). */
  readonly trunkName: string | null;
  readonly result: TrunkConnectivityResult | null;
  readonly isPending: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** Renders a tri-state check icon: ✓ pass, ✗ fail, — not-applicable/unknown. */
function CheckIcon({ value }: { value: boolean | null }) {
  if (value === true) {
    return (
      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
    );
  }
  if (value === false) {
    return <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />;
  }
  return <MinusCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
}

/** A single labelled check row with a tri-state outcome. */
function CheckRow({
  testid,
  label,
  value,
}: {
  testid: string;
  label: string;
  value: boolean | null;
}) {
  const { t } = useTranslation('admin');
  const stateLabel =
    value === true
      ? t('trunks.connectivity.pass')
      : value === false
        ? t('trunks.connectivity.fail')
        : t('trunks.connectivity.notApplicable');
  return (
    <div
      className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0"
      data-testid={testid}
      data-check-value={value === null ? 'null' : String(value)}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <CheckIcon value={value} />
        {stateLabel}
      </span>
    </div>
  );
}

export function TrunkConnectivityDialog({
  trunkName,
  result,
  isPending,
  onOpenChange,
}: TrunkConnectivityDialogProps) {
  const { t } = useTranslation('admin');

  // Open while we have a target trunk (either testing in-flight or a result).
  const open = trunkName !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="trunk-connectivity-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('trunks.connectivity.dialogTitle')}</DialogTitle>
        </DialogHeader>

        {isPending || !result ? (
          <div
            className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
            data-testid="trunk-connectivity-loading"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t('trunks.connectivity.loading')}
          </div>
        ) : (
          <div className="space-y-4" data-connectivity-ok={result.ok}>
            {/* Semáforo — overall verdict. */}
            <div
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3',
                result.ok
                  ? 'border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-destructive/30 bg-destructive/10 text-destructive',
              )}
              data-testid="trunk-connectivity-verdict"
            >
              {result.ok ? (
                <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden="true" />
              ) : (
                <XCircle className="h-6 w-6 shrink-0" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {result.ok
                    ? t('trunks.connectivity.verdictOk')
                    : t('trunks.connectivity.verdictFail')}
                </p>
                <p className="truncate text-xs opacity-80">{result.endpointId}</p>
              </div>
            </div>

            {/* Per-check rows. */}
            <div className="rounded-lg border px-3">
              <CheckRow
                testid="trunk-connectivity-check-endpoint"
                label={t('trunks.connectivity.checks.endpoint')}
                value={result.endpointFound}
              />
              <CheckRow
                testid="trunk-connectivity-check-reachable"
                label={t('trunks.connectivity.checks.reachable')}
                value={result.reachable}
              />
              {result.authMode === 'register' && (
                <CheckRow
                  testid="trunk-connectivity-check-registered"
                  label={t('trunks.connectivity.checks.registered')}
                  value={result.registered}
                />
              )}
              {result.authMode === 'ip-acl' && (
                <CheckRow
                  testid="trunk-connectivity-check-identify"
                  label={t('trunks.connectivity.checks.identify')}
                  value={result.identifyPresent}
                />
              )}
              <div
                className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0"
                data-testid="trunk-connectivity-check-authMode"
              >
                <span className="text-sm text-muted-foreground">
                  {t('trunks.connectivity.checks.authMode')}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {t(`trunks.connectivity.authMode.${result.authMode}`)}
                </span>
              </div>
            </div>

            {/* Raw server diagnostics — rendered verbatim (NOT i18n keys). */}
            {result.messages.length > 0 ? (
              <ul
                className="space-y-1 rounded-lg bg-muted p-3 text-xs text-muted-foreground"
                data-testid="trunk-connectivity-messages"
              >
                {result.messages.map((msg, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span aria-hidden="true">·</span>
                    <span>{msg}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className="rounded-lg bg-muted p-3 text-xs text-muted-foreground"
                data-testid="trunk-connectivity-messages-empty"
              >
                {t('trunks.connectivity.noMessages')}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
