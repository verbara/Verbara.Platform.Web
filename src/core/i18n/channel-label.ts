import type { TFunction } from 'i18next';

/**
 * The keys of `common:channels.*`. Listed because i18next walks the prototype chain: a free-text
 * contact address on `constructor` would otherwise come back as a function, not a label.
 */
const CHANNEL_KEYS = new Set([
  'voice',
  'whatsapp',
  'sms',
  'webchat',
  'email',
  'messenger',
  'instagram',
  'telegram',
  'twitter',
  'video',
  'rcs',
]);

/**
 * The localized name of a channel, from the one keyed set `common:channels.*`. The wire value is
 * PascalCase; the match ignores case only as a convenience, and a value with no key shows as it
 * came. The namespace is named here, so any `t` works whatever namespace it is bound to.
 */
export function channelLabel(t: TFunction, channel: string | null | undefined): string {
  if (!channel) return '';
  const key = channel.toLowerCase();
  if (!CHANNEL_KEYS.has(key)) return channel;
  return t(`channels.${key}`, { ns: 'common', defaultValue: channel });
}
