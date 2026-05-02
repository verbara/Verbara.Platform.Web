import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import type { SetupFormValues } from '../setup-wizard';

export default function QueueStep() {
  const { t } = useTranslation(['admin']);
  const {
    register,
    formState: { errors },
  } = useFormContext<SetupFormValues>();

  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          {t('admin:setup.queueTitle', 'Create a Queue')}
        </h2>
      </div>

      <div className="space-y-2">
        <Label htmlFor="queueName">{t('admin:setup.queueNameLabel')}</Label>
        <Input
          id="queueName"
          placeholder="e.g. Support, Sales"
          {...register('queueName', { required: true, minLength: 1 })}
        />
        {errors.queueName && (
          <p className="text-sm text-destructive">
            {t('admin:setup.queueNameRequired', 'Queue name is required.')}
          </p>
        )}
      </div>

      <p className="text-sm italic text-muted-foreground">
        {t(
          'admin:setup.queueNote',
          'Advanced queue settings like routing strategy, SLA, and overflow rules can be configured later in Admin → Queues.',
        )}
      </p>
    </div>
  );
}
