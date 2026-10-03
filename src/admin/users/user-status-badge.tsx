import { useTranslation } from 'react-i18next';
import { Badge } from '@/core/ui/badge';
import { describeAccountStatus } from './account-status';

/**
 * A user's account status as the users list and the detail page show it: the active locale's
 * label, a variant per status, and the canonical lower-case status in `data-status` for selectors.
 * A status the console does not know is shown as reported, with neutral styling and
 * `data-status="unknown"`.
 */
export function UserStatusBadge({ status }: { status: string | null | undefined }) {
  const { t } = useTranslation(['admin']);
  const view = describeAccountStatus(status);
  return (
    <Badge
      data-testid="user-status-badge"
      data-status={view.dataStatus}
      variant={view.badgeVariant}
    >
      {view.labelKey ? t(view.labelKey) : status}
    </Badge>
  );
}
