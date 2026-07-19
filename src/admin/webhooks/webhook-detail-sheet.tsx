import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { KeyRound, Play } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { DrawerDetail, type DrawerDetailAction } from '@/core/ui/drawer-detail';
import { StatusBadge } from '@/core/ui/status-badge';
import {
  useWebhookDeliveries,
  useTestWebhookSubscription,
  useRotateWebhookSecret,
  useCircuitStatus,
  useResetCircuit,
  type WebhookDelivery,
  type WebhookSubscription,
} from '@/core/api/hooks/use-webhooks';
import { WebhookDeliveryDetailDrawer } from './webhook-delivery-detail-drawer';

interface WebhookDetailSheetProps {
  subscription: WebhookSubscription | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DELIVERY_PAGE_SIZE = 10;

export function WebhookDetailSheet({
  subscription,
  open,
  onOpenChange,
}: Readonly<WebhookDetailSheetProps>) {
  const { t } = useTranslation(['admin']);
  const [page, setPage] = useState(1);
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDelivery | null>(null);

  const { data: deliveriesPage } = useWebhookDeliveries(
    subscription?.subscriptionId ?? '',
    page,
    DELIVERY_PAGE_SIZE,
  );

  const testWebhook = useTestWebhookSubscription();
  const rotateSecret = useRotateWebhookSecret();
  const { data: circuit } = useCircuitStatus(subscription?.subscriptionId);
  const resetCircuit = useResetCircuit();

  const handleTest = useCallback(() => {
    if (subscription) testWebhook.mutate(subscription.subscriptionId);
  }, [subscription, testWebhook]);

  const handleRotate = useCallback(() => {
    if (subscription) rotateSecret.mutate(subscription.subscriptionId);
  }, [subscription, rotateSecret]);

  const deliveries = deliveriesPage?.items ?? [];
  const totalCount = deliveriesPage?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / DELIVERY_PAGE_SIZE));

  if (!subscription) return null;

  const actions: DrawerDetailAction[] = [
    {
      key: 'rotate',
      label: rotateSecret.isPending
        ? t('admin:webhooks.detail.rotating', 'Rotating...')
        : t('admin:webhooks.detail.rotateSecret', 'Rotate Secret'),
      icon: <KeyRound className="h-3.5 w-3.5" />,
      variant: 'outline',
      onAction: handleRotate,
      loading: rotateSecret.isPending,
      'data-testid': 'webhook-rotate-secret',
    },
    {
      key: 'test',
      label: testWebhook.isPending
        ? t('admin:webhooks.detail.sending', 'Sending...')
        : t('admin:webhooks.detail.sendTest', 'Send Test'),
      icon: <Play className="h-3.5 w-3.5" />,
      variant: 'outline',
      onAction: handleTest,
      loading: testWebhook.isPending,
      'data-testid': 'webhook-send-test',
    },
  ];

  return (
    <DrawerDetail
      open={open}
      onOpenChange={onOpenChange}
      title={subscription.name}
      subtitle={t(
        'admin:webhooks.detail.subtitle',
        'Webhook subscription details and delivery log.',
      )}
      width="lg"
      actions={actions}
    >
      <div data-testid="webhook-detail-sheet" className="flex flex-col gap-6">
        {/* Info section */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t('admin:webhooks.detail.details', 'Details')}
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('admin:webhooks.detail.name', 'Name')}</dt>
            <dd className="font-medium">{subscription.name}</dd>

            <dt className="text-muted-foreground">
              {t('admin:webhooks.detail.endpointUrl', 'Endpoint URL')}
            </dt>
            <dd className="break-all font-mono text-xs">{subscription.endpointUrl}</dd>

            <dt className="text-muted-foreground">{t('admin:webhooks.detail.secret', 'Secret')}</dt>
            <dd className="font-mono text-xs text-muted-foreground">{'*'.repeat(32)}</dd>

            <dt className="text-muted-foreground">
              {t('admin:webhooks.detail.eventTypes', 'Event Types')}
            </dt>
            <dd className="flex flex-wrap gap-1">
              {subscription.eventTypes.map((et) => (
                <Badge key={et} variant="secondary">
                  {et}
                </Badge>
              ))}
            </dd>

            <dt className="text-muted-foreground">{t('admin:webhooks.detail.status', 'Status')}</dt>
            <dd>
              {subscription.isActive ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {t('admin:webhooks.status.active', 'Active')}
                </Badge>
              ) : (
                <Badge variant="secondary">{t('admin:webhooks.status.inactive', 'Inactive')}</Badge>
              )}
            </dd>

            {circuit && (
              <>
                <dt className="text-muted-foreground">
                  {t('admin:webhooks.detail.circuit', 'Circuit')}
                </dt>
                <dd className="flex items-center gap-2">
                  <span data-testid="webhook-circuit-status">
                    <StatusBadge variant="webhook-circuit" status={circuit.status} />
                  </span>
                  {circuit.status === 'Open' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resetCircuit.isPending}
                      data-testid="webhook-reset-circuit"
                      onClick={() => resetCircuit.mutate(subscription.subscriptionId)}
                    >
                      {t('admin:webhooks.detail.resetCircuit', 'Reset Circuit')}
                    </Button>
                  )}
                  {Number(circuit.failures) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {t('admin:webhooks.detail.failureCount', '{{count}} failures', {
                        count: Number(circuit.failures),
                      })}
                    </span>
                  )}
                </dd>
              </>
            )}

            <dt className="text-muted-foreground">
              {t('admin:webhooks.detail.created', 'Created')}
            </dt>
            <dd>{format(new Date(subscription.createdAt), 'MMM d, yyyy HH:mm')}</dd>

            <dt className="text-muted-foreground">
              {t('admin:webhooks.detail.updated', 'Updated')}
            </dt>
            <dd>{format(new Date(subscription.updatedAt), 'MMM d, yyyy HH:mm')}</dd>
          </dl>
        </div>

        {/* Delivery log */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t('admin:webhooks.detail.deliveryLog', 'Delivery Log')} ({totalCount})
          </h3>

          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('admin:webhooks.detail.noDeliveries', 'No deliveries yet.')}
            </p>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        {t('admin:webhooks.detail.eventTypeCol', 'Event Type')}
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        {t('admin:webhooks.detail.statusCol', 'Status')}
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        {t('admin:webhooks.detail.attemptsCol', 'Attempts')}
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        {t('admin:webhooks.detail.responseCol', 'Response')}
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        {t('admin:webhooks.detail.createdCol', 'Created')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {deliveries.map((d) => (
                      <tr
                        key={d.deliveryId}
                        className="cursor-pointer transition-colors hover:bg-muted/50"
                        onClick={() => setSelectedDelivery(d)}
                        data-testid={`delivery-row-${d.deliveryId}`}
                      >
                        <td className="px-3 py-2 font-mono text-xs">{d.eventType}</td>
                        <td className="px-3 py-2">
                          <StatusBadge variant="webhook-delivery" status={d.status} />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {d.attempts}/{d.maxAttempts}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {d.lastResponseCode ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {format(new Date(d.createdAt), 'MMM d, HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {t('admin:webhooks.detail.pageInfo', 'Page {{page}} of {{totalPages}}', {
                    page,
                    totalPages,
                  })}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    {t('admin:webhooks.detail.previous', 'Previous')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    {t('admin:webhooks.detail.next', 'Next')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <WebhookDeliveryDetailDrawer
        delivery={selectedDelivery}
        open={selectedDelivery !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedDelivery(null);
        }}
      />
    </DrawerDetail>
  );
}
