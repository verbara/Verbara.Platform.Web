import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Save, Headset, Info } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Separator } from '@/core/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { PageHeader } from '@/admin/shared/page-header';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import { EmptyState } from '@/admin/shared/empty-state';
import { useAgent } from '@/core/api/hooks/use-agents';
import { useQueues } from '@/core/api/hooks/use-queues';
import { useAgentMemberships } from '@/core/api/hooks/use-agent-memberships';
import type { AgentQueueMembership } from '@/core/api/hooks/use-agent-memberships';
import {
  useAddQueueMember,
  useRemoveQueueMember,
  useUpdateQueueMember,
} from '@/core/api/hooks/use-queue-members';

// ADR-0026 Phase A.6 — channel options mirror the backend ChannelType enum.
// Voice is special-cased in the sync gate: when present (or AllowedChannels
// is null), the Asterisk queue_members row is materialized. The order
// matches the SMB-first product priorities (Voice/WebChat/Email first).
const CHANNEL_OPTIONS = [
  'Voice',
  'WebChat',
  'Email',
  'WhatsApp',
  'Sms',
  'Messenger',
  'Instagram',
  'Telegram',
  'Twitter',
  'Video',
  'Rcs',
] as const;

function includesVoice(channels: string[] | null | undefined): boolean {
  if (!channels) return true; // null = all channels (including voice)
  return channels.some((c) => c.toLowerCase() === 'voice');
}

function channelsKey(channels: string[] | null | undefined): string {
  if (!channels) return 'all';
  return [...channels]
    .map((c) => c.toLowerCase())
    .sort((a, b) => a.localeCompare(b))
    .join(',');
}

