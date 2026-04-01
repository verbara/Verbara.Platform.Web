import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { KeyRound, Play } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/ui/sheet';
import {
  useWebhookDeliveries,
  useTestWebhookSubscription,
  useRotateWebhookSecret,
  type WebhookSubscription,
} from '@/core/api/hooks/use-webhooks';

interface WebhookDetailSheetProps {
  subscription: WebhookSubscription | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DELIVERY_PAGE_SIZE = 10;

function DeliveryStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'Delivered':
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Delivered
        </Badge>
      );
    case 'Failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'DeadLetter':
      return (
        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
          Dead Letter
        </Badge>
      );
    default:
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          Pending
        </Badge>
      );
  }
}

export function WebhookDetailSheet({ subscription, open, onOpenChange }: WebhookDetailSheetProps) {
  const [page, setPage] = useState(1);

  const { data: deliveriesPage } = useWebhookDeliveries(
    subscription?.subscriptionId ?? '',
    page,
    DELIVERY_PAGE_SIZE,
  );

  const testWebhook = useTestWebhookSubscription();
  const rotateSecret = useRotateWebhookSecret();

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl" data-testid="webhook-detail-sheet">
        <SheetHeader>
          <SheetTitle>{subscription.name}</SheetTitle>
          <SheetDescription>Webhook subscription details and delivery log.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4">
          {/* Info section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Details</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{subscription.name}</dd>

              <dt className="text-muted-foreground">Endpoint URL</dt>
              <dd className="break-all font-mono text-xs">{subscription.endpointUrl}</dd>

              <dt className="text-muted-foreground">Secret</dt>
              <dd className="font-mono text-xs text-muted-foreground">
                {'*'.repeat(32)}
              </dd>

              <dt className="text-muted-foreground">Event Types</dt>
              <dd className="flex flex-wrap gap-1">
                {subscription.eventTypes.map((et) => (
                  <Badge key={et} variant="secondary">{et}</Badge>
                ))}
              </dd>

              <dt className="text-muted-foreground">Status</dt>
              <dd>
                {subscription.isActive ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </dd>

              <dt className="text-muted-foreground">Created</dt>
              <dd>{format(new Date(subscription.createdAt), 'MMM d, yyyy HH:mm')}</dd>

              <dt className="text-muted-foreground">Updated</dt>
              <dd>{format(new Date(subscription.updatedAt), 'MMM d, yyyy HH:mm')}</dd>
            </dl>
          </div>

          {/* Actions row */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotate}
              disabled={rotateSecret.isPending}
              data-testid="webhook-rotate-secret"
            >
              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
              {rotateSecret.isPending ? 'Rotating...' : 'Rotate Secret'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testWebhook.isPending}
              data-testid="webhook-send-test"
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              {testWebhook.isPending ? 'Sending...' : 'Send Test'}
            </Button>
          </div>

          {/* Delivery log */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Delivery Log ({totalCount})
            </h3>

            {deliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deliveries yet.</p>
            ) : (
              <>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Event Type
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Attempts
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Response
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {deliveries.map((d) => (
                        <tr key={d.deliveryId} className="transition-colors hover:bg-muted/50">
                          <td className="px-3 py-2 font-mono text-xs">{d.eventType}</td>
                          <td className="px-3 py-2">
                            <DeliveryStatusBadge status={d.status} />
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
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
