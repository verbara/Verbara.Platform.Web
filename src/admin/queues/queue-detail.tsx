import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Clock,
  Target,
  ArrowRightLeft,
  Tags,
  Users,
  Zap,
  X,
  UserPlus,
  Pause,
  Play,
} from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { Separator } from '@/core/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import { QueueForm } from './queue-form';
import { useQueue, useQueues, useDeleteQueue, useUpdateQueue } from '@/core/api/hooks/use-queues';
import { useAgents } from '@/core/api/hooks/use-agents';
import {
  useAddQueueMember,
  useQueueMemberPause,
  useQueueMemberResume,
  useQueueMembers,
  useRemoveQueueMember,
} from '@/core/api/hooks/use-queue-members';

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
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

export default function QueueDetailPage() {
  const { t } = useTranslation(['admin']);
  const { queueId } = useParams<{ queueId: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [addAgentId, setAddAgentId] = useState('');
  const [addPenalty, setAddPenalty] = useState('0');
  const [removeTargetAgentId, setRemoveTargetAgentId] = useState<string | null>(null);
  const [pauseTargetAgentId, setPauseTargetAgentId] = useState<string | null>(null);
  const [pauseReason, setPauseReason] = useState('');

  const { data: queue } = useQueue(queueId);
  const { data: allQueues = [] } = useQueues();
  const { data: allAgents = [] } = useAgents();
  const { data: assignedMembers = [] } = useQueueMembers(queueId);
  const deleteQueue = useDeleteQueue();
  const updateQueue = useUpdateQueue();
  const addMember = useAddQueueMember();
  const removeMember = useRemoveQueueMember();
  const pauseMember = useQueueMemberPause();
  const resumeMember = useQueueMemberResume();

  if (!queue) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Queue not found.
      </div>
    );
  }

  const handleDelete = () => {
    deleteQueue.mutate(queue.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        navigate('/admin/queues');
      },
    });
  };

  // Platform R5.1 Task I: pull the real assigned-member list off the RESTful
  // queue-members endpoint. The Queue aggregate never carried membership —
  // prior code read a phantom field and always rendered an empty list.
  const assignedIds = new Set(assignedMembers.map((m) => m.agentId));
  const availableAgents = allAgents.filter((a) => !assignedIds.has(a.id));

  const handleAddMember = () => {
    if (!addAgentId || !queueId) return;
    const penalty = Number.parseInt(addPenalty, 10);
    addMember.mutate(
      {
        queueId,
        agentId: addAgentId,
        penalty: Number.isFinite(penalty) ? Math.min(10, Math.max(0, penalty)) : 0,
      },
      {
        onSuccess: () => {
          setAddAgentId('');
          setAddPenalty('0');
        },
      },
    );
  };

  const handleConfirmRemove = () => {
    if (!queueId || !removeTargetAgentId) return;
    const agentId = removeTargetAgentId;
    removeMember.mutate({ queueId, agentId }, { onSettled: () => setRemoveTargetAgentId(null) });
  };

  const handleConfirmPause = () => {
    if (!queueId || !pauseTargetAgentId) return;
    const agentId = pauseTargetAgentId;
    const reason = pauseReason.trim() || undefined;
    pauseMember.mutate(
      { queueId, agentId, reason },
      {
        onSettled: () => {
          setPauseTargetAgentId(null);
          setPauseReason('');
        },
      },
    );
  };

  const handleResume = (agentId: string) => {
    if (!queueId) return;
    resumeMember.mutate({ queueId, agentId });
  };

  const editDefaults = {
    name: queue.name,
    isActive: queue.isActive,
    maxWaiting: queue.maxWaiting?.toString() ?? '',
    answerWithinSeconds: queue.slaTargets?.answerWithinSeconds?.toString() ?? '',
    firstResponseWithinSeconds: queue.slaTargets?.firstResponseWithinSeconds?.toString() ?? '',
    resolutionWithinSeconds: queue.slaTargets?.resolutionWithinSeconds?.toString() ?? '',
    // `overflowQueueId` is the generated `EntityId` (typed `unknown` in the OpenAPI document);
    // coerce to the plain string the form field expects (openapi-response-adoption boundary).
    overflowQueueId: String(queue.overflowRule?.overflowQueueId ?? ''),
    overflowAfterSeconds: queue.overflowRule?.overflowAfterSeconds?.toString() ?? '',
    requiredSkills: queue.requiredSkills.map((s) => ({ name: s })),
    defaultWrapUpSeconds: (queue.wrapUp?.defaultWrapUpSeconds ?? 30).toString(),
    forceWrapUp: queue.wrapUp?.forceWrapUp ?? false,
    autoAnswerDefault: queue.autoAnswerDefault ?? false,
  };

  const overflowTarget = queue.overflowRule
    ? (allQueues.find((q) => q.id === queue.overflowRule!.overflowQueueId)?.name ??
      // `overflowQueueId` is the generated `EntityId` (`unknown`); coerce for the JSX child.
      String(queue.overflowRule.overflowQueueId))
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/queues')}>
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

      {/* Queue info card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-xl font-semibold">{queue.name}</h2>
          <Badge variant={queue.isActive ? 'default' : 'destructive'}>
            {queue.isActive ? 'active' : 'inactive'}
          </Badge>
        </div>

        <Separator className="my-4" />

        {/* General */}
        {queue.maxWaiting && (
          <InfoRow icon={Users} label={t('admin:queues.maxWaiting')}>
            {queue.maxWaiting}
          </InfoRow>
        )}
        {/* SLA */}
        {queue.slaTargets && (
          <>
            <Separator className="my-2" />
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('admin:queues.sla')}
            </p>
            {queue.slaTargets.answerWithinSeconds && (
              <InfoRow icon={Target} label={t('admin:queues.answerWithin')}>
                {queue.slaTargets.answerWithinSeconds}s
              </InfoRow>
            )}
            {queue.slaTargets.firstResponseWithinSeconds && (
              <InfoRow icon={Target} label={t('admin:queues.firstResponseWithin')}>
                {queue.slaTargets.firstResponseWithinSeconds}s
              </InfoRow>
            )}
            {queue.slaTargets.resolutionWithinSeconds && (
              <InfoRow icon={Target} label={t('admin:queues.resolutionWithin')}>
                {queue.slaTargets.resolutionWithinSeconds}s
              </InfoRow>
            )}
          </>
        )}

        {/* Routing */}
        {(queue.requiredSkills.length > 0 || queue.overflowRule) && (
          <>
            <Separator className="my-2" />
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('admin:queues.routing')}
            </p>
            {queue.requiredSkills.length > 0 && (
              <InfoRow icon={Tags} label={t('admin:queues.skills')}>
                <div className="flex flex-wrap gap-1">
                  {queue.requiredSkills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </InfoRow>
            )}
            {queue.overflowRule && (
              <InfoRow icon={ArrowRightLeft} label={t('admin:queues.overflow')}>
                {overflowTarget} ({queue.overflowRule.overflowAfterSeconds}s)
              </InfoRow>
            )}
          </>
        )}

        {/* Wrap-up */}
        {queue.wrapUp && (
          <>
            <Separator className="my-2" />
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('admin:queues.wrap_up')}
            </p>
            <InfoRow icon={Clock} label={t('admin:queues.wrapUpSeconds')}>
              {queue.wrapUp.defaultWrapUpSeconds}s
            </InfoRow>
            <InfoRow icon={Zap} label={t('admin:queues.forceWrapUp')}>
              {queue.wrapUp.forceWrapUp ? 'Yes' : 'No'}
            </InfoRow>
          </>
        )}
      </div>

      {/* Agent membership */}
      <div data-testid="queue-members-card" className="rounded-lg border bg-card p-6">
        <h3 className="font-heading text-sm font-semibold">{t('admin:queue-members.assigned')}</h3>
        <Separator className="my-3" />
        {assignedMembers.length > 0 ? (
          <div className="space-y-2" data-testid="queue-members-list">
            {assignedMembers.map((member) => (
              <div
                key={member.agentId}
                data-testid={`queue-member-row-${member.agentId}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{member.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('admin:queue-members.penalty')}: {member.penalty} · {member.source}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {member.isPaused ? (
                    <Badge variant="destructive" data-testid="paused-badge">
                      {t('admin:queue-members.paused')}
                    </Badge>
                  ) : null}
                  {member.isPaused ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      title={t('admin:queue-members.resume')}
                      aria-label={t('admin:queue-members.resume')}
                      onClick={() => handleResume(member.agentId)}
                      disabled={resumeMember.isPending}
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      title={t('admin:queue-members.pause')}
                      aria-label={t('admin:queue-members.pause')}
                      onClick={() => setPauseTargetAgentId(member.agentId)}
                      disabled={pauseMember.isPending}
                    >
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    title={t('admin:queue-members.remove')}
                    aria-label={t('admin:queue-members.remove')}
                    onClick={() => setRemoveTargetAgentId(member.agentId)}
                    disabled={removeMember.isPending}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('admin:queues.noAgents')}</p>
        )}

        {/* Add agent */}
        {availableAgents.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Select value={addAgentId} onValueChange={(v) => setAddAgentId(v ?? '')}>
              <SelectTrigger className="flex-1" data-testid="add-member-agent-select">
                <SelectValue placeholder={t('admin:queue-members.add')} />
              </SelectTrigger>
              <SelectContent>
                {availableAgents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              max={10}
              value={addPenalty}
              onChange={(e) => setAddPenalty(e.target.value)}
              aria-label={t('admin:queue-members.penalty')}
              className="w-24"
              data-testid="add-member-penalty-input"
            />
            <Button
              size="sm"
              onClick={handleAddMember}
              disabled={!addAgentId || addMember.isPending}
              data-testid="add-member-submit"
              aria-label={t('admin:queue-members.add')}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Remove member confirmation */}
      <ConfirmDialog
        open={removeTargetAgentId !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTargetAgentId(null);
        }}
        title={t('admin:queue-members.remove')}
        description={t('admin:queue-members.confirm-remove')}
        onConfirm={handleConfirmRemove}
        confirmLabel={t('admin:queue-members.remove')}
        variant="destructive"
      />

      {/* Pause member dialog — reuses ConfirmDialog with a reason input above */}
      <ConfirmDialog
        open={pauseTargetAgentId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPauseTargetAgentId(null);
            setPauseReason('');
          }
        }}
        title={t('admin:queue-members.pause')}
        description={
          <div className="space-y-2">
            <p>{t('admin:queue-members.pause-reason')}</p>
            <Input
              type="text"
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder={t('admin:queue-members.pause-reason')}
              data-testid="pause-reason-input"
            />
          </div>
        }
        onConfirm={handleConfirmPause}
        confirmLabel={t('admin:queue-members.pause')}
      />

      {/* Edit sheet */}
      <QueueForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        defaultValues={editDefaults}
        onSubmit={(values) =>
          updateQueue.mutate({
            id: queue.id,
            name: values.name,
            isActive: values.isActive,
            maxWaiting: values.maxWaiting ? Number(values.maxWaiting) : undefined,
            slaTargets: {
              answerWithinSeconds: values.answerWithinSeconds
                ? Number(values.answerWithinSeconds)
                : undefined,
              firstResponseWithinSeconds: values.firstResponseWithinSeconds
                ? Number(values.firstResponseWithinSeconds)
                : undefined,
              resolutionWithinSeconds: values.resolutionWithinSeconds
                ? Number(values.resolutionWithinSeconds)
                : undefined,
            },
            overflowRule: values.overflowQueueId
              ? {
                  overflowQueueId: values.overflowQueueId,
                  overflowAfterSeconds: Number(values.overflowAfterSeconds) || 120,
                }
              : undefined,
            wrapUp: {
              defaultWrapUpSeconds: Number(values.defaultWrapUpSeconds) || 30,
              forceWrapUp: values.forceWrapUp,
            },
            requiredSkills: values.requiredSkills.map((s) => s.name),
            autoAnswerDefault: values.autoAnswerDefault,
          })
        }
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('admin:queues.deleteTitle')}
        description={
          <>
            Are you sure you want to delete <strong>{queue.name}</strong>? This action cannot be
            undone.
          </>
        }
        onConfirm={handleDelete}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
