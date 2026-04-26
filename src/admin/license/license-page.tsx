// License admin page — full-surface view over ILicenseStatus.
//
// Brownfield note (R5.1 Phase 2 Task P audit):
//   `src/admin/system/license-card.tsx` already ships a condensed license panel
//   embedded inside /admin/system. This page is the dedicated License admin
//   surface: it re-uses the same `useSystemLicense()` hook but renders a
//   StatCard + full feature matrix + license-key upload flow, aligned with
//   the Phase 0 primitives (StatCard / StatusBadge variant="license" /
//   CopyButton / ConfirmDialog).
//
// Backend shape (`GET /api/v1/management/system/license`) returns statuses
// from `ILicenseStatus.LastResult.ToString()` — currently `Valid` / `Expired`
// / `Invalid` / `NotFound`. These are mapped to the canonical StatusBadge
// license variants (`active` / `expired` / `invalid`) via `toBadgeStatus` so
// the badge renders correctly without any backend change.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { differenceInDays, parseISO } from 'date-fns';
import { AlertTriangle, Clock, Shield, ShieldX, Upload } from 'lucide-react';

import { Button } from '@/core/ui/button';
import { Textarea } from '@/core/ui/textarea';
import { Label } from '@/core/ui/label';
import { Separator } from '@/core/ui/separator';
import { StatCard } from '@/core/ui/stat-card';
import { StatusBadge } from '@/core/ui/status-badge';
import { CopyButton } from '@/core/ui/copy-button';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import { useFormatDate } from '@/core/i18n/use-format';
import {
  useSystemLicense,
  useUpdateLicense,
} from '@/core/api/hooks/use-system';

// ─── Status mapping ──────────────────────────────────────────────────────────

// The backend emits `LicenseValidationResult` values (Valid / Expired /
// Invalid / NotFound / GracePeriod). StatusBadge variant="license" uses the
// canonical `active / grace / expired / invalid` set. This small adapter
// bridges the two so we don't push backend rename churn into the UI layer.
// PC.4 (R5.2): `inGrace` from the new DTO field overrides the raw status to
// favour the canonical `grace` badge whenever the LicenseGuard reports the
// system is currently in the post-expiry grace window.
function toBadgeStatus(status: string, inGrace: boolean): string {
  if (inGrace) return 'grace';
  switch (status.toLowerCase()) {
    case 'valid':
      return 'active';
    case 'graceperiod':
    case 'grace_period':
      return 'grace';
    case 'expired':
      return 'expired';
    case 'invalid':
      return 'invalid';
    case 'notfound':
    case 'not_found':
    case 'not-found':
      return 'invalid';
    default:
      return status;
  }
}

// Parses System.Text.Json's default TimeSpan format ("d.hh:mm:ss" or
// "hh:mm:ss" for sub-day spans) into a total-seconds number. Returns null
// for malformed/empty input so callers can treat missing values gracefully.
// Exported for the StatCard test harness.
export function parseGraceDuration(value: string | null | undefined): number | null {
  if (!value) return null;
  // System.Text.Json emits hh:mm:ss with optional leading "d." for days and
  // a trailing ".fffffff" for sub-second precision. We only care about whole
  // seconds for display, so a single regex captures the relevant groups.
  const match = /^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(value);
  if (!match) return null;
  // `noUncheckedIndexedAccess` widens captured groups to `string | undefined`
  // even though groups 2-4 are guaranteed by the anchored regex; coerce with
  // `?? '0'` so the parser stays total without sacrificing the type contract.
  const [, days, hours, minutes, seconds] = match;
  const d = days ? Number.parseInt(days, 10) : 0;
  const h = Number.parseInt(hours ?? '0', 10);
  const m = Number.parseInt(minutes ?? '0', 10);
  const s = Number.parseInt(seconds ?? '0', 10);
  return d * 86_400 + h * 3_600 + m * 60 + s;
}

