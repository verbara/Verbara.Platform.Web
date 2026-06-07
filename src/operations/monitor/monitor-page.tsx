import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/admin/shared/page-header';
import { VirtualList } from '@/core/ui/virtual-list';
import { useActiveSessions, useStartListening } from '@/core/api/hooks/use-supervisor';
import { SessionCard } from './session-card';
import { SessionDetail } from './session-detail';
import { DigitalMonitorTab } from './digital-monitor-tab';
import { StuckWorkTab } from './stuck-work-tab';

const SESSION_CARD_HEIGHT_PX = 96;

export default function MonitorPage() {
  const { t } = useTranslation('operations');
  const [tab, setTab] = useState<'voice' | 'digital' | 'stuck'>('voice');
  const { data: sessions = [] } = useActiveSessions();
  const startListening = useStartListening();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Auto-deselect if the selected session disappears from the live list.
  // Legitimate because the sessions array is an external (server-driven) source
  // we must reactively reconcile against local selection state.
  useEffect(() => {
    if (selectedSessionId && !sessions.find((s) => s.sessionId === selectedSessionId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedSessionId(null);
    }
  }, [sessions, selectedSessionId]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (sessionId === selectedSessionId) return;
      setSelectedSessionId(sessionId);
      startListening.mutate(sessionId);
    },
    [selectedSessionId, startListening],
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden" data-testid="monitor-page">
      <PageHeader title={t('monitor.title')} />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border px-4">
        <button
          type="button"
          onClick={() => setTab('voice')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'voice'
              ? 'border-b-2 border-brand text-brand'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="monitor-tab-voice"
        >
          Voice
        </button>
        <button
          type="button"
          onClick={() => setTab('digital')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'digital'
              ? 'border-b-2 border-brand text-brand'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="monitor-tab-digital"
        >
          Digital
        </button>
        <button
          type="button"
          onClick={() => setTab('stuck')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'stuck'
              ? 'border-b-2 border-brand text-brand'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="monitor-tab-stuck"
        >
          {t('stuck_work.tab')}
        </button>
      </div>

      {tab === 'voice' && (
        <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
          {/* Left panel — session list */}
          <div className="w-64 shrink-0" data-testid="monitor-sessions-list">
            {sessions.length === 0 ? (
              <p
                className="py-8 text-center text-sm text-muted-foreground"
                data-testid="monitor-empty-state"
              >
                {t('monitor.noSessions')}
              </p>
            ) : (
              <VirtualList
                items={sessions}
                getItemKey={(session) => session.sessionId}
                estimateSize={() => SESSION_CARD_HEIGHT_PX}
                renderItem={(session) => (
                  <SessionCard
                    session={session}
                    isSelected={session.sessionId === selectedSessionId}
                    onClick={() => handleSelectSession(session.sessionId)}
                  />
                )}
              />
            )}
          </div>

          {/* Right panel — session detail */}
          <div className="min-w-0 flex-1 overflow-hidden" data-testid="monitor-detail-panel">
            {selectedSessionId ? (
              <SessionDetail sessionId={selectedSessionId} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border">
                <p className="text-sm text-muted-foreground">
                  {sessions.length === 0 ? t('monitor.noSessions') : 'Select a session to monitor.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'digital' && <DigitalMonitorTab />}

      {tab === 'stuck' && <StuckWorkTab />}
    </div>
  );
}
