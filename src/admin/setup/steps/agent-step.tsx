import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
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

  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          {t('admin:setup.agentTitle', 'Assign an Agent')}
        </h2>
      </div>

      {hasUsers ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agentUserId">User</Label>
            <select
              id="agentUserId"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...register('agentUserId', { required: true })}
            >
              <option value="">
                {t('admin:setup.agentSelectUser', '-- Select a user --')}
              </option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} ({user.email})
                </option>
              ))}
            </select>
            {errors.agentUserId && (
              <p className="text-sm text-destructive">
                {t('admin:setup.agentUserRequired', 'Please select a user.')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentDisplayName">Display Name</Label>
            <Input
              id="agentDisplayName"
              placeholder="e.g. John Smith"
              {...register('agentDisplayName')}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t(
              'admin:setup.agentNoUsers',
              'No users available. Create one first:',
            )}
          </p>

          <div className="space-y-2">
            <Label htmlFor="agentEmail">Email</Label>
            <Input
              id="agentEmail"
              type="email"
              placeholder="agent@example.com"
              {...register('agentEmail', { required: true })}
            />
            {errors.agentEmail && (
              <p className="text-sm text-destructive">
                {t('admin:setup.agentEmailRequired', 'Email is required.')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentDisplayName">Display Name</Label>
            <Input
              id="agentDisplayName"
              placeholder="e.g. John Smith"
              {...register('agentDisplayName', { required: true })}
            />
            {errors.agentDisplayName && (
              <p className="text-sm text-destructive">
                {t(
                  'admin:setup.agentNameRequired',
                  'Display name is required.',
                )}
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {t('admin:setup.agentRoleNote', 'Role will be set to agent.')}
          </p>
        </div>
      )}

      <p className="text-sm italic text-muted-foreground">
        {t(
          'admin:setup.agentNote',
          'Add skills and team assignments later in Admin \u2192 Agents.',
        )}
      </p>
    </div>
  );
}
