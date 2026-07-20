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
  TriangleAlert,
  RotateCcw,
  Timer,
  FileText,
  Plus,
  Trash2,
  Pencil,
} from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Separator } from '@/core/ui/separator';
import { Switch } from '@/core/ui/switch';
import { Input } from '@/core/ui/input';
import { Checkbox } from '@/core/ui/checkbox';
import { Label } from '@/core/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/core/ui/dialog';
import { ConfirmDialog } from '@/core/ui/confirm-dialog';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { PermissionButton } from '@/core/ui/permission-button';
import { AuditTimeline } from '@/core/ui/audit-timeline';
import {
  useCampaign,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useStopCampaign,
  useDeleteCampaign,
  useUpdateCampaign,
  useCampaignDispositions,
  useCampaignContactLists,
  useCreateDispositionCode,
  useUpdateDispositionCode,
  useDeleteDispositionCode,
} from '@/core/api/hooks/use-campaigns';
import type { DispositionCode } from '@/core/api/hooks/use-campaigns';
import type { CampaignStatus } from './campaign-list-page';
import { CallbacksTab } from './callbacks-tab';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { useFormatNumber } from '@/core/i18n/use-format';

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

const STATUS_VARIANT: Record<CampaignStatus, 'default' | 'secondary' | 'outline' | 'destructive'> =
  {
    draft: 'secondary',
    active: 'default',
    paused: 'outline',
    completed: 'secondary',
  };

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
  const { t } = useTranslation(['admin']);
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
        {
          onSuccess: () => {
            onOpenChange(false);
            setForm(DEFAULT_DISPO_FORM);
          },
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t('admin:campaigns.dispositions.dialog_edit_title')
              : t('admin:campaigns.dispositions.dialog_add_title')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dispo-code">{t('admin:campaigns.dispositions.field_code')}</Label>
              <Input
                id="dispo-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder={t('admin:campaigns.dispositions.field_code_placeholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dispo-label">{t('admin:campaigns.dispositions.field_label')}</Label>
              <Input
                id="dispo-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder={t('admin:campaigns.dispositions.field_label_placeholder')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dispo-category">
              {t('admin:campaigns.dispositions.field_category')}
            </Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? f.category }))}
            >
              <SelectTrigger id="dispo-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">
                  {t('admin:campaigns.dispositions.cat_success')}
                </SelectItem>
                <SelectItem value="failure">
                  {t('admin:campaigns.dispositions.cat_failure')}
                </SelectItem>
                <SelectItem value="callback">
                  {t('admin:campaigns.dispositions.cat_callback')}
                </SelectItem>
                <SelectItem value="no_answer">
                  {t('admin:campaigns.dispositions.cat_no_answer')}
                </SelectItem>
                <SelectItem value="busy">{t('admin:campaigns.dispositions.cat_busy')}</SelectItem>
                <SelectItem value="dnc">{t('admin:campaigns.dispositions.cat_dnc')}</SelectItem>
                <SelectItem value="other">{t('admin:campaigns.dispositions.cat_other')}</SelectItem>
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
              <Label htmlFor="dispo-retry" className="cursor-pointer">
                {t('admin:campaigns.dispositions.toggle_retry')}
              </Label>
            </div>
            {form.triggerRetry && (
              <div className="ml-6 space-y-1.5">
                <Label htmlFor="dispo-retry-delay">
                  {t('admin:campaigns.dispositions.retry_delay')}
                </Label>
                <Input
                  id="dispo-retry-delay"
                  type="number"
                  min={1}
                  value={form.retryDelayMinutes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, retryDelayMinutes: Number(e.target.value) }))
                  }
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="dispo-callback"
                checked={form.triggerCallback}
                onCheckedChange={(v) => setForm((f) => ({ ...f, triggerCallback: !!v }))}
              />
              <Label htmlFor="dispo-callback" className="cursor-pointer">
                {t('admin:campaigns.dispositions.toggle_callback')}
              </Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('admin:campaigns.dispositions.dialog_cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending || !form.code.trim() || !form.label.trim()}
          >
            {isPending
              ? t('admin:campaigns.dispositions.dialog_saving')
              : editing
                ? t('admin:campaigns.dispositions.dialog_update')
                : t('admin:campaigns.dispositions.dialog_add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { t } = useTranslation(['admin']);
  const { formatNumber } = useFormatNumber();
  const navigate = useNavigate();
  const [stopOpen, setStopOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [dispoDialogOpen, setDispoDialogOpen] = useState(false);
  const [editingDispo, setEditingDispo] = useState<DispositionCode | null>(null);
  const [deletingDispoId, setDeletingDispoId] = useState<number | null>(null);

  const campaignIdNum = Number(campaignId);
  const { data: campaign, isLoading } = useCampaign(campaignIdNum);
  const { data: dispositions = [] } = useCampaignDispositions(campaignIdNum);
  const { data: contactLists = [] } = useCampaignContactLists(campaignIdNum);
  const updateCampaign = useUpdateCampaign();
  const deleteDispositionCode = useDeleteDispositionCode();
  const deleteCampaign = useDeleteCampaign();

  const startCampaign = useStartCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();
  const stopCampaign = useStopCampaign();

  if (isLoading) {
    return <PageSkeleton variant="form" />;
  }

  if (!campaign) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t('admin:campaigns.detail.not_found')}
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

  const progressPct =
    campaign.totalContacts > 0
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
          <PermissionButton
            requires="campaigns:campaign:delete"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {t('admin:campaigns.detail.delete_btn')}
          </PermissionButton>
        </div>
      </div>

      {/* Header card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isEditing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="font-heading text-xl font-semibold"
              />
            ) : (
              <h2 className="font-heading text-xl font-semibold">{campaign.name}</h2>
            )}
            <Badge variant={STATUS_VARIANT[status]}>{t(`admin:campaigns.status_${status}`)}</Badge>
          </div>
          <PermissionGuard requires="campaigns:campaign:edit">
            {isEditing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                  {t('admin:campaigns.detail.cancel_btn')}
                </Button>
                <Button
                  size="sm"
                  disabled={updateCampaign.isPending}
                  onClick={() => {
                    updateCampaign.mutate(
                      { id: campaignIdNum, name: editName, description: editDescription },
                      {
                        onSuccess: () => setIsEditing(false),
                      },
                    );
                  }}
                >
                  {updateCampaign.isPending
                    ? t('admin:campaigns.detail.saving_btn')
                    : t('admin:campaigns.detail.save_btn')}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditName(campaign.name);
                  setEditDescription(campaign.description ?? '');
                  setIsEditing(true);
                }}
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                {t('admin:campaigns.detail.edit_btn')}
              </Button>
            )}
          </PermissionGuard>
        </div>
        {isEditing ? (
          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder={t('admin:campaigns.detail.description_placeholder')}
            className="mt-2"
          />
        ) : campaign.description ? (
          <p className="mt-2 text-sm text-muted-foreground">{campaign.description}</p>
        ) : null}

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
          {t('admin:campaigns.detail.basic')}
        </p>
        <InfoRow icon={Settings} label={t('admin:campaigns.detail.queue')}>
          {campaign.queueName}
        </InfoRow>
        {campaign.teamName && (
          <InfoRow icon={Users} label={t('admin:campaigns.detail.team')}>
            {campaign.teamName}
          </InfoRow>
        )}

        {/* Dialing */}
        <SectionHeader title={t('admin:campaigns.detail.dialing')} />
        <InfoRow icon={Phone} label={t('admin:campaigns.detail.mode')}>
          <span className="capitalize">{campaign.mode}</span>
        </InfoRow>
        <InfoRow icon={Phone} label={t('admin:campaigns.detail.max_concurrent_calls')}>
          {campaign.maxConcurrentCalls}
        </InfoRow>
        {campaign.powerRatio !== undefined && (
          <InfoRow icon={Settings} label={t('admin:campaigns.detail.power_ratio')}>
            {campaign.powerRatio}
          </InfoRow>
        )}
        {campaign.targetAbandonRate !== undefined && (
          <InfoRow icon={Timer} label={t('admin:campaigns.detail.target_abandon_rate')}>
            {campaign.targetAbandonRate}%
          </InfoRow>
        )}

        {/* Schedule */}
        <SectionHeader title={t('admin:campaigns.detail.schedule')} />
        <InfoRow icon={MapPin} label={t('admin:campaigns.detail.timezone')}>
          {campaign.timezone}
        </InfoRow>
        {(campaign.campaignStart || campaign.campaignEnd) && (
          <InfoRow icon={Calendar} label={t('admin:campaigns.detail.campaign_period')}>
            {campaign.campaignStart} &mdash; {campaign.campaignEnd}
          </InfoRow>
        )}
        {campaign.schedule && campaign.schedule.length > 0 && (
          <InfoRow icon={Calendar} label={t('admin:campaigns.detail.weekly_schedule')}>
            <div className="space-y-0.5">
              {campaign.schedule.map((entry) => (
                <div key={entry.day} className="flex items-center gap-2 text-xs">
                  <span className="w-24 font-medium">{entry.day}</span>
                  {entry.enabled ? (
                    <span>
                      {entry.start} &ndash; {entry.end}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t('admin:campaigns.detail.day_closed')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </InfoRow>
        )}
        {campaign.holidays && campaign.holidays.length > 0 && (
          <InfoRow icon={TriangleAlert} label={t('admin:campaigns.detail.holidays_no_dialing')}>
            <div className="flex flex-wrap gap-1">
              {campaign.holidays.map((h) => (
                <Badge key={h} variant="outline">
                  {h}
                </Badge>
              ))}
            </div>
          </InfoRow>
        )}

        {/* Compliance */}
        <SectionHeader title={t('admin:campaigns.detail.compliance')} />
        <InfoRow icon={Shield} label={t('admin:campaigns.detail.dnc_enabled')}>
          {campaign.dncEnabled ? t('admin:campaigns.detail.yes') : t('admin:campaigns.detail.no')}
        </InfoRow>
        <InfoRow icon={RotateCcw} label={t('admin:campaigns.detail.max_attempts')}>
          {campaign.maxAttemptsPerContact}
        </InfoRow>
        <InfoRow icon={Clock} label={t('admin:campaigns.detail.retry_interval')}>
          {campaign.retryIntervalMinutes} {t('admin:campaigns.detail.minutes_short')}
        </InfoRow>
        <InfoRow icon={Timer} label={t('admin:campaigns.detail.time_between_attempts')}>
          {campaign.timeBetweenAttemptsMinutes} {t('admin:campaigns.detail.minutes_short')}
        </InfoRow>
        {campaign.complianceNotes && (
          <InfoRow icon={FileText} label={t('admin:campaigns.detail.notes')}>
            {campaign.complianceNotes}
          </InfoRow>
        )}

        {/* Contacts */}
        <SectionHeader title={t('admin:campaigns.detail.contacts')} />
        <InfoRow icon={Users} label={t('admin:campaigns.detail.total_contacts')}>
          {formatNumber(campaign.totalContacts)}
        </InfoRow>
        <InfoRow icon={Phone} label={t('admin:campaigns.detail.contacts_dialed')}>
          {formatNumber(campaign.contactsDialed)}
        </InfoRow>
      </div>

      {/* Dispositions */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('admin:campaigns.dispositions.heading')}
          </p>
          <Button size="sm" variant="outline" onClick={handleOpenAddDispo}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('admin:campaigns.dispositions.add_btn')}
          </Button>
        </div>

        {dispositions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin:campaigns.dispositions.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('admin:campaigns.dispositions.col_code')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('admin:campaigns.dispositions.col_label')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {t('admin:campaigns.dispositions.col_category')}
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                    {t('admin:campaigns.dispositions.col_retry')}
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                    {t('admin:campaigns.dispositions.col_callback')}
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                    {t('admin:campaigns.dispositions.col_active')}
                  </th>
                  <th className="px-3 py-2" aria-label={t('common:table.col_actions')} />
                </tr>
              </thead>
              <tbody>
                {dispositions.map((d) => (
                  <tr key={d.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs font-medium">{d.code}</td>
                    <td className="px-3 py-2">{d.label}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="capitalize">
                        {d.category}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={d.triggerRetry}
                        disabled
                        aria-label={t('admin:campaigns.dispositions.aria_trigger_retry')}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={d.triggerCallback}
                        disabled
                        aria-label={t('admin:campaigns.dispositions.aria_trigger_callback')}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={d.isActive}
                        disabled
                        aria-label={t('admin:campaigns.dispositions.aria_is_active')}
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
                          {t('admin:campaigns.dispositions.row_edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          aria-label={t('common:actions.delete')}
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
          {t('admin:campaigns.detail.pending_callbacks')}
        </p>
        <CallbacksTab campaignId={campaignIdNum} />
      </div>

      {/* Contact Lists */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('admin:campaigns.detail.contact_lists')}
          </p>
        </div>
        {contactLists.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('admin:campaigns.detail.contact_lists_empty')}
          </p>
        ) : (
          <div className="space-y-2">
            {contactLists.map((list) => (
              <div
                key={list.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{list.name}</p>
                  {list.sourceFileName && (
                    <p className="text-xs text-muted-foreground">{list.sourceFileName}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {t('admin:campaigns.detail.list_total', { count: list.totalContacts })}
                  </span>
                  <span>
                    {t('admin:campaigns.detail.list_pending', { count: list.pendingContacts })}
                  </span>
                  <span>
                    {t('admin:campaigns.detail.list_completed', { count: list.completedContacts })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <PermissionGuard requires="system:audit:view">
        <div className="rounded-lg border bg-card p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('admin:campaigns.detail.history')}
          </p>
          <AuditTimeline entityType="campaign" entityId={String(campaignIdNum)} />
        </div>
      </PermissionGuard>

      {/* Stop confirmation dialog */}
      <ConfirmDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        title={t('admin:campaigns.stopTitle')}
        description={
          <>
            {t('admin:campaigns.detail.stop_description_prefix')}
            <strong>{campaign.name}</strong>
            {t('admin:campaigns.detail.stop_description_suffix')}
          </>
        }
        onConfirm={handleStop}
        confirmLabel={t('admin:campaigns.detail.stop_confirm')}
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
        onOpenChange={(o) => {
          if (!o) setDeletingDispoId(null);
        }}
        title={t('admin:campaigns.dispositions.delete_title')}
        description={t('admin:campaigns.dispositions.delete_description')}
        onConfirm={handleConfirmDelete}
        confirmLabel={t('admin:campaigns.dispositions.delete_confirm')}
        variant="destructive"
      />

      {/* Campaign delete confirmation */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteCampaign}
        entityName={campaign.name}
        entityType={t('admin:campaigns.entity_type')}
        isPending={deleteCampaign.isPending}
      />
    </div>
  );
}
