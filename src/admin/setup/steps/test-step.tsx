import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';
import { CopyButton } from '@/core/ui/copy-button';
import { Checkbox } from '@/core/ui/checkbox';
import { Label } from '@/core/ui/label';
import { useTenantStore } from '@/core/tenant/tenant-store';
import type { SetupFormValues } from '../setup-wizard';

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function TestStep() {
  const { t } = useTranslation(['admin']);
  const { watch } = useFormContext<SetupFormValues>();
  const [tested, setTested] = useState(false);

  const queueName = watch('queueName');
  const agentDisplayName = watch('agentDisplayName');
  const channelId = watch('channelId');
  const tenantId = useTenantStore.getState().activeTenantId ?? 'default';

  const isWebchat = channelId === 'webchat';
  const webhookUrl = `https://your-api.com/api/v1/webhooks/${tenantId}/${channelId}`;

  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          {t('admin:setup.testTitle', 'Test Your Setup')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            'admin:setup.testDescription',
            'Review your configuration and verify everything works.',
          )}
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t('admin:setup.testSummary', 'Configuration Summary')}
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>
              {t('admin:setup.testQueue', 'Queue')}: <strong>{queueName}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>
              {t('admin:setup.testAgent', 'Agent')}: <strong>{agentDisplayName}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>
              {t('admin:setup.testChannel', 'Channel')}: <strong>{capitalize(channelId)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Channel-specific test area */}
      {isWebchat ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t(
              'admin:setup.testWebchatMessage',
              'Send a test message below to verify everything works.',
            )}
          </p>

          {/* Placeholder chat widget */}
          <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 overflow-hidden">
            <div className="bg-primary/5 px-4 py-2 text-sm font-medium border-b border-dashed border-muted-foreground/25">
              WebChat
            </div>
            <div className="flex flex-col gap-3 p-4 min-h-[200px]">
              <div className="self-start max-w-[70%] rounded-lg bg-muted px-3 py-2 text-sm">
                {t('admin:setup.testBubbleAgent', 'Hello! How can I help you today?')}
              </div>
              <div className="self-end max-w-[70%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm">
                {t('admin:setup.testBubbleCustomer', 'Hi, I have a question about my order.')}
              </div>
            </div>
            <div className="flex gap-2 border-t border-dashed border-muted-foreground/25 p-3">
              <div className="flex-1 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                {t('admin:setup.testInputPlaceholder', 'Type a message...')}
              </div>
              <div className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
                {t('admin:setup.testSend', 'Send')}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {t(
              'admin:setup.testWebchatNote',
              'In production, embed the WebChat widget on your site.',
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Webhook URL */}
          <div className="space-y-2">
            <Label>{t('admin:setup.testWebhookUrl', 'Webhook URL')}</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm break-all">
                {webhookUrl}
              </code>
              <CopyButton value={webhookUrl} variant="outline" iconOnly />
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">
              {t('admin:setup.testInstructions', 'Instructions')}
            </h3>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
              <li>
                {t(
                  'admin:setup.testStep1',
                  `Configure this webhook URL in your ${capitalize(channelId)} provider dashboard`,
                )}
              </li>
              <li>
                {t(
                  'admin:setup.testStep2',
                  'Send a test message from a customer device',
                )}
              </li>
              <li>
                {t(
                  'admin:setup.testStep3',
                  'Check the Agent workspace — you should see the conversation appear',
                )}
              </li>
            </ol>
          </div>

          {/* Tested checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={tested}
              onCheckedChange={(v) => setTested(v === true)}
            />
            <Label className="text-sm cursor-pointer" onClick={() => setTested(!tested)}>
              {t('admin:setup.testConfirm', "I've tested it")}
            </Label>
          </div>
        </div>
      )}
    </div>
  );
}
