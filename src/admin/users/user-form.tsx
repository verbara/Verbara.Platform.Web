import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
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

const userSchema = z.object({
  email: z.string().email('admin:users.validation.emailInvalid'),
  displayName: z.string().min(2, 'admin:users.validation.displayNameMinLength'),
  role: z.enum(['admin', 'supervisor', 'agent', 'readonly']),
  status: z.enum(['active', 'inactive']).optional(),
});

export type UserFormValues = z.infer<typeof userSchema>;

const ROLES = ['admin', 'supervisor', 'agent', 'readonly'] as const;
const STATUSES = ['active', 'inactive'] as const;

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  defaultValues?: Partial<UserFormValues>;
  onSubmit?: (values: UserFormValues) => void;
}

export function UserForm({ open, onOpenChange, mode, defaultValues, onSubmit }: UserFormProps) {
  const { t } = useTranslation(['admin']);

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
      status: 'active',
      ...defaultValues,
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
        status: 'active',
        ...defaultValues,
      });
    }
  }, [open, defaultValues, reset]);

  const handleFormSubmit = handleSubmit((values) => {
    onSubmit?.(values);
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

          {/* Status — Controller/Select optional field; inputProps cannot be spread onto SelectTrigger */}
          <div className="space-y-1.5">
            <Label>{t('admin:users.status')}</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger data-testid="user-form-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

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
