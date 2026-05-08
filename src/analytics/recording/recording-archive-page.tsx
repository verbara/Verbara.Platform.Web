import { useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { useCdrList } from '@/core/api/hooks/use-analytics';
import { recordingStreamUrl } from '@/core/api/hooks/use-recording';

const StereoWaveformPlayer = lazy(() => import('@/analytics/cdr/stereo-waveform-player'));

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function RecordingArchivePage() {
  const { t } = useTranslation('analytics');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [agent, setAgent] = useState('');
  const [queue, setQueue] = useState('');
  const [page, setPage] = useState(1);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const filters = {
    ...(agent && { agent }),
    ...(queue && { queue }),
  };
  const { data, isLoading } = useCdrList(
    from || undefined,
    to || undefined,
    Object.keys(filters).length > 0 ? filters : undefined,
    page,
  );

  const recordings = data?.items.filter((row) => row.hasRecording) ?? [];

  function handlePlay(sessionId: string) {
    setExpandedSession((prev) => (prev === sessionId ? null : sessionId));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('recording.archive.title', 'Recording Archive')}
        description={t('recording.archive.description', 'Browse and play back call recordings.')}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3" data-testid="filter-bar">
        <Input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          aria-label={t('recording.archive.filters.dateRange', 'Date range')}
          className="w-40"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          aria-label="date-to"
          className="w-40"
        />
        <Input
          placeholder={t('recording.archive.filters.agent', 'Agent')}
          value={agent}
          onChange={(e) => {
            setAgent(e.target.value);
            setPage(1);
          }}
          className="w-44"
        />
        <Input
          placeholder={t('recording.archive.filters.queue', 'Queue')}
          value={queue}
          onChange={(e) => {
            setQueue(e.target.value);
            setPage(1);
          }}
          className="w-44"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
      ) : recordings.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground" data-testid="empty-state">
          {t('recording.archive.empty', 'No recordings found for the selected filters.')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  {t('recording.archive.columns.date', 'Date')}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t('recording.archive.columns.contact', 'Contact')}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t('recording.archive.columns.agent', 'Agent')}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t('recording.archive.columns.queue', 'Queue')}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t('recording.archive.columns.duration', 'Duration')}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t('recording.archive.columns.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recordings.map((row) => (
                <RecordingRow
                  key={row.sessionId}
                  row={row}
                  isExpanded={expandedSession === row.sessionId}
                  onPlay={() => handlePlay(row.sessionId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {Math.max(1, Math.ceil(data.totalCount / data.pageSize))}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface RecordingRowProps {
  readonly row: {
    sessionId: string;
    startTime: string;
    contact?: string;
    agentName?: string;
    queueName?: string;
    durationMs: number;
  };
  readonly isExpanded: boolean;
  readonly onPlay: () => void;
}

function RecordingRow({ row, isExpanded, onPlay }: RecordingRowProps) {
  const { t } = useTranslation('analytics');
  const streamUrl = recordingStreamUrl(row.sessionId);

  return (
    <>
      <tr className="hover:bg-muted/30">
        <td className="px-4 py-3">{new Date(row.startTime).toLocaleString()}</td>
        <td className="px-4 py-3">{row.contact ?? '—'}</td>
        <td className="px-4 py-3">{row.agentName ?? '—'}</td>
        <td className="px-4 py-3">{row.queueName ?? '—'}</td>
        <td className="px-4 py-3">{formatDuration(row.durationMs)}</td>
        {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- buttons inside have sr-only labels; <td> is not a control */}
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPlay}
              data-testid={`play-${row.sessionId}`}
            >
              <Play className="h-4 w-4" />
              <span className="sr-only">{t('recording.archive.play', 'Play')}</span>
            </Button>
            <a href={streamUrl} target="_blank" rel="noopener noreferrer" download>
              <Button variant="ghost" size="sm" data-testid={`download-${row.sessionId}`}>
                <Download className="h-4 w-4" />
                <span className="sr-only">{t('recording.archive.download', 'Download')}</span>
              </Button>
            </a>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr data-testid={`player-row-${row.sessionId}`}>
          <td colSpan={6} className="bg-muted/20 px-4 py-4">
            <Suspense
              fallback={
                <div className="py-4 text-center text-sm text-muted-foreground">
                  Loading player...
                </div>
              }
            >
              <StereoWaveformPlayer src={streamUrl} />
            </Suspense>
          </td>
        </tr>
      )}
    </>
  );
}
