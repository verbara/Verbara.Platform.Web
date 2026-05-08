import { useState } from 'react';
import { Phone, Calendar, User, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/core/ui/dialog';
import { Skeleton } from '@/core/ui/skeleton';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { useCallbacks, useCreateCallback } from '@/core/api/hooks/use-campaigns';
import { useFormatDate } from '@/core/i18n/use-format';

interface CallbacksTabProps {
  campaignId: number;
}

export function CallbacksTab({ campaignId }: CallbacksTabProps) {
  const { t } = useTranslation('admin');
  const { formatDateTime } = useFormatDate();
  const { data: callbacks = [], isLoading } = useCallbacks(campaignId);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ contactId: '', phone: '', scheduledAt: '', agentId: '' });
  const createCallback = useCreateCallback();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('campaigns.callbacks.title')}
        </p>
        <PermissionGuard requires="campaigns:campaign:edit">
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('campaigns.callbacks.schedule')}
          </Button>
        </PermissionGuard>
      </div>

      {callbacks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{t('campaigns.callbacks.empty')}</p>
      ) : (
        <div className="space-y-2">
          {callbacks.map((cb, i) => (
            <div key={i} className="flex items-center gap-4 rounded-md border p-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {t('campaigns.callbacks.contact_label', { id: cb.contactId })}
                </p>
                <p className="text-xs text-muted-foreground">
                  <Calendar className="mr-1 inline h-3 w-3" />
                  {formatDateTime(cb.scheduledAt)}
                  {cb.agentId && (
                    <>
                      <User className="ml-2 mr-1 inline h-3 w-3" />
                      {cb.agentId}
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('campaigns.callbacks.schedule')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cb-phone">{t('campaigns.callbacks.phone')}</Label>
              <Input
                id="cb-phone"
                placeholder={t('campaigns.callbacks.phone_placeholder')}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cb-contactId">{t('campaigns.callbacks.contact_id')}</Label>
              <Input
                id="cb-contactId"
                type="number"
                value={form.contactId}
                onChange={(e) => setForm((f) => ({ ...f, contactId: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cb-scheduledAt">{t('campaigns.callbacks.scheduled_at')}</Label>
              <Input
                id="cb-scheduledAt"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cb-agentId">{t('campaigns.callbacks.agent_id')}</Label>
              <Input
                id="cb-agentId"
                placeholder={t('campaigns.callbacks.agent_id_placeholder')}
                value={form.agentId}
                onChange={(e) => setForm((f) => ({ ...f, agentId: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('campaigns.callbacks.cancel')}
            </Button>
            <Button
              disabled={
                !form.phone.trim() ||
                !form.contactId.trim() ||
                !form.scheduledAt ||
                createCallback.isPending
              }
              onClick={() => {
                createCallback.mutate(
                  {
                    campaignId,
                    contactId: Number(form.contactId),
                    phone: form.phone,
                    scheduledAt: new Date(form.scheduledAt).toISOString(),
                    agentId: form.agentId || undefined,
                  },
                  {
                    onSuccess: () => {
                      setCreateOpen(false);
                      setForm({ contactId: '', phone: '', scheduledAt: '', agentId: '' });
                    },
                  },
                );
              }}
            >
              {createCallback.isPending
                ? t('campaigns.callbacks.scheduling')
                : t('campaigns.callbacks.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
