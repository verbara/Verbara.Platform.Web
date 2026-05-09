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
  useCreateRoute,
  useUpdateRoute,
  type OutboundRouteSummary,
} from '@/core/api/hooks/use-routes';
import { useTrunks } from '@/core/api/hooks/use-trunks';

const PATTERN_TYPES = ['prefix', 'exact', 'regex'] as const;

const routeSchema = z.object({
  priority: z.coerce.number().int().min(0, 'admin:routes.validation.priorityAtLeastZero'),
  pattern: z.string().min(1, 'admin:routes.validation.patternRequired'),
  patternType: z.enum(['prefix', 'exact', 'regex']),
  trunkId: z.coerce.number().int().min(1, 'admin:routes.validation.trunkRequired'),
  overflowTrunkId: z.coerce.number().int().min(1).optional().or(z.literal('')),
  dialPrefix: z.string().optional(),
});

export type RouteFormValues = z.infer<typeof routeSchema>;

interface RouteFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  route?: OutboundRouteSummary;
}

export function RouteForm({ open, onOpenChange, mode, route }: RouteFormProps) {
  const { t } = useTranslation('admin');
  const createRoute = useCreateRoute();
  const updateRoute = useUpdateRoute();
  const { data: trunks = [] } = useTrunks();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RouteFormValues>({
    resolver: zodResolver(routeSchema) as Resolver<RouteFormValues>,
    defaultValues: {
      priority: 10,
      pattern: '',
      patternType: 'prefix',
      trunkId: undefined,
      overflowTrunkId: '',
      dialPrefix: '',
    },
  });

  const priorityA11y = useFieldA11y(errors.priority, 'route-priority', { required: true });
  const patternA11y = useFieldA11y(errors.pattern, 'route-pattern', { required: true });
  const trunkIdA11y = useFieldA11y(errors.trunkId, 'route-trunkId', { required: true });

  useEffect(() => {
    if (open) {
      reset(
        route
          ? {
              priority: route.priority,
              pattern: route.pattern,
              patternType: route.patternType as RouteFormValues['patternType'],
              trunkId: route.trunkId,
              overflowTrunkId: route.overflowTrunkId ?? '',
              dialPrefix: route.dialPrefix ?? '',
            }
          : {
              priority: 10,
              pattern: '',
              patternType: 'prefix',
              trunkId: undefined,
              overflowTrunkId: '',
              dialPrefix: '',
            },
      );
    }
  }, [open, route, reset]);

  const handleFormSubmit = handleSubmit((values) => {
    const payload = {
      priority: values.priority,
      pattern: values.pattern,
      patternType: values.patternType,
      trunkId: values.trunkId,
      overflowTrunkId: values.overflowTrunkId ? Number(values.overflowTrunkId) : undefined,
      dialPrefix: values.dialPrefix || undefined,
    };

    if (mode === 'edit' && route) {
      updateRoute.mutate({ id: route.id, ...payload });
    } else {
      createRoute.mutate(payload);
    }
    onOpenChange(false);
  });

  const title = mode === 'create' ? t('routes.form.create_title') : t('routes.form.edit_title');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('routes.form.create_description')
              : t('routes.form.edit_description')}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          {/* Priority */}
          <div className="space-y-1.5">
            <Label htmlFor="route-priority" required>
              {t('routes.priority')}
            </Label>
            <Input
              id="route-priority"
              type="number"
              min={0}
              placeholder="10"
              data-testid="route-form-priority"
              {...priorityA11y.inputProps}
              {...register('priority')}
            />
            <FieldError
              id={priorityA11y.errorId}
              message={errors.priority?.message ? t(errors.priority.message) : undefined}
            />
          </div>

          {/* Pattern */}
          <div className="space-y-1.5">
            <Label htmlFor="route-pattern" required>
              {t('routes.pattern')}
            </Label>
            <Input
              id="route-pattern"
              placeholder="+1"
              data-testid="route-form-pattern"
              {...patternA11y.inputProps}
              {...register('pattern')}
            />
            <FieldError
              id={patternA11y.errorId}
              message={errors.pattern?.message ? t(errors.pattern.message) : undefined}
            />
          </div>

          {/* Pattern Type */}
          <div className="space-y-1.5">
            <Label>{t('routes.patternType')}</Label>
            <Controller
              name="patternType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" data-testid="route-form-patternType">
                    <SelectValue placeholder={t('routes.form.select_type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PATTERN_TYPES.map((pt) => (
                      <SelectItem key={pt} value={pt}>
                        {pt.charAt(0).toUpperCase() + pt.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Trunk — Controller/Select: aria-* not forwarded through SelectTrigger */}
          <div className="space-y-1.5">
            <Label required>{t('routes.trunk')}</Label>
            <Controller
              name="trunkId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <SelectTrigger className="w-full" data-testid="route-form-trunkId">
                    <SelectValue placeholder={t('routes.form.select_trunk')} />
                  </SelectTrigger>
                  <SelectContent>
                    {trunks.map((trunk) => (
                      <SelectItem key={trunk.id} value={String(trunk.id)}>
                        {trunk.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError
              id={trunkIdA11y.errorId}
              message={errors.trunkId?.message ? t(errors.trunkId.message) : undefined}
            />
          </div>

          {/* Overflow Trunk (optional) */}
          <div className="space-y-1.5">
            <Label>{t('routes.form.overflow_trunk')}</Label>
            <Controller
              name="overflowTrunkId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(v) => field.onChange(v ? Number(v) : '')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('routes.form.no_overflow')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('routes.form.no_overflow')}</SelectItem>
                    {trunks.map((trunk) => (
                      <SelectItem key={trunk.id} value={String(trunk.id)}>
                        {trunk.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Dial Prefix */}
          <div className="space-y-1.5">
            <Label htmlFor="route-dialPrefix">{t('routes.form.dial_prefix_optional')}</Label>
            <Input id="route-dialPrefix" placeholder="9" {...register('dialPrefix')} />
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting} data-testid="route-form-submit">
              {mode === 'create' ? t('routes.form.submit_create') : t('routes.form.submit_edit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
