import { describe, expect, it } from 'vitest';
import type { components } from '@/core/api/generated/openapi';
import { mapPlatformMessage } from './platform-message';

type PlatformMessage = components['schemas']['Message'];

function platformMessage(overrides: Partial<PlatformMessage> = {}): PlatformMessage {
  return {
    messageId: 'm1',
    conversationId: 'c1',
    tenantId: 't1',
    direction: 'Inbound',
    channel: 'WebChat',
    senderId: null,
    content: { blocks: [{ $type: 'text', text: 'Hola', type: 'Text' }] },
    deliveryStatus: 'Delivered',
    externalMessageId: null,
    createdAt: '2026-10-03T14:05:00+00:00',
    deliveredAt: null,
    readAt: null,
    updatedAt: null,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

describe('mapPlatformMessage', () => {
  it('mapPlatformMessage_ShouldUseCreatedAtAsTimestamp_WhenPlatformSendsNoTimestamp', () => {
    const mapped = mapPlatformMessage(platformMessage());
    expect(mapped).toEqual({
      id: 'm1',
      conversationId: 'c1',
      sender: 'customer',
      senderName: '',
      text: 'Hola',
      timestamp: '2026-10-03T14:05:00+00:00',
      status: 'delivered',
      type: 'text',
    });
  });

  it('mapPlatformMessage_ShouldMapAgentAndSystemDirections_WhenOutboundOrSystem', () => {
    expect(
      mapPlatformMessage(
        platformMessage({ direction: 'Outbound', senderId: 'agent-7', deliveryStatus: 'Pending' }),
      ),
    ).toMatchObject({ sender: 'agent', senderName: 'agent-7', status: 'sending', type: 'text' });
    expect(mapPlatformMessage(platformMessage({ direction: 'System' }))).toMatchObject({
      sender: 'system',
      type: 'system',
    });
  });

  it('mapPlatformMessage_ShouldMapImageAndFileBlocks_WhenContentIsMedia', () => {
    const image = mapPlatformMessage(
      platformMessage({
        content: {
          blocks: [
            { $type: 'image', url: 'https://cdn/x.png', caption: 'foto', mimeType: 'image/png' },
          ],
        },
      }),
    );
    expect(image).toMatchObject({
      type: 'image',
      text: 'foto',
      metadata: { url: 'https://cdn/x.png' },
    });

    const file = mapPlatformMessage(
      platformMessage({
        content: {
          blocks: [
            {
              $type: 'file',
              url: 'https://cdn/a.pdf',
              fileName: 'a.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 10,
            },
          ],
        },
      }),
    );
    expect(file).toMatchObject({
      type: 'file',
      metadata: { url: 'https://cdn/a.pdf', fileName: 'a.pdf' },
    });
  });

  it('mapPlatformMessage_ShouldJoinTextAndInteractiveBodies_WhenSeveralBlocks', () => {
    const mapped = mapPlatformMessage(
      platformMessage({
        content: {
          blocks: [
            { $type: 'text', text: 'Elija una opción' },
            { $type: 'interactive', body: '¿Ventas o soporte?', replies: [] },
          ],
        },
      }),
    );
    expect(mapped.text).toBe('Elija una opción\n¿Ventas o soporte?');
  });
});
