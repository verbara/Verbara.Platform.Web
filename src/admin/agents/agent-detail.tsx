import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Trash2, Mail, Users, Zap, CircleDot, Plus, X } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { Separator } from '@/core/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/core/ui/dialog';
import { AgentForm } from './agent-form';
import { MOCK_AGENTS } from './agents-page';
import type { Agent, AgentSkill } from './agents-page';

const stateBadgeVariant: Record<Agent['state'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  available: 'default',
  busy: 'destructive',
  away: 'secondary',
  offline: 'outline',
};

function InfoRow({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
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

const MOCK_QUEUE_MEMBERSHIPS = [
  { id: 'q1', name: 'General Support' },
  { id: 'q2', name: 'Billing' },
  { id: 'q3', name: 'VIP' },
];

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

  const { data: agent } = useQuery({
    queryKey: ['agents', agentId],
    queryFn: async () => MOCK_AGENTS.find((a) => a.id === agentId) ?? null,
  });

  /* Initialize skills from agent data once loaded */
  if (agent && !skillsInitialized) {
    setSkills(agent.skills);
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
    // TODO: call API to delete agent
    setDeleteOpen(false);
    navigate('/admin/agents');
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

  /* Queue memberships scoped to this agent (mock) */
  const queues = MOCK_QUEUE_MEMBERSHIPS.slice(0, agent.queueCount);

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
          <Badge variant={stateBadgeVariant[agent.state]}>
            {agent.state}
          </Badge>
        </InfoRow>
      </div>

      {/* Skills section */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-heading text-lg font-semibold">{t('admin:agents.skills')}</h3>
        <Separator className="my-3" />

        {skills.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('admin:agents.noSkills')}</p>
        ) : (
          <div className="space-y-2">
            {skills.map((skill) => (
              <div key={skill.name} className="flex items-center justify-between rounded-md border px-3 py-2">
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
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            className="flex-1"
          />
          <Input
            type="number"
            min={1}
            max={10}
            placeholder="1-10"
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

      {/* Queue memberships (read-only) */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-heading text-lg font-semibold">{t('admin:agents.queues')}</h3>
        <Separator className="my-3" />

        {queues.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('admin:agents.noQueues')}</p>
        ) : (
          <div className="space-y-1">
            {queues.map((q) => (
              <div key={q.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                {q.name}
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{t('admin:agents.queuesNote')}</p>
      </div>

      {/* Edit sheet */}
      <AgentForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        defaultValues={{
          userId: agent.userId,
          displayName: agent.displayName,
          teamId: agent.teamId ?? '',
          skills: agent.skills,
        }}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:agents.deleteTitle')}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{agent.displayName}</strong>? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
