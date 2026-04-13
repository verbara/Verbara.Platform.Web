import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import { usePartnerSettings, useUpdatePartnerSettings } from '@/core/api/hooks/use-partner';

export default function PartnerSettingsPage() {
  const { data: settings, isLoading } = usePartnerSettings();
  const update = useUpdatePartnerSettings();

  const [editOpen, setEditOpen] = useState(false);
  const [platformName, setPlatformName] = useState('');
  const [defaultTimezone, setDefaultTimezone] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('');

  function openEdit() {
    setPlatformName(settings?.platformName ?? '');
    setDefaultTimezone(settings?.defaultTimezone ?? '');
    setDefaultLanguage(settings?.defaultLanguage ?? '');
    setEditOpen(true);
  }

  function handleSave() {
    update.mutate(
      {
        platformName: platformName || undefined,
        defaultTimezone: defaultTimezone || undefined,
        defaultLanguage: defaultLanguage || undefined,
      },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="partner-settings-page">
      <PageHeader title="Partner Settings" description="Manage your partner account configuration.">
        <Button onClick={openEdit} data-testid="edit-partner-settings">
          <Pencil className="mr-1.5 h-4 w-4" />
          Edit settings
        </Button>
      </PageHeader>

      <div className="max-w-2xl rounded-md border p-6">
        <h3 className="mb-4 text-sm font-medium">Operational settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Platform name" value={settings?.platformName} testid="ps-platform-name" />
          <Field label="Default timezone" value={settings?.defaultTimezone} testid="ps-timezone" />
          <Field label="Default language" value={settings?.defaultLanguage} testid="ps-language" />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Plan, quotas and rate limit tier are managed by the platform administrator.
        </p>
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit partner settings</SheetTitle>
            <SheetDescription>Update operational settings for your partner account.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="ps-name-input">Platform name</Label>
              <Input
                id="ps-name-input"
                data-testid="ps-name-input"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-tz-input">Default timezone</Label>
              <Input
                id="ps-tz-input"
                data-testid="ps-tz-input"
                value={defaultTimezone}
                onChange={(e) => setDefaultTimezone(e.target.value)}
                placeholder="America/Bogota"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-lang-input">Default language</Label>
              <Input
                id="ps-lang-input"
                data-testid="ps-lang-input"
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                placeholder="es-CO"
              />
            </div>
          </div>
          <SheetFooter className="px-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={update.isPending} data-testid="ps-submit">
              {update.isPending ? 'Saving...' : 'Save'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, value, testid }: Readonly<{ label: string; value?: string; testid: string }>) {
  return (
    <div data-testid={testid}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? '—'}</p>
    </div>
  );
}