export default function AgentQueuesPage() {
  const { t } = useTranslation(['admin']);
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();

  const { data: agent } = useAgent(agentId);
  const { data: memberships = [], isLoading: membershipsLoading } = useAgentMemberships(agentId);
  const { data: queues = [] } = useQueues();
  const addMember = useAddQueueMember();
  const removeMember = useRemoveQueueMember();
  const updateMember = useUpdateQueueMember();

  const [addQueueId, setAddQueueId] = useState('');
  const [removeTarget, setRemoveTarget] = useState<AgentQueueMembership | null>(null);

  const memberQueueIds = useMemo(() => new Set(memberships.map((m) => m.queueId)), [memberships]);
  const availableQueues = useMemo(
    () => queues.filter((q) => !memberQueueIds.has(q.id)),
    [queues, memberQueueIds],
  );

  if (!agentId || !agent) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t('admin:agents.notFound', 'Agent not found.')}
      </div>
    );
  }

  const handleAdd = () => {
    if (!addQueueId || !agentId) return;
    addMember.mutate(
      { queueId: addQueueId, agentId, allowedChannels: null },
      {
        onSuccess: () => setAddQueueId(''),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/agents/${agentId}`)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {t('admin:agents.queues.backToAgent', 'Back to agent')}
        </Button>
      </div>

      <PageHeader
        title={t('admin:agents.queues.title', 'Manage queues — {{name}}', {
          name: agent.displayName,
        })}
        description={t(
          'admin:agents.queues.description',
          'Attach the agent to queues and restrict membership per channel. Voice memberships are synced to the Asterisk PBX.',
        )}
      />

      {/* Banner: channel-aware semantics */}
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900/50 dark:bg-blue-950/40">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="space-y-1">
          <p className="font-medium text-blue-900 dark:text-blue-100">
            {t('admin:agents.queues.bannerTitle', 'Channel-aware membership')}
          </p>
          <p className="text-blue-800/90 dark:text-blue-200/90">
            {t(
              'admin:agents.queues.bannerBody',
              'Leave channels empty (= "All") so the agent serves every channel the queue accepts. Toggle individual channels to restrict the membership. When Voice is included, Asterisk receives a queue_members entry; otherwise the membership stays digital-only.',
            )}
          </p>
        </div>
      </div>

      {/* Add membership */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('admin:agents.queues.addTitle', 'Add to queue')}
        </h3>
        <Separator className="my-3" />
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="agent-queues-add">{t('admin:agents.queues.queue', 'Queue')}</Label>
            <Select value={addQueueId} onValueChange={(v) => setAddQueueId(v ?? '')}>
              <SelectTrigger id="agent-queues-add" className="w-full">
                <SelectValue
                  placeholder={
                    availableQueues.length === 0
                      ? t('admin:agents.queues.allQueuesAdded', 'Agent is already in every queue')
                      : t('admin:agents.queues.selectQueue', 'Select a queue')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableQueues.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            data-testid="agent-queues-add-btn"
            disabled={!addQueueId || addMember.isPending}
            onClick={handleAdd}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t('admin:agents.queues.add', 'Add')}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            'admin:agents.queues.addHint',
            'New memberships default to "All channels". Edit the chips below to restrict.',
          )}
        </p>
      </div>

      {/* Current memberships */}
      <div className="space-y-3">
        <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('admin:agents.queues.currentTitle', 'Memberships')}
        </h3>
        {renderMembershipsBody({
          loading: membershipsLoading,
          memberships,
          loadingLabel: t('common:loading', 'Loading…'),
          emptyMessage: t(
            'admin:agents.queues.empty',
            'Agent is not a member of any queue yet. Use the form above to attach the first one.',
          ),
          renderRow: (m) => (
            <MembershipEditor
              key={m.queueId}
              membership={m}
              onUpdate={(allowedChannels, penalty) => {
                const clearAllowedChannels = allowedChannels === null;
                updateMember.mutate({
                  queueId: m.queueId,
                  agentId,
                  penalty,
                  allowedChannels: clearAllowedChannels ? undefined : allowedChannels,
                  clearAllowedChannels,
                });
              }}
              onRemove={() => setRemoveTarget(m)}
            />
          ),
        })}
      </div>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={t('admin:agents.queues.removeTitle', 'Remove from queue')}
        description={
          <>
            {t('admin:agents.queues.removeDescription', 'Remove agent from')}{' '}
            <strong>{removeTarget?.queueName}</strong>?
          </>
        }
        onConfirm={() => {
          if (!removeTarget || !agentId) return;
          removeMember.mutate(
            { queueId: removeTarget.queueId, agentId },
            { onSuccess: () => setRemoveTarget(null) },
          );
        }}
        confirmLabel={t('common:remove', 'Remove')}
        variant="destructive"
      />
    </div>
  );
}

interface MembershipEditorProps {
  readonly membership: AgentQueueMembership;
  readonly onUpdate: (allowedChannels: string[] | null, penalty: number) => void;
  readonly onRemove: () => void;
}

interface MembershipsBodyProps {
  readonly loading: boolean;
  readonly memberships: readonly AgentQueueMembership[];
  readonly loadingLabel: string;
  readonly emptyMessage: string;
  readonly renderRow: (m: AgentQueueMembership) => React.ReactNode;
}

function renderMembershipsBody({
  loading,
  memberships,
  loadingLabel,
  emptyMessage,
  renderRow,
}: MembershipsBodyProps): React.ReactNode {
  if (loading) {
    return <p className="text-sm text-muted-foreground">{loadingLabel}</p>;
  }
  if (memberships.length === 0) {
    return <EmptyState icon={Headset} message={emptyMessage} />;
  }
  return memberships.map(renderRow);
}

function chipClassName(allAllowed: boolean, active: boolean): string {
  if (allAllowed) {
    return 'border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground/60';
  }
  return active
    ? 'border-primary bg-primary text-primary-foreground'
    : 'border-input bg-background text-foreground hover:bg-muted';
}

function MembershipEditor({ membership, onUpdate, onRemove }: MembershipEditorProps) {
  const { t } = useTranslation(['admin']);
  const [allAllowed, setAllAllowed] = useState(membership.allowedChannels == null);
  const [channels, setChannels] = useState<string[]>(
    membership.allowedChannels ? [...membership.allowedChannels] : [],
  );
  // `AgentQueueMembershipDto.penalty` is the AOT-wire `number | string` union;
  // coerce at this numeric boundary (the wire always sends a numeric JSON value).
  const initialPenalty = Number(membership.penalty);
  const [penalty, setPenalty] = useState<number>(initialPenalty);

  const initialKey = channelsKey(membership.allowedChannels);
  const currentKey = allAllowed ? 'all' : channelsKey(channels);
  const dirty = initialKey !== currentKey || penalty !== initialPenalty;

  const effectiveChannels = allAllowed ? null : channels;
  const voiceSynced = includesVoice(effectiveChannels);

  const toggleChannel = (ch: string) => {
    setAllAllowed(false);
    setChannels((prev) =>
      prev.some((c) => c.toLowerCase() === ch.toLowerCase())
        ? prev.filter((c) => c.toLowerCase() !== ch.toLowerCase())
        : [...prev, ch],
    );
  };

  const handleSave = () => {
    if (allAllowed) {
      onUpdate(null, penalty);
    } else if (channels.length === 0) {
      // Empty list is invalid backend-side; treat as "All" to keep the UX coherent.
      setAllAllowed(true);
      onUpdate(null, penalty);
    } else {
      onUpdate(channels, penalty);
    }
  };

  const isSkill = membership.source === 'Skill';

  return (
    <div
      className="rounded-lg border bg-card p-4"
      data-testid={`membership-card-${membership.queueId}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-medium">{membership.queueName}</span>
            {isSkill && (
              <Badge variant="outline" className="text-xs">
                {t('admin:agents.queues.skillSource', 'Skill-derived')}
              </Badge>
            )}
            {membership.isExcluded && (
              <Badge variant="destructive" className="text-xs">
                {t('admin:agents.queues.excluded', 'Excluded')}
              </Badge>
            )}
            <Badge
              variant={voiceSynced ? 'default' : 'secondary'}
              data-testid="agent-queues-voice-sync"
            >
              {voiceSynced
                ? t('admin:agents.queues.voiceSyncOn', 'Voice → Asterisk')
                : t('admin:agents.queues.voiceSyncOff', 'Digital only')}
            </Badge>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{membership.queueId}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onRemove}
          data-testid="agent-queues-remove-btn"
        >
          <Trash2 className="mr-1 h-4 w-4" />
          {t('common:remove', 'Remove')}
        </Button>
      </div>

      <Separator className="my-3" />

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`penalty-${membership.queueId}`}>
              {t('admin:agents.queues.penalty', 'Penalty (0–10)')}
            </Label>
            <Input
              id={`penalty-${membership.queueId}`}
              type="number"
              min={0}
              max={10}
              value={penalty}
              onChange={(e) => setPenalty(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
              className="w-20"
            />
          </div>
          <p className="self-end pb-2 text-xs text-muted-foreground">
            {t(
              'admin:agents.queues.penaltyHint',
              'Higher penalty = lower routing priority within the queue.',
            )}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('admin:agents.queues.channels', 'Channels')}</Label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={allAllowed}
                onChange={(e) => {
                  setAllAllowed(e.target.checked);
                  if (e.target.checked) setChannels([]);
                }}
                className="h-3.5 w-3.5"
                data-testid={`channels-all-${membership.queueId}`}
              />
              {t('admin:agents.queues.allChannels', 'All channels')}
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CHANNEL_OPTIONS.map((ch) => {
              const active =
                !allAllowed && channels.some((c) => c.toLowerCase() === ch.toLowerCase());
              return (
                <button
                  type="button"
                  key={ch}
                  data-testid={`channel-chip-${ch.toLowerCase()}`}
                  onClick={() => toggleChannel(ch)}
                  className={
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ' +
                    chipClassName(allAllowed, active)
                  }
                >
                  {ch}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {allAllowed
              ? t(
                  'admin:agents.queues.allChannelsHint',
                  '"All channels" — membership is implicit for every channel the queue accepts.',
                )
              : t(
                  'admin:agents.queues.restrictedHint',
                  'Restricted — pick at least one channel. Voice gates the Asterisk sync.',
                )}
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={!dirty}
            onClick={handleSave}
            data-testid="agent-queues-save-btn"
          >
            <Save className="mr-1.5 h-4 w-4" />
            {t('common:save', 'Save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
