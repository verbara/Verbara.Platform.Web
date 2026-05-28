import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import type { SetupFormValues } from '../setup-wizard';

/**
 * Day 1 wizard — Agent step.
 *
 * ADR-0026 Phase A.4: this step ALWAYS creates a fresh User with role=Agent,
 * regardless of whether other users (e.g. the platform admin created via
 * /setup) already exist in the tenant. The platform admin administers the
 * platform; the agent attends conversations — they are conceptually distinct
 * roles, and the wizard's job is to surface that separation from day one.
 *
 * The previous behavior (Pre-v2.5.5) was to read `useUsers()` and offer a
 * dropdown when ≥1 user existed, which inevitably pointed at the platform
 * admin in a fresh setup. That dual-mode UI is reserved for the standalone
 * `/admin/agents/new` page where the operator may legitimately want to
 * promote an existing user to agent. The setup wizard's mental model is
 * "first agent = new person" — keep it linear.
 */
export default function AgentStep() {
  const { t } = useTranslation(['admin']);
  const {
    register,
    formState: { errors },
  } = useFormContext<SetupFormValues>();

  // For native-required fields without Zod, errors[field] exists when invalid
  // but message is '' — supply the translated message via FieldError directly.
  const agentEmailError = errors.agentEmail
    ? { message: 'admin:setup.agentEmailRequired' }
    : undefined;
  const agentDisplayNameError = errors.agentDisplayName
    ? { message: 'admin:setup.agentNameRequired' }
    : undefined;

  const agentEmailA11y = useFieldA11y(agentEmailError, 'setup-agentEmail', { required: true });
  const agentDisplayNameA11y = useFieldA11y(agentDisplayNameError, 'setup-agentDisplayName', {
    required: true,
  });

  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{t('admin:setup.agentTitle', 'Assign an Agent')}</h2>
        <p className="text-sm text-muted-foreground">
          {t(
            'admin:setup.agentCreateIntro',
            'Create the first agent account. The platform admin is a separate role — the agent attends conversations.',
          )}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="setup-agentEmail" required>
            {t('admin:setup.agentEmailLabel')}
          </Label>
          <Input
            id="setup-agentEmail"
            type="email"
            placeholder="agent@example.com"
            {...agentEmailA11y.inputProps}
            {...register('agentEmail', { required: true })}
          />
          <FieldError
            id={agentEmailA11y.errorId}
            message={agentEmailError ? t(agentEmailError.message) : undefined}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="setup-agentDisplayName" required>
            {t('admin:setup.agentDisplayNameLabel')}
          </Label>
          <Input
            id="setup-agentDisplayName"
            placeholder="e.g. John Smith"
            {...agentDisplayNameA11y.inputProps}
            {...register('agentDisplayName', { required: true })}
          />
          <FieldError
            id={agentDisplayNameA11y.errorId}
            message={agentDisplayNameError ? t(agentDisplayNameError.message) : undefined}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {t('admin:setup.agentRoleNote', 'Role will be set to agent.')}
        </p>
      </div>

      <p className="text-sm italic text-muted-foreground">
        {t('admin:setup.agentNote', 'Add skills and team assignments later in Admin → Agents.')}
      </p>
    </div>
  );
}
