import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ShieldCheck, Download, Copy, KeyRound } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Badge } from '@/core/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/core/ui/dialog';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

interface MfaSetupResponse {
  secret: string;
  qrUri: string;
  recoveryCodes: string[];
}

export default function SecurityPage() {
  const { t } = useTranslation(['admin']);

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false); // TODO: read from user profile
  const [setupData, setSetupData] = useState<MfaSetupResponse | null>(null);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify' | 'codes'>('idle');
  const [verifyCode, setVerifyCode] = useState('');
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Change password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handleSetupMfa() {
    setLoading(true);
    try {
      const data = await customFetch<MfaSetupResponse>({
        url: '/api/v1/auth/mfa/setup',
        method: 'POST',
      });
      setSetupData(data);
      setSetupStep('qr');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmMfa() {
    setLoading(true);
    try {
      await customFetch<void>({
        url: '/api/v1/auth/mfa/confirm',
        method: 'POST',
        data: { code: verifyCode },
      });
      setSetupStep('codes');
      setMfaEnabled(true);
      toast.success('MFA enabled');
    } catch {
      toast.error(t('auth.mfa_invalid_code', 'Invalid verification code'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDisableMfa() {
    setLoading(true);
    try {
      await customFetch<void>({
        url: '/api/v1/auth/mfa',
        method: 'DELETE',
        data: { password: disablePassword },
      });
      setMfaEnabled(false);
      setDisableOpen(false);
      setDisablePassword('');
      toast.success('MFA disabled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      toast.error(t('auth.passwords_do_not_match', 'Passwords do not match'));
      return;
    }
    setPasswordLoading(true);
    try {
      await customFetch<void>({
        url: '/api/v1/auth/change-password',
        method: 'POST',
        data: { oldPassword, newPassword },
      });
      toast.success(t('auth.password_changed', 'Password changed'));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  }

  function copyRecoveryCodes() {
    if (setupData) {
      navigator.clipboard.writeText(setupData.recoveryCodes.join('\n'));
      toast.success('Recovery codes copied');
    }
  }

  function downloadRecoveryCodes() {
    if (!setupData) return;
    const blob = new Blob([setupData.recoveryCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-heading text-xl font-semibold">{t('admin:security.title', 'Security')}</h1>

      {/* MFA Section */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mfaEnabled ? (
              <ShieldCheck className="h-5 w-5 text-green-500" />
            ) : (
              <Shield className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <h3 className="font-medium">{t('admin:security.mfa', 'Two-Factor Authentication')}</h3>
              <p className="text-sm text-muted-foreground">{t('admin:security.mfa_description', 'Add an extra layer of security to your account')}</p>
            </div>
          </div>
          <Badge data-testid="security-mfa-status" variant={mfaEnabled ? 'default' : 'secondary'}>
            {mfaEnabled ? t('status.enabled', 'Enabled') : t('status.disabled', 'Disabled')}
          </Badge>
        </div>

        {setupStep === 'idle' && !mfaEnabled && (
          <Button data-testid="security-mfa-enable" onClick={() => void handleSetupMfa()} disabled={loading}>
            {t('admin:security.enable_mfa', 'Enable MFA')}
          </Button>
        )}

        {setupStep === 'idle' && mfaEnabled && (
          <Button data-testid="security-mfa-disable" variant="destructive" onClick={() => setDisableOpen(true)}>
            {t('admin:security.disable_mfa', 'Disable MFA')}
          </Button>
        )}

        {/* QR Code step */}
        {setupStep === 'qr' && setupData && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm">{t('admin:security.scan_qr', 'Scan this QR code with your authenticator app')}</p>
            <div className="flex justify-center">
              <div data-testid="security-mfa-qrcode" className="rounded-lg border bg-white p-4">
                <QRCodeSVG value={setupData.qrUri} size={192} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('admin:security.manual_key', 'Or enter this key manually:')}</p>
              <code className="block rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                {setupData.secret}
              </code>
            </div>
            <Button data-testid="security-mfa-next-verify" onClick={() => setSetupStep('verify')}>
              {t('actions.next', 'Next')}
            </Button>
          </div>
        )}

        {/* Verify step */}
        {setupStep === 'verify' && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm">{t('admin:security.enter_code', 'Enter the 6-digit code from your authenticator app')}</p>
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
                onClick={() => void handleConfirmMfa()}
                disabled={verifyCode.length !== 6 || loading}
              >
                {t('auth.mfa_verify', 'Verify')}
              </Button>
            </div>
          </div>
        )}

        {/* Recovery codes step */}
        {setupStep === 'codes' && setupData && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium text-amber-600">
              {t('admin:security.save_recovery_codes', 'Save these recovery codes in a safe place. You will not be able to see them again.')}
            </p>
            <div data-testid="security-mfa-recovery-codes" className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4">
              {setupData.recoveryCodes.map((code, i) => (
                <code key={i} className="text-sm font-mono">{code}</code>
              ))}
            </div>
            <div className="flex gap-2">
              <Button data-testid="security-mfa-copy" variant="outline" size="sm" onClick={copyRecoveryCodes}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                {t('actions.copy', 'Copy')}
              </Button>
              <Button data-testid="security-mfa-download" variant="outline" size="sm" onClick={downloadRecoveryCodes}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {t('actions.download', 'Download')}
              </Button>
            </div>
            <Button data-testid="security-mfa-done" onClick={() => setSetupStep('idle')}>
              {t('actions.done', 'Done')}
            </Button>
          </div>
        )}
      </div>

      {/* Change Password Section */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">{t('admin:security.change_password', 'Change Password')}</h3>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{t('auth.current_password', 'Current Password')}</Label>
            <Input
              type="password"
              data-testid="security-password-old"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('auth.new_password', 'New Password')}</Label>
            <Input
              type="password"
              data-testid="security-password-new"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('auth.confirm_password', 'Confirm Password')}</Label>
            <Input
              type="password"
              data-testid="security-password-confirm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button
            data-testid="security-password-submit"
            onClick={() => void handleChangePassword()}
            disabled={passwordLoading || !oldPassword || !newPassword || !confirmPassword}
          >
            {t('admin:security.change_password', 'Change Password')}
          </Button>
        </div>
      </div>

      {/* Disable MFA Dialog */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:security.disable_mfa', 'Disable MFA')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('auth.password', 'Password')}</Label>
            <Input
              type="password"
              data-testid="security-mfa-disable-password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder={t('admin:security.confirm_password_to_disable', 'Enter your password to confirm')}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t('actions.cancel', 'Cancel')}
            </DialogClose>
            <Button
              data-testid="security-mfa-disable-confirm"
              variant="destructive"
              onClick={() => void handleDisableMfa()}
              disabled={!disablePassword || loading}
            >
              {t('admin:security.disable_mfa', 'Disable MFA')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
