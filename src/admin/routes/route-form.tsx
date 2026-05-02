import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
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
import { useCreateRoute, useUpdateRoute, type OutboundRouteSummary } from '@/core/api/hooks/use-routes';
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
    resolver: zodResolver(routeSchema) as any,
    defaultValues: {
      priority: 10,
      pattern: '',
      patternType: 'prefix',
      trunkId: '' as unknown as number,
      overflowTrunkId: '',
      dialPrefix: '',
    },
  });

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
              trunkId: '' as unknown as number,
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

        <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {/* Priority */}
          <div className="space-y-1.5">
            <Label htmlFor="route-priority">{t('routes.priority')}</Label>
            <Input
              id="route-priority"
              type="number"
              min={0}
              placeholder="10"
              aria-invalid={!!errors.priority}
              data-testid="route-form-priority"
              {...register('priority')}
            />
            {errors.priority && (
              <p className="text-xs text-destructive">{t(errors.priority.message ?? '')}</p>
            )}
          </div>

          {/* Pattern */}
          <div className="space-y-1.5">
            <Label htmlFor="route-pattern">{t('routes.pattern')}</Label>
            <Input
              id="route-pattern"
              placeholder="+1"
              aria-invalid={!!errors.pattern}
              data-testid="route-form-pattern"
              {...register('pattern')}
            />
            {errors.pattern && (
              <p className="text-xs text-destructive">{t(errors.pattern.message ?? '')}</p>
            )}
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

          {/* Trunk */}
          <div className="space-y-1.5">
            <Label>{t('routes.trunk')}</Label>
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
            {errors.trunkId && (
              <p className="text-xs text-destructive">{t(errors.trunkId.message ?? '')}</p>
            )}
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
            <Input
              id="route-dialPrefix"
              placeholder="9"
              {...register('dialPrefix')}
            />
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
