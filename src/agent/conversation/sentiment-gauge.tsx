import { useAgentAiStore, EMPTY_SESSION } from '@/core/stores/agent-ai-store';

function getSentimentDot(score: number): string {
  if (score > 0.3) return 'bg-green-500';
  if (score < -0.3) return 'bg-red-500';
  return 'bg-yellow-400';
}

export function SentimentGauge({ conversationId }: { conversationId: string }) {
  const sentiment = useAgentAiStore((s) => (s.sessions[conversationId] ?? EMPTY_SESSION).sentiment);

  if (!sentiment) return null;

  const dotColor = getSentimentDot(sentiment.score);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      {sentiment.speaker}: {sentiment.label}
    </span>
  );
}
