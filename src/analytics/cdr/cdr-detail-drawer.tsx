import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, PhoneOff, UserCheck, Clock, ArrowRightLeft } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/ui/sheet';
import { Badge } from '@/core/ui/badge';
import { Separator } from '@/core/ui/separator';
import { AudioPlayer } from './audio-player';
import { SyncedTranscript } from './synced-transcript';
import type { CdrRow } from './cdr-page';
import { useCdrDetail, useTranscript } from '@/core/api/hooks/use-analytics';

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

interface CdrDetailDrawerProps {
  sessionId: string | null;
  row: CdrRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TimelineEvent {
  time: string;
  label: string;
  icon: React.ReactNode;
}

function buildTimelineFromRow(row: CdrRow): TimelineEvent[] {
  return [
    {
      time: row.startTime,
      label: 'Call started',
      icon: <Phone className="h-3.5 w-3.5 text-green-500" />,
    },
    {
      time: row.answerTime ?? row.startTime,
      label: row.answerTime ? 'Answered by agent' : 'Not answered',
      icon: <UserCheck className="h-3.5 w-3.5 text-blue-500" />,
    },
    ...(row.transferTo
      ? [
          {
            time: row.answerTime ?? row.startTime,
            label: `Transferred to ${row.transferTo}`,
            icon: <ArrowRightLeft className="h-3.5 w-3.5 text-amber-500" />,
          },
        ]
      : []),
    {
      time: row.endTime,
      label: 'Call ended',
      icon: <PhoneOff className="h-3.5 w-3.5 text-red-500" />,
    },
  ];
}

function buildTimelineFromEvents(
  events: { event: string; timestamp: string; detail?: string }[],
): TimelineEvent[] {
  const iconFor = (event: string): React.ReactNode => {
    const lower = event.toLowerCase();
    if (lower.includes('start') || lower.includes('creat')) return <Phone className="h-3.5 w-3.5 text-green-500" />;
    if (lower.includes('answer') || lower.includes('agent')) return <UserCheck className="h-3.5 w-3.5 text-blue-500" />;
    if (lower.includes('transfer')) return <ArrowRightLeft className="h-3.5 w-3.5 text-amber-500" />;
    if (lower.includes('end') || lower.includes('hung') || lower.includes('abandon')) return <PhoneOff className="h-3.5 w-3.5 text-red-500" />;
    return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  };
  return events.map((e) => ({
    time: e.timestamp,
    label: e.detail ? `${e.event}: ${e.detail}` : e.event,
    icon: iconFor(e.event),
  }));
}

export function CdrDetailDrawer({ sessionId, row, open, onOpenChange }: CdrDetailDrawerProps) {
  const { t } = useTranslation('analytics');
  const [currentTime, setCurrentTime] = useState(0);
  const seekRef = useRef<((time: number) => void) | null>(null);

  const { data: detail, isLoading } = useCdrDetail(sessionId ?? '');
  const hasTranscript = detail?.hasTranscript ?? false;
  const { data: transcriptSegments } = useTranscript(sessionId ?? '', hasTranscript);

  if (!row) return null;

  const apiCdr = detail?.cdr;

  // Prefer API-sourced fields when available, fall back to grid row
  const startTime = apiCdr?.startTime ? new Date(apiCdr.startTime).toLocaleString() : row.startTime;
  const endTime = apiCdr?.endTime ? new Date(apiCdr.endTime).toLocaleString() : row.endTime;
  const answerTime = apiCdr?.answerTime ? new Date(apiCdr.answerTime).toLocaleString() : row.answerTime;
  const channel = apiCdr?.channel ?? row.channel;
  const queue = apiCdr?.queueName ?? row.queue;
  const agent = apiCdr?.agentName ?? row.agent;
  const disposition = apiCdr?.dispositionName ?? apiCdr?.disposition ?? row.disposition;
  const slaMet = apiCdr != null ? apiCdr.slaMet : row.slaMet;
  const durationMs = apiCdr?.durationMs;
  const duration = durationMs != null
    ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
    : row.duration;
  const recordingUrl: string | null = detail?.recordingStreamUrl ?? null;

  const timeline: TimelineEvent[] =
    detail?.timeline && detail.timeline.length > 0
      ? buildTimelineFromEvents(detail.timeline)
      : buildTimelineFromRow({ ...row, startTime, endTime, answerTime, channel, queue, agent, duration, disposition, slaMet });

  const qaSummary = detail?.qaSummary;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('cdr.title')}</SheetTitle>
          <SheetDescription>{row.contact}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
          {isLoading && (
            <p className="text-sm text-muted-foreground py-2">Loading detail…</p>
          )}

