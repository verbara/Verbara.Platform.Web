import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import type { Skill } from '@/core/api/hooks/use-skills';

const skillSchema = z.object({
  name: z.string().min(1, 'admin:skills.validation.nameRequired'),
  category: z.string(),
  description: z.string(),
});

export type SkillFormValues = z.infer<typeof skillSchema>;

interface SkillFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  defaultValues?: Partial<Skill>;
  onSubmit?: (values: SkillFormValues) => void;
}

export function SkillForm({ open, onOpenChange, mode, defaultValues, onSubmit }: SkillFormProps) {
  const { t } = useTranslation(['admin']);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SkillFormValues>({
    resolver: zodResolver(skillSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      category: defaultValues?.category ?? '',
      description: defaultValues?.description ?? '',
    },
  });

  const nameA11y = useFieldA11y(errors.name, 'skill-name', { required: true });

  useEffect(() => {
    if (open) {
      reset({
        name: defaultValues?.name ?? '',
        category: defaultValues?.category ?? '',
        description: defaultValues?.description ?? '',
      });
    }
  }, [open, defaultValues, reset]);

  const handleFormSubmit = handleSubmit((values) => {
    onSubmit?.(values);
    onOpenChange(false);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {mode === 'create' ? t('admin:skills.createSkill') : t('admin:skills.editSkill')}
          </SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('admin:skills.createDescription')
              : t('admin:skills.editDescription')}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col gap-4 px-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="skill-name" required>
              {t('admin:skills.name')}
            </Label>
            <Input
              id="skill-name"
              data-testid="skill-form-name"
              placeholder={t('admin:skills.namePlaceholder')}
              disabled={mode === 'edit'}
              {...nameA11y.inputProps}
              {...register('name')}
            />
            <FieldError
              id={nameA11y.errorId}
              message={errors.name?.message ? t(errors.name.message) : undefined}
            />
            {mode === 'edit' && (
              <p className="text-xs text-muted-foreground">{t('admin:skills.nameReadOnly')}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="skill-category">{t('admin:skills.category')}</Label>
            <Input
              id="skill-category"
              data-testid="skill-form-category"
              placeholder={t('admin:skills.categoryPlaceholder')}
              {...register('category')}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="skill-description">{t('admin:skills.description')}</Label>
            <textarea
              id="skill-description"
              data-testid="skill-form-description"
              rows={4}
              placeholder={t('admin:skills.descriptionPlaceholder')}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              {...register('description')}
            />
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" data-testid="skill-form-submit" disabled={isSubmitting}>
              {mode === 'create' ? t('admin:skills.createSkill') : t('admin:skills.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
