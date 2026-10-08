import { useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import {
  ACCOUNT_STATUSES,
  accountStatusLabelKey,
  normalizeAccountStatus,
  type AccountStatus,
} from './account-status';
import {
  USER_ROLES,
  isLowerRole,
  normalizeUserRole,
  userRoleLabelKey,
  type UserRole,
} from './user-role';

const displayNameSchema = z.string().min(2, 'admin:users.validation.displayNameMinLength');
// Platform's `UserStatus` names. Optional, so a status the console does not know (normalized to
// `undefined`) never fails validation.
const statusSchema = z.enum(ACCOUNT_STATUSES).optional();

/** Create: the email is typed and validated, and a role is always chosen. */
const createSchema = z.object({
  email: z.string().email('admin:users.validation.emailInvalid'),
  displayName: displayNameSchema,
  role: z.enum(USER_ROLES),
  status: statusSchema,
});

/**
 * Edit: the email is shown read-only and never validated or sent (`UpdateUserRequest` has none).
 * The role is optional for the same reason as the status: a role the console does not know is
 * normalized to `undefined` and must never block the save of another field (H1).
 */
const editSchema = z.object({
  email: z.string(),
  displayName: displayNameSchema,
  role: z.enum(USER_ROLES).optional(),
  status: statusSchema,
});

type UserFormFields = z.infer<typeof editSchema>;

/**
 * What the form submits.
 * - Create: `email`, `displayName` and `role`.
 * - Edit: `displayName`, plus `role` and `status` only when the administrator picked a value other
 *   than the user's current one; otherwise the key is absent. `email` is never present (H2).
 */
export interface UserFormValues {
  email?: string;
  displayName: string;
  role?: UserRole;
  status?: AccountStatus;
}

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  defaultValues?: { email?: string; displayName?: string };
  /**
   * Edit mode: the user's role as `UserDto.role` reports it, in any casing. The role field opens on
   * it, and it is the baseline the lower-role hint and a change are measured against. Ignored in
   * create mode, which opens on `Agent`.
   */
  currentRole?: string | null;
  /**
   * Edit mode: the user's status as `UserDto.status` reports it, in any casing. The status field
   * opens on it, and it is the baseline a change is measured against. Ignored in create mode,
   * which has no status field: the create endpoint takes none and every new account is `Active`.
   */
  currentStatus?: string | null;
  onSubmit?: (values: UserFormValues) => void;
}

