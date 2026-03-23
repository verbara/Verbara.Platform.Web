import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/admin/shared/page-header';

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { t } = useTranslation(['admin']);

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:campaigns.detailTitle')} />
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-muted-foreground/25">
        <p className="text-sm text-muted-foreground">
          {t('admin:campaigns.comingSoon')} &mdash; {campaignId}
        </p>
      </div>
    </div>
  );
}
