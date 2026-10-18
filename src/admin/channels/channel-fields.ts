import { z } from 'zod';

export interface FieldDef {
  /** The credential key saved in the channel config; must match what Platform reads. */
  key: string;
  /** Fallback label, shown when no `labelKey` is set. */
  label: string;
  /** `password` masks a secret; `queue` picks one of the tenant's queues and saves its id. */
  type: 'text' | 'password' | 'queue';
  /** Optional `admin:` i18n key for the label (wins over `label`). */
  labelKey?: string;
  /** Optional `admin:` i18n key for help text shown under the input. */
  helpKey?: string;
  /**
   * The channel works without this key. An optional key that is set can be removed from the form;
   * a required one can only be replaced, and must be entered when it is not set yet.
   */
  optional?: boolean;
}

export const channelFields: Record<string, FieldDef[]> = {
  // Platform's declared WhatsApp credential schema (channel-credential-config): the four keys the
  // channel needs, then WabaId, ApiVersion and the default queue inbound routing reads. Platform
  // refuses a value for any other key with `unknown-credential-key`.
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
      type: 'password',
      labelKey: 'admin:channels.whatsapp.webhookVerifyToken.label',
      helpKey: 'admin:channels.whatsapp.webhookVerifyToken.help',
    },
    {
      key: 'WabaId',
      label: 'WhatsApp Business Account ID',
      type: 'text',
      labelKey: 'admin:channels.whatsapp.wabaId.label',
      helpKey: 'admin:channels.whatsapp.wabaId.help',
      optional: true,
    },
    {
      key: 'ApiVersion',
      label: 'Graph API version',
      type: 'text',
      labelKey: 'admin:channels.whatsapp.apiVersion.label',
      helpKey: 'admin:channels.whatsapp.apiVersion.help',
      optional: true,
    },
    {
      key: 'defaultQueueId',
      label: 'Default queue',
      type: 'queue',
      labelKey: 'admin:channels.whatsapp.defaultQueueId.label',
      helpKey: 'admin:channels.whatsapp.defaultQueueId.help',
      optional: true,
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
  // Platform reads only the default queue for WebChat; a Widget Key or Allowed Origins saved by an older
  // console shows up as a legacy key the admin can remove.
  webchat: [
    {
      key: 'defaultQueueId',
      label: 'Default queue',
      type: 'queue',
      labelKey: 'admin:channels.webchat.defaultQueueId.label',
      helpKey: 'admin:channels.webchat.defaultQueueId.help',
      optional: true,
    },
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

/**
 * The form schema. A required key must be entered only while it is not set on the server: a blank
 * field keeps the stored value (Platform merges a PUT key by key), so an admin who changes one key
 * never retypes the others.
 */
export function buildSchema(fields: FieldDef[], isSet: (key: string) => boolean = () => false) {
  const shape: Record<string, z.ZodType> = { isActive: z.boolean() };
  for (const field of fields) {
    shape[field.key] =
      field.optional || isSet(field.key)
        ? z.string()
        : z.string().trim().min(1, 'admin:channels.validation.fieldRequired');
  }
  return z.object(shape);
}

export function buildDefaults(
  fields: FieldDef[],
  isActive = false,
): Record<string, string | boolean> {
  const defaults: Record<string, string | boolean> = { isActive };
  for (const field of fields) {
    defaults[field.key] = '';
  }
  return defaults;
}

/**
 * The `credentials` of a `PUT /admin/channels/{channel}`: a non-blank field replaces the key, a
 * blank one is left out so the stored value is kept, and a key the admin removed is sent as `null`,
 * which deletes it (also for a stored key outside the form, such as a legacy `ApiToken`).
 */
export function buildCredentialUpdate(
  fields: readonly FieldDef[],
  values: Readonly<Record<string, unknown>>,
  removed: Iterable<string> = [],
): Record<string, string | null> {
  const credentials: Record<string, string | null> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (typeof value === 'string' && value.trim() !== '') credentials[field.key] = value.trim();
  }
  for (const key of removed) credentials[key] = null;
  return credentials;
}

/** Stored keys the form has no field for (keys older consoles saved), in the server's order. */
export function legacyKeysOf(
  fields: readonly FieldDef[],
  credentials: readonly { key: string; isSet: boolean }[],
): string[] {
  const known = new Set(fields.map((f) => f.key));
  return credentials.filter((c) => c.isSet && !known.has(c.key)).map((c) => c.key);
}

/** Channels whose provider calls Platform's inbound webhook route (`/webhooks/{tenantId}/{channel}`). */
const WEBHOOK_CHANNELS = new Set(['whatsapp', 'messenger', 'instagram']);

/**
 * The URL the provider must call for this tenant and channel, or `null` when the channel takes no
 * webhook or the tenant is unknown. The console and the API share an origin (`/api/v1` is served
 * next to the console), so the console's own origin is the API's public address.
 */
export function webhookUrlFor(
  origin: string,
  tenantId: string | null | undefined,
  channelId: string | null | undefined,
): string | null {
  if (!tenantId || !channelId || !WEBHOOK_CHANNELS.has(channelId)) return null;
  return `${origin}/api/v1/webhooks/${encodeURIComponent(tenantId)}/${channelId}`;
}
