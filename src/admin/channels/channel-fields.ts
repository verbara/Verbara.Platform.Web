import { z } from 'zod';

export interface FieldDef {
  /** The credential key saved in the channel config; must match what Platform reads. */
  key: string;
  /** Fallback label, shown when no `labelKey` is set. */
  label: string;
  type: 'text' | 'password';
  /** Optional `admin:` i18n key for the label (wins over `label`). */
  labelKey?: string;
  /** Optional `admin:` i18n key for help text shown under the input. */
  helpKey?: string;
}

export const channelFields: Record<string, FieldDef[]> = {
  // Keys are the ones Platform's WhatsApp channel reads (WhatsAppCredentialKeys).
  whatsapp: [
    {
      key: 'AccessToken',
      label: 'Access Token',
      type: 'password',
      labelKey: 'admin:channels.whatsapp.accessToken.label',
      helpKey: 'admin:channels.whatsapp.accessToken.help',
    },
    {
      key: 'PhoneNumberId',
      label: 'Phone Number ID',
      type: 'text',
      labelKey: 'admin:channels.whatsapp.phoneNumberId.label',
      helpKey: 'admin:channels.whatsapp.phoneNumberId.help',
    },
    {
      key: 'AppSecret',
      label: 'App Secret',
      type: 'password',
      labelKey: 'admin:channels.whatsapp.appSecret.label',
      helpKey: 'admin:channels.whatsapp.appSecret.help',
    },
    {
      key: 'WebhookVerifyToken',
      label: 'Webhook Verify Token',
      type: 'text',
      labelKey: 'admin:channels.whatsapp.webhookVerifyToken.label',
      helpKey: 'admin:channels.whatsapp.webhookVerifyToken.help',
    },
  ],
  sms: [
    { key: 'ApiKey', label: 'API Key', type: 'password' },
    { key: 'ApiSecret', label: 'API Secret', type: 'password' },
    { key: 'SenderNumber', label: 'Sender Number', type: 'text' },
  ],
  email: [
    { key: 'SmtpHost', label: 'SMTP Host', type: 'text' },
    { key: 'SmtpPort', label: 'SMTP Port', type: 'text' },
    { key: 'SmtpUser', label: 'SMTP Username', type: 'text' },
    { key: 'SmtpPassword', label: 'SMTP Password', type: 'password' },
    { key: 'FromAddress', label: 'From Address', type: 'text' },
  ],
  webchat: [
    { key: 'WidgetKey', label: 'Widget Key', type: 'text' },
    { key: 'AllowedOrigins', label: 'Allowed Origins', type: 'text' },
  ],
  voice: [
    { key: 'TrunkHost', label: 'SIP Trunk Host', type: 'text' },
    { key: 'TrunkUser', label: 'Trunk Username', type: 'text' },
    { key: 'TrunkPassword', label: 'Trunk Password', type: 'password' },
    { key: 'CallerIdNumber', label: 'Caller ID Number', type: 'text' },
  ],
  messenger: [
    { key: 'PageAccessToken', label: 'Page Access Token', type: 'password' },
    { key: 'AppSecret', label: 'App Secret', type: 'password' },
    { key: 'VerifyToken', label: 'Verify Token', type: 'text' },
  ],
  instagram: [
    { key: 'AccessToken', label: 'Access Token', type: 'password' },
    { key: 'AppSecret', label: 'App Secret', type: 'password' },
  ],
  telegram: [
    { key: 'BotToken', label: 'Bot Token', type: 'password' },
    { key: 'WebhookUrl', label: 'Webhook URL', type: 'text' },
  ],
  twitter: [
    { key: 'ApiKey', label: 'API Key', type: 'password' },
    { key: 'ApiSecret', label: 'API Secret', type: 'password' },
    { key: 'BearerToken', label: 'Bearer Token', type: 'password' },
  ],
  video: [
    { key: 'ApiKey', label: 'API Key', type: 'password' },
    { key: 'ApiSecret', label: 'API Secret', type: 'password' },
    { key: 'RoomPrefix', label: 'Room Prefix', type: 'text' },
  ],
  rcs: [
    { key: 'AgentId', label: 'Agent ID', type: 'text' },
    { key: 'ServiceAccountKey', label: 'Service Account Key', type: 'password' },
  ],
};

export function buildSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodType> = { isActive: z.boolean() };
  for (const field of fields) {
    shape[field.key] = z.string().min(1, 'admin:channels.validation.fieldRequired');
  }
  return z.object(shape);
}

export function buildDefaults(fields: FieldDef[]): Record<string, string | boolean> {
  const defaults: Record<string, string | boolean> = { isActive: false };
  for (const field of fields) {
    defaults[field.key] = '';
  }
  return defaults;
}
