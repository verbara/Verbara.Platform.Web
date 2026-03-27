import { useState } from 'react';
import { Phone, Calendar, User, Plus } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/ui/dialog';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { useCallbacks, useCreateCallback } from '@/core/api/hooks/use-campaigns';

interface CallbacksTabProps {
  campaignId: number;
}

export function CallbacksTab({ campaignId }: CallbacksTabProps) {
  const { data: callbacks = [], isLoading } = useCallbacks(campaignId);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ contactId: '', phone: '', scheduledAt: '', agentId: '' });
  const createCallback = useCreateCallback();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pending Callbacks
        </p>
        <PermissionGuard requires="campaigns:campaign:edit">
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Schedule Callback
          </Button>
        </PermissionGuard>
      </div>

      {callbacks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No pending callbacks.</p>
      ) : (
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
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Callback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cb-phone">Phone Number</Label>
              <Input
                id="cb-phone"
                placeholder="+1 555 000 0000"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cb-contactId">Contact ID</Label>
              <Input
                id="cb-contactId"
                type="number"
                value={form.contactId}
                onChange={(e) => setForm((f) => ({ ...f, contactId: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cb-scheduledAt">Scheduled Time</Label>
              <Input
                id="cb-scheduledAt"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cb-agentId">Agent ID (optional)</Label>
              <Input
                id="cb-agentId"
                placeholder="Leave empty for any agent"
                value={form.agentId}
                onChange={(e) => setForm((f) => ({ ...f, agentId: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.phone.trim() || !form.contactId.trim() || !form.scheduledAt || createCallback.isPending}
              onClick={() => {
                createCallback.mutate({
                  campaignId,
                  contactId: Number(form.contactId),
                  phone: form.phone,
                  scheduledAt: new Date(form.scheduledAt).toISOString(),
                  agentId: form.agentId || undefined,
                }, {
                  onSuccess: () => {
                    setCreateOpen(false);
                    setForm({ contactId: '', phone: '', scheduledAt: '', agentId: '' });
                  },
                });
              }}
            >
              {createCallback.isPending ? 'Scheduling...' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
