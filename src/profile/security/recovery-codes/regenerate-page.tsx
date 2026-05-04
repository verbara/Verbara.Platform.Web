import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TriangleAlert, Check, Download, RefreshCw } from 'lucide-react';

import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Checkbox } from '@/core/ui/checkbox';
import { CopyButton } from '@/core/ui/copy-button';
import { PageHeader } from '@/admin/shared/page-header';
import { useRegenerateRecoveryCodes } from '@/core/api/hooks/use-recovery-codes';

type WizardStep = 'warning' | 'codes';

/**
 * Recovery-codes regenerate page at
 * `/profile/security/recovery-codes/regenerate` (R5.2 PA.2).
 *
 * Step 1 — Warning + step-up MFA challenge (TOTP input).
 * Step 2 — Display the freshly-minted codes (copy + download + ack).
 *
 * Backend requires a fresh TOTP step-up; if the user submits without one,
 * the request returns 401 with `mfaStepUpRequired: true` and the toast
 * surfaces the reason.
 */
export default function RegeneratePage() {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();

  const [step, setStep] = useState<WizardStep>('warning');
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);

  const regenerate = useRegenerateRecoveryCodes();

  async function handleRegenerate() {
    const res = await regenerate.mutateAsync({ totpCode });
    setRecoveryCodes(res.recoveryCodes);
    setStep('codes');
  }

  function downloadCodes() {
    const blob = new Blob([recoveryCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6" data-testid="recovery-regenerate-page">
      <PageHeader
        title={t('admin:profile_security.recovery_codes.regenerate.title')}
        description={t('admin:profile_security.recovery_codes.regenerate.description')}
      />

      {step === 'warning' && (
        <div
          className="rounded-lg border bg-card p-6 space-y-4"
          data-testid="recovery-warning-step"
        >
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-1 h-5 w-5 text-amber-500" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {t('admin:profile_security.recovery_codes.regenerate.warning_title')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('admin:profile_security.recovery_codes.regenerate.warning_body')}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recovery-totp">{t('common:auth.totp_code')}</Label>
            <Input
              id="recovery-totp"
              data-testid="recovery-regenerate-totp-input"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="w-32 font-mono text-center"
            />
            <p className="text-xs text-muted-foreground">
              {t('admin:profile_security.recovery_codes.regenerate.totp_hint')}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/profile/security')}
              data-testid="recovery-regenerate-cancel"
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              onClick={() => void handleRegenerate()}
              disabled={totpCode.length !== 6 || regenerate.isPending}
              data-testid="recovery-regenerate-submit"
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              {t('admin:profile_security.recovery_codes.regenerate.action')}
            </Button>
          </div>
        </div>
      )}

      {step === 'codes' && (
        <div className="rounded-lg border bg-card p-6 space-y-4" data-testid="recovery-codes-step">
          <p className="text-sm font-medium text-amber-600">
            {t('admin:profile_security.recovery_codes.regenerate.save_warning')}
          </p>
          <div
            className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4"
            data-testid="recovery-regenerate-codes"
          >
            {recoveryCodes.map((code, i) => (
              <code key={i} className="text-sm font-mono">
                {code}
              </code>
            ))}
          </div>
          <div className="flex gap-2">
            <CopyButton
              value={recoveryCodes.join('\n')}
              variant="outline"
              label={t('common:actions.copy')}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCodes}
              data-testid="recovery-regenerate-download"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {t('common:actions.download')}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recovery-ack"
              data-testid="recovery-regenerate-ack"
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
            />
            <Label htmlFor="recovery-ack" className="text-sm">
              {t('admin:profile_security.recovery_codes.regenerate.acknowledge_saved')}
            </Label>
          </div>
          <Button
            onClick={() => navigate('/admin/profile/security')}
            disabled={!acknowledged}
            data-testid="recovery-regenerate-done"
          >
            <Check className="mr-1.5 h-4 w-4" />
            {t('common:actions.done')}
          </Button>
        </div>
      )}
    </div>
  );
}
