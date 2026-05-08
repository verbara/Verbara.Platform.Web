import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/ui/copy-button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Badge } from '@/core/ui/badge';

export default function WebChatPage() {
  const { t } = useTranslation('admin');
  const apiBase = window.location.origin;
  const snippet = `<!-- Verbara WebChat Widget -->
<script>
(function() {
  var s = document.createElement('script');
  s.src = '${apiBase}/webchat-widget.js';
  s.async = true;
  s.onload = function() {
    VerbaraWebChat.init({
      apiUrl: '${apiBase}/api/v1/webchat',
      wsUrl: '${apiBase.replace(/^http/, 'ws')}/ws/webchat',
    });
  };
  document.body.appendChild(s);
})();
</script>`;

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
