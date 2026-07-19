import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Mail,
  Users,
  Zap,
  CircleDot,
  Plus,
  X,
  Headset,
  ArrowRight,
  Phone,
  Gauge,
} from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { Separator } from '@/core/ui/separator';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { AgentForm } from './agent-form';
import { toCapacityOverride } from './capacity-override';
import { useAgent, useUpdateAgent, useDeleteAgent } from '@/core/api/hooks/use-agents';
import { useAgentSkills } from '@/core/api/hooks/use-skills';

interface AgentSkill {
  name: string;
  proficiency: number;
}

const stateBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  available: 'default',
  busy: 'destructive',
  away: 'secondary',
  offline: 'outline',
};

/**
 * Coerce a capacity-override field from the generated `ChannelCapacityOverrideDto`
 * (AOT-wire `number | string | null`) to the numeric `number | null` the agent
 * form expects. `null`/`undefined` stay `null` (inherit the tenant default).
 */
function overrideField(value: number | string | null | undefined): number | null {
  return value == null ? null : Number(value);
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm">{children}</div>
      </div>
    </div>
  );
}

function CapacityRow({
  label,
  value,
  overridden,
  fixed,
  overriddenLabel,
  inheritedLabel,
}: Readonly<{
  label: string;
  value: number | string;
  overridden: boolean;
  fixed?: boolean;
  overriddenLabel?: string;
  inheritedLabel?: string;
}>) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm tabular-nums">{value}</span>
        {!fixed && (
          <Badge variant={overridden ? 'default' : 'outline'}>
            {overridden ? overriddenLabel : inheritedLabel}
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function AgentDetailPage() {
  const { t } = useTranslation(['admin']);
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillProf, setNewSkillProf] = useState('5');
  const [skillsInitialized, setSkillsInitialized] = useState(false);

  const { data: agent } = useAgent(agentId);
  const { data: agentSkills = [] } = useAgentSkills(agentId);
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();

  /* Initialize skills from agent data once loaded */
  if (agent && !skillsInitialized) {
    setSkills((agent.skills ?? []).map((name) => ({ name, proficiency: 5 })));
    setSkillsInitialized(true);
  }

  if (!agent) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Agent not found.
      </div>
    );
  }

  const handleDelete = () => {
    deleteAgent.mutate(agent.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        navigate('/admin/agents');
      },
    });
  };

  const handleAddSkill = () => {
    const name = newSkillName.trim();
    const proficiency = parseInt(newSkillProf, 10);
    if (!name || isNaN(proficiency) || proficiency < 1 || proficiency > 10) return;
    if (skills.some((s) => s.name === name)) return;
    setSkills([...skills, { name, proficiency }]);
    setNewSkillName('');
    setNewSkillProf('5');
  };

  const handleRemoveSkill = (name: string) => {
    setSkills(skills.filter((s) => s.name !== name));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/agents')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Agent info card */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-heading text-xl font-semibold">{agent.displayName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{agent.userEmail}</p>

        <Separator className="my-4" />

        <InfoRow icon={Mail} label={t('admin:agents.user')}>
          {agent.userEmail}
        </InfoRow>
        <InfoRow icon={Users} label={t('admin:agents.team')}>
          {agent.teamName ? (
            <Badge variant="secondary">{agent.teamName}</Badge>
          ) : (
            <span className="text-muted-foreground">&mdash;</span>
          )}
        </InfoRow>
        <InfoRow icon={CircleDot} label={t('admin:agents.state')}>
          <Badge variant={stateBadgeVariant[agent.state] ?? 'outline'}>{agent.state}</Badge>
        </InfoRow>
        <InfoRow icon={Phone} label={t('admin:agents.extension')}>
          {agent.extension ? (
            <span data-testid="agent-detail-extension" className="font-mono">
              {agent.extension}
            </span>
          ) : (
            <span className="text-muted-foreground">&mdash;</span>
          )}
        </InfoRow>
      </div>

      {/* Channel capacity (W6) — effective per-channel limits with inherited/overridden tags. */}
      {agent.effectiveCapacity && (
        <div data-testid="agent-detail-capacity" className="rounded-lg border bg-card p-6">
          <h3 className="font-heading text-lg font-semibold">{t('admin:agents.capacity.title')}</h3>
          <Separator className="my-3" />
          <div className="space-y-1">
            <CapacityRow
              label={t('admin:agents.capacity.maxVoice')}
              value={t('admin:agents.capacity.voiceFixed')}
              overridden={false}
              fixed
            />
            <CapacityRow
              label={t('admin:agents.capacity.maxChat')}
              value={agent.effectiveCapacity.maxChat ?? 0}
              overridden={agent.capacityOverride?.maxChat != null}
              overriddenLabel={t('admin:agents.capacity.overridden')}
              inheritedLabel={t('admin:agents.capacity.inherited')}
            />
            <CapacityRow
              label={t('admin:agents.capacity.maxEmail')}
              value={agent.effectiveCapacity.maxEmail ?? 0}
              overridden={agent.capacityOverride?.maxEmail != null}
              overriddenLabel={t('admin:agents.capacity.overridden')}
              inheritedLabel={t('admin:agents.capacity.inherited')}
            />
            <CapacityRow
              label={t('admin:agents.capacity.maxSms')}
              value={agent.effectiveCapacity.maxSms ?? 0}
              overridden={agent.capacityOverride?.maxSms != null}
              overriddenLabel={t('admin:agents.capacity.overridden')}
              inheritedLabel={t('admin:agents.capacity.inherited')}
            />
            <CapacityRow
              label={t('admin:agents.capacity.maxTotal')}
              value={agent.effectiveCapacity.maxTotal ?? 0}
              overridden={agent.capacityOverride?.maxTotal != null}
              overriddenLabel={t('admin:agents.capacity.overridden')}
              inheritedLabel={t('admin:agents.capacity.inherited')}
            />
          </div>
        </div>
      )}

      {/* Skills section */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-heading text-lg font-semibold">{t('admin:agents.skills')}</h3>
        <Separator className="my-3" />

        {skills.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('admin:agents.noSkills')}
          </p>
        ) : (
          <div className="space-y-2">
            {skills.map((skill) => (
              <div
                key={skill.name}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{skill.name}</span>
                  <Badge variant="outline">{skill.proficiency}/10</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleRemoveSkill(skill.name)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Inline skill add */}
        <div className="mt-3 flex items-center gap-2">
          <Input
            placeholder={t('admin:agents.skillName')}
            aria-label={t('admin:agents.skillName')}
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            className="flex-1"
          />
          <Input
            type="number"
            min={1}
            max={10}
            placeholder="1-10"
            aria-label={t('admin:agents.skillProficiency', 'Skill proficiency 1-10')}
            value={newSkillProf}
            onChange={(e) => setNewSkillProf(e.target.value)}
            className="w-20"
          />
          <Button type="button" variant="outline" size="sm" onClick={handleAddSkill}>
            <Plus className="mr-1 h-3 w-3" />
            {t('admin:agents.addSkill')}
          </Button>
        </div>
      </div>

      {/* Queue memberships — ADR-0026 Phase A.6 channel-aware editor lives at
          /admin/agents/{agentId}/queues. */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-heading text-lg font-semibold">{t('admin:agents.queues')}</h3>
        <Separator className="my-3" />
        <p className="text-sm text-muted-foreground">
          {t(
            'admin:agents.queuesEditorIntro',
            'Manage which queues this agent serves and restrict membership per channel (Voice gates the Asterisk PBX sync).',
          )}
        </p>
        <Button
          data-testid="agent-detail-manage-queues"
          variant="outline"
          className="mt-4"
          onClick={() => navigate(`/admin/agents/${agent.id}/queues`)}
        >
          <Headset className="mr-1.5 h-4 w-4" />
          {t('admin:agents.manageQueues', 'Manage queues')}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>

      {/* Skills & Proficiency (from routing system) */}
      <PermissionGuard requires="routing:skill:view">
        <div className="rounded-lg border bg-card p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Skills &amp; Proficiency
          </p>
          {agentSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills assigned via routing.</p>
          ) : (
            <div className="space-y-3">
              {agentSkills.map((skill) => (
                <div key={skill.skillName} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{skill.skillName}</span>
                    <span className="text-xs text-muted-foreground">{skill.proficiency}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${skill.proficiency}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PermissionGuard>

      {/* Edit sheet */}
      <AgentForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        defaultValues={{
          userId: agent.userId,
          displayName: agent.displayName,
          teamId: agent.teamId ?? '',
          skills: (agent.skills ?? []).map((name) => ({ name, proficiency: 5 })),
          extension: agent.extension ?? '',
          // W6 — prefill the async override inputs from the agent's stored override.
          // A null field (or a null override object) shows the inherited placeholder.
          // The generated `capacityOverride` fields are the AOT-wire `number | string`
          // union; coerce each non-null value to the numeric form the form expects.
          capacity: {
            maxChat: overrideField(agent.capacityOverride?.maxChat),
            maxEmail: overrideField(agent.capacityOverride?.maxEmail),
            maxSms: overrideField(agent.capacityOverride?.maxSms),
            maxTotal: overrideField(agent.capacityOverride?.maxTotal),
          },
        }}
        onSubmit={(v) => {
          // sipPassword is write-only: a blank field means "keep the current
          // password" (the API never returns it), so omit it from the update.
          const { sipPassword, capacity, ...rest } = v;
          updateAgent.mutate({
            id: agent.id,
            ...rest,
            // W6 — always send the full override (maxVoice null = server-pinned 1).
            capacity: toCapacityOverride(capacity),
            ...(sipPassword ? { sipPassword } : {}),
          });
        }}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('admin:agents.deleteTitle')}
        description={
          <>
            Are you sure you want to delete <strong>{agent.displayName}</strong>? This action cannot
            be undone.
          </>
        }
        onConfirm={handleDelete}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