          {/* Fields */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label={t('cdr.date')} value={startTime} />
            <Field label={t('cdr.duration')} value={duration} />
            <Field label={t('cdr.channel')} value={channel} />
            <Field label={t('cdr.queue')} value={queue} />
            <Field label={t('cdr.agent')} value={agent} />
            <Field label={t('cdr.disposition')} value={disposition} />
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-muted-foreground">{t('cdr.sla_met')}:</span>
              <Badge variant={slaMet ? 'default' : 'destructive'}>
                {slaMet ? 'Yes' : 'No'}
              </Badge>
            </div>
          </div>

          {/* Timing */}
          {(apiCdr?.ringDurationMs != null || apiCdr?.wrapUpDurationMs != null || (apiCdr?.holdCount ?? 0) > 0) && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Timing</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {apiCdr?.ringDurationMs != null && (
                    <Field label="Ring time" value={formatMs(apiCdr.ringDurationMs)} />
                  )}
                  {apiCdr?.wrapUpDurationMs != null && (
                    <Field label="Wrap-up time" value={formatMs(apiCdr.wrapUpDurationMs)} />
                  )}
                  {(apiCdr?.holdCount ?? 0) > 0 && (
                    <Field label="Hold count" value={String(apiCdr!.holdCount)} />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Transfer */}
          {(apiCdr?.transferredTo || (detail?.transferCount ?? 0) > 0) && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Transfer</h3>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {apiCdr?.transferType != null && (
                    <Badge variant="outline">
                      {apiCdr.transferType === 1 ? 'Blind' : apiCdr.transferType === 2 ? 'Attended' : `Type ${apiCdr.transferType}`}
                    </Badge>
                  )}
                  {apiCdr?.transferredTo && (
                    <span className="text-muted-foreground">→ <span className="font-medium text-foreground">{apiCdr.transferredTo}</span></span>
                  )}
                  {(detail?.transferCount ?? 0) > 1 && (
                    <span className="text-muted-foreground text-xs">({detail!.transferCount} transfers)</span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Campaign */}
          {apiCdr?.campaignName && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Campaign</h3>
                <p className="text-sm font-medium">{apiCdr.campaignName}</p>
                {apiCdr.dispositionName && (
                  <p className="text-sm text-muted-foreground">Disposition: {apiCdr.dispositionName}</p>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Timeline */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Timeline</h3>
            <div className="relative space-y-3 pl-6">
              <div className="absolute left-[0.4375rem] top-1 bottom-1 w-px bg-border" />
              {timeline.map((evt, i) => (
                <div key={i} className="relative flex items-start gap-3">
                  <div className="absolute -left-6 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background">
                    {evt.icon}
                  </div>
                  <div>
                    <p className="text-sm">{evt.label}</p>
                    <p className="text-xs text-muted-foreground">
                      <Clock className="mr-1 inline-block h-3 w-3" />
                      {evt.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* QA Summary */}
          {qaSummary && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium">QA Summary</h3>
                {qaSummary.reason && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Reason: </span>
                    {qaSummary.reason}
                  </div>
                )}
                {qaSummary.outcome && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Outcome: </span>
                    {qaSummary.outcome}
                  </div>
                )}
                {qaSummary.narrative && (
                  <p className="text-sm text-muted-foreground">{qaSummary.narrative}</p>
                )}
                <div className="flex items-center gap-3 pt-1">
                  {qaSummary.qaScore != null && (
                    <Badge variant="secondary">Score: {qaSummary.qaScore}</Badge>
                  )}
                  {qaSummary.sentimentLabel && (
                    <Badge variant="outline">{qaSummary.sentimentLabel}</Badge>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Recording */}
          {recordingUrl && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="mb-2 text-sm font-medium">{t('cdr.recording')}</h3>
                <AudioPlayer
                  src={recordingUrl}
                  onTimeUpdate={setCurrentTime}
                  seekRef={seekRef}
                />
                {hasTranscript && transcriptSegments && transcriptSegments.length > 0 && (
                  <SyncedTranscript
                    segments={transcriptSegments}
                    currentTime={currentTime}
                    onSeek={(time) => seekRef.current?.(time)}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  );
}
