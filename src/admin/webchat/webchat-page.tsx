import { MessageCircle } from 'lucide-react';
import { CopyButton } from '@/core/ui/copy-button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Badge } from '@/core/ui/badge';

export default function WebChatPage() {
  const apiBase = window.location.origin;
  const snippet = `<!-- Asterisk Platform WebChat Widget -->
<script>
(function() {
  var s = document.createElement('script');
  s.src = '${apiBase}/webchat-widget.js';
  s.async = true;
  s.onload = function() {
    AsteriskWebChat.init({
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
          <h1 className="font-heading text-xl font-semibold">WebChat Widget</h1>
          <p className="text-sm text-muted-foreground">
            Embed the chat widget on your website to let visitors start conversations.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Embed Snippet</h3>
          <Badge variant="secondary">HTML</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Copy this snippet and paste it before the closing <code className="text-xs bg-muted px-1 py-0.5 rounded">&lt;/body&gt;</code> tag of your website.
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
        <h3 className="font-medium">Configuration</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>API URL</Label>
            <Input readOnly value={`${apiBase}/api/v1/webchat`} className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label>WebSocket URL</Label>
            <Input readOnly value={`${apiBase.replace(/^http/, 'ws')}/ws/webchat`} className="font-mono text-xs" />
          </div>
        </div>
      </div>
    </div>
  );
}
