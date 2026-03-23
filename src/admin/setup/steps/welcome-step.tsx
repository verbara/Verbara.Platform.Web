import { useTranslation } from 'react-i18next';
import { ListChecks, Headset, Radio, CheckCircle } from 'lucide-react';

const BULLETS = [
  { icon: ListChecks, key: 'bullet1', fallback: 'A queue to receive conversations' },
  { icon: Headset, key: 'bullet2', fallback: 'An agent to handle them' },
  { icon: Radio, key: 'bullet3', fallback: 'A channel to connect with customers' },
] as const;

const PREVIEW_STEPS = [
  { icon: ListChecks, key: 'step_queue' },
  { icon: Headset, key: 'step_agent' },
  { icon: Radio, key: 'step_channel' },
  { icon: CheckCircle, key: 'step_test' },
] as const;

export default function WelcomeStep() {
  const { t } = useTranslation(['admin']);

  return (
    <div className="mx-auto max-w-lg space-y-6 py-4 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          {t('admin:setup.welcomeTitle', 'Welcome to Asterisk Platform')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            'admin:setup.welcomeDescription',
            "Let's get your contact center ready in a few steps.",
          )}
        </p>
      </div>

      <ul className="mx-auto max-w-sm space-y-3 text-left">
        {BULLETS.map(({ icon: Icon, key, fallback }) => (
          <li key={key} className="flex items-center gap-3 text-sm">
            <Icon className="h-5 w-5 shrink-0 text-primary" />
            <span>{t(`admin:setup.${key}`, fallback)}</span>
          </li>
        ))}
      </ul>

      <div className="flex justify-center gap-6 pt-2">
        {PREVIEW_STEPS.map(({ icon: Icon, key }) => (
          <div key={key} className="flex flex-col items-center gap-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <span className="text-xs text-muted-foreground">
              {t(`admin:setup.${key}`, key.replace('step_', ''))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
