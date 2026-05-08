import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import type { SetupFormValues } from '../setup-wizard';
import { useUsers } from '@/core/api/hooks/use-users';

export default function AgentStep() {
  const { t } = useTranslation(['admin']);
  const {
    register,
    formState: { errors },
  } = useFormContext<SetupFormValues>();

  const { data: users = [] } = useUsers();
  const hasUsers = users.length > 0;

  // For native-required fields without Zod, errors[field] exists when invalid
  // but message is '' — supply the translated message via FieldError directly.
  const agentUserIdError = errors.agentUserId
    ? { message: 'admin:setup.agentUserRequired' }
    : undefined;
  const agentEmailError = errors.agentEmail
    ? { message: 'admin:setup.agentEmailRequired' }
    : undefined;
  const agentDisplayNameError = errors.agentDisplayName
    ? { message: 'admin:setup.agentNameRequired' }
    : undefined;

  const agentUserIdA11y = useFieldA11y(agentUserIdError, 'setup-agentUserId', { required: true });
  const agentEmailA11y = useFieldA11y(agentEmailError, 'setup-agentEmail', { required: true });
  const agentDisplayNameA11y = useFieldA11y(agentDisplayNameError, 'setup-agentDisplayName', {
    required: true,
  });

  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{t('admin:setup.agentTitle', 'Assign an Agent')}</h2>
      </div>

      {hasUsers ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setup-agentUserId" required>
              {t('admin:setup.agentUserLabel')}
            </Label>
            <select
              id="setup-agentUserId"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...agentUserIdA11y.inputProps}
              {...register('agentUserId', { required: true })}
            >
              <option value="">{t('admin:setup.agentSelectUser', '-- Select a user --')}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} ({user.email})
                </option>
              ))}
            </select>
            <FieldError
              id={agentUserIdA11y.errorId}
              message={agentUserIdError ? t(agentUserIdError.message) : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="setup-agentDisplayName">{t('admin:setup.agentDisplayNameLabel')}</Label>
            <Input
              id="setup-agentDisplayName"
              placeholder="e.g. John Smith"
              {...register('agentDisplayName')}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('admin:setup.agentNoUsers', 'No users available. Create one first:')}
          </p>

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
      )}

      <p className="text-sm italic text-muted-foreground">
        {t('admin:setup.agentNote', 'Add skills and team assignments later in Admin → Agents.')}
      </p>
    </div>
  );
}
