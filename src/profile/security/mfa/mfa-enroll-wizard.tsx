import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Download, Shield, ShieldCheck, Smartphone } from 'lucide-react';

import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Checkbox } from '@/core/ui/checkbox';
import { CopyButton } from '@/core/ui/copy-button';
import { PageHeader } from '@/core/ui/page-header';
import {
  useMfaEnrollInit,
  useMfaEnrollVerify,
  useMfaEnrollComplete,
  type MfaEnrollInitResponse,
} from '@/core/api/hooks/use-mfa-enroll';

type WizardStep = 'qr' | 'verify' | 'codes';

/**
 * 3-step MFA enrollment wizard at `/profile/security/mfa/enroll` (R5.2 PA.2 /
 * S3.4 Frente E). Flow:
 *
 *   Step 1 (qr)     — Display QR + manual code, prompt to scan
 *   Step 2 (verify) — Validate fresh TOTP, persist secret + codes server-side
 *   Step 3 (codes)  — Display recovery codes, require ack before exit
 *
 * The wizard auto-fires the init mutation on mount so the QR is ready by the
 * time the user lands on the page; subsequent steps are user-driven.
 */
export default function MfaEnrollWizard() {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();

  const [step, setStep] = useState<WizardStep>('qr');
  const [initData, setInitData] = useState<MfaEnrollInitResponse | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);

  const init = useMfaEnrollInit();
  const verify = useMfaEnrollVerify();
  const complete = useMfaEnrollComplete();

  // Auto-init on first render so the QR is rendered without an extra click.
  if (!initData && !init.isPending && !init.isError) {
    void init.mutateAsync().then(setInitData);
  }

  async function handleVerify() {
    if (!initData) return;
    const res = await verify.mutateAsync({
      secret: initData.secret,
      totpCode,
    });
    setRecoveryCodes(res.recoveryCodes);
    setStep('codes');
  }

  async function handleComplete() {
    await complete.mutateAsync();
    navigate('/admin/profile/security');
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
    <div className="mx-auto max-w-2xl space-y-6 p-6" data-testid="mfa-enroll-wizard">
      <PageHeader
        title={t('admin:profile_security.mfa.enroll.title')}
        description={t('admin:profile_security.mfa.enroll.description')}
      />

      <Stepper current={step} />

      {step === 'qr' && (
        <QrStep
          initData={initData}
          isLoading={init.isPending || !initData}
          onNext={() => setStep('verify')}
        />
      )}

      {step === 'verify' && (
        <VerifyStep
          totpCode={totpCode}
          onTotpCodeChange={setTotpCode}
          onBack={() => setStep('qr')}
          onVerify={() => void handleVerify()}
          isVerifying={verify.isPending}
        />
      )}

      {step === 'codes' && (
        <CodesStep
          codes={recoveryCodes}
          acknowledged={acknowledged}
          onAcknowledgedChange={setAcknowledged}
          onDownload={downloadCodes}
          onComplete={() => void handleComplete()}
          isCompleting={complete.isPending}
        />
      )}
    </div>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────

function Stepper({ current }: Readonly<{ current: WizardStep }>) {
  const { t } = useTranslation(['admin']);
  const steps: WizardStep[] = ['qr', 'verify', 'codes'];
  return (
    <ol className="flex items-center gap-2" data-testid="mfa-enroll-stepper">
      {steps.map((s, i) => {
        const reached = steps.indexOf(current) >= i;
        return (
          <li
            key={s}
            className="flex items-center gap-2"
            data-testid={`mfa-enroll-step-${s}`}
            data-active={s === current ? 'true' : 'false'}
            data-reached={reached ? 'true' : 'false'}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium ${
                s === current
                  ? 'border-primary bg-primary text-primary-foreground'
                  : reached
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-muted text-muted-foreground'
              }`}
            >
              {i + 1}
            </span>
            <span className="text-sm">
              {t(`admin:profile_security.mfa.enroll.steps.${s}`)}
            </span>
            {i < steps.length - 1 && <span className="mx-2 text-muted-foreground">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Step 1 ──────────────────────────────────────────────────────────────

function QrStep({
  initData,
  isLoading,
  onNext,
}: Readonly<{
  initData: MfaEnrollInitResponse | null;
  isLoading: boolean;
  onNext: () => void;
}>) {
  const { t } = useTranslation(['admin', 'common']);

  if (isLoading || !initData) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        {t('common:status.loading')}…
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4" data-testid="mfa-enroll-qr-step">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-1 h-5 w-5 text-muted-foreground" />
        <p className="text-sm">{t('admin:profile_security.mfa.enroll.qr_instructions')}</p>
      </div>
      <div className="flex justify-center">
        <div className="rounded-lg border bg-white p-4" data-testid="mfa-enroll-qrcode">
          <QRCodeSVG value={initData.qrUri} size={192} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('admin:profile_security.mfa.enroll.manual_code')}</Label>
        <div className="flex items-center gap-2">
          <code
            className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all"
            data-testid="mfa-enroll-manual-code"
          >
            {initData.manualCode}
          </code>
          <CopyButton value={initData.manualCode} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('admin:profile_security.mfa.enroll.recommended_apps')}
      </p>
      <Button onClick={onNext} data-testid="mfa-enroll-next-verify">
        {t('common:actions.next')}
      </Button>
    </div>
  );
}

// ─── Step 2 ──────────────────────────────────────────────────────────────

function VerifyStep({
  totpCode,
  onTotpCodeChange,
  onBack,
  onVerify,
  isVerifying,
}: Readonly<{
  totpCode: string;
  onTotpCodeChange: (v: string) => void;
  onBack: () => void;
  onVerify: () => void;
  isVerifying: boolean;
}>) {
  const { t } = useTranslation(['admin', 'common']);
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4" data-testid="mfa-enroll-verify-step">
      <div className="flex items-start gap-3">
        <Shield className="mt-1 h-5 w-5 text-muted-foreground" />
        <p className="text-sm">{t('admin:profile_security.mfa.enroll.verify_instructions')}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="mfa-totp">{t('common:auth.totp_code')}</Label>
        <Input
          id="mfa-totp"
          data-testid="mfa-enroll-totp-input"
          value={totpCode}
          onChange={(e) => onTotpCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="w-32 font-mono text-center"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} data-testid="mfa-enroll-verify-back">
          {t('common:actions.back')}
        </Button>
        <Button
          onClick={onVerify}
          disabled={totpCode.length !== 6 || isVerifying}
          data-testid="mfa-enroll-verify-submit"
        >
          {t('common:auth.mfa_verify')}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3 ──────────────────────────────────────────────────────────────

function CodesStep({
  codes,
  acknowledged,
  onAcknowledgedChange,
  onDownload,
  onComplete,
  isCompleting,
}: Readonly<{
  codes: string[];
  acknowledged: boolean;
  onAcknowledgedChange: (v: boolean) => void;
  onDownload: () => void;
  onComplete: () => void;
  isCompleting: boolean;
}>) {
  const { t } = useTranslation(['admin', 'common']);
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4" data-testid="mfa-enroll-codes-step">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-5 w-5 text-green-500" />
        <p className="text-sm font-medium text-amber-600">
          {t('admin:profile_security.mfa.enroll.save_codes_warning')}
        </p>
      </div>
      <div
        className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4"
        data-testid="mfa-enroll-recovery-codes"
      >
        {codes.map((code, i) => (
          <code key={i} className="text-sm font-mono">
            {code}
          </code>
        ))}
      </div>
      <div className="flex gap-2">
        <CopyButton value={codes.join('\n')} variant="outline" label={t('common:actions.copy')} />
        <Button variant="outline" size="sm" onClick={onDownload} data-testid="mfa-enroll-download">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {t('common:actions.download')}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="mfa-ack"
          data-testid="mfa-enroll-ack"
          checked={acknowledged}
          onCheckedChange={(v) => onAcknowledgedChange(v === true)}
        />
        <Label htmlFor="mfa-ack" className="text-sm">
          {t('admin:profile_security.mfa.enroll.acknowledge_saved')}
        </Label>
      </div>
      <Button
        onClick={onComplete}
        disabled={!acknowledged || isCompleting}
        data-testid="mfa-enroll-done"
      >
        <Check className="mr-1.5 h-4 w-4" />
        {t('common:actions.done')}
      </Button>
    </div>
  );
}
