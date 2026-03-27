import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Phone,
  Clock,
  Shield,
  Users,
  Settings,
  Calendar,
  MapPin,
  AlertTriangle,
  RotateCcw,
  Timer,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Separator } from '@/core/ui/separator';
import { Switch } from '@/core/ui/switch';
import { Input } from '@/core/ui/input';
import { Checkbox } from '@/core/ui/checkbox';
import { Label } from '@/core/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/ui/dialog';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import {
  useCampaign,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useStopCampaign,
  useDeleteCampaign,
  useCampaignDispositions,
  useCreateDispositionCode,
  useUpdateDispositionCode,
  useDeleteDispositionCode,
} from '@/core/api/hooks/use-campaigns';
import type { DispositionCode } from '@/core/api/hooks/use-campaigns';
import type { CampaignStatus } from './campaign-list-page';
import { CallbacksTab } from './callbacks-tab';

interface DispositionFormState {
  code: string;
  label: string;
  category: string;
  triggerRetry: boolean;
  retryDelayMinutes: number;
  triggerCallback: boolean;
}

const DEFAULT_DISPO_FORM: DispositionFormState = {
  code: '',
  label: '',
  category: 'success',
  triggerRetry: false,
  retryDelayMinutes: 60,
  triggerCallback: false,
};

const STATUS_VARIANT: Record<CampaignStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  active: 'default',
  paused: 'outline',
  completed: 'secondary',
};

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

function SectionHeader({ title }: { title: string }) {
  return (
    <>
      <Separator className="my-2" />
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
    </>
  );
}

