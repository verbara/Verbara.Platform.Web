import {
  MessageSquare,
  Mail,
  Smartphone,
  Globe,
  Phone,
  MessagesSquare,
  Camera,
  Send,
  type LucideIcon,
} from 'lucide-react';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { MessageThread } from './message-thread';

const channelIcons: Record<string, LucideIcon> = {
  whatsapp: MessageSquare,
  email: Mail,
  sms: Smartphone,
  webchat: Globe,
  voice: Phone,
  messenger: MessagesSquare,
  instagram: Camera,
  telegram: Send,
};

const channelColors: Record<string, string> = {
  whatsapp: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  email: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  sms: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  webchat: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  voice: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  messenger: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  instagram: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  telegram: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

export function ConversationPanel({ conversationId }: { conversationId: string }) {
  const conversation = useConversationStore((s) => s.conversations[conversationId]);

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Conversation not found
      </div>
    );
  }

  const ChannelIcon = channelIcons[conversation.channel] ?? Globe;
  const badgeColor =
    channelColors[conversation.channel] ??
    'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {conversation.contactName}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeColor}`}
          >
            <ChannelIcon className="h-3 w-3" />
            {conversation.channel}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {conversation.queueName}
          </span>
        </div>

        {/* Action buttons placeholder (Task 6) */}
        <div className="flex items-center gap-1" />
      </div>

      {/* Message Thread */}
      <MessageThread conversationId={conversationId} />

      {/* Reply Composer placeholder (Task 5) */}
      <div className="shrink-0 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex h-10 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-600">
          Reply composer — Task 5
        </div>
      </div>
    </div>
  );
}
