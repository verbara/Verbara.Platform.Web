import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
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
import { useCreateBot, useUpdateBot, type Bot } from '@/core/api/hooks/use-bots';
import { useFlows } from '@/core/api/hooks/use-flows';
import { useQueues } from '@/core/api/hooks/use-queues';

const botSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  defaultFlowId: z.string().optional(),
  fallbackQueueId: z.string().optional(),
  confidenceThreshold: z.coerce.number().min(0).max(1),
  maxTurns: z.coerce.number().int().min(1),
  isActive: z.boolean(),
});

export type BotFormValues = z.infer<typeof botSchema>;

interface BotFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  bot?: Bot;
}

const NO_SELECTION = '__none__';

export function BotForm({ open, onOpenChange, mode, bot }: BotFormProps) {
  const { t } = useTranslation(['admin']);
  const createBot = useCreateBot();
  const updateBot = useUpdateBot();
  const { data: flows = [] } = useFlows();
  const { data: queues = [] } = useQueues();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BotFormValues>({
    resolver: zodResolver(botSchema) as any,
    defaultValues: {
      name: '',
      defaultFlowId: undefined,
      fallbackQueueId: undefined,
      confidenceThreshold: 0.7,
      maxTurns: 20,
      isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        bot
          ? {
              name: bot.name,
              defaultFlowId: bot.defaultFlowId,
              fallbackQueueId: bot.fallbackQueueId,
              confidenceThreshold: bot.confidenceThreshold,
              maxTurns: bot.maxTurns,
              isActive: bot.isActive,
            }
          : {
              name: '',
              defaultFlowId: undefined,
              fallbackQueueId: undefined,
              confidenceThreshold: 0.7,
              maxTurns: 20,
              isActive: true,
            },
      );
    }
  }, [open, bot, reset]);

  const handleFormSubmit = handleSubmit((values) => {
    const payload = {
      ...values,
      defaultFlowId: values.defaultFlowId === NO_SELECTION ? undefined : values.defaultFlowId,
      fallbackQueueId: values.fallbackQueueId === NO_SELECTION ? undefined : values.fallbackQueueId,
    };
    if (mode === 'edit' && bot) {
      updateBot.mutate({ id: bot.id, ...payload });
    } else {
      createBot.mutate(payload);
    }
    onOpenChange(false);
  });

  const title = mode === 'create' ? t('admin:bots.create') : t('admin:bots.edit');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('admin:bots.createDescription')
              : t('admin:bots.editDescription')}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="bot-name">{t('admin:bots.name')}</Label>
            <Input
              id="bot-name"
              data-testid="bot-form-name"
              placeholder="my-bot"
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Default Flow */}
          <div className="space-y-1.5">
            <Label>{t('admin:bots.defaultFlow')}</Label>
            <Controller
              name="defaultFlowId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? NO_SELECTION}
                  onValueChange={(v) => field.onChange(v === NO_SELECTION ? undefined : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('admin:bots.selectFlow')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SELECTION}>{t('admin:bots.noFlow')}</SelectItem>
                    {flows.map((f) => (
                      <SelectItem key={f.flowId} value={f.flowId}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Fallback Queue */}
          <div className="space-y-1.5">
            <Label>{t('admin:bots.fallbackQueue')}</Label>
            <Controller
              name="fallbackQueueId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? NO_SELECTION}
                  onValueChange={(v) => field.onChange(v === NO_SELECTION ? undefined : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('admin:bots.selectQueue')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SELECTION}>{t('admin:bots.noQueue')}</SelectItem>
                    {queues.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Confidence Threshold */}
          <div className="space-y-1.5">
            <Label htmlFor="bot-confidence">{t('admin:bots.confidenceThreshold')}</Label>
            <Controller
              name="confidenceThreshold"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-3">
                  <input
                    id="bot-confidence"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={field.value}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    className="flex-1 accent-brand"
                  />
                  <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
                    {field.value.toFixed(2)}
                  </span>
                </div>
              )}
            />
            {errors.confidenceThreshold && (
              <p className="text-xs text-destructive">{errors.confidenceThreshold.message}</p>
            )}
          </div>

          {/* Max Turns */}
          <div className="space-y-1.5">
            <Label htmlFor="bot-maxTurns">{t('admin:bots.maxTurns')}</Label>
            <Input
              id="bot-maxTurns"
              data-testid="bot-form-maxTurns"
              type="number"
              min={1}
              placeholder="20"
              aria-invalid={!!errors.maxTurns}
              {...register('maxTurns')}
            />
            {errors.maxTurns && (
              <p className="text-xs text-destructive">{errors.maxTurns.message}</p>
            )}
          </div>

          {/* Active */}
          <div className="flex items-center gap-3">
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="bot-isActive"
                  data-testid="bot-form-isActive"
                />
              )}
            />
            <Label htmlFor="bot-isActive">{t('admin:bots.active')}</Label>
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button data-testid="bot-form-submit" type="submit" disabled={isSubmitting}>
              {mode === 'create' ? t('admin:bots.create') : t('admin:bots.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
