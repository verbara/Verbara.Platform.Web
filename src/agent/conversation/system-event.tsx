import {
  ArrowRightLeft,
  UserPlus,
  Pause,
  Play,
  PhoneOff,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Message } from '@/agent/stores/conversation-store';

const eventIcons: Record<string, LucideIcon> = {
  assigned: UserPlus,
  transferred: ArrowRightLeft,
  hold: Pause,
  resume: Play,
  ended: PhoneOff,
  conference: Users,
};

export function SystemEvent({ message }: { message: Message }) {
  const eventType = (message.metadata?.eventType as string) ?? 'assigned';
  const Icon = eventIcons[eventType] ?? UserPlus;

  return (
    <div className="flex items-center justify-center gap-2 py-3">
      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
        <Icon className="h-3 w-3" />
        <span>{message.text}</span>
      </div>
      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
