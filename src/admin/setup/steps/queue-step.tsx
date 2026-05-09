import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import type { SetupFormValues } from '../setup-wizard';

export default function QueueStep() {
  const { t } = useTranslation(['admin']);
  const {
    register,
    formState: { errors },
  } = useFormContext<SetupFormValues>();

  const queueNameA11y = useFieldA11y(errors.queueName, 'queueName', { required: true });

  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{t('admin:setup.queueTitle', 'Create a Queue')}</h2>
      </div>

      <div className="space-y-2">
        <Label htmlFor="queueName" required>
          {t('admin:setup.queueNameLabel')}
        </Label>
        <Input
          id="queueName"
          placeholder="e.g. Support, Sales"
          {...queueNameA11y.inputProps}
          {...register('queueName', { required: true, minLength: 1 })}
        />
        <FieldError
          id={queueNameA11y.errorId}
          message={
            errors.queueName
              ? t('admin:setup.queueNameRequired', 'Queue name is required.')
              : undefined
          }
        />
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
