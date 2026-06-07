import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, AlertTriangle, RotateCcw } from 'lucide-react';
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
import { useUsers } from '@/core/api/hooks/use-users';
import { useAgents } from '@/core/api/hooks/use-agents';
import { useTeams } from '@/core/api/hooks/use-teams';
import { useTenantSettings } from '@/admin/tenants/use-tenant-settings';
import { useAuthStore } from '@/core/auth/auth-store';
import { generateSipPassword } from './sip-password';

const skillSchema = z.object({
  name: z.string().min(1, 'admin:agents.validation.skillNameRequired'),
  proficiency: z.number().min(1).max(10),
});

// W6 — per-agent capacity override. Each async field is tri-state: a number sets
// an explicit per-channel limit (0–50); `null` (empty input) inherits the tenant
// default. MaxVoice is NOT a user field — it is pinned to 1 by the server until
// simultaneous voice (W5b ARI mixing-bridge) ships, so it is rendered read-only
// and always submitted as `null` (the server inherits the pinned 1).
const capacityFieldSchema = z.number().int().min(0).max(50).nullable();

const capacitySchema = z.object({
  maxChat: capacityFieldSchema,
  maxEmail: capacityFieldSchema,
  maxSms: capacityFieldSchema,
  maxTotal: capacityFieldSchema,
});

const agentSchema = z.object({
  userId: z.string().min(1, 'admin:agents.validation.userRequired'),
  displayName: z.string().min(2),
  teamId: z.string().optional(),
  skills: z.array(skillSchema),
  // Phase 3A — SIP credentials for the in-browser softphone. Optional: an agent
  // without them is digital-only. The extension is the SIP user number; the
  // password is write-only (never returned by the API) — leave blank on edit to
  // keep the current one.
  extension: z.string().optional(),
  sipPassword: z.string().optional(),
  // Phase 3B.2b — per-agent auto-answer override. Tri-state: null = inherit the call's queue
  // default, true/false = explicit. Stored as bool|null so it passes straight through to the
  // create/update payload (the parent forwards form values verbatim).
  autoAnswer: z.boolean().nullable().optional(),
  // W6 — optional per-agent capacity override. Each async field nullable (= inherit
  // the tenant default). MaxVoice is omitted here (server-pinned to 1).
  capacity: capacitySchema.optional(),
});

export type AgentFormValues = z.infer<typeof agentSchema>;

interface AgentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  defaultValues?: Partial<AgentFormValues>;
  onSubmit?: (values: AgentFormValues) => void;
}

// All-null override = fully inherit the tenant defaults (create-mode baseline).
const EMPTY_CAPACITY: AgentFormValues['capacity'] = {
  maxChat: null,
  maxEmail: null,
  maxSms: null,
  maxTotal: null,
};

