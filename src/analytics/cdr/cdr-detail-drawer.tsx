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
import type { CdrRow } from './cdr-page';

interface CdrDetailDrawerProps {
  row: CdrRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TimelineEvent {
  time: string;
  label: string;
  icon: React.ReactNode;
}

function buildTimeline(row: CdrRow): TimelineEvent[] {
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

export function CdrDetailDrawer({ row, open, onOpenChange }: CdrDetailDrawerProps) {
  const { t } = useTranslation('analytics');

  if (!row) return null;

  const timeline = buildTimeline(row);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('cdr.title')}</SheetTitle>
          <SheetDescription>{row.contact}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
          {/* Fields */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label={t('cdr.date')} value={row.startTime} />
            <Field label={t('cdr.duration')} value={row.duration} />
            <Field label={t('cdr.channel')} value={row.channel} />
            <Field label={t('cdr.queue')} value={row.queue} />
            <Field label={t('cdr.agent')} value={row.agent} />
            <Field label={t('cdr.disposition')} value={row.disposition} />
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-muted-foreground">{t('cdr.sla_met')}:</span>
              <Badge variant={row.slaMet ? 'default' : 'destructive'}>
                {row.slaMet ? 'Yes' : 'No'}
              </Badge>
            </div>
          </div>

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

          {/* Recording */}
          {row.recordingUrl && (
            <>
              <Separator />
              <div>
                <h3 className="mb-2 text-sm font-medium">{t('cdr.recording')}</h3>
                <AudioPlayer src={row.recordingUrl} />
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
