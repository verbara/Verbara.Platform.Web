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

const userSchema = z.object({
  email: z.string().email('admin:users.validation.emailInvalid'),
  displayName: z.string().min(2, 'admin:users.validation.displayNameMinLength'),
  role: z.enum(['admin', 'supervisor', 'agent', 'readonly']),
  // Platform's `UserStatus` names. Optional, so a status the console does not know (normalized to
  // `undefined`) never fails validation.
  status: z.enum(ACCOUNT_STATUSES).optional(),
});

/**
 * What the form submits. `status` is present only in edit mode, and only when the administrator
 * picked a status other than the user's current one; otherwise the key is absent.
 */
export type UserFormValues = z.infer<typeof userSchema>;

const ROLES = ['admin', 'supervisor', 'agent', 'readonly'] as const;

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  defaultValues?: Partial<Omit<UserFormValues, 'status'>>;
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
  currentStatus,
  onSubmit,
}: UserFormProps) {
  const { t } = useTranslation(['admin']);
  const statusHintId = useId();
  const initialStatus: AccountStatus | undefined =
    mode === 'edit' ? normalizeAccountStatus(currentStatus) : undefined;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      displayName: '',
      role: 'agent',
      ...defaultValues,
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
        role: 'agent',
        ...defaultValues,
        status: initialStatus,
      });
    }
  }, [open, defaultValues, initialStatus, reset]);

  const selectedStatus = useWatch({ control, name: 'status' });
  // Leaving Active signs the user out everywhere: warn before the change is saved.
  const showStatusHint =
    mode === 'edit' &&
    selectedStatus !== undefined &&
    selectedStatus !== 'Active' &&
    selectedStatus !== initialStatus;

  const handleFormSubmit = handleSubmit(({ status, ...values }) => {
    const statusChanged = mode === 'edit' && status !== undefined && status !== initialStatus;
    onSubmit?.(statusChanged ? { ...values, status } : values);
    onOpenChange(false);
  });

  const title = mode === 'create' ? t('admin:users.create') : 'Edit user';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create' ? 'Add a new user to the platform.' : 'Update user details.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col gap-4 px-4">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="user-email" required>
              {t('admin:users.email')}
            </Label>
            <Input
              id="user-email"
              type="email"
              placeholder="user@example.com"
              data-testid="user-form-email"
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
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger data-testid="user-form-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.role && (
              <p className="text-xs text-destructive">{t(errors.role.message ?? '')}</p>
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
              {mode === 'create' ? t('admin:users.create') : 'Save changes'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
