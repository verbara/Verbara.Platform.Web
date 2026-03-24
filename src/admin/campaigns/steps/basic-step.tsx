import { useFormContext } from 'react-hook-form';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';
import { useQueues } from '@/core/api/hooks/use-queues';
import { useTeams } from '@/core/api/hooks/use-teams';
import type { CampaignFormValues } from '../campaign-wizard';

export default function BasicStep() {
  const { register } = useFormContext<CampaignFormValues>();
  const { data: queues } = useQueues();
  const { data: teams } = useTeams();

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Campaign Name</Label>
        <Input id="name" placeholder="e.g. Q2 Outbound Sales" {...register('name')} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Brief description of campaign goals..."
          rows={3}
          {...register('description')}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="queueId">Queue</Label>
          <select
            id="queueId"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            {...register('queueId')}
          >
            <option value="">Select a queue...</option>
            {queues?.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="teamId">Agent Team</Label>
          <select
            id="teamId"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            {...register('teamId')}
          >
            <option value="">Select a team...</option>
            {teams?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
