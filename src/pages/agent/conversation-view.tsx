import { useEffect } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ConversationPanel } from '@/agent/conversation/conversation-panel';
import { useConversationStore } from '@/agent/stores/conversation-store';

export default function ConversationView() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const select = useConversationStore((s) => s.select);

  // Keep the right-side ContextPanel (contact/history/notes — keyed on selectedId) in sync with the
  // displayed conversation regardless of how it was opened: voice screen-pop auto-nav, inbox click,
  // or a deep-link/refresh. The voice path navigates but never selected (review finding #1), and a
  // route→selectedId sync also covers deep-link/refresh that the manual inbox select missed.
  useEffect(() => {
    if (id) select(id);
  }, [id, select]);

  if (!id) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        {t('agent_layout.select_conversation')}
      </div>
    );
  }

  return <ConversationPanel conversationId={id} />;
}
