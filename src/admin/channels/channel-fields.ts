import { z } from 'zod';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'password';
}

export const channelFields: Record<string, FieldDef[]> = {
  whatsapp: [
    { key: 'ApiToken', label: 'Business API Token', type: 'password' },
    { key: 'PhoneNumber', label: 'Phone Number', type: 'text' },
    { key: 'WebhookVerifyToken', label: 'Webhook Verify Token', type: 'text' },
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
