import type { components } from '@/core/api/generated/openapi';
import type { Message } from '@/core/api/hooks/use-conversations';

type PlatformMessage = components['schemas']['Message'];
type PlatformBlock = components['schemas']['MessageBlock'];

const SENDER: Record<PlatformMessage['direction'], Message['sender']> = {
  Inbound: 'customer',
  Outbound: 'agent',
  System: 'system',
};

const STATUS: Record<PlatformMessage['deliveryStatus'], NonNullable<Message['status']>> = {
  Pending: 'sending',
  Sent: 'sent',
  Delivered: 'delivered',
  Read: 'read',
  Failed: 'failed',
};

/** The block's kind: Platform writes the `$type` discriminator; `type` is the enum it also carries. */
function blockKind(block: PlatformBlock): string {
  return (block.$type ?? block.type ?? '').toString().toLowerCase();
}

function blockText(block: PlatformBlock): string | null {
  if ('text' in block) return block.text;
  if ('body' in block) return block.body;
  if ('caption' in block) return block.caption;
  return null;
}

/**
 * Maps Platform's `Message` record — what `GET /api/v1/conversations/{id}/messages` and
 * `GET /api/v1/supervisor/conversations/{id}/messages` return (Verbara.Platform.Conversations/
 * Message.cs: `messageId`, `direction`, `content.blocks`, `deliveryStatus`, `createdAt`) — onto the
 * console's message view-model, which the live `conversation.message` SSE event already fills
 * directly (`messageId`, `sender`, `text`, `timestamp`). Before 3.20.3-web the history went into the
 * store unmapped, so `timestamp` was undefined and the Agent Workspace bubble threw
 * "Invalid time value".
 */
export function mapPlatformMessage(message: PlatformMessage): Message {
  const blocks = message.content?.blocks ?? [];
  const media = blocks.find((b) => ['image', 'file'].includes(blockKind(b)));
  const text = blocks
    .map(blockText)
    .filter((t): t is string => !!t)
    .join('\n');

  let type: Message['type'] = 'text';
  let metadata: Record<string, unknown> | undefined;
  if (message.direction === 'System') {
    type = 'system';
  } else if (media && 'url' in media) {
    type = blockKind(media) === 'file' ? 'file' : 'image';
    metadata =
      'fileName' in media ? { url: media.url, fileName: media.fileName } : { url: media.url };
  }

  return {
    id: String(message.messageId),
    conversationId: String(message.conversationId),
    sender: SENDER[message.direction] ?? 'customer',
    senderName: message.senderId ?? '',
    text,
    timestamp: message.createdAt,
    status: STATUS[message.deliveryStatus],
    type,
    ...(metadata ? { metadata } : {}),
  };
}
