import { ExternalLink, MessageCircle, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useChannel } from '@/core/api/hooks/use-channels';
import { Badge } from '@/core/ui/badge';
import { CopyButton } from '@/core/ui/copy-button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { useTenantStore } from '@/core/tenant/tenant-store';

export default function WebChatPage() {
  const { t } = useTranslation('admin');
  const apiBase = window.location.origin;
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const tenantId = activeTenantId ?? 'YOUR_TENANT_ID';
  // Platform starts a WebChat session only while the tenant's WebChat channel is active. A channel that was never
  // configured comes back with isActive false. No answer (loading, error) is not a reason to warn.
  const { data: channel } = useChannel('webchat');
  const channelOff = channel !== undefined && !channel.isActive;

  const snippet = `<!-- Verbara WebChat Widget -->
<script
  src="${apiBase}/webchat/v1/verbara-webchat.js"
  data-tenant-id="${tenantId}"
  data-locale="auto"
  data-position="bottom-right"
  async
></script>`;

  const previewUrl = `${apiBase}/webchat/demo.html?tenantId=${encodeURIComponent(tenantId)}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <MessageCircle className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-heading text-xl font-semibold">{t('webchat.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('webchat.description')}</p>
        </div>
      </div>

      {channelOff && (
        <div
          role="status"
          data-webchat-channel-warning
          className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-700 dark:bg-amber-950"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="flex-1 text-amber-900 dark:text-amber-100">
            {t('webchat.channel_inactive')}
          </p>
          <Link
            to="/admin/channels"
            className="shrink-0 text-xs font-medium text-amber-700 underline hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
          >
            {t('webchat.open_channels')}
          </Link>
        </div>
      )}

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{t('webchat.embed_snippet')}</h2>
          <Badge variant="secondary">{t('webchat.html')}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('webchat.instructions_prefix')}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">&lt;/body&gt;</code>
          {t('webchat.instructions_suffix')}
        </p>
        <div className="relative">
          <pre
            data-testid="webchat-snippet"
            className="overflow-x-auto rounded-md bg-slate-950 p-4 text-sm text-slate-50 font-mono leading-relaxed"
          >
            {snippet}
          </pre>
          <div className="absolute right-2 top-2" data-testid="webchat-copy">
            <CopyButton value={snippet} variant="outline" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground" data-webchat-snippet-scope>
          {t('webchat.snippet_scope')}
        </p>
        <div className="flex justify-end">
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="webchat-preview-link"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-[0.8rem] font-medium hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('webchat.live_preview')}
          </a>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-medium">{t('webchat.configuration')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('webchat.api_url')}</Label>
            <Input readOnly value={`${apiBase}/api/v1/webchat`} className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label>{t('webchat.ws_url')}</Label>
            <Input
              readOnly
              value={`${apiBase.replace(/^http/, 'ws')}/ws/webchat`}
              className="font-mono text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
