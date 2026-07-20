import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  type ColDef,
  type ICellRendererParams,
  ModuleRegistry,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {
  Phone,
  MessageCircle,
  Globe,
  Mail,
  CircleCheck,
  CircleX,
  ChevronLeft,
  ChevronRight,
  Play,
  Users,
} from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { ExportButton } from '@/analytics/shared/export-button';
import { ContactSearchPanel } from '@/core/ui/contact-search-panel';
import { CdrDetailDrawer } from './cdr-detail-drawer';
import { useCdrList, type CdrRow as ApiCdrRow } from '@/core/api/hooks/use-analytics';
import { useAnalyticsFilterStore } from '@/core/stores/analytics-filter-store';
import { useFormatDate } from '@/core/i18n/use-format';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface CdrRow {
  id: string;
  startTime: string;
  endTime: string;
  answerTime: string | null;
  contact: string;
  channel: string;
  queue: string;
  agent: string;
  duration: string;
  disposition: string;
  slaMet: boolean;
  recordingUrl: string | null;
  transferTo: string | null;
  hasRecording: boolean;
  campaignName: string | null;
  // Premium columns
  qaScore: number | null;
  sentimentLabel: string | null;
  ringDurationMs: number | null;
  holdCount: number | null;
  wrapUpDurationMs: number | null;
}

// Channel icon cell renderer
function ChannelCellRenderer({ value }: ICellRendererParams<CdrRow, string>) {
  const iconMap: Record<string, React.ReactNode> = {
    voice: <Phone className="h-4 w-4 text-blue-500" />,
    whatsapp: <MessageCircle className="h-4 w-4 text-green-500" />,
    webchat: <Globe className="h-4 w-4 text-violet-500" />,
    email: <Mail className="h-4 w-4 text-amber-500" />,
  };
  return (
    <span className="flex items-center gap-1.5">
      {iconMap[value ?? ''] ?? null}
      <span className="capitalize">{value}</span>
    </span>
  );
}

// SLA badge cell renderer
function SlaCellRenderer({ value }: ICellRendererParams<CdrRow, boolean>) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-green-600">
      <CircleCheck className="h-3.5 w-3.5" /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-500">
      <CircleX className="h-3.5 w-3.5" /> No
    </span>
  );
}

// Disposition badge cell renderer
function DispositionCellRenderer({ value }: ICellRendererParams<CdrRow, string>) {
  const upper = (value ?? '').toUpperCase();
  const variant =
    upper === 'ANSWERED' ? 'default' : upper === 'NO ANSWER' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{value}</Badge>;
}

// Recording icon cell renderer
function RecordingCellRenderer({ data }: ICellRendererParams<CdrRow>) {
  const { t } = useTranslation('analytics');
  if (!data?.hasRecording) return null;
  return <Play className="h-3.5 w-3.5 text-blue-500" aria-label={t('cdr.aria.hasRecording')} />;
}

// QA score badge cell renderer
function QaScoreCellRenderer({ data }: ICellRendererParams<CdrRow>) {
  const score = data?.qaScore;
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const color =
    score >= 80
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : score >= 60
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {Math.round(score)}/100
    </span>
  );
}

// Sentiment badge cell renderer
function SentimentCellRenderer({ data }: ICellRendererParams<CdrRow>) {
  const label = data?.sentimentLabel;
  if (!label) return <span className="text-muted-foreground">—</span>;
  const upper = label.toUpperCase();
  const color =
    upper === 'POSITIVE'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : upper === 'NEGATIVE'
        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {label}
    </span>
  );
}

// Hold count badge cell renderer
function HoldCountCellRenderer({ data }: ICellRendererParams<CdrRow>) {
  const count = data?.holdCount;
  if (!count) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {count} {count === 1 ? 'hold' : 'holds'}
    </span>
  );
}

function formatDurationMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatMinSec(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function CdrPage() {
  const { t } = useTranslation('analytics');
  const { formatDateTime } = useFormatDate();
  const mapApiRowToGridRow = useCallback(
    (r: ApiCdrRow): CdrRow => {
      const formatDateTimeSafe = (iso: string): string => {
        try {
          return formatDateTime(iso);
        } catch {
          return iso;
        }
      };
      return {
        id: r.sessionId,
        startTime: formatDateTimeSafe(r.startTime),
        endTime: formatDateTimeSafe(r.endTime),
        answerTime: r.answerTime ? formatDateTimeSafe(r.answerTime) : null,
        contact: r.contact ?? '',
        channel: r.channelType ?? r.channel,
        queue: r.queueName ?? '',
        agent: r.agentName ?? '',
        duration: formatDurationMs(r.durationMs),
        disposition: r.dispositionName ?? r.disposition,
        slaMet: r.slaMet,
        recordingUrl: r.recordingStreamUrl ?? null,
        transferTo: r.transferredTo ?? null,
        hasRecording: r.hasRecording,
        campaignName: r.campaignName ?? null,
        qaScore: r.qaScore ?? null,
        sentimentLabel: r.sentimentLabel ?? null,
        ringDurationMs: r.ringDurationMs ?? null,
        holdCount: r.holdCount ?? null,
        wrapUpDurationMs: r.wrapUpDurationMs ?? null,
      };
    },
    [formatDateTime],
  );
  const [selectedRow, setSelectedRow] = useState<CdrRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const { from, to, queue } = useAnalyticsFilterStore();

  // Reset to first page when filters (Zustand store) change. Legitimate because
  // the filters are owned by an external store, not a local prop, so we can't
  // co-locate the reset with the setter.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [from, to, queue]);

  const { data, isLoading } = useCdrList(from, to, { queue: queue || undefined }, page);

  const rowData = useMemo<CdrRow[]>(
    () => (data?.items ?? []).map(mapApiRowToGridRow),
    [data, mapApiRowToGridRow],
  );

  const columnDefs = useMemo<ColDef<CdrRow>[]>(
    () => [
      { field: 'startTime', headerName: t('cdr.date'), sortable: true, minWidth: 160 },
      { field: 'contact', headerName: t('cdr.contact'), sortable: true, minWidth: 140 },
      {
        field: 'channel',
        headerName: t('cdr.channel'),
        sortable: true,
        minWidth: 120,
        cellRenderer: ChannelCellRenderer,
      },
      { field: 'queue', headerName: t('cdr.queue'), sortable: true, minWidth: 100 },
      { field: 'agent', headerName: t('cdr.agent'), sortable: true, minWidth: 130 },
      { field: 'duration', headerName: t('cdr.duration'), sortable: true, minWidth: 100 },
      {
        field: 'disposition',
        headerName: t('cdr.disposition'),
        sortable: true,
        minWidth: 130,
        cellRenderer: DispositionCellRenderer,
      },
      {
        field: 'slaMet',
        headerName: t('cdr.sla_met'),
        sortable: true,
        minWidth: 90,
        cellRenderer: SlaCellRenderer,
      },
      {
        field: 'hasRecording',
        headerName: '',
        sortable: false,
        minWidth: 44,
        maxWidth: 44,
        cellRenderer: RecordingCellRenderer,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      },
      {
        field: 'qaScore',
        headerName: t('cdr.qa_score'),
        sortable: true,
        minWidth: 100,
        cellRenderer: QaScoreCellRenderer,
      },
      {
        field: 'sentimentLabel',
        headerName: t('cdr.sentiment'),
        sortable: true,
        minWidth: 110,
        cellRenderer: SentimentCellRenderer,
      },
      {
        field: 'ringDurationMs',
        headerName: t('cdr.ring_duration'),
        sortable: true,
        minWidth: 110,
        valueFormatter: ({ value }: { value: number | null }) =>
          value != null ? formatMinSec(value) : '—',
      },
      {
        field: 'holdCount',
        headerName: t('cdr.hold_count'),
        sortable: true,
        minWidth: 100,
        cellRenderer: HoldCountCellRenderer,
      },
      {
        field: 'wrapUpDurationMs',
        headerName: t('cdr.acw_duration'),
        sortable: true,
        minWidth: 110,
        valueFormatter: ({ value }: { value: number | null }) =>
          value != null ? formatMinSec(value) : '—',
      },
    ],
    [t],
  );

  const defaultColDef = useMemo<ColDef>(() => ({ resizable: true, flex: 1 }), []);

  const handleRowClicked = useCallback((event: { data: CdrRow | undefined }) => {
    if (event.data) {
      setSelectedRow(event.data);
      setDrawerOpen(true);
    }
  }, []);

  const handleExport = useCallback(() => {
    const headers = [
      'Date',
      'Contact',
      'Channel',
      'Queue',
      'Agent',
      'Duration',
      'Disposition',
      'SLA Met',
    ];
    const csvRows = [
      headers.join(','),
      ...rowData.map((r) =>
        [
          r.startTime,
          r.contact,
          r.channel,
          r.queue,
          r.agent,
          r.duration,
          r.disposition,
          r.slaMet ? 'Yes' : 'No',
        ].join(','),
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cdr-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [rowData]);

  return (
    <div className="space-y-4" data-testid="cdr-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('cdr.title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setContactSearchOpen((o) => !o)}>
            <Users className="mr-1.5 h-4 w-4" />
            Contact Search
          </Button>
          <span data-testid="cdr-export-btn">
            <ExportButton onClick={handleExport} />
          </span>
        </div>
      </div>

      {contactSearchOpen && (
        <div className="rounded-lg border bg-card p-4">
          <ContactSearchPanel />
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          Loading…
        </div>
      )}

      {!isLoading && (
        <div
          className="ag-theme-alpine h-[600px] w-full rounded-lg border dark:ag-theme-alpine-dark"
          data-testid="cdr-table"
        >
          <AgGridReact<CdrRow>
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onRowClicked={handleRowClicked}
            rowClass="cursor-pointer"
            animateRows={true}
          />
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2" data-testid="cdr-pagination">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!data?.hasNextPage}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <CdrDetailDrawer
        sessionId={selectedRow?.id ?? null}
        row={selectedRow}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