interface DispositionDialogProps {
  campaignId: number;
  editing: DispositionCode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DispositionDialog({ campaignId, editing, open, onOpenChange }: DispositionDialogProps) {
  const [form, setForm] = useState<DispositionFormState>(
    editing
      ? {
          code: editing.code,
          label: editing.label,
          category: editing.category,
          triggerRetry: editing.triggerRetry,
          retryDelayMinutes: editing.retryDelayMinutes ?? 60,
          triggerCallback: editing.triggerCallback,
        }
      : DEFAULT_DISPO_FORM,
  );

  const createCode = useCreateDispositionCode();
  const updateCode = useUpdateDispositionCode();

  const isPending = createCode.isPending || updateCode.isPending;

  const handleSave = () => {
    if (!form.code.trim() || !form.label.trim()) return;
    if (editing) {
      updateCode.mutate(
        { campaignId, codeId: editing.id, ...form },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createCode.mutate(
        { campaignId, ...form },
        { onSuccess: () => { onOpenChange(false); setForm(DEFAULT_DISPO_FORM); } },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Disposition Code' : 'Add Disposition Code'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dispo-code">Code</Label>
              <Input
                id="dispo-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. SALE"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dispo-label">Label</Label>
              <Input
                id="dispo-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Sale Made"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dispo-category">Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? f.category }))}
            >
              <SelectTrigger id="dispo-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
                <SelectItem value="callback">Callback</SelectItem>
                <SelectItem value="no_answer">No Answer</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="dnc">DNC</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="dispo-retry"
                checked={form.triggerRetry}
                onCheckedChange={(v) => setForm((f) => ({ ...f, triggerRetry: !!v }))}
              />
              <Label htmlFor="dispo-retry" className="cursor-pointer">Trigger Retry</Label>
            </div>
            {form.triggerRetry && (
              <div className="ml-6 space-y-1.5">
                <Label htmlFor="dispo-retry-delay">Retry Delay (minutes)</Label>
                <Input
                  id="dispo-retry-delay"
                  type="number"
                  min={1}
                  value={form.retryDelayMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, retryDelayMinutes: Number(e.target.value) }))}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="dispo-callback"
                checked={form.triggerCallback}
                onCheckedChange={(v) => setForm((f) => ({ ...f, triggerCallback: !!v }))}
              />
              <Label htmlFor="dispo-callback" className="cursor-pointer">Trigger Callback</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || !form.code.trim() || !form.label.trim()}>
            {isPending ? 'Saving…' : editing ? 'Update' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();
  const [stopOpen, setStopOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dispoDialogOpen, setDispoDialogOpen] = useState(false);
  const [editingDispo, setEditingDispo] = useState<DispositionCode | null>(null);
  const [deletingDispoId, setDeletingDispoId] = useState<number | null>(null);

  const campaignIdNum = Number(campaignId);
  const { data: campaign, isLoading } = useCampaign(campaignIdNum);
  const { data: dispositions = [] } = useCampaignDispositions(campaignIdNum);
  const deleteDispositionCode = useDeleteDispositionCode();
  const deleteCampaign = useDeleteCampaign();

  const startCampaign = useStartCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();
  const stopCampaign = useStopCampaign();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Campaign not found.
      </div>
    );
  }

  const status = campaign.status;

  const handleDeleteCampaign = () => {
    deleteCampaign.mutate(campaignIdNum, {
      onSuccess: () => {
        setDeleteOpen(false);
        navigate('/admin/campaigns');
      },
    });
  };

  const handleStart = () => startCampaign.mutate(campaign.id);
  const handlePause = () => pauseCampaign.mutate(campaign.id);
  const handleResume = () => resumeCampaign.mutate(campaign.id);
  const handleStop = () => {
    stopCampaign.mutate(campaign.id);
    setStopOpen(false);
  };

  const progressPct = campaign.totalContacts > 0
    ? Math.round((campaign.contactsDialed / campaign.totalContacts) * 100)
    : 0;

  const handleOpenAddDispo = () => {
    setEditingDispo(null);
    setDispoDialogOpen(true);
  };

  const handleOpenEditDispo = (dispo: DispositionCode) => {
    setEditingDispo(dispo);
    setDispoDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingDispoId === null) return;
    deleteDispositionCode.mutate(
      { campaignId: campaignIdNum, codeId: deletingDispoId },
      { onSuccess: () => setDeletingDispoId(null) },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/campaigns')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {t('admin:campaigns.back')}
        </Button>
        <div className="flex gap-2">
          {status === 'draft' && (
            <Button size="sm" onClick={handleStart}>
              <Play className="mr-1.5 h-4 w-4" />
              {t('admin:campaigns.start')}
            </Button>
          )}
          {status === 'active' && (
            <Button variant="outline" size="sm" onClick={handlePause}>
              <Pause className="mr-1.5 h-4 w-4" />
              {t('admin:campaigns.pause')}
            </Button>
          )}
          {status === 'paused' && (
            <Button size="sm" onClick={handleResume}>
              <Play className="mr-1.5 h-4 w-4" />
              {t('admin:campaigns.resume')}
            </Button>
          )}
          {(status === 'active' || status === 'paused') && (
            <Button variant="destructive" size="sm" onClick={() => setStopOpen(true)}>
              <Square className="mr-1.5 h-4 w-4" />
              {t('admin:campaigns.stop')}
            </Button>
          )}
          <PermissionGuard requires="campaigns:campaign:delete">
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Header card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-xl font-semibold">{campaign.name}</h2>
          <Badge variant={STATUS_VARIANT[status]}>
            {t(`admin:campaigns.status_${status}`)}
          </Badge>
        </div>
        {campaign.description && (
          <p className="mt-2 text-sm text-muted-foreground">{campaign.description}</p>
        )}

        {/* Progress */}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-sm font-medium">{progressPct}%</span>
          <span className="text-xs text-muted-foreground">
            ({campaign.contactsDialed}/{campaign.totalContacts})
          </span>
        </div>
      </div>

      {/* Basic Info */}
      <div className="rounded-lg border bg-card p-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Basic
        </p>
        <InfoRow icon={Settings} label="Queue">
          {campaign.queueName}
        </InfoRow>
        {campaign.teamName && (
          <InfoRow icon={Users} label="Team">
            {campaign.teamName}
          </InfoRow>
        )}

        {/* Dialing */}
        <SectionHeader title="Dialing" />
        <InfoRow icon={Phone} label="Mode">
          <span className="capitalize">{campaign.mode}</span>
        </InfoRow>
        <InfoRow icon={Phone} label="Max Concurrent Calls">
          {campaign.maxConcurrentCalls}
        </InfoRow>
        {campaign.powerRatio !== undefined && (
          <InfoRow icon={Settings} label="Power Ratio">
            {campaign.powerRatio}
          </InfoRow>
        )}
        {campaign.targetAbandonRate !== undefined && (
          <InfoRow icon={Timer} label="Target Abandon Rate">
            {campaign.targetAbandonRate}%
          </InfoRow>
        )}

        {/* Schedule */}
        <SectionHeader title="Schedule" />
        <InfoRow icon={MapPin} label="Timezone">
          {campaign.timezone}
        </InfoRow>
        {(campaign.campaignStart || campaign.campaignEnd) && (
          <InfoRow icon={Calendar} label="Campaign Period">
            {campaign.campaignStart} &mdash; {campaign.campaignEnd}
          </InfoRow>
        )}
        {campaign.schedule && campaign.schedule.length > 0 && (
          <InfoRow icon={Calendar} label="Weekly Schedule">
            <div className="space-y-0.5">
              {campaign.schedule.map((entry) => (
                <div key={entry.day} className="flex items-center gap-2 text-xs">
                  <span className="w-24 font-medium">{entry.day}</span>
                  {entry.enabled ? (
                    <span>{entry.start} &ndash; {entry.end}</span>
                  ) : (
                    <span className="text-muted-foreground">Closed</span>
                  )}
                </div>
              ))}
            </div>
          </InfoRow>
        )}
        {campaign.holidays && campaign.holidays.length > 0 && (
          <InfoRow icon={AlertTriangle} label="Holidays (No Dialing)">
            <div className="flex flex-wrap gap-1">
              {campaign.holidays.map((h) => (
                <Badge key={h} variant="outline">{h}</Badge>
              ))}
            </div>
          </InfoRow>
        )}

        {/* Compliance */}
        <SectionHeader title="Compliance" />
        <InfoRow icon={Shield} label="DNC List Enabled">
          {campaign.dncEnabled ? 'Yes' : 'No'}
        </InfoRow>
        <InfoRow icon={RotateCcw} label="Max Attempts">
          {campaign.maxAttemptsPerContact}
        </InfoRow>
        <InfoRow icon={Clock} label="Retry Interval">
          {campaign.retryIntervalMinutes} min
        </InfoRow>
        <InfoRow icon={Timer} label="Time Between Attempts">
          {campaign.timeBetweenAttemptsMinutes} min
        </InfoRow>
        {campaign.complianceNotes && (
          <InfoRow icon={FileText} label="Notes">
            {campaign.complianceNotes}
          </InfoRow>
        )}

        {/* Contacts */}
        <SectionHeader title="Contacts" />
        <InfoRow icon={Users} label="Total Contacts">
          {campaign.totalContacts.toLocaleString()}
        </InfoRow>
        <InfoRow icon={Phone} label="Contacts Dialed">
          {campaign.contactsDialed.toLocaleString()}
        </InfoRow>
      </div>

      {/* Dispositions */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Disposition Codes
          </p>
          <Button size="sm" variant="outline" onClick={handleOpenAddDispo}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Disposition
          </Button>
        </div>

        {dispositions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No disposition codes defined. Add codes to categorize call outcomes.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Code</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Label</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Category</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Retry</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Callback</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Active</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {dispositions.map((d) => (
                  <tr key={d.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs font-medium">{d.code}</td>
                    <td className="px-3 py-2">{d.label}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="capitalize">{d.category}</Badge>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={d.triggerRetry}
                        disabled
                        aria-label="Trigger retry"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={d.triggerCallback}
                        disabled
                        aria-label="Trigger callback"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={d.isActive}
                        disabled
                        aria-label="Is active"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleOpenEditDispo(d)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeletingDispoId(d.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Callbacks */}
      <div className="rounded-lg border bg-card p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pending Callbacks
        </p>
        <CallbacksTab campaignId={campaignIdNum} />
      </div>

      {/* Stop confirmation dialog */}
      <ConfirmDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        title={t('admin:campaigns.stopTitle')}
        description={
          <>
            Are you sure you want to stop <strong>{campaign.name}</strong>? This action
            cannot be undone.
          </>
        }
        onConfirm={handleStop}
        confirmLabel="Stop Campaign"
        variant="destructive"
      />

      {/* Disposition add/edit dialog */}
      <DispositionDialog
        campaignId={campaignIdNum}
        editing={editingDispo}
        open={dispoDialogOpen}
        onOpenChange={setDispoDialogOpen}
      />

      {/* Disposition delete confirmation */}
      <ConfirmDialog
        open={deletingDispoId !== null}
        onOpenChange={(o) => { if (!o) setDeletingDispoId(null); }}
        title="Delete Disposition Code"
        description="Are you sure you want to delete this disposition code? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        variant="destructive"
      />

      {/* Campaign delete confirmation */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteCampaign}
        entityName={campaign.name}
        entityType="Campaign"
        isPending={deleteCampaign.isPending}
      />
    </div>
  );
}
