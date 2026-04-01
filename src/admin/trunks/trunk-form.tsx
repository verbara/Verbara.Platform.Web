import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useCreateTrunk, useUpdateTrunk, type TrunkSummary } from '@/core/api/hooks/use-trunks';

const TRUNK_TYPES = ['SIP', 'PJSIP', 'IAX2', 'DAHDI'] as const;

const trunkSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  displayName: z.string().min(1, 'Display name is required'),
  type: z.enum(['SIP', 'PJSIP', 'IAX2', 'DAHDI']),
  maxChannels: z.coerce.number().int().min(1, 'Must be at least 1'),
  isActive: z.boolean(),
});

export type TrunkFormValues = z.infer<typeof trunkSchema>;

interface TrunkFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  trunk?: TrunkSummary;
}

export function TrunkForm({ open, onOpenChange, mode, trunk }: TrunkFormProps) {
  const createTrunk = useCreateTrunk();
  const updateTrunk = useUpdateTrunk();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TrunkFormValues>({
    resolver: zodResolver(trunkSchema) as any,
    defaultValues: {
      name: '',
      displayName: '',
      type: 'PJSIP',
      maxChannels: 10,
      isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        trunk
          ? {
              name: trunk.name,
              displayName: trunk.displayName,
              type: trunk.type as TrunkFormValues['type'],
              maxChannels: trunk.maxChannels,
              isActive: trunk.isActive,
            }
          : {
              name: '',
              displayName: '',
              type: 'PJSIP',
              maxChannels: 10,
              isActive: true,
            },
      );
    }
  }, [open, trunk, reset]);

  const handleFormSubmit = handleSubmit((values) => {
    if (mode === 'edit' && trunk) {
      updateTrunk.mutate({ id: trunk.id, ...values });
    } else {
      createTrunk.mutate(values);
    }
    onOpenChange(false);
  });

  const title = mode === 'create' ? 'Add Trunk' : 'Edit Trunk';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? 'Configure a new SIP/PJSIP/IAX2/DAHDI trunk.'
              : 'Update trunk configuration.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-name">Name</Label>
            <Input
              id="trunk-name"
              placeholder="my-trunk"
              aria-invalid={!!errors.name}
              data-testid="trunk-form-name"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-displayName">Display Name</Label>
            <Input
              id="trunk-displayName"
              placeholder="My Primary Trunk"
              aria-invalid={!!errors.displayName}
              data-testid="trunk-form-displayName"
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="text-xs text-destructive">{errors.displayName.message}</p>
            )}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" data-testid="trunk-form-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRUNK_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Max Channels */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-maxChannels">Max Channels</Label>
            <Input
              id="trunk-maxChannels"
              type="number"
              min={1}
              placeholder="10"
              aria-invalid={!!errors.maxChannels}
              data-testid="trunk-form-maxChannels"
              {...register('maxChannels')}
            />
            {errors.maxChannels && (
              <p className="text-xs text-destructive">{errors.maxChannels.message}</p>
            )}
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
                  id="trunk-isActive"
                  data-testid="trunk-form-isActive"
                />
              )}
            />
            <Label htmlFor="trunk-isActive">Active</Label>
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting} data-testid="trunk-form-submit">
              {mode === 'create' ? 'Add Trunk' : 'Save Changes'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