export function UserForm({
  open,
  onOpenChange,
  mode,
  defaultValues,
  currentRole,
  currentStatus,
  onSubmit,
}: UserFormProps) {
  const { t } = useTranslation(['admin']);
  const statusHintId = useId();
  const roleHintId = useId();
  const initialStatus: AccountStatus | undefined =
    mode === 'edit' ? normalizeAccountStatus(currentStatus) : undefined;
  const initialRole: UserRole | undefined =
    mode === 'edit' ? normalizeUserRole(currentRole) : 'Agent';

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormFields>({
    resolver: zodResolver(mode === 'create' ? createSchema : editSchema),
    defaultValues: {
      email: '',
      displayName: '',
      ...defaultValues,
      role: initialRole,
      status: initialStatus,
    },
  });

  const emailA11y = useFieldA11y(errors.email, 'user-email', { required: true });
  const displayNameA11y = useFieldA11y(errors.displayName, 'user-displayName', { required: true });

  useEffect(() => {
    if (open) {
      reset({
        email: '',
        displayName: '',
        ...defaultValues,
        role: initialRole,
        status: initialStatus,
      });
    }
  }, [open, defaultValues, initialRole, initialStatus, reset]);

  const selectedStatus = useWatch({ control, name: 'status' });
  // Leaving Active signs the user out everywhere: warn before the change is saved.
  const showStatusHint =
    mode === 'edit' &&
    selectedStatus !== undefined &&
    selectedStatus !== 'Active' &&
    selectedStatus !== initialStatus;

  const selectedRole = useWatch({ control, name: 'role' });
  // Lowering a role ends the user's sessions (Platform v2.25.0): warn before the change is saved.
  const showRoleHint =
    mode === 'edit' &&
    selectedRole !== undefined &&
    initialRole !== undefined &&
    isLowerRole(selectedRole, initialRole);

  const handleFormSubmit = handleSubmit(({ email, displayName, role, status }) => {
    if (mode === 'create') {
      onSubmit?.({ email, displayName, role });
    } else {
      const roleChanged = role !== undefined && role !== initialRole;
      const statusChanged = status !== undefined && status !== initialStatus;
      onSubmit?.({
        displayName,
        ...(roleChanged && { role }),
        ...(statusChanged && { status }),
      });
    }
    onOpenChange(false);
  });

  const title = mode === 'create' ? t('admin:users.create') : t('admin:users.edit');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('admin:users.create_description')
              : t('admin:users.edit_description')}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col gap-4 px-4">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="user-email" required>
              {t('admin:users.email')}
            </Label>
            {/* Edit: read-only, because `PUT /admin/users/{id}` takes no email (H2). */}
            <Input
              id="user-email"
              type="email"
              placeholder="user@example.com"
              data-testid="user-form-email"
              readOnly={mode === 'edit'}
              {...emailA11y.inputProps}
              {...register('email')}
            />
            <FieldError
              id={emailA11y.errorId}
              message={errors.email?.message ? t(errors.email.message) : undefined}
            />
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="user-displayName" required>
              {t('admin:users.name')}
            </Label>
            <Input
              id="user-displayName"
              placeholder={t('admin:users.namePlaceholder')}
              data-testid="user-form-displayName"
              {...displayNameA11y.inputProps}
              {...register('displayName')}
            />
            <FieldError
              id={displayNameA11y.errorId}
              message={errors.displayName?.message ? t(errors.displayName.message) : undefined}
            />
          </div>

          {/* Role — Controller/Select: inputProps cannot be spread onto SelectTrigger (no aria-* passthrough); Label has no htmlFor match */}
          <div className="space-y-1.5">
            <Label>{t('admin:users.role')}</Label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? null}
                  onValueChange={(value) => field.onChange(value ?? undefined)}
                >
                  <SelectTrigger
                    data-testid="user-form-role"
                    className="w-full"
                    aria-describedby={showRoleHint ? roleHintId : undefined}
                  >
                    <SelectValue>
                      {(value: UserRole | null) =>
                        // An unknown role selects nothing and is shown as reported.
                        value ? t(userRoleLabelKey(value)) : (currentRole ?? '')
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((role) => (
                      <SelectItem
                        key={role}
                        value={role}
                        data-testid={`user-form-role-option-${role}`}
                      >
                        {t(userRoleLabelKey(role))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.role && (
              <p className="text-xs text-destructive">{t(errors.role.message ?? '')}</p>
            )}
            {showRoleHint && (
              <p
                id={roleHintId}
                data-testid="user-form-role-hint"
                className="text-xs text-muted-foreground"
              >
                {t('admin:users.role_hint_lower')}
              </p>
            )}
          </div>

          {/* Status — edit only. Controller/Select: inputProps cannot be spread onto SelectTrigger */}
          {mode === 'edit' && (
            <div className="space-y-1.5">
              <Label>{t('admin:users.status')}</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? null}
                    onValueChange={(value) => field.onChange(value ?? undefined)}
                  >
                    <SelectTrigger
                      data-testid="user-form-status"
                      className="w-full"
                      aria-describedby={showStatusHint ? statusHintId : undefined}
                    >
                      <SelectValue>
                        {(value: AccountStatus | null) =>
                          // An unknown status selects nothing and is shown as reported.
                          value ? t(accountStatusLabelKey(value)) : (currentStatus ?? '')
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_STATUSES.map((status) => (
                        <SelectItem
                          key={status}
                          value={status}
                          data-testid={`user-form-status-option-${status}`}
                        >
                          {t(accountStatusLabelKey(status))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {showStatusHint && (
                <p
                  id={statusHintId}
                  data-testid="user-form-status-hint"
                  className="text-xs text-muted-foreground"
                >
                  {t('admin:users.status_hint_inactive')}
                </p>
              )}
            </div>
          )}

          <SheetFooter className="mt-auto px-0">
            <Button data-testid="user-form-submit" type="submit" disabled={isSubmitting}>
              {mode === 'create' ? t('admin:users.create') : t('admin:users.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
