import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';
import { useQueues } from '@/core/api/hooks/use-queues';
import { useTeams } from '@/core/api/hooks/use-teams';
import type { CampaignFormValues } from '../campaign-wizard';

export default function BasicStep() {
  const { t } = useTranslation('admin');
  const { register, formState: { errors } } = useFormContext<CampaignFormValues>();
  const { data: queues } = useQueues();
  const { data: teams } = useTeams();

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">{t('campaigns.basic_step.name')}</Label>
        <Input id="name" placeholder={t('campaigns.basic_step.name_placeholder')} {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{t(errors.name.message ?? '')}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">{t('campaigns.basic_step.description')}</Label>
        <Textarea
          id="description"
          placeholder={t('campaigns.basic_step.description_placeholder')}
          rows={3}
          {...register('description')}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="queueId">{t('campaigns.basic_step.queue')}</Label>
          <select
            id="queueId"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            {...register('queueId')}
          >
            <option value="">{t('campaigns.basic_step.queue_placeholder')}</option>
            {queues?.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
          {errors.queueId && <p className="text-sm text-destructive">{t(errors.queueId.message ?? '')}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="teamId">{t('campaigns.basic_step.team')}</Label>
          <select
            id="teamId"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            {...register('teamId')}
          >
            <option value="">{t('campaigns.basic_step.team_placeholder')}</option>
            {teams?.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
