import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, type ColDef, type ICellRendererParams, ModuleRegistry } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {
  Phone,
  MessageCircle,
  Globe,
  Mail,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import { ExportButton } from '@/analytics/shared/export-button';
import { CdrDetailDrawer } from './cdr-detail-drawer';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface CdrRow {
  id: string;
  startTime: string;
  endTime: string;
  answerTime: string | null;
  contact: string;
  channel: 'voice' | 'whatsapp' | 'webchat' | 'email';
  queue: string;
  agent: string;
  duration: string;
  disposition: string;
  slaMet: boolean;
  recordingUrl: string | null;
  transferTo: string | null;
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
      <CheckCircle2 className="h-3.5 w-3.5" /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-500">
      <XCircle className="h-3.5 w-3.5" /> No
    </span>
  );
}

// Disposition badge cell renderer
function DispositionCellRenderer({ value }: ICellRendererParams<CdrRow, string>) {
  const variant = value === 'ANSWERED' ? 'default' : value === 'NO ANSWER' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{value}</Badge>;
}

// --- Mock data ---
const MOCK_CDR: CdrRow[] = [
  { id: 'cdr-01', startTime: '2026-03-23 08:12:34', endTime: '2026-03-23 08:17:12', answerTime: '2026-03-23 08:12:55', contact: '+1 555-0101', channel: 'voice', queue: 'support', agent: 'Ana Garcia', duration: '4m 38s', disposition: 'ANSWERED', slaMet: true, recordingUrl: '/mock/rec-01.wav', transferTo: null },
  { id: 'cdr-02', startTime: '2026-03-23 08:15:01', endTime: '2026-03-23 08:15:45', answerTime: null, contact: '+1 555-0102', channel: 'voice', queue: 'sales', agent: '', duration: '0m 44s', disposition: 'NO ANSWER', slaMet: false, recordingUrl: null, transferTo: null },
  { id: 'cdr-03', startTime: '2026-03-23 08:22:10', endTime: '2026-03-23 08:30:05', answerTime: '2026-03-23 08:22:28', contact: 'user@chat.com', channel: 'webchat', queue: 'support', agent: 'Carlos Mendez', duration: '7m 55s', disposition: 'ANSWERED', slaMet: true, recordingUrl: null, transferTo: null },
  { id: 'cdr-04', startTime: '2026-03-23 08:30:22', endTime: '2026-03-23 08:35:11', answerTime: '2026-03-23 08:30:40', contact: '+52 55-1234-5678', channel: 'whatsapp', queue: 'billing', agent: 'Maria Lopez', duration: '4m 49s', disposition: 'ANSWERED', slaMet: true, recordingUrl: '/mock/rec-04.wav', transferTo: null },
  { id: 'cdr-05', startTime: '2026-03-23 08:42:05', endTime: '2026-03-23 08:42:35', answerTime: null, contact: '+1 555-0105', channel: 'voice', queue: 'support', agent: '', duration: '0m 30s', disposition: 'BUSY', slaMet: false, recordingUrl: null, transferTo: null },
  { id: 'cdr-06', startTime: '2026-03-23 09:01:44', endTime: '2026-03-23 09:12:30', answerTime: '2026-03-23 09:02:10', contact: 'contact@corp.com', channel: 'email', queue: 'support', agent: 'Ana Garcia', duration: '10m 46s', disposition: 'ANSWERED', slaMet: false, recordingUrl: null, transferTo: null },
  { id: 'cdr-07', startTime: '2026-03-23 09:05:18', endTime: '2026-03-23 09:09:55', answerTime: '2026-03-23 09:05:30', contact: '+1 555-0107', channel: 'voice', queue: 'sales', agent: 'Pedro Ruiz', duration: '4m 37s', disposition: 'ANSWERED', slaMet: true, recordingUrl: '/mock/rec-07.wav', transferTo: 'Maria Lopez' },
  { id: 'cdr-08', startTime: '2026-03-23 09:10:33', endTime: '2026-03-23 09:18:20', answerTime: '2026-03-23 09:11:05', contact: '+52 55-9876-5432', channel: 'whatsapp', queue: 'support', agent: 'Carlos Mendez', duration: '7m 47s', disposition: 'ANSWERED', slaMet: true, recordingUrl: null, transferTo: null },
  { id: 'cdr-09', startTime: '2026-03-23 09:22:00', endTime: '2026-03-23 09:22:45', answerTime: null, contact: '+1 555-0109', channel: 'voice', queue: 'billing', agent: '', duration: '0m 45s', disposition: 'NO ANSWER', slaMet: false, recordingUrl: null, transferTo: null },
  { id: 'cdr-10', startTime: '2026-03-23 09:30:12', endTime: '2026-03-23 09:36:48', answerTime: '2026-03-23 09:30:28', contact: 'visitor@web.io', channel: 'webchat', queue: 'sales', agent: 'Pedro Ruiz', duration: '6m 36s', disposition: 'ANSWERED', slaMet: true, recordingUrl: null, transferTo: null },
  { id: 'cdr-11', startTime: '2026-03-23 09:45:05', endTime: '2026-03-23 09:52:10', answerTime: '2026-03-23 09:45:22', contact: '+1 555-0111', channel: 'voice', queue: 'support', agent: 'Ana Garcia', duration: '7m 05s', disposition: 'ANSWERED', slaMet: true, recordingUrl: '/mock/rec-11.wav', transferTo: null },
  { id: 'cdr-12', startTime: '2026-03-23 10:00:30', endTime: '2026-03-23 10:03:15', answerTime: '2026-03-23 10:00:48', contact: '+52 55-5555-0012', channel: 'whatsapp', queue: 'billing', agent: 'Maria Lopez', duration: '2m 45s', disposition: 'ANSWERED', slaMet: true, recordingUrl: null, transferTo: null },
  { id: 'cdr-13', startTime: '2026-03-23 10:08:11', endTime: '2026-03-23 10:08:41', answerTime: null, contact: '+1 555-0113', channel: 'voice', queue: 'support', agent: '', duration: '0m 30s', disposition: 'NO ANSWER', slaMet: false, recordingUrl: null, transferTo: null },
  { id: 'cdr-14', startTime: '2026-03-23 10:15:22', endTime: '2026-03-23 10:22:50', answerTime: '2026-03-23 10:15:40', contact: 'help@client.org', channel: 'email', queue: 'support', agent: 'Carlos Mendez', duration: '7m 28s', disposition: 'ANSWERED', slaMet: true, recordingUrl: null, transferTo: null },
  { id: 'cdr-15', startTime: '2026-03-23 10:30:00', endTime: '2026-03-23 10:38:25', answerTime: '2026-03-23 10:30:15', contact: '+1 555-0115', channel: 'voice', queue: 'sales', agent: 'Pedro Ruiz', duration: '8m 25s', disposition: 'ANSWERED', slaMet: false, recordingUrl: '/mock/rec-15.wav', transferTo: null },
  { id: 'cdr-16', startTime: '2026-03-23 10:42:18', endTime: '2026-03-23 10:47:55', answerTime: '2026-03-23 10:42:35', contact: '+52 55-1111-2222', channel: 'whatsapp', queue: 'support', agent: 'Ana Garcia', duration: '5m 37s', disposition: 'ANSWERED', slaMet: true, recordingUrl: null, transferTo: null },
  { id: 'cdr-17', startTime: '2026-03-23 11:00:05', endTime: '2026-03-23 11:05:30', answerTime: '2026-03-23 11:00:20', contact: 'chat-user@live.com', channel: 'webchat', queue: 'billing', agent: 'Maria Lopez', duration: '5m 25s', disposition: 'ANSWERED', slaMet: true, recordingUrl: null, transferTo: null },
  { id: 'cdr-18', startTime: '2026-03-23 11:10:45', endTime: '2026-03-23 11:11:15', answerTime: null, contact: '+1 555-0118', channel: 'voice', queue: 'sales', agent: '', duration: '0m 30s', disposition: 'BUSY', slaMet: false, recordingUrl: null, transferTo: null },
  { id: 'cdr-19', startTime: '2026-03-23 11:20:33', endTime: '2026-03-23 11:28:10', answerTime: '2026-03-23 11:20:50', contact: '+1 555-0119', channel: 'voice', queue: 'support', agent: 'Carlos Mendez', duration: '7m 37s', disposition: 'ANSWERED', slaMet: true, recordingUrl: '/mock/rec-19.wav', transferTo: null },
  { id: 'cdr-20', startTime: '2026-03-23 11:35:00', endTime: '2026-03-23 11:42:18', answerTime: '2026-03-23 11:35:12', contact: '+52 55-3333-4444', channel: 'whatsapp', queue: 'support', agent: 'Ana Garcia', duration: '7m 18s', disposition: 'ANSWERED', slaMet: true, recordingUrl: null, transferTo: 'Pedro Ruiz' },
  { id: 'cdr-21', startTime: '2026-03-23 11:50:22', endTime: '2026-03-23 11:55:40', answerTime: '2026-03-23 11:50:38', contact: 'info@company.com', channel: 'email', queue: 'billing', agent: 'Maria Lopez', duration: '5m 18s', disposition: 'ANSWERED', slaMet: true, recordingUrl: null, transferTo: null },
  { id: 'cdr-22', startTime: '2026-03-23 12:05:10', endTime: '2026-03-23 12:13:45', answerTime: '2026-03-23 12:05:25', contact: '+1 555-0122', channel: 'voice', queue: 'support', agent: 'Pedro Ruiz', duration: '8m 35s', disposition: 'ANSWERED', slaMet: false, recordingUrl: '/mock/rec-22.wav', transferTo: null },
];

