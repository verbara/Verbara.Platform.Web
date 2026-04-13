import { useEffect, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
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
import { USAGE_TYPES, type RateCard, type CreateRateCardInput } from '@/core/api/hooks/use-billing';
import { useCreatePartnerRateCard, useUpdatePartnerRateCard } from '@/core/api/hooks/use-partner';

const rateEntrySchema = z.object({
  usageType: z.string().min(1, 'Required'),
  unitPrice: z.coerce.number().min(0),
  includedQuantity: z.coerce.number().min(0),
});

const rateCardSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  currency: z.string().min(1, 'Currency is required'),
  effectiveFrom: z.string().min(1, 'Start date required'),
  effectiveTo: z.string().optional(),
  isDefault: z.boolean(),
  rates: z.array(rateEntrySchema).min(1, 'At least one rate entry is required'),
});

type RateCardFormValues = z.infer<typeof rateCardSchema>;

interface PartnerRateCardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  rateCard?: RateCard;
}

function mapToForm(rc: RateCard): RateCardFormValues {
  return {
    name: rc.name,
    currency: rc.currency,
    effectiveFrom: rc.effectiveFrom.slice(0, 16),
    effectiveTo: rc.effectiveTo?.slice(0, 16) ?? '',
    isDefault: rc.isDefault,
    rates: rc.rates.map((r) => ({
      usageType: r.usageType,
      unitPrice: r.unitPrice,
      includedQuantity: r.includedQuantity,
    })),
  };
}

const DEFAULT_VALUES: RateCardFormValues = {
  name: '',
  currency: 'USD',
  effectiveFrom: '',
  effectiveTo: '',
  isDefault: false,
  rates: [],
};

export function PartnerRateCardForm({ open, onOpenChange, mode, rateCard }: Readonly<PartnerRateCardFormProps>) {
  const create = useCreatePartnerRateCard();
  const update = useUpdatePartnerRateCard();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RateCardFormValues>({
    resolver: zodResolver(rateCardSchema) as never,
    defaultValues: DEFAULT_VALUES,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'rates' });

  useEffect(() => {
    if (open) {
      reset(rateCard ? mapToForm(rateCard) : DEFAULT_VALUES);
    }
  }, [open, rateCard, reset]);

  const addRate = useCallback(() => {
    append({ usageType: 'VoiceInbound', unitPrice: 0, includedQuantity: 0 });
  }, [append]);

  const onSubmit = handleSubmit((values) => {
    const payload: CreateRateCardInput = {
      name: values.name,
      currency: values.currency,
      effectiveFrom: new Date(values.effectiveFrom).toISOString(),
      effectiveTo: values.effectiveTo ? new Date(values.effectiveTo).toISOString() : null,
      isDefault: values.isDefault,
      rates: values.rates.map((r) => ({
        usageType: r.usageType,
        unitPrice: r.unitPrice,
        includedQuantity: r.includedQuantity,
        tiers: null,
      })),
    };

    if (mode === 'edit' && rateCard) {
      update.mutate({ id: rateCard.rateCardId, ...payload });
    } else {
      create.mutate(payload);
    }
    onOpenChange(false);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{mode === 'create' ? 'Create rate card' : 'Edit rate card'}</SheetTitle>
          <SheetDescription>
            {mode === 'create' ? 'Define partner pricing rates for usage types.' : 'Update partner rate card.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="space-y-1.5">
            <Label htmlFor="prc-name">Name</Label>
            <Input id="prc-name" data-testid="partner-rate-card-name" placeholder="Standard partner pricing" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prc-currency">Currency</Label>
            <Input id="prc-currency" data-testid="partner-rate-card-currency" placeholder="USD" {...register('currency')} />
            {errors.currency && <p className="text-xs text-destructive">{errors.currency.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prc-from">Effective from</Label>
              <Input id="prc-from" type="datetime-local" data-testid="partner-rate-card-from" {...register('effectiveFrom')} />
              {errors.effectiveFrom && <p className="text-xs text-destructive">{errors.effectiveFrom.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prc-to">Effective to</Label>
              <Input id="prc-to" type="datetime-local" data-testid="partner-rate-card-to" {...register('effectiveTo')} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Controller
              name="isDefault"
              control={control}
              render={({ field }) => (
                <Switch id="prc-default" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="prc-default">Default rate card</Label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Rate entries</Label>
              <Button type="button" size="sm" variant="outline" onClick={addRate} data-testid="partner-add-rate-entry">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add rate
              </Button>
            </div>

            {errors.rates?.root && (
              <p className="text-xs text-destructive">{errors.rates.root.message}</p>
            )}

            {fields.length === 0 && (
              <p className="text-sm text-muted-foreground">No rate entries yet. Add at least one.</p>
            )}

            {fields.map((field, index) => (
              <div key={field.id} className="rounded-md border bg-muted/30 p-3 space-y-2" data-testid={`partner-rate-entry-${index}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Rate #{index + 1}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <Controller
                  name={`rates.${index}.usageType`}
                  control={control}
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select usage type" />
                      </SelectTrigger>
                      <SelectContent>
                        {USAGE_TYPES.map((ut) => (
                          <SelectItem key={ut} value={ut}>{ut}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Unit price</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="0.00"
                      {...register(`rates.${index}.unitPrice`, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Included qty</Label>
                    <Input
                      type="number"
                      step="1"
                      placeholder="0"
                      {...register(`rates.${index}.includedQuantity`, { valueAsNumber: true })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting} data-testid="partner-rate-card-submit">
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
