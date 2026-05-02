import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
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
            {mode === 'create'
              ? 'Add a new user to the platform.'
              : 'Update user details.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col gap-4 px-4">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('admin:users.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              aria-invalid={!!errors.email}
              data-testid="user-form-email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{t(errors.email.message ?? '')}</p>
            )}
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="displayName">{t('admin:users.name')}</Label>
            <Input
              id="displayName"
              placeholder="Jane Doe"
              aria-invalid={!!errors.displayName}
              data-testid="user-form-displayName"
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="text-xs text-destructive">{t(errors.displayName.message ?? '')}</p>
            )}
          </div>

          {/* Role */}
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

          {/* Status */}
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
