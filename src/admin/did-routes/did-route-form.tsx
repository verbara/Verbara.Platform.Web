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
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import {
  useCreateDidRoute,
  useUpdateDidRoute,
  type DidRouteSummary,
  type CreateDidRouteFields,
  type UpdateDidRouteFields,
} from '@/core/api/hooks/use-did-routes';
import { useQueues } from '@/core/api/hooks/use-queues';

// Same E.164 contract the backend enforces (`^\+?[1-9]\d{6,14}$`): optional
// leading '+', non-zero first digit, 7–15 digits total. Validating client-side
// gives the operator early feedback before the API 400s.
const E164 = /^\+?[1-9]\d{6,14}$/;

const didRouteSchema = z.object({
  did: z
    .string()
    .min(1, 'admin:didRoutes.validation.didRequired')
    .refine((v) => E164.test(v.trim()), 'admin:didRoutes.validation.didInvalid'),
  // Queue is MANDATORY — never a DID without a destination. An empty string
  // (the unselected Select state) fails the min(1) check and blocks submit.
  queueId: z.string().min(1, 'admin:didRoutes.validation.queueRequired'),
  isActive: z.boolean(),
});

export type DidRouteFormValues = z.infer<typeof didRouteSchema>;

interface DidRouteFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  didRoute?: DidRouteSummary;
}

const EMPTY_DEFAULTS: DidRouteFormValues = {
  did: '',
  queueId: '',
  isActive: true,
};

export function DidRouteForm({ open, onOpenChange, mode, didRoute }: DidRouteFormProps) {
  const { t } = useTranslation('admin');
  const createDidRoute = useCreateDidRoute();
  const updateDidRoute = useUpdateDidRoute();
  // Populate the destination Select from active queues only. `useQueues`
  // returns the full list; filter to active so an operator can't route a DID
  // to a disabled queue.
  const { data: allQueues = [] } = useQueues();
  const queues = allQueues.filter((q) => q.isActive);

  const {
    handleSubmit,
    control,
    reset,
    register,
    formState: { errors, isSubmitting },
  } = useForm<DidRouteFormValues>({
    resolver: zodResolver(didRouteSchema) as Resolver<DidRouteFormValues>,
    defaultValues: EMPTY_DEFAULTS,
  });

  const didA11y = useFieldA11y(errors.did, 'did-route-did', { required: true });
  const queueA11y = useFieldA11y(errors.queueId, 'did-route-queue', { required: true });

  useEffect(() => {
    if (open) {
      reset(
        didRoute
          ? {
              did: didRoute.did,
              queueId: didRoute.queueId,
              isActive: didRoute.isActive,
            }
          : EMPTY_DEFAULTS,
      );
    }
  }, [open, didRoute, reset]);

  // Map a backend 409 (DID already exists in tenant) to a friendly toast. The
  // generic client surfaces the status as `API error: 409`; anything else falls
  // through to the hook's default `err.message` toast.
  const handleMutationError = (err: Error) => {
    if (err.message.includes('409')) {
      toast.error(t('didRoutes.form.duplicate_error'));
    } else {
      toast.error(err.message);
    }
  };

  const handleFormSubmit = handleSubmit((values) => {
    const did = values.did.trim();

    if (mode === 'edit' && didRoute) {
      const payload: UpdateDidRouteFields = {
        did,
        queueId: values.queueId,
        isActive: values.isActive,
      };
      updateDidRoute.mutate(
        { id: didRoute.id, ...payload },
        { onError: handleMutationError, onSuccess: () => onOpenChange(false) },
      );
    } else {
      const payload: CreateDidRouteFields = {
        did,
        queueId: values.queueId,
        isActive: values.isActive,
      };
      createDidRoute.mutate(payload, {
        onError: handleMutationError,
        onSuccess: () => onOpenChange(false),
      });
    }
  });

  const title =
    mode === 'create' ? t('didRoutes.form.create_title') : t('didRoutes.form.edit_title');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('didRoutes.form.create_description')
              : t('didRoutes.form.edit_description')}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          {/* DID (E.164) */}
          <div className="space-y-1.5">
            <Label htmlFor="did-route-did" required>
              {t('didRoutes.did')}
            </Label>
            <Input
              id="did-route-did"
              placeholder={t('didRoutes.form.did_placeholder')}
              data-testid="did-route-form-did"
              {...didA11y.inputProps}
              {...register('did')}
            />
            <p className="text-xs text-muted-foreground">{t('didRoutes.form.did_hint')}</p>
            <FieldError
              id={didA11y.errorId}
              message={errors.did?.message ? t(errors.did.message) : undefined}
            />
          </div>

          {/* Queue (MANDATORY — never a DID without a destination) */}
          <div className="space-y-1.5">
            <Label required>{t('didRoutes.queue')}</Label>
            <Controller
              name="queueId"
              control={control}
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" data-testid="did-route-form-queueId">
                    <SelectValue placeholder={t('didRoutes.form.select_queue')} />
                  </SelectTrigger>
                  <SelectContent>
                    {queues.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">{t('didRoutes.form.queue_hint')}</p>
            <FieldError
              id={queueA11y.errorId}
              message={errors.queueId?.message ? t(errors.queueId.message) : undefined}
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
                  id="did-route-isActive"
                  data-testid="did-route-form-isActive"
                />
              )}
            />
            <Label htmlFor="did-route-isActive">{t('didRoutes.form.active')}</Label>
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting} data-testid="did-route-form-submit">
              {mode === 'create'
                ? t('didRoutes.form.submit_create')
                : t('didRoutes.form.submit_edit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
