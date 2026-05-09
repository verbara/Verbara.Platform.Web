import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

const schema = z.object({
  name: z.string().min(1, 'webchat:preChat.validation.nameRequired'),
  email: z
    .string()
    .min(1, 'webchat:preChat.validation.emailRequired')
    .refine((v) => z.email().safeParse(v).success, 'webchat:preChat.validation.emailInvalid'),
});

type FormValues = z.infer<typeof schema>;

export interface PreChatFormProps {
  readonly defaultValues?: Partial<FormValues>;
  readonly onSubmit: (values: FormValues) => void;
}

export function PreChatForm({ defaultValues, onSubmit }: PreChatFormProps) {
  const { t } = useTranslation('webchat');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', ...defaultValues },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data))}
      noValidate
      className="flex flex-col gap-4 p-4"
    >
      <div>
        <h2 className="text-lg font-semibold">{t('preChat.title')}</h2>
        <p className="text-sm text-gray-600">{t('preChat.subtitle')}</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="webchat-name" className="text-sm font-medium">
          {t('preChat.name')} <span aria-hidden="true">*</span>
        </label>
        <input
          id="webchat-name"
          type="text"
          autoComplete="name"
          placeholder={t('preChat.namePlaceholder')}
          aria-required="true"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'webchat-name-error' : undefined}
          className="w-full rounded border px-3 py-2 text-sm"
          {...register('name')}
        />
        {errors.name && (
          <p id="webchat-name-error" role="alert" className="text-xs text-red-600">
            {t(errors.name.message ?? '')}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="webchat-email" className="text-sm font-medium">
          {t('preChat.email')} <span aria-hidden="true">*</span>
        </label>
        <input
          id="webchat-email"
          type="email"
          autoComplete="email"
          placeholder={t('preChat.emailPlaceholder')}
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'webchat-email-error' : undefined}
          className="w-full rounded border px-3 py-2 text-sm"
          {...register('email')}
        />
        {errors.email && (
          <p id="webchat-email-error" role="alert" className="text-xs text-red-600">
            {t(errors.email.message ?? '')}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded px-4 py-2 text-sm font-medium text-white"
        style={{ background: 'var(--vw-primary, #0d9488)' }}
      >
        {t('preChat.submit')}
      </button>
    </form>
  );
}
