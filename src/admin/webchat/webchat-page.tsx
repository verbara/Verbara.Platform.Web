import { ExternalLink, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
