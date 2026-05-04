import { useState } from 'react';
import { FileDown, Trash2, Download, TriangleAlert, Search } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('admin');
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
      <PageHeader title={t('gdpr.title')} description={t('gdpr.description')} />

      <div className="mx-auto max-w-2xl space-y-6">
        <Tabs defaultValue="contact">
          <TabsList>
            <TabsTrigger value="contact">{t('gdpr.tabs.by_contact')}</TabsTrigger>
            <TabsTrigger value="user">{t('gdpr.tabs.by_user')}</TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="space-y-6 mt-4">
            {/* Data Export Card */}
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileDown className="h-5 w-5 text-brand" />
                <h2 className="text-lg font-semibold">{t('gdpr.export.heading')}</h2>
              </div>
              <Separator className="mb-4" />

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="export-contact-id">{t('gdpr.export.contact_id')}</Label>
                  <Input
                    id="export-contact-id"
                    placeholder={t('gdpr.export.contact_id_placeholder')}
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
                  {gdprExport.isPending ? t('gdpr.export.exporting') : t('gdpr.export.export_btn')}
                </Button>

                {exportResult && (
                  <div className="space-y-3 rounded-md border bg-muted/50 p-4">
                    <h3 className="text-sm font-medium">{t('gdpr.export.summary')}</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>
                        {t('gdpr.export.summary_contact', {
                          value: exportResult.contact
                            ? t('gdpr.export.summary_found')
                            : t('gdpr.export.summary_not_found'),
                        })}
                      </li>
                      <li>
                        {t('gdpr.export.summary_conversations', {
                          count: exportResult.conversations.length,
                        })}
                      </li>
                      <li>
                        {t('gdpr.export.summary_messages', { count: exportResult.messages.length })}
                      </li>
                      <li>
                        {t('gdpr.export.summary_auth_events', {
                          count: exportResult.authEvents.length,
                        })}
                      </li>
                      <li>
                        {t('gdpr.export.summary_audit_entries', {
                          count: exportResult.auditEntries.length,
                        })}
                      </li>
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadJson}
                      data-testid="gdpr-export-download"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      {t('gdpr.export.download_json')}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Data Purge Card */}
            <div className="rounded-lg border border-destructive/30 bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trash2 className="h-5 w-5 text-destructive" />
                <h2 className="text-lg font-semibold">{t('gdpr.purge.heading')}</h2>
              </div>
              <Separator className="mb-4" />

              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-md bg-amber-50 p-3 dark:bg-amber-950/30">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {t('gdpr.purge.warning_contact')}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="purge-contact-id">{t('gdpr.purge.contact_id')}</Label>
                  <Input
                    id="purge-contact-id"
                    placeholder={t('gdpr.purge.contact_id_placeholder')}
                    value={contactIdPurge}
                    onChange={(e) => setContactIdPurge(e.target.value)}
                    data-testid="gdpr-purge-contactId"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="purge-reason">{t('gdpr.purge.reason')}</Label>
                  <Textarea
                    id="purge-reason"
                    placeholder={t('gdpr.purge.reason_placeholder')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    data-testid="gdpr-purge-reason"
                  />
                  {reason.length > 0 && reason.length < 10 && (
                    <p className="text-xs text-destructive">{t('gdpr.purge.reason_too_short')}</p>
                  )}
                </div>

                <Button
                  variant="destructive"
                  onClick={() => setShowConfirm(true)}
                  disabled={
                    !contactIdPurge.trim() || reason.trim().length < 10 || gdprPurge.isPending
                  }
                  data-testid="gdpr-purge-btn"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  {t('gdpr.purge.purge_contact_btn')}
                </Button>

                {purgeResult && (
                  <div
                    className="space-y-3 rounded-md border bg-muted/50 p-4"
                    data-testid="gdpr-purge-result"
                  >
                    <h3 className="text-sm font-medium">{t('gdpr.purge.result_heading')}</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>
                        <Trans
                          i18nKey="gdpr.purge.result_purge_id"
                          ns="admin"
                          values={{ id: purgeResult.purgeId }}
                          components={[<span key="id" className="font-mono text-xs" />]}
                        />
                      </li>
                      {Object.entries(purgeResult.entitiesDeleted).map(([entity, count]) => (
                        <li key={entity}>
                          {t('gdpr.purge.result_entity_line', { entity, count })}
                        </li>
                      ))}
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
                <h2 className="text-lg font-semibold">{t('gdpr.purge.purge_user_heading')}</h2>
              </div>
              <Separator className="mb-4" />

              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-md bg-amber-50 p-3 dark:bg-amber-950/30">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {t('gdpr.purge.warning_user')}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="purge-user-id">{t('gdpr.purge.user_id')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="purge-user-id"
                      placeholder={t('gdpr.purge.user_id_placeholder')}
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
                      {t('gdpr.purge.preview')}
                    </Button>
                  </div>
                </div>

                {preview && (
                  <div
                    className="space-y-2 rounded-md border bg-muted/50 p-4"
                    data-testid="gdpr-preview-result"
                  >
                    <h3 className="text-sm font-medium">{t('gdpr.purge.preview_heading')}</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>
                        {t('gdpr.purge.preview_conversations', { count: preview.conversations })}
                      </li>
                      <li>{t('gdpr.purge.preview_messages', { count: preview.messages })}</li>
                      <li>{t('gdpr.purge.preview_auth_events', { count: preview.authEvents })}</li>
                      <li>
                        {t('gdpr.purge.preview_audit_entries', { count: preview.auditEntries })}
                      </li>
                    </ul>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="purge-user-reason">{t('gdpr.purge.reason')}</Label>
                  <Textarea
                    id="purge-user-reason"
                    placeholder={t('gdpr.purge.reason_placeholder')}
                    value={userReason}
                    onChange={(e) => setUserReason(e.target.value)}
                    data-testid="gdpr-purge-userReason"
                  />
                  {userReason.length > 0 && userReason.length < 10 && (
                    <p className="text-xs text-destructive">{t('gdpr.purge.reason_too_short')}</p>
                  )}
                </div>

                <Button
                  variant="destructive"
                  onClick={() => setShowUserConfirm(true)}
                  disabled={
                    !userIdPurge.trim() || userReason.trim().length < 10 || gdprPurgeUser.isPending
                  }
                  data-testid="gdpr-purge-user-btn"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  {t('gdpr.purge.purge_user_btn')}
                </Button>

                {userPurgeResult && (
                  <div
                    className="space-y-3 rounded-md border bg-muted/50 p-4"
                    data-testid="gdpr-purge-user-result"
                  >
                    <h3 className="text-sm font-medium">{t('gdpr.purge.result_heading')}</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>
                        <Trans
                          i18nKey="gdpr.purge.result_purge_id"
                          ns="admin"
                          values={{ id: userPurgeResult.purgeId }}
                          components={[<span key="id" className="font-mono text-xs" />]}
                        />
                      </li>
                      {Object.entries(userPurgeResult.entitiesDeleted).map(([entity, count]) => (
                        <li key={entity}>
                          {t('gdpr.purge.result_entity_line', { entity, count })}
                        </li>
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
        entityType={t('gdpr.purge.contact_entity_type')}
        isPending={gdprPurge.isPending}
      />

      <ConfirmDeleteDialog
        open={showUserConfirm}
        onOpenChange={setShowUserConfirm}
        onConfirm={handleUserPurgeConfirm}
        entityName={userIdPurge}
        entityType={t('gdpr.purge.user_entity_type')}
        isPending={gdprPurgeUser.isPending}
      />
    </div>
  );
}
