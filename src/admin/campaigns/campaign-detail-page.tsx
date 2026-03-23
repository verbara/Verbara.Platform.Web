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
import {
  useCampaign,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useStopCampaign,
  useCampaignDispositions,
  useCreateDispositionCode,
  useUpdateDispositionCode,
  useDeleteDispositionCode,
} from '@/core/api/hooks/use-campaigns';
import type { CampaignStatus } from './campaign-list-page';

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

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();
  const [stopOpen, setStopOpen] = useState(false);

  const campaignIdNum = Number(campaignId);
  const { data: campaign, isLoading } = useCampaign(campaignIdNum);

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
    </div>
  );
}
