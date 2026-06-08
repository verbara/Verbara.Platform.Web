import { useEffect } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { Switch } from '@/core/ui/switch';
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
  useCreateReasonHint,
  useUpdateReasonHint,
  type ReasonHint,
  type CreateReasonHintFields,
  type UpdateReasonHintFields,
} from '@/core/api/hooks/use-reason-hints';
import {
  REASON_HINT_SCOPES,
  type ReasonHintScope,
  parseCodes,
  codesToText,
} from './reason-hint-codes';

const reasonHintSchema = z.object({
  scope: z.enum(REASON_HINT_SCOPES, { message: 'admin:reasonHints.validation.scopeRequired' }),
  scopeRef: z.string().min(1, 'admin:reasonHints.validation.scopeRefRequired'),
  // The friendly comma-separated taxonomy codes (e.g. "CITAS, REPROG"). It is
  // serialized to a JSON array string on submit; at least one code is required.
  reasonCodes: z
    .string()
    .min(1, 'admin:reasonHints.validation.reasonPathRequired')
    .refine((v) => parseCodes(v).length > 0, 'admin:reasonHints.validation.reasonPathRequired'),
  priority: z.number().int(),
  isActive: z.boolean(),
});

export type ReasonHintFormValues = z.infer<typeof reasonHintSchema>;

interface ReasonHintFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  reasonHint?: ReasonHint;
}

const EMPTY_DEFAULTS: ReasonHintFormValues = {
  scope: 'Did',
  scopeRef: '',
  reasonCodes: '',
  priority: 0,
  isActive: true,
};

export function ReasonHintForm({ open, onOpenChange, mode, reasonHint }: ReasonHintFormProps) {
  const { t } = useTranslation('admin');
  const createReasonHint = useCreateReasonHint();
  const updateReasonHint = useUpdateReasonHint();

  const {
    handleSubmit,
    control,
    reset,
    register,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReasonHintFormValues>({
    resolver: zodResolver(reasonHintSchema) as Resolver<ReasonHintFormValues>,
    defaultValues: EMPTY_DEFAULTS,
  });

  const scope = watch('scope');

  const scopeRefA11y = useFieldA11y(errors.scopeRef, 'reason-hint-scopeRef', { required: true });
  const reasonCodesA11y = useFieldA11y(errors.reasonCodes, 'reason-hint-reasonCodes', {
    required: true,
  });
  const priorityA11y = useFieldA11y(errors.priority, 'reason-hint-priority');

  useEffect(() => {
    if (open) {
      reset(
        reasonHint
          ? {
              scope: (REASON_HINT_SCOPES as readonly string[]).includes(reasonHint.scope)
                ? (reasonHint.scope as ReasonHintScope)
                : 'Did',
              scopeRef: reasonHint.scopeRef,
              reasonCodes: codesToText(reasonHint.reasonPath),
              priority: reasonHint.priority,
              isActive: reasonHint.isActive,
            }
          : EMPTY_DEFAULTS,
      );
    }
  }, [open, reasonHint, reset]);

  // The scopeRef label/help adapts to the chosen scope; the input itself stays a
  // plain text field (P1 — no per-scope picker).
  const scopeRefLabel = t(`reasonHints.form.scopeRef_label_${scope.toLowerCase()}`);
  const scopeRefHint = t(`reasonHints.form.scopeRef_hint_${scope.toLowerCase()}`);

  const handleFormSubmit = handleSubmit((values) => {
    const reasonPath = JSON.stringify(parseCodes(values.reasonCodes));
    const scopeRef = values.scopeRef.trim();

    if (mode === 'edit' && reasonHint) {
      const payload: UpdateReasonHintFields = {
        scope: values.scope,
        scopeRef,
        reasonPath,
        priority: values.priority,
        isActive: values.isActive,
      };
      updateReasonHint.mutate(
        { id: reasonHint.id, ...payload },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      const payload: CreateReasonHintFields = {
        scope: values.scope,
        scopeRef,
        reasonPath,
        priority: values.priority,
        isActive: values.isActive,
      };
      createReasonHint.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  });

  const title =
    mode === 'create' ? t('reasonHints.form.create_title') : t('reasonHints.form.edit_title');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('reasonHints.form.create_description')
              : t('reasonHints.form.edit_description')}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          {/* Scope */}
          <div className="space-y-1.5">
            <Label required>{t('reasonHints.scope')}</Label>
            <Controller
              name="scope"
              control={control}
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" data-testid="reason-hint-form-scope">
                    <SelectValue placeholder={t('reasonHints.form.select_scope')} />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_HINT_SCOPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`reasonHints.scopeOption.${s.toLowerCase()}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">{t('reasonHints.form.scope_hint')}</p>
          </div>

          {/* Scope reference (label/help adapts to scope) */}
          <div className="space-y-1.5">
            <Label htmlFor="reason-hint-scopeRef" required>
              {scopeRefLabel}
            </Label>
            <Input
              id="reason-hint-scopeRef"
              placeholder={scopeRefLabel}
              data-testid="reason-hint-form-scopeRef"
              {...scopeRefA11y.inputProps}
              {...register('scopeRef')}
            />
            <p className="text-xs text-muted-foreground">{scopeRefHint}</p>
            <FieldError
              id={scopeRefA11y.errorId}
              message={errors.scopeRef?.message ? t(errors.scopeRef.message) : undefined}
            />
          </div>

          {/* Reason path (friendly comma-separated codes) */}
          <div className="space-y-1.5">
            <Label htmlFor="reason-hint-reasonCodes" required>
              {t('reasonHints.reasonPath')}
            </Label>
            <Input
              id="reason-hint-reasonCodes"
              placeholder={t('reasonHints.form.reasonPath_placeholder')}
              data-testid="reason-hint-form-reasonCodes"
              {...reasonCodesA11y.inputProps}
              {...register('reasonCodes')}
            />
            <p className="text-xs text-muted-foreground">{t('reasonHints.form.reasonPath_hint')}</p>
            <FieldError
              id={reasonCodesA11y.errorId}
              message={errors.reasonCodes?.message ? t(errors.reasonCodes.message) : undefined}
            />
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label htmlFor="reason-hint-priority">{t('reasonHints.priority')}</Label>
            <Input
              id="reason-hint-priority"
              type="number"
              data-testid="reason-hint-form-priority"
              {...priorityA11y.inputProps}
              {...register('priority', { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">{t('reasonHints.form.priority_hint')}</p>
            <FieldError
              id={priorityA11y.errorId}
              message={errors.priority?.message ? t(errors.priority.message) : undefined}
            />
          </div>

          {/* Is Active */}
          <div className="flex items-center gap-3">
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="reason-hint-isActive"
                  data-testid="reason-hint-form-isActive"
                />
              )}
            />
            <Label htmlFor="reason-hint-isActive">{t('reasonHints.form.active')}</Label>
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting} data-testid="reason-hint-form-submit">
              {mode === 'create'
                ? t('reasonHints.form.submit_create')
                : t('reasonHints.form.submit_edit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