export function AgentForm({ open, onOpenChange, mode, defaultValues, onSubmit }: AgentFormProps) {
  const { t } = useTranslation(['admin']);

  const { data: allUsers = [] } = useUsers();
  const { data: agents = [] } = useAgents();
  const { data: teams = [] } = useTeams();

  // W6 — tenant defaults are the inherited-placeholder source for empty override fields.
  const tenantId = useAuthStore((s) => s.tenantId);
  const { data: tenantSettings } = useTenantSettings(tenantId ?? '');
  const tenantDefaults = tenantSettings?.operational;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      userId: '',
      displayName: '',
      teamId: '',
      skills: [],
      extension: '',
      sipPassword: '',
      autoAnswer: null,
      capacity: EMPTY_CAPACITY,
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'skills' });

  const userIdA11y = useFieldA11y(errors.userId, 'agent-userId', { required: true });
  const displayNameA11y = useFieldA11y(errors.displayName, 'agent-displayName', { required: true });

  useEffect(() => {
    if (open) {
      reset({
        userId: '',
        displayName: '',
        teamId: '',
        skills: [],
        extension: '',
        sipPassword: '',
        autoAnswer: null,
        capacity: EMPTY_CAPACITY,
        ...defaultValues,
      });
    }
  }, [open, defaultValues, reset]);

  // W6 — live override values to drive inherited/overridden affordances + the
  // MaxTotal-below-cap advisory warning.
  const capacityValues = watch('capacity');

  const handleFormSubmit = handleSubmit((values) => {
    onSubmit?.(values);
    onOpenChange(false);
  });

  /* Users not yet assigned as agents, plus the currently-edited user */
  const assignedUserIds = useMemo(() => new Set(agents.map((a) => a.userId)), [agents]);
  const availableUsers = useMemo(() => {
    const available = allUsers.filter(
      (u) => !assignedUserIds.has(u.id) || u.id === defaultValues?.userId,
    );
    return available.map((u) => ({ id: u.id, email: u.email, displayName: u.displayName }));
  }, [allUsers, assignedUserIds, defaultValues?.userId]);

  const title = mode === 'create' ? t('admin:agents.create') : t('admin:agents.edit');

  // W6 — editable async capacity fields. `defaultKey` reads the inherited tenant
  // default (placeholder source) when the override is empty/null.
  const capacityFields = [
    {
      name: 'maxChat',
      label: t('admin:agents.capacity.maxChat'),
      defaultValue: tenantDefaults?.maxChatDefault,
    },
    {
      name: 'maxEmail',
      label: t('admin:agents.capacity.maxEmail'),
      defaultValue: tenantDefaults?.maxEmailDefault,
    },
    {
      name: 'maxSms',
      label: t('admin:agents.capacity.maxSms'),
      defaultValue: tenantDefaults?.maxSmsDefault,
    },
    {
      name: 'maxTotal',
      label: t('admin:agents.capacity.maxTotal'),
      defaultValue: tenantDefaults?.maxTotalDefault,
    },
  ] as const;

  // Advisory: warn when the effective MaxTotal sits below the effective Chat cap
  // (an entered override falls back to the tenant default when empty). Server allows
  // it, so this NEVER blocks submit.
  const effectiveTotal = capacityValues?.maxTotal ?? tenantDefaults?.maxTotalDefault;
  const effectiveChat = capacityValues?.maxChat ?? tenantDefaults?.maxChatDefault;
  const showMaxTotalWarning =
    typeof effectiveTotal === 'number' &&
    typeof effectiveChat === 'number' &&
    effectiveTotal < effectiveChat;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('admin:agents.createDescription')
              : t('admin:agents.editDescription')}
          </SheetDescription>
        </SheetHeader>

        <form
          data-testid="agent-form"
          onSubmit={handleFormSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          {/* User select — Controller/Select: aria-* not forwarded through SelectTrigger */}
          <div className="space-y-1.5">
            <Label required>{t('admin:agents.user')}</Label>
            <Controller
              name="userId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('admin:agents.selectUser')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.displayName} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError
              id={userIdA11y.errorId}
              message={errors.userId?.message ? t(errors.userId.message) : undefined}
            />
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="agent-displayName" required>
              {t('admin:agents.displayName')}
            </Label>
            <Input
              id="agent-displayName"
              placeholder={t('admin:agents.displayNamePlaceholder')}
              {...displayNameA11y.inputProps}
              {...register('displayName')}
            />
            <FieldError
              id={displayNameA11y.errorId}
              message={errors.displayName?.message?.toString()}
            />
          </div>

          {/* Team select */}
          <div className="space-y-1.5">
            <Label>{t('admin:agents.team')}</Label>
            <Controller
              name="teamId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('admin:agents.noTeam')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('admin:agents.noTeam')}</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* SIP credentials (Phase 3A — in-browser softphone) */}
          <div className="space-y-1.5">
            <Label htmlFor="agent-extension">{t('admin:agents.extension')}</Label>
            <Input
              id="agent-extension"
              data-testid="agent-extension"
              placeholder={t('admin:agents.extensionPlaceholder', 'e.g. 1001')}
              {...register('extension')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-sipPassword">{t('admin:agents.sipPassword')}</Label>
            <div className="flex gap-2">
              <Input
                id="agent-sipPassword"
                data-testid="agent-sipPassword"
                type="text"
                autoComplete="off"
                placeholder={t('admin:agents.sipPasswordPlaceholder', 'Generate or enter')}
                className="flex-1"
                {...register('sipPassword')}
              />
              <Button
                type="button"
                variant="outline"
                data-testid="agent-generate-sip"
                onClick={() =>
                  setValue('sipPassword', generateSipPassword(), { shouldDirty: true })
                }
              >
                {t('admin:agents.generatePassword', 'Generate')}
              </Button>
            </div>
            {mode === 'edit' && (
              <p className="text-xs text-muted-foreground">
                {t('admin:agents.sipPasswordEditHint', 'Leave blank to keep the current password.')}
              </p>
            )}
          </div>

          {/* Auto-answer (3B.2b) — tri-state: inherit the queue default / always / never. */}
          <div className="space-y-1.5">
            <Label htmlFor="agent-auto-answer">{t('admin:agents.autoAnswer', 'Auto-answer')}</Label>
            <Controller
              name="autoAnswer"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value === true ? 'on' : field.value === false ? 'off' : 'inherit'}
                  onValueChange={(v) =>
                    field.onChange(v === 'on' ? true : v === 'off' ? false : null)
                  }
                >
                  <SelectTrigger className="w-full" data-testid="agent-auto-answer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">
                      {t('admin:agents.autoAnswerInherit', 'Inherit queue default')}
                    </SelectItem>
                    <SelectItem value="on">{t('admin:agents.autoAnswerOn', 'Always')}</SelectItem>
                    <SelectItem value="off">{t('admin:agents.autoAnswerOff', 'Never')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              {t(
                'admin:agents.autoAnswerHint',
                'Automatically accept incoming calls without clicking Answer.',
              )}
            </p>
          </div>

          {/* Skills */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('admin:agents.skills')}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: '', proficiency: 5 })}
              >
                <Plus className="mr-1 h-3 w-3" />
                {t('admin:agents.addSkill')}
              </Button>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder={t('admin:agents.skillName')}
                    aria-invalid={!!errors.skills?.[index]?.name}
                    {...register(`skills.${index}.name`)}
                  />
                  {errors.skills?.[index]?.name && (
                    <p className="text-xs text-destructive">{errors.skills[index].name?.message}</p>
                  )}
                </div>
                <div className="w-20 space-y-1">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    placeholder="1-10"
                    aria-invalid={!!errors.skills?.[index]?.proficiency}
                    {...register(`skills.${index}.proficiency`)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-0.5 h-8 w-8 p-0"
                  onClick={() => remove(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {fields.length === 0 && (
              <p className="text-xs text-muted-foreground">{t('admin:agents.noSkills')}</p>
            )}
          </div>

          {/* Channel capacity (W6) — per-agent override of the tenant defaults. */}
          <div
            data-testid="agent-capacity-section"
            className="space-y-3 rounded-lg border bg-muted/30 p-4"
          >
            <Label>{t('admin:agents.capacity.title')}</Label>

            {/* Voice — pinned to 1 (read-only) until simultaneous voice ships. */}
            <div className="space-y-1.5">
              <Label htmlFor="agent-capacity-voice">{t('admin:agents.capacity.maxVoice')}</Label>
              <Input
                id="agent-capacity-voice"
                data-testid="agent-capacity-voice"
                type="number"
                value="1"
                readOnly
                disabled
                title={t('admin:agents.capacity.maxVoicePinnedHint')}
              />
              <p className="text-xs text-muted-foreground">
                {t('admin:agents.capacity.maxVoicePinnedHint')}
              </p>
            </div>

            {/* Async channels — number input yields number|null (empty = inherit). */}
            {capacityFields.map((cf) => (
              <Controller
                key={cf.name}
                name={`capacity.${cf.name}`}
                control={control}
                render={({ field }) => {
                  const isOverridden = field.value !== null && field.value !== undefined;
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`agent-capacity-${cf.name}`}>{cf.label}</Label>
                        <span
                          data-testid={`agent-capacity-${cf.name}-state`}
                          className="text-xs text-muted-foreground"
                        >
                          {isOverridden
                            ? t('admin:agents.capacity.overridden')
                            : t('admin:agents.capacity.inherited')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`agent-capacity-${cf.name}`}
                          data-testid={`agent-capacity-${cf.name}`}
                          type="number"
                          min={0}
                          max={50}
                          value={field.value ?? ''}
                          placeholder={
                            cf.defaultValue !== undefined ? String(cf.defaultValue) : undefined
                          }
                          onChange={(e) => {
                            // Empty input (or an invalid/NaN intermediate state) = inherit.
                            const n = e.target.valueAsNumber;
                            field.onChange(Number.isNaN(n) ? null : n);
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={!isOverridden}
                          title={t('admin:agents.capacity.resetToInherited')}
                          aria-label={t('admin:agents.capacity.resetToInherited')}
                          data-testid={`agent-capacity-${cf.name}-reset`}
                          onClick={() => field.onChange(null)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                }}
              />
            ))}

            {showMaxTotalWarning && (
              <p
                data-testid="agent-capacity-total-warning"
                className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t('admin:agents.capacity.maxTotalBelowCapWarning')}
              </p>
            )}
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting}>
              {mode === 'create' ? t('admin:agents.create') : t('admin:agents.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
