import { Phone, Calendar, User } from 'lucide-react';
import { useCallbacks } from '@/core/api/hooks/use-campaigns';

interface CallbacksTabProps {
  campaignId: number;
}

export function CallbacksTab({ campaignId }: CallbacksTabProps) {
  const { data: callbacks = [], isLoading } = useCallbacks(campaignId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (callbacks.length === 0) return <p className="text-sm text-muted-foreground py-4">No pending callbacks.</p>;

  return (
    <div className="space-y-2">
      {callbacks.map((cb, i) => (
        <div key={i} className="flex items-center gap-4 rounded-md border p-3">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Contact #{cb.contactId}</p>
            <p className="text-xs text-muted-foreground">
              <Calendar className="mr-1 inline h-3 w-3" />
              {new Date(cb.scheduledAt).toLocaleString()}
              {cb.agentId && (
                <><User className="ml-2 mr-1 inline h-3 w-3" />{cb.agentId}</>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
