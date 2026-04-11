import { useState } from 'react';
import { FileDown, Trash2, Download, AlertTriangle, Search } from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Textarea } from '@/core/ui/textarea';
import { Separator } from '@/core/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/ui/tabs';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import {
  useGdprExport,
  useGdprPurge,
  useGdprPurgeUser,
  usePurgePreview,
  type GdprExportResult,
  type PurgeResult,
} from '@/core/api/hooks/use-gdpr';

export default function GdprPage() {
  // Export state
  const [contactIdExport, setContactIdExport] = useState('');
  const [exportResult, setExportResult] = useState<GdprExportResult | null>(null);

  // Purge state
  const [contactIdPurge, setContactIdPurge] = useState('');
  const [reason, setReason] = useState('');
  const [purgeResult, setPurgeResult] = useState<PurgeResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // User purge state
  const [userIdPurge, setUserIdPurge] = useState('');
  const [userReason, setUserReason] = useState('');
  const [previewUserId, setPreviewUserId] = useState<string | undefined>();
  const [showUserConfirm, setShowUserConfirm] = useState(false);
  const [userPurgeResult, setUserPurgeResult] = useState<PurgeResult | null>(null);

  const gdprExport = useGdprExport();
  const gdprPurge = useGdprPurge();
  const gdprPurgeUser = useGdprPurgeUser();
  const { data: preview, isLoading: previewLoading } = usePurgePreview(previewUserId);

  function handleUserPurgeConfirm() {
    if (!userIdPurge.trim() || userReason.trim().length < 10) return;
    gdprPurgeUser.mutate(
      { userId: userIdPurge.trim(), reason: userReason.trim() },
      {
        onSuccess: (data) => {
          setUserPurgeResult(data);
          setShowUserConfirm(false);
        },
      },
    );
  }

  function handleExport() {
    if (!contactIdExport.trim()) return;
    gdprExport.mutate(
      { contactId: contactIdExport.trim() },
      {
        onSuccess: (data) => setExportResult(data),
      },
    );
  }

  function handleDownloadJson() {
    if (!exportResult) return;
    const blob = new Blob([JSON.stringify(exportResult, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gdpr-export-${contactIdExport}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handlePurgeConfirm() {
    if (!contactIdPurge.trim() || reason.trim().length < 10) return;
    gdprPurge.mutate(
      { contactId: contactIdPurge.trim(), reason: reason.trim() },
      {
        onSuccess: (data) => {
          setPurgeResult(data);
          setShowConfirm(false);
        },
      },
    );
  }

  return (
    <div data-testid="gdpr-page" className="space-y-6">
      <PageHeader
        title="GDPR Data Management"
        description="Export or purge personal data for GDPR compliance."
      />

      <div className="mx-auto max-w-2xl space-y-6">
        <Tabs defaultValue="contact">
          <TabsList>
            <TabsTrigger value="contact">By Contact</TabsTrigger>
            <TabsTrigger value="user">By User</TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="space-y-6 mt-4">
        {/* Data Export Card */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileDown className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-semibold">Data Export</h2>
          </div>
          <Separator className="mb-4" />

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="export-contact-id">Contact ID</Label>
              <Input
                id="export-contact-id"
                placeholder="Enter contact ID to export"
                value={contactIdExport}
                onChange={(e) => setContactIdExport(e.target.value)}
                data-testid="gdpr-export-contactId"
              />
            </div>

            <Button
              onClick={handleExport}
              disabled={!contactIdExport.trim() || gdprExport.isPending}
              data-testid="gdpr-export-btn"
            >
              <Download className="mr-1.5 h-4 w-4" />
              {gdprExport.isPending ? 'Exporting...' : 'Export Data'}
            </Button>

            {exportResult && (
              <div className="space-y-3 rounded-md border bg-muted/50 p-4">
                <h3 className="text-sm font-medium">Export Summary</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>
                    Contact: {exportResult.contact ? 'Found' : 'Not found'}
                  </li>
                  <li>Conversations: {exportResult.conversations.length}</li>
                  <li>Messages: {exportResult.messages.length}</li>
                  <li>Auth events: {exportResult.authEvents.length}</li>
                  <li>Audit entries: {exportResult.auditEntries.length}</li>
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadJson}
                  data-testid="gdpr-export-download"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download JSON
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Data Purge Card */}
        <div className="rounded-lg border border-destructive/30 bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold">Data Purge</h2>
          </div>
          <Separator className="mb-4" />

          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md bg-amber-50 p-3 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                This action is irreversible. All personal data for this contact
                will be permanently deleted.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="purge-contact-id">Contact ID</Label>
              <Input
                id="purge-contact-id"
                placeholder="Enter contact ID to purge"
                value={contactIdPurge}
                onChange={(e) => setContactIdPurge(e.target.value)}
                data-testid="gdpr-purge-contactId"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="purge-reason">Reason</Label>
              <Textarea
                id="purge-reason"
                placeholder="Provide a reason for the data purge (min 10 characters)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-testid="gdpr-purge-reason"
              />
              {reason.length > 0 && reason.length < 10 && (
                <p className="text-xs text-destructive">
                  Reason must be at least 10 characters.
                </p>
              )}
            </div>

            <Button
              variant="destructive"
              onClick={() => setShowConfirm(true)}
              disabled={
                !contactIdPurge.trim() ||
                reason.trim().length < 10 ||
                gdprPurge.isPending
              }
              data-testid="gdpr-purge-btn"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Purge Contact Data
            </Button>

            {purgeResult && (
              <div
                className="space-y-3 rounded-md border bg-muted/50 p-4"
                data-testid="gdpr-purge-result"
              >
                <h3 className="text-sm font-medium">Purge Complete</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>
                    Purge ID:{' '}
                    <span className="font-mono text-xs">
                      {purgeResult.purgeId}
                    </span>
                  </li>
                  {Object.entries(purgeResult.entitiesDeleted).map(
                    ([entity, count]) => (
                      <li key={entity}>
                        {entity}: {count} deleted
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
          </TabsContent>

          <TabsContent value="user" className="space-y-6 mt-4">
            <div className="rounded-lg border border-destructive/30 bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trash2 className="h-5 w-5 text-destructive" />
                <h2 className="text-lg font-semibold">Purge User Data</h2>
              </div>
              <Separator className="mb-4" />

              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-md bg-amber-50 p-3 dark:bg-amber-950/30">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    This permanently deletes all data associated with a user account (auth events, audit entries, sessions).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="purge-user-id">User ID</Label>
                  <div className="flex gap-2">
                    <Input
                      id="purge-user-id"
                      placeholder="Enter user ID to purge"
                      value={userIdPurge}
                      onChange={(e) => setUserIdPurge(e.target.value)}
                      data-testid="gdpr-purge-userId"
                    />
                    <Button
                      variant="outline"
                      disabled={!userIdPurge.trim() || previewLoading}
                      onClick={() => setPreviewUserId(userIdPurge.trim())}
                      data-testid="gdpr-preview-btn"
                    >
                      <Search className="mr-1.5 h-4 w-4" />
                      Preview
                    </Button>
                  </div>
                </div>

                {preview && (
                  <div className="space-y-2 rounded-md border bg-muted/50 p-4" data-testid="gdpr-preview-result">
                    <h3 className="text-sm font-medium">Data to be purged:</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>Conversations: {preview.conversations}</li>
                      <li>Messages: {preview.messages}</li>
                      <li>Auth events: {preview.authEvents}</li>
                      <li>Audit entries: {preview.auditEntries}</li>
                    </ul>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="purge-user-reason">Reason</Label>
                  <Textarea
                    id="purge-user-reason"
                    placeholder="Provide a reason for the data purge (min 10 characters)"
                    value={userReason}
                    onChange={(e) => setUserReason(e.target.value)}
                    data-testid="gdpr-purge-userReason"
                  />
                  {userReason.length > 0 && userReason.length < 10 && (
                    <p className="text-xs text-destructive">
                      Reason must be at least 10 characters.
                    </p>
                  )}
                </div>

                <Button
                  variant="destructive"
                  onClick={() => setShowUserConfirm(true)}
                  disabled={!userIdPurge.trim() || userReason.trim().length < 10 || gdprPurgeUser.isPending}
                  data-testid="gdpr-purge-user-btn"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Purge User Data
                </Button>

                {userPurgeResult && (
                  <div className="space-y-3 rounded-md border bg-muted/50 p-4" data-testid="gdpr-purge-user-result">
                    <h3 className="text-sm font-medium">Purge Complete</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>Purge ID: <span className="font-mono text-xs">{userPurgeResult.purgeId}</span></li>
                      {Object.entries(userPurgeResult.entitiesDeleted).map(([entity, count]) => (
                        <li key={entity}>{entity}: {count} deleted</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDeleteDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handlePurgeConfirm}
        entityName={contactIdPurge}
        entityType="contact data"
        isPending={gdprPurge.isPending}
      />

      <ConfirmDeleteDialog
        open={showUserConfirm}
        onOpenChange={setShowUserConfirm}
        onConfirm={handleUserPurgeConfirm}
        entityName={userIdPurge}
        entityType="user data"
        isPending={gdprPurgeUser.isPending}
      />
    </div>
  );
}