// Renders a grace-window remaining duration as the largest sensible unit:
// `5d 4h` for multi-day, `4h 30m` under 24h, `30m` under an hour. Falls
// back to `--` when the input is null/unparseable.
function formatGraceRemaining(value: string | null | undefined): string {
  const totalSeconds = parseGraceDuration(value);
  if (totalSeconds === null || totalSeconds < 0) return '--';
  if (totalSeconds === 0) return '0m';
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

// Converts enum-style feature keys ("Dialer", "CallAnalytics", "AgentAssist")
// into human-readable labels by inserting a space before camel-case segments.
// Kept in the page rather than a shared util because it's narrowly scoped to
// `LicenseFeature` values from the backend.
function featureLabel(key: string): string {
  return key.replaceAll(/([a-z])([A-Z])/g, '$1 $2');
}

// Last-4 mask for the license ID. Returns the whole ID if it's shorter than
// 4 characters — callers typically render "—" for null/empty values upstream.
function maskLicenseId(id: string): string {
  if (id.length <= 4) return id;
  return `•••• ${id.slice(-4)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LicensePage() {
  const { t } = useTranslation(['admin']);
  const { formatDate, formatRelative } = useFormatDate();

  const { data: license, isLoading } = useSystemLicense();
  const update = useUpdateLicense();

  const [keyInput, setKeyInput] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // React Compiler auto-memoizes these; no `useMemo` wrapper needed.
  // `daysLeft` is `null` when the license has no expiration (perpetual).
  const daysLeft: number | null = license?.expiresAt
    ? differenceInDays(parseISO(license.expiresAt), new Date())
    : null;
  const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;
  const isExpired = daysLeft !== null && daysLeft <= 0;

  if (isLoading || !license) {
    return (
      <div className="space-y-6" data-testid="license-page">
        <h1 className="font-heading text-2xl font-semibold">
          {t('admin:license.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('admin:license.loading')}</p>
      </div>
    );
  }

  const badgeStatus = toBadgeStatus(license.status, license.inGrace);

  const tierValue = license.licensee ?? t('admin:license.tier_unknown');
  const expiryDescription = license.expiresAt
    ? formatDate(license.expiresAt)
    : t('admin:license.perpetual');
  const expiryExtra = (() => {
    if (isExpired) return t('admin:license.expired_label');
    if (daysLeft !== null)
      return t('admin:license.expires_in_days', { days: daysLeft });
    return '';
  })();

  // R5.2 PC.4 / triage limitation #11 — grace state derived from new DTO
  // fields. The card is rendered with a grace badge + remaining duration
  // when the LicenseGuard reports we're inside the post-expiry window;
  // the blocked banner takes precedence when grace has been exhausted.
  const graceRemainingLabel = formatGraceRemaining(license.gracePeriodRemaining);

  return (
    <div className="space-y-8" data-testid="license-page">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">
          {t('admin:license.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('admin:license.subtitle')}
        </p>
      </div>

      {/* Summary row: tier + expiration + nodes/grace.
       *
       * PC.4: when `inGrace` is true the third StatCard pivots from
       * "Max Nodes" to a Grace card so the operator sees the remaining
       * window first; max-nodes information is still reachable via the
       * standard system page. */}
      <section className="grid gap-4 md:grid-cols-3" data-testid="license-summary">
        <StatCard
          icon={<Shield className="h-4 w-4" aria-hidden="true" />}
          label={t('admin:license.tier')}
          value={tierValue}
          description={
            license.licenseId ? maskLicenseId(license.licenseId) : '—'
          }
          statusBadge={<StatusBadge status={badgeStatus} variant="license" />}
        />
        <StatCard
          label={t('admin:license.expiration')}
          value={expiryDescription}
          description={expiryExtra}
        />
        {license.inGrace ? (
          // StatCard does not surface an extra wrapper element for testid,
          // so we wrap it in a sentinel div for the test harness to query.
          <div data-testid="license-grace-card">
            <StatCard
              icon={<Clock className="h-4 w-4" aria-hidden="true" />}
              label={t('admin:license.grace_remaining')}
              value={graceRemainingLabel}
              description={t('admin:license.grace_description')}
              statusBadge={<StatusBadge status="grace" variant="license" />}
            />
          </div>
        ) : (
          <StatCard
            label={t('admin:license.max_nodes')}
            value={license.maxNodes}
            description={t('admin:license.last_validated', {
              at: formatRelative(license.lastValidatedAt),
            })}
          />
        )}
      </section>

      {/* Blocked banner — PC.4: takes precedence over expiring-soon styling
          when LicenseGuard reports the grace window is fully exhausted and
          features can no longer authorize. */}
      {license.blocked && (
        <div
          data-testid="license-blocked-banner"
          className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          <ShieldX className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('admin:license.warning_blocked')}
        </div>
      )}

      {/* Expiration warning banner */}
      {!license.blocked && (isExpiringSoon || isExpired) && (
        <div
          data-testid="license-warning-banner"
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
            isExpired
              ? 'bg-destructive/10 text-destructive'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
          }`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {isExpired
            ? t('admin:license.warning_expired')
            : t('admin:license.warning_expiring_soon', {
                days: daysLeft,
              })}
        </div>
      )}

      {/* Key metadata row */}
      {license.licenseId && (
        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('admin:license.license_id')}
              </p>
              <p
                className="truncate font-mono text-sm text-foreground"
                data-testid="license-id-masked"
              >
                {maskLicenseId(license.licenseId)}
              </p>
            </div>
            <CopyButton
              value={license.licenseId}
              label={t('admin:license.copy_id')}
              size="sm"
              variant="outline"
            />
          </div>
        </section>
      )}

      <Separator />

      {/* Feature matrix */}
      <section className="space-y-3" data-testid="license-feature-matrix">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t('admin:license.features_title')}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('admin:license.features_subtitle')}
          </p>
        </div>
        {license.licensedFeatures.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('admin:license.no_features')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">
                    {t('admin:license.feature_name')}
                  </th>
                  <th className="px-4 py-2 text-right font-semibold">
                    {t('admin:license.feature_state')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {license.licensedFeatures.map((feature) => (
                  <tr
                    key={feature}
                    className="border-t"
                    data-testid={`feature-row-${feature.toLowerCase()}`}
                  >
                    <td className="px-4 py-2 text-foreground">
                      {featureLabel(feature)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <StatusBadge status="active" variant="license" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Separator />

      {/* Upload section */}
      <section className="space-y-3" data-testid="license-upload">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t('admin:license.upload_title')}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('admin:license.upload_subtitle')}
          </p>
        </div>
        <form
          className="max-w-2xl space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!keyInput.trim()) return;
            setConfirmOpen(true);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="license-key-input">
              {t('admin:license.key_label')}
            </Label>
            <Textarea
              id="license-key-input"
              data-testid="license-key-input"
              rows={6}
              placeholder="-----BEGIN LICENSE-----"
              className="font-mono text-xs"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            data-testid="license-submit-button"
            disabled={!keyInput.trim() || update.isPending}
          >
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('admin:license.submit')}
          </Button>
        </form>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('admin:license.confirm_title')}
        description={t('admin:license.confirm_description')}
        confirmLabel={t('admin:license.submit')}
        variant="destructive"
        data-testid="license-confirm-dialog"
        onConfirm={() => {
          update.mutate(
            { licenseKey: keyInput.trim() },
            {
              onSettled: () => {
                setConfirmOpen(false);
                setKeyInput('');
              },
            }
          );
        }}
      />
    </div>
  );
}
