import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Shield, ShieldCheck, Download, KeyRound, Lock, RefreshCw, LogOut as LogOutIcon,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/core/ui/button';
import { CopyButton } from '@/core/ui/copy-button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Badge } from '@/core/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/core/ui/dialog';
import { useMe, isLockedOut, type Me } from '@/core/api/hooks/use-me';
import {
  useSetupMfa, useConfirmMfa, useDisableMfa,
  useChangePassword,
  useMySessions, useRevokeSession, useRevokeOtherSessions,
  useRegenerateRecoveryCodes, usePasswordPolicy,
  type UserSession, type MfaSetupResponse,
} from '@/core/api/hooks/use-auth-admin';

export default function SecurityPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { data: me, isLoading: meLoading } = useMe();

  if (meLoading || !me) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <h1 className="font-heading text-2xl font-semibold">
          {t('admin:security.title')}
        </h1>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const locked = isLockedOut(me);
  const isOidc = me.authProvider === 'oidc';

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6" data-testid="security-page">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">
          {t('admin:security.title')}
        </h1>
        {isOidc && (
          <Badge variant="secondary" data-testid="security-oidc-badge">
            {t('admin:security.oidc_badge')}
          </Badge>
        )}
      </div>

      {locked && (
        <div
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          data-testid="security-lockout-banner"
        >
          {t('admin:security.account_locked', {
            time: new Date(me.lockedUntil!).toLocaleString(),
          })}
        </div>
      )}

      <MfaSection me={me} locked={locked} />
      {!isOidc && <PasswordSection locked={locked} />}
      <SessionsSection locked={locked} />
    </div>
  );
}

// ------------------------------------------------------------
// MFA section
// ------------------------------------------------------------

