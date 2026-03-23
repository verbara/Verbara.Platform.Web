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
  Calendar,
  Tags,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Separator } from '@/core/ui/separator';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import { QueueForm } from './queue-form';
import { useQueue, useQueues, useDeleteQueue, useUpdateQueue } from '@/core/api/hooks/use-queues';
import { useAgents } from '@/core/api/hooks/use-agents';

function InfoRow({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
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

  const { data: queue } = useQueue(queueId);
  const { data: allQueues = [] } = useQueues();
  const { data: allAgents = [] } = useAgents();
  const deleteQueue = useDeleteQueue();
  const updateQueue = useUpdateQueue();

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

  const assignedAgents = allAgents.filter((a) => queue.agentIds.includes(a.id));

  const editDefaults = {
    name: queue.name,
    isActive: queue.isActive,
    maxWaiting: queue.maxWaiting?.toString() ?? '',
    timezone: queue.timezone ?? '',
    answerWithinSeconds: queue.slaTargets?.answerWithinSeconds?.toString() ?? '',
    firstResponseWithinSeconds: queue.slaTargets?.firstResponseWithinSeconds?.toString() ?? '',
    resolutionWithinSeconds: queue.slaTargets?.resolutionWithinSeconds?.toString() ?? '',
    overflowQueueId: queue.overflowRule?.overflowQueueId ?? '',
    overflowAfterSeconds: queue.overflowRule?.overflowAfterSeconds?.toString() ?? '',
    requiredSkills: queue.requiredSkills.map((s) => ({ name: s })),
    schedule: queue.schedule,
    defaultWrapUpSeconds: (queue.wrapUp?.defaultWrapUpSeconds ?? 30).toString(),
    forceWrapUp: queue.wrapUp?.forceWrapUp ?? false,
    dispositions: queue.dispositionCodes.map((code) => ({ code })),
  };

  const overflowTarget = queue.overflowRule
    ? allQueues.find((q) => q.id === queue.overflowRule!.overflowQueueId)?.name ?? queue.overflowRule.overflowQueueId
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
        {queue.timezone && (
          <InfoRow icon={Clock} label={t('admin:queues.timezone')}>
            {queue.timezone}
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
                    <Badge key={skill} variant="secondary">{skill}</Badge>
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

        {/* Schedule */}
        {queue.schedule.length > 0 && (
          <>
            <Separator className="my-2" />
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('admin:queues.hours')}
            </p>
            <InfoRow icon={Calendar} label={t('admin:queues.hours')}>
              <div className="space-y-0.5">
                {queue.schedule.map((entry) => (
                  <div key={entry.day} className="flex items-center gap-2 text-xs">
                    <span className="w-20 font-medium">{entry.day}</span>
                    {entry.enabled ? (
                      <span>{entry.open} &ndash; {entry.close}</span>
                    ) : (
                      <span className="text-muted-foreground">Closed</span>
                    )}
                  </div>
                ))}
              </div>
            </InfoRow>
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

        {/* Disposition codes */}
        {queue.dispositionCodes.length > 0 && (
          <>
            <Separator className="my-2" />
            <InfoRow icon={Tags} label={t('admin:queues.dispositionCodes')}>
              <div className="flex flex-wrap gap-1">
                {queue.dispositionCodes.map((code) => (
                  <Badge key={code} variant="outline">{code}</Badge>
                ))}
              </div>
            </InfoRow>
          </>
        )}
      </div>

      {/* Agent membership */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-heading text-sm font-semibold">{t('admin:queues.agents')}</h3>
        <Separator className="my-3" />
        {assignedAgents.length > 0 ? (
          <div className="space-y-2">
            {assignedAgents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="font-medium">{agent.displayName}</span>
                <Badge variant="outline">{agent.state}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('admin:queues.noAgents')}</p>
        )}
      </div>

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
            timezone: values.timezone || undefined,
            slaTargets: {
              answerWithinSeconds: values.answerWithinSeconds ? Number(values.answerWithinSeconds) : undefined,
              firstResponseWithinSeconds: values.firstResponseWithinSeconds ? Number(values.firstResponseWithinSeconds) : undefined,
              resolutionWithinSeconds: values.resolutionWithinSeconds ? Number(values.resolutionWithinSeconds) : undefined,
            },
            overflowRule: values.overflowQueueId
              ? { overflowQueueId: values.overflowQueueId, overflowAfterSeconds: Number(values.overflowAfterSeconds) || 120 }
              : undefined,
            wrapUp: {
              defaultWrapUpSeconds: Number(values.defaultWrapUpSeconds) || 30,
              forceWrapUp: values.forceWrapUp,
            },
            requiredSkills: values.requiredSkills.map((s) => s.name),
            schedule: values.schedule,
            dispositionCodes: values.dispositions.map((d) => d.code),
            agentIds: queue.agentIds,
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
            Are you sure you want to delete <strong>{queue.name}</strong>? This action
            cannot be undone.
          </>
        }
        onConfirm={handleDelete}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