export default function CdrPage() {
  const { t } = useTranslation('analytics');
  const [selectedRow, setSelectedRow] = useState<CdrRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    ],
    [t],
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({ resizable: true, flex: 1 }),
    [],
  );

  const handleRowClicked = useCallback((event: { data: CdrRow | undefined }) => {
    if (event.data) {
      setSelectedRow(event.data);
      setDrawerOpen(true);
    }
  }, []);

  const handleExport = useCallback(() => {
    const headers = ['Date', 'Contact', 'Channel', 'Queue', 'Agent', 'Duration', 'Disposition', 'SLA Met'];
    const csvRows = [
      headers.join(','),
      ...MOCK_CDR.map((r) =>
        [r.startTime, r.contact, r.channel, r.queue, r.agent, r.duration, r.disposition, r.slaMet ? 'Yes' : 'No'].join(','),
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cdr-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('cdr.title')}
        </h1>
        <ExportButton onClick={handleExport} />
      </div>

      <div className="ag-theme-alpine h-[600px] w-full rounded-lg border dark:ag-theme-alpine-dark">
        <AgGridReact<CdrRow>
          rowData={MOCK_CDR}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          pagination={true}
          paginationPageSize={50}
          onRowClicked={handleRowClicked}
          rowClass="cursor-pointer"
          animateRows={true}
        />
      </div>

      <CdrDetailDrawer
        row={selectedRow}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
