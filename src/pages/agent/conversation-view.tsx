import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConversationPanel } from '@/agent/conversation/conversation-panel';

export default function ConversationView() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        {t('agent_layout.select_conversation')}
      </div>
    );
  }

  return <ConversationPanel conversationId={id} />;
}
