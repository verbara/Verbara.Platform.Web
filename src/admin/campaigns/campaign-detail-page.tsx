import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Separator } from '@/core/ui/separator';
import { ConfirmDialog } from '@/admin/shared/confirm-dialog';
import type { CampaignStatus, DialingMode } from './campaign-list-page';

interface CampaignScheduleEntry {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
}

interface CampaignDetail {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  queueName: string;
  teamName: string;
  mode: DialingMode;
  pacingStrategy: string;
  pacingTargetWait: number;
  maxChannels: number;
  timezone: string;
  schedule: CampaignScheduleEntry[];
  campaignStart: string;
  campaignEnd: string;
  holidays: string[];
  dncEnabled: boolean;
  maxAttempts: number;
  retryIntervalMinutes: number;
  timeBetweenAttempts: number;
  complianceNotes: string;
  totalContacts: number;
  contactsDialed: number;
}

const MOCK_CAMPAIGN: CampaignDetail = {
  id: 'c1',
  name: 'Q1 Retention',
  description: 'Outbound retention campaign for Q1',
  status: 'active',
  queueName: 'Retention',
  teamName: 'Team Alpha',
  mode: 'predictive',
  pacingStrategy: 'adaptive',
  pacingTargetWait: 5,
  maxChannels: 50,
  timezone: 'America/Bogota',
  schedule: [
    { day: 'Monday', enabled: true, start: '09:00', end: '18:00' },
    { day: 'Tuesday', enabled: true, start: '09:00', end: '18:00' },
    { day: 'Wednesday', enabled: true, start: '09:00', end: '18:00' },
    { day: 'Thursday', enabled: true, start: '09:00', end: '18:00' },
    { day: 'Friday', enabled: true, start: '09:00', end: '17:00' },
    { day: 'Saturday', enabled: false, start: '', end: '' },
    { day: 'Sunday', enabled: false, start: '', end: '' },
  ],
  campaignStart: '2026-03-01',
  campaignEnd: '2026-03-31',
  holidays: ['2026-03-19'],
  dncEnabled: true,
  maxAttempts: 3,
  retryIntervalMinutes: 60,
  timeBetweenAttempts: 30,
  complianceNotes: 'Follow local telecom regulations',
  totalContacts: 5000,
  contactsDialed: 2340,
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
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus | null>(null);

  const { data: campaign } = useQuery({
    queryKey: ['campaigns', campaignId],
    queryFn: async () => {
      const found = campaignId === MOCK_CAMPAIGN.id ? MOCK_CAMPAIGN : null;
      return found;
    },
  });

  const status = campaignStatus ?? campaign?.status ?? 'draft';

  if (!campaign) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Campaign not found.
      </div>
    );
  }

  const handleStart = () => {
    setCampaignStatus('active');
    toast.success(t('admin:campaigns.toastStarted'));
  };

  const handlePause = () => {
    setCampaignStatus('paused');
    toast.success(t('admin:campaigns.toastPaused'));
  };

  const handleResume = () => {
    setCampaignStatus('active');
    toast.success(t('admin:campaigns.toastResumed'));
  };

  const handleStop = () => {
    setCampaignStatus('completed');
    setStopOpen(false);
    toast.success(t('admin:campaigns.toastStopped'));
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
        <InfoRow icon={Users} label="Team">
          {campaign.teamName}
        </InfoRow>

        {/* Dialing */}
        <SectionHeader title="Dialing" />
        <InfoRow icon={Phone} label="Mode">
          <span className="capitalize">{campaign.mode}</span>
        </InfoRow>
        <InfoRow icon={Settings} label="Pacing Strategy">
          <span className="capitalize">{campaign.pacingStrategy}</span>
        </InfoRow>
        <InfoRow icon={Timer} label="Target Wait (seconds)">
          {campaign.pacingTargetWait}s
        </InfoRow>
        <InfoRow icon={Phone} label="Max Channels">
          {campaign.maxChannels}
        </InfoRow>

        {/* Schedule */}
        <SectionHeader title="Schedule" />
        <InfoRow icon={MapPin} label="Timezone">
          {campaign.timezone}
        </InfoRow>
        <InfoRow icon={Calendar} label="Campaign Period">
          {campaign.campaignStart} &mdash; {campaign.campaignEnd}
        </InfoRow>
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
        {campaign.holidays.length > 0 && (
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
          {campaign.maxAttempts}
        </InfoRow>
        <InfoRow icon={Clock} label="Retry Interval">
          {campaign.retryIntervalMinutes} min
        </InfoRow>
        <InfoRow icon={Timer} label="Time Between Attempts">
          {campaign.timeBetweenAttempts} min
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
