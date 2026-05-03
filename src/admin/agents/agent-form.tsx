import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
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
import { useUsers } from '@/core/api/hooks/use-users';
import { useAgents } from '@/core/api/hooks/use-agents';
import { useTeams } from '@/core/api/hooks/use-teams';

const skillSchema = z.object({
  name: z.string().min(1, 'admin:agents.validation.skillNameRequired'),
  proficiency: z.number().min(1).max(10),
});

const agentSchema = z.object({
  userId: z.string().min(1, 'admin:agents.validation.userRequired'),
  displayName: z.string().min(2),
  teamId: z.string().optional(),
  skills: z.array(skillSchema),
});

export type AgentFormValues = z.infer<typeof agentSchema>;

interface AgentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  defaultValues?: Partial<AgentFormValues>;
  onSubmit?: (values: AgentFormValues) => void;
}

export function AgentForm({ open, onOpenChange, mode, defaultValues, onSubmit }: AgentFormProps) {
  const { t } = useTranslation(['admin']);

  const { data: allUsers = [] } = useUsers();
  const { data: agents = [] } = useAgents();
  const { data: teams = [] } = useTeams();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      userId: '',
      displayName: '',
      teamId: '',
      skills: [],
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'skills' });

  useEffect(() => {
    if (open) {
      reset({
        userId: '',
        displayName: '',
        teamId: '',
        skills: [],
        ...defaultValues,
      });
    }
  }, [open, defaultValues, reset]);

  const handleFormSubmit = handleSubmit((values) => {
    onSubmit?.(values);
    onOpenChange(false);
  });

  /* Users not yet assigned as agents, plus the currently-edited user */
  const assignedUserIds = useMemo(
    () => new Set(agents.map((a) => a.userId)),
    [agents],
  );
  const availableUsers = useMemo(() => {
    const available = allUsers.filter(
      (u) => !assignedUserIds.has(u.id) || u.id === defaultValues?.userId,
    );
    return available.map((u) => ({ id: u.id, email: u.email, displayName: u.displayName }));
  }, [allUsers, assignedUserIds, defaultValues?.userId]);

  const title = mode === 'create' ? t('admin:agents.create') : t('admin:agents.edit');

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

        <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {/* User select */}
          <div className="space-y-1.5">
            <Label>{t('admin:agents.user')}</Label>
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
            {errors.userId && (
              <p className="text-xs text-destructive">{t(errors.userId.message ?? '')}</p>
            )}
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="displayName">{t('admin:agents.displayName')}</Label>
            <Input
              id="displayName"
              placeholder={t('admin:agents.displayNamePlaceholder')}
              aria-invalid={!!errors.displayName}
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="text-xs text-destructive">{errors.displayName.message}</p>
            )}
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
