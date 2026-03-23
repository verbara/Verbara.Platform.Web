import { useParams } from 'react-router-dom';
import { ConversationPanel } from '@/agent/conversation/conversation-panel';

export default function ConversationView() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Select a conversation
      </div>
    );
  }

  return <ConversationPanel conversationId={id} />;
}