function MfaSection({ me, locked }: Readonly<{ me: Me; locked: boolean }>) {
  const { t } = useTranslation(['admin', 'common']);
  const setupMfa = useSetupMfa();
  const confirmMfa = useConfirmMfa();
  const disableMfa = useDisableMfa();
  const regenerate = useRegenerateRecoveryCodes();

  const [setupData, setSetupData] = useState<MfaSetupResponse | null>(null);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify' | 'codes'>('idle');
  const [verifyCode, setVerifyCode] = useState('');
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regeneratePassword, setRegeneratePassword] = useState('');
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  // TODO(v1.7.0): add MfaPolicy to /users/me response so UI can hide Disable proactively.
  // For v1.6.0, we rely on the backend 403 response when tenant policy blocks disable.
  const mfaRequired = false;

  async function handleSetup() {
    const data = await setupMfa.mutateAsync();
    setSetupData(data);
    setSetupStep('qr');
  }

  async function handleConfirm() {
    await confirmMfa.mutateAsync(verifyCode);
    setSetupStep('codes');
    setVerifyCode('');
  }

  async function handleDisable() {
    await disableMfa.mutateAsync(disablePassword);
    setDisableOpen(false);
    setDisablePassword('');
  }

  async function handleRegenerate() {
    const res = await regenerate.mutateAsync(regeneratePassword);
    setNewCodes(res.recoveryCodes);
    setRegenerateOpen(false);
    setRegeneratePassword('');
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {me.mfaEnabled ? (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          ) : (
            <Shield className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <h3 className="font-medium">{t('admin:security.mfa')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('admin:security.mfa_description')}
            </p>
          </div>
        </div>
        <Badge
          data-testid="security-mfa-status"
          data-status={me.mfaEnabled ? 'enabled' : 'disabled'}
          variant={me.mfaEnabled ? 'default' : 'secondary'}
        >
          {me.mfaEnabled ? t('common:status.enabled') : t('common:status.disabled')}
        </Badge>
      </div>

      {!me.mfaEnabled && mfaRequired && (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
          data-testid="security-mfa-required-banner"
        >
          {t('admin:security.mfa_required_banner')}{' '}
          {t('admin:security.mfa_required_enroll')}
        </div>
      )}

      {setupStep === 'idle' && !me.mfaEnabled && (
        <Button
          data-testid="security-mfa-enable"
          onClick={() => void handleSetup()}
          disabled={locked || setupMfa.isPending}
        >
          {t('admin:security.enable_mfa')}
        </Button>
      )}

      {setupStep === 'idle' && me.mfaEnabled && (
        <div className="flex gap-2">
          {!mfaRequired && (
            <Button
              data-testid="security-mfa-disable"
              variant="destructive"
              onClick={() => setDisableOpen(true)}
              disabled={locked}
            >
              {t('admin:security.disable_mfa')}
            </Button>
          )}
          <Button
            data-testid="security-mfa-regenerate"
            variant="outline"
            onClick={() => setRegenerateOpen(true)}
            disabled={locked}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            {t('admin:security.regenerate_recovery_codes')}
          </Button>
        </div>
      )}

      {/* Setup: QR code step */}
      {setupStep === 'qr' && setupData && (
        <div className="space-y-4 border-t pt-4">
          <p className="text-sm">{t('admin:security.scan_qr')}</p>
          <div className="flex justify-center">
            <div
              data-testid="security-mfa-qrcode"
              className="rounded-lg border bg-white p-4"
            >
              <QRCodeSVG value={setupData.qrUri} size={192} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t('admin:security.manual_key')}
            </p>
            <code className="block rounded bg-muted px-3 py-2 text-sm font-mono break-all">
              {setupData.secret}
            </code>
          </div>
          <Button data-testid="security-mfa-next-verify" onClick={() => setSetupStep('verify')}>
            {t('common:actions.next')}
          </Button>
        </div>
      )}

      {/* Setup: Verify step */}
      {setupStep === 'verify' && (
        <div className="space-y-4 border-t pt-4">
          <p className="text-sm">{t('admin:security.enter_code')}</p>
          <div className="flex gap-2">
            <Input
              data-testid="security-mfa-code"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-32 font-mono text-center"
            />
            <Button
              data-testid="security-mfa-confirm"
              onClick={() => void handleConfirm()}
              disabled={verifyCode.length !== 6 || confirmMfa.isPending}
            >
              {t('common:auth.mfa_verify')}
            </Button>
          </div>
        </div>
      )}

      {/* Setup: Recovery codes step (initial enrollment) */}
      {setupStep === 'codes' && setupData && (
        <RecoveryCodesDisplay
          codes={setupData.recoveryCodes}
          onDone={() => {
            setSetupStep('idle');
            setSetupData(null);
          }}
        />
      )}

      {/* Recovery codes regeneration result */}
      {newCodes && (
        <RecoveryCodesDisplay codes={newCodes} onDone={() => setNewCodes(null)} />
      )}

      {/* Disable MFA dialog */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:security.disable_mfa')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('common:auth.password')}</Label>
            <Input
              type="password"
              data-testid="security-mfa-disable-password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder={t('admin:security.confirm_password_to_disable')}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t('common:actions.cancel')}
            </DialogClose>
            <Button
              data-testid="security-mfa-disable-confirm"
              variant="destructive"
              onClick={() => void handleDisable()}
              disabled={!disablePassword || disableMfa.isPending}
            >
              {t('admin:security.disable_mfa')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate recovery codes dialog */}
      <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:security.regenerate_recovery_codes')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('admin:security.regenerate_confirm')}
          </p>
          <Input
            type="password"
            value={regeneratePassword}
            onChange={(e) => setRegeneratePassword(e.target.value)}
            placeholder={t('common:auth.password')}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t('common:actions.cancel')}
            </DialogClose>
            <Button
              data-testid="security-mfa-regenerate-confirm"
              onClick={() => void handleRegenerate()}
              disabled={!regeneratePassword || regenerate.isPending}
            >
              {t('admin:security.regenerate_recovery_codes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecoveryCodesDisplay({ codes, onDone }: Readonly<{ codes: string[]; onDone: () => void }>) {
  const { t } = useTranslation(['admin', 'common']);
  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-sm font-medium text-amber-600">
        {t('admin:security.save_recovery_codes')}
      </p>
      <div
        data-testid="security-mfa-recovery-codes"
        className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4"
      >
        {codes.map((code, i) => (
          <code key={i} className="text-sm font-mono">{code}</code>
        ))}
      </div>
      <div className="flex gap-2">
        <span data-testid="security-mfa-copy">
          <CopyButton value={codes.join('\n')} variant="outline" label={t('common:actions.copy')} />
        </span>
        <Button
          data-testid="security-mfa-download"
          variant="outline"
          size="sm"
          onClick={() => {
            const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'recovery-codes.txt';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {t('common:actions.download')}
        </Button>
      </div>
      <Button data-testid="security-mfa-done" onClick={onDone}>
        {t('common:actions.done')}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------
// Password section
// ------------------------------------------------------------

function PasswordSection({ locked }: Readonly<{ locked: boolean }>) {
  const { t } = useTranslation(['admin', 'common']);
  const { data: policy } = usePasswordPolicy();
  const changePassword = useChangePassword();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const effective = policy ?? {
    minLength: 12,
    requireUppercase: true,
    requireNumber: true,
    requireSpecial: false,
  };

  const checks = useMemo(() => ({
    length: newPassword.length >= effective.minLength,
    uppercase: !effective.requireUppercase || /[A-Z]/.test(newPassword),
    number: !effective.requireNumber || /[0-9]/.test(newPassword),
    special: !effective.requireSpecial || /[^a-zA-Z0-9]/.test(newPassword),
    match: newPassword === confirmPassword && newPassword.length > 0,
  }), [newPassword, confirmPassword, effective]);

  const allValid = Object.values(checks).every(Boolean);

  async function handleSubmit() {
    await changePassword.mutateAsync({ oldPassword, newPassword });
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-medium">{t('admin:security.change_password')}</h3>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>{t('common:auth.password')}</Label>
          <Input
            type="password"
            data-testid="security-password-old"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            disabled={locked}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('common:auth.new_password')}</Label>
          <Input
            type="password"
            data-testid="security-password-new"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={locked}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('common:auth.confirm_password')}</Label>
          <Input
            type="password"
            data-testid="security-password-confirm"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={locked}
          />
        </div>

        {/* Password policy checklist */}
        <div data-testid="security-password-checklist" className="space-y-1 rounded-md bg-muted p-3 text-sm">
          <p className="font-medium">{t('admin:security.password_policy_title')}</p>
          <ul className="space-y-0.5">
            <li
              data-testid="security-password-rule-length"
              className={checks.length ? 'text-green-600' : 'text-muted-foreground'}
            >
              {checks.length ? '✓' : '○'} {t('admin:security.password_too_short', { n: effective.minLength })}
            </li>
            {effective.requireUppercase && (
              <li
                data-testid="security-password-rule-uppercase"
                className={checks.uppercase ? 'text-green-600' : 'text-muted-foreground'}
              >
                {checks.uppercase ? '✓' : '○'} {t('admin:security.password_needs_uppercase')}
              </li>
            )}
            {effective.requireNumber && (
              <li
                data-testid="security-password-rule-number"
                className={checks.number ? 'text-green-600' : 'text-muted-foreground'}
              >
                {checks.number ? '✓' : '○'} {t('admin:security.password_needs_number')}
              </li>
            )}
            {effective.requireSpecial && (
              <li
                data-testid="security-password-rule-special"
                className={checks.special ? 'text-green-600' : 'text-muted-foreground'}
              >
                {checks.special ? '✓' : '○'} {t('admin:security.password_needs_special')}
              </li>
            )}
          </ul>
        </div>

        <Button
          data-testid="security-password-submit"
          onClick={() => void handleSubmit()}
          disabled={locked || !allValid || !oldPassword || changePassword.isPending}
        >
          {t('admin:security.change_password')}
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Sessions section
// ------------------------------------------------------------

function SessionsSection({ locked }: Readonly<{ locked: boolean }>) {
  const { t } = useTranslation(['admin', 'common']);
  const { data: sessions, isLoading } = useMySessions();
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading sessions…</p>;
  }

  async function handleRevokeAll() {
    await revokeOthers.mutateAsync();
    setRevokeAllOpen(false);
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-medium">{t('admin:security.active_sessions')}</h3>
      </div>

      <div data-testid="security-sessions-list" className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Device</th>
              <th className="px-3 py-2 text-left font-medium">IP</th>
              <th className="px-3 py-2 text-left font-medium">Created</th>
              <th className="w-24 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(sessions ?? []).map((s) => (
              <SessionRow
                key={s.tokenId}
                session={s}
                onRevoke={() => void revokeSession.mutateAsync(s.tokenId)}
                locked={locked}
              />
            ))}
          </tbody>
        </table>
      </div>

      <Button
        variant="destructive"
        data-testid="security-sessions-revoke-others"
        disabled={locked}
        onClick={() => setRevokeAllOpen(true)}
      >
        <LogOutIcon className="mr-1.5 h-4 w-4" />
        {t('admin:security.sign_out_others')}
      </Button>

      <Dialog open={revokeAllOpen} onOpenChange={setRevokeAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:security.sign_out_others')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will sign out all sessions except your current one.
          </p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t('common:actions.cancel')}
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => void handleRevokeAll()}
              disabled={revokeOthers.isPending}
            >
              {t('admin:security.sign_out_others')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionRow({
  session, onRevoke, locked,
}: Readonly<{
  session: UserSession;
  onRevoke: () => void;
  locked: boolean;
}>) {
  const { t } = useTranslation(['admin']);
  const device = parseUserAgent(session.userAgent);
  const created = new Date(session.createdAt).toLocaleString();

  return (
    <tr
      className="border-b last:border-0 hover:bg-muted/30"
      data-current={session.isCurrentSession ? 'true' : 'false'}
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {device}
          {session.isCurrentSession && (
            <Badge variant="default" className="text-xs">
              {t('admin:security.this_session')}
            </Badge>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{session.ipAddress ?? '—'}</td>
      <td className="px-3 py-2 text-muted-foreground">{created}</td>
      <td className="px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          data-testid={`security-sessions-revoke-${session.tokenId}`}
          disabled={session.isCurrentSession || locked}
          onClick={onRevoke}
        >
          {t('admin:security.revoke_session')}
        </Button>
      </td>
    </tr>
  );
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown';
  const browser = /Chrome/.test(ua) ? 'Chrome'
    : /Firefox/.test(ua) ? 'Firefox'
    : /Safari/.test(ua) ? 'Safari'
    : /Edge/.test(ua) ? 'Edge'
    : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows'
    : /Mac OS/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : 'Unknown OS';
  return `${browser} on ${os}`;
}
