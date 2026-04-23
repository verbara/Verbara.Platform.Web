// WebhookDeliveryDetailDrawer — net-new (R5.1 Task O) inspector for a single
// webhook delivery. Mounts behind a row click in either the DLQ page or the
// subscription detail sheet delivery log and surfaces the raw JSON payload
// through the CodeBlock primitive (prism-react-renderer). Payload pretty-print
// is best-effort — if the API body is not valid JSON we fall back to raw text.

import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react';

import { CodeBlock } from '@/core/ui/code-block';
import { DrawerDetail, type DrawerDetailAction } from '@/core/ui/drawer-detail';
import { StatusBadge } from '@/core/ui/status-badge';
import {
  useRetryDeadLetter,
  type WebhookDelivery,
} from '@/core/api/hooks/use-webhooks';

interface WebhookDeliveryDetailDrawerProps {
  readonly delivery: WebhookDelivery | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

function prettyPrintJson(raw: string): { content: string; language: 'json' | 'plaintext' } {
  if (!raw) return { content: '', language: 'plaintext' };
  try {
    const parsed: unknown = JSON.parse(raw);
    return { content: JSON.stringify(parsed, null, 2), language: 'json' };
  } catch {
    return { content: raw, language: 'plaintext' };
  }
}

export function WebhookDeliveryDetailDrawer({
  delivery,
  open,
  onOpenChange,
}: WebhookDeliveryDetailDrawerProps) {
  const { t } = useTranslation(['admin']);
  const retryDeadLetter = useRetryDeadLetter();

  const payload = useMemo(
    () => prettyPrintJson(delivery?.payload ?? ''),
    [delivery?.payload],
  );

  const handleRetry = useCallback(() => {
    if (delivery) retryDeadLetter.mutate(delivery.deliveryId);
  }, [delivery, retryDeadLetter]);

  if (!delivery) return null;

  const isDeadLetter = delivery.status === 'DeadLetter';
  const actions: DrawerDetailAction[] = isDeadLetter
    ? [
        {
          key: 'retry',
          label: retryDeadLetter.isPending
            ? t('admin:deadLetter.retrying', 'Retrying...')
            : t('admin:deadLetter.retry', 'Retry delivery'),
          icon: <RefreshCw className="h-3.5 w-3.5" />,
          variant: 'default',
          onAction: handleRetry,
          loading: retryDeadLetter.isPending,
          'data-testid': 'webhook-delivery-retry',
        },
      ]
    : [];

  return (
    <DrawerDetail
      open={open}
      onOpenChange={onOpenChange}
      title={t('admin:deadLetter.detail.title', 'Delivery {{id}}', {
        id: delivery.deliveryId.slice(0, 12),
      })}
      subtitle={t(
        'admin:deadLetter.detail.subtitle',
        'Webhook delivery attempt — payload, status, and retry controls.',
      )}
      width="lg"
      actions={actions}
    >
      <div
        data-testid="webhook-delivery-detail-drawer"
        className="flex flex-col gap-6"
      >
        {/* Metadata grid */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t('admin:deadLetter.detail.metadata', 'Delivery metadata')}
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">
              {t('admin:deadLetter.detail.deliveryId', 'Delivery ID')}
            </dt>
            <dd className="break-all font-mono text-xs">{delivery.deliveryId}</dd>

            <dt className="text-muted-foreground">
              {t('admin:deadLetter.detail.subscriptionId', 'Subscription ID')}
            </dt>
            <dd className="break-all font-mono text-xs">{delivery.subscriptionId}</dd>

            <dt className="text-muted-foreground">
              {t('admin:deadLetter.detail.eventType', 'Event type')}
            </dt>
            <dd className="font-mono text-xs">{delivery.eventType}</dd>

            <dt className="text-muted-foreground">
              {t('admin:deadLetter.detail.status', 'Status')}
            </dt>
            <dd>
              <StatusBadge
                variant="webhook-delivery"
                status={delivery.status}
              />
            </dd>

            <dt className="text-muted-foreground">
              {t('admin:deadLetter.detail.attempts', 'Attempts')}
            </dt>
            <dd>
              {delivery.attempts} / {delivery.maxAttempts}
            </dd>

            <dt className="text-muted-foreground">
              {t('admin:deadLetter.detail.responseCode', 'Response code')}
            </dt>
            <dd className="font-mono text-xs">
              {delivery.lastResponseCode ?? '—'}
            </dd>

            <dt className="text-muted-foreground">
              {t('admin:deadLetter.detail.createdAt', 'Created at')}
            </dt>
            <dd>{format(new Date(delivery.createdAt), 'MMM d, yyyy HH:mm:ss')}</dd>

            {delivery.deliveredAt && (
              <>
                <dt className="text-muted-foreground">
                  {t('admin:deadLetter.detail.deliveredAt', 'Delivered at')}
                </dt>
                <dd>{format(new Date(delivery.deliveredAt), 'MMM d, yyyy HH:mm:ss')}</dd>
              </>
            )}

            {delivery.nextRetryAt && (
              <>
                <dt className="text-muted-foreground">
                  {t('admin:deadLetter.detail.nextRetryAt', 'Next retry at')}
                </dt>
                <dd>{format(new Date(delivery.nextRetryAt), 'MMM d, yyyy HH:mm:ss')}</dd>
              </>
            )}
          </dl>
        </div>

        {/* Last error (if any) */}
        {delivery.lastError && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t('admin:deadLetter.detail.lastError', 'Last error')}
            </h3>
            <pre
              data-testid="webhook-delivery-last-error"
              className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              {delivery.lastError}
            </pre>
          </div>
        )}

        {/* Payload viewer */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t('admin:deadLetter.detail.payload', 'Payload')}
          </h3>
          {payload.content ? (
            <div data-testid="webhook-delivery-payload">
              <CodeBlock
                code={payload.content}
                language={payload.language}
                collapsible
                maxHeight="22rem"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('admin:deadLetter.detail.payloadEmpty', 'No payload captured.')}
            </p>
          )}
        </div>
      </div>
    </DrawerDetail>
  );
}
