import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import { useDncLists } from '@/core/api/hooks/use-dnc-lists';
import type { CampaignFormValues } from '../campaign-wizard';

export default function ComplianceStep() {
  const { t } = useTranslation('admin');
  const { register, watch, setValue } = useFormContext<CampaignFormValues>();
  const dncListId = watch('dncListId');
  const { data: dncLists = [] } = useDncLists();

  return (
    <div className="space-y-6">
      {/* DNC List */}
      <div className="space-y-1.5">
        <Label htmlFor="dncListId">{t('campaigns.compliance_step.dnc_list')}</Label>
        <p className="text-xs text-muted-foreground">
          {t('campaigns.compliance_step.dnc_help')}
        </p>
        <Select
          value={dncListId !== null ? String(dncListId) : 'none'}
          onValueChange={(val) =>
            setValue('dncListId', val === 'none' ? null : Number(val))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('campaigns.compliance_step.select_dnc_placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('campaigns.compliance_step.dnc_none')}</SelectItem>
            {dncLists.map((list) => (
              <SelectItem key={list.id} value={String(list.id)}>
                {list.name}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {t('campaigns.compliance_step.dnc_entries', { count: list.entryCount })}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Attempt Limits */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="maxAttempts">{t('campaigns.compliance_step.max_attempts')}</Label>
          <Input
            id="maxAttempts"
            type="number"
            min={1}
            max={20}
            {...register('maxAttempts', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="retryIntervalMinutes">{t('campaigns.compliance_step.retry_interval')}</Label>
          <Input
            id="retryIntervalMinutes"
            type="number"
            min={1}
            max={1440}
            {...register('retryIntervalMinutes', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="timeBetweenAttempts">{t('campaigns.compliance_step.time_between_attempts')}</Label>
          <Input
            id="timeBetweenAttempts"
            type="number"
            min={1}
            max={1440}
            {...register('timeBetweenAttempts', { valueAsNumber: true })}
          />
        </div>
      </div>

      {/* Compliance Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="complianceNotes">{t('campaigns.compliance_step.compliance_notes')}</Label>
        <Textarea
          id="complianceNotes"
          placeholder={t('campaigns.compliance_step.compliance_notes_placeholder')}
          rows={4}
          {...register('complianceNotes')}
        />
      </div>
    </div>
  );
}
