import type { components } from '@/core/api/generated/openapi';

export type ChannelType = components['schemas']['ChannelType'];

/**
 * Every `ChannelType` name, as Platform writes it on the wire (PascalCase, compared ordinally). The
 * `Record` makes a name the generated schema adds or drops a compile error here.
 */
const CHANNEL_TYPE_SET = {
  Voice: true,
  WhatsApp: true,
  Sms: true,
  WebChat: true,
  Email: true,
  Messenger: true,
  Instagram: true,
  Telegram: true,
  Twitter: true,
  Video: true,
  Rcs: true,
} satisfies Record<ChannelType, true>;

/** The eleven names, in the order the schema lists them. */
export const CHANNEL_TYPES = Object.keys(CHANNEL_TYPE_SET) as readonly ChannelType[];

/** Whether `value` is a `ChannelType` name exactly as Platform writes it. */
export function isChannelType(value: string): value is ChannelType {
  return Object.hasOwn(CHANNEL_TYPE_SET, value);
}
