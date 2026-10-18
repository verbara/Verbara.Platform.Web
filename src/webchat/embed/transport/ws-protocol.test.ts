import { describe, it, expect } from 'vitest';
import { messageFrame, readAgentMessage, type ServerFrame } from './ws-protocol';
import frames from './__fixtures__/ws-frames.json';

function frame(blocks: unknown[]): ServerFrame {
  return { type: 'message', data: { blocks } };
}

describe('ws-protocol', () => {
  describe('messageFrame', () => {
    it('MessageFrame_ShouldMatchPlatformClientMessage_WhenSerialized', () => {
      expect(JSON.stringify(messageFrame('hola por socket'))).toBe(frames.client.visitorMessage);
    });
  });

  describe('readAgentMessage', () => {
    it('ReadAgentMessage_ShouldReturnBlockText_WhenFrameIsTheMeasuredAgentReply', () => {
      const parsed = JSON.parse(frames.server.agentTextReply) as ServerFrame;
      expect(readAgentMessage(parsed)).toEqual({ text: 'agent reply wcl71c00d.c2.1.1.' });
    });

    it('ReadAgentMessage_ShouldReturnNull_WhenFrameIsTheConnectedConfirmation', () => {
      expect(readAgentMessage(JSON.parse(frames.server.connected) as ServerFrame)).toBeNull();
    });

    it('ReadAgentMessage_ShouldReturnNull_WhenTypeIsNotMessage', () => {
      expect(
        readAgentMessage({ type: 'typing', data: { blocks: [{ $type: 'text', text: 'x' }] } }),
      ).toBeNull();
    });

    it('ReadAgentMessage_ShouldJoinTextBlocksInOrder_WhenSeveralArrive', () => {
      const msg = readAgentMessage(
        frame([
          { $type: 'text', text: 'one', type: 0 },
          { $type: 'text', text: 'two', type: 0 },
        ]),
      );
      expect(msg).toEqual({ text: 'one\ntwo' });
    });

    it('ReadAgentMessage_ShouldUseInteractiveBody_AsText', () => {
      const msg = readAgentMessage(
        frame([{ $type: 'interactive', body: 'Pick one', replies: [{ id: 'a', title: 'A' }] }]),
      );
      expect(msg).toEqual({ text: 'Pick one' });
    });

    it('ReadAgentMessage_ShouldMapMediaBlocks_ToAttachments', () => {
      const msg = readAgentMessage(
        frame([
          { $type: 'image', url: 'https://c/p.png', caption: 'plan', mimeType: 'image/png' },
          { $type: 'image', url: 'https://c/q.jpg', caption: null, mimeType: null },
          { $type: 'video', url: 'https://c/v.mp4', caption: null, mimeType: 'video/mp4' },
          { $type: 'audio', url: 'https://c/a.ogg', duration: '00:00:03', mimeType: null },
          {
            $type: 'file',
            url: 'https://c/r.pdf',
            fileName: 'report.pdf',
            mimeType: null,
            sizeBytes: 1,
          },
        ]),
      );
      expect(msg).toEqual({
        text: '',
        attachments: [
          { url: 'https://c/p.png', name: 'plan', mimeType: 'image/png' },
          { url: 'https://c/q.jpg', name: 'q.jpg', mimeType: 'image/*' },
          { url: 'https://c/v.mp4', name: 'v.mp4', mimeType: 'video/mp4' },
          { url: 'https://c/a.ogg', name: 'a.ogg', mimeType: 'audio/*' },
          { url: 'https://c/r.pdf', name: 'report.pdf', mimeType: 'application/octet-stream' },
        ],
      });
    });

    it('ReadAgentMessage_ShouldDropAttachment_WhenUrlIsNotHttp', () => {
      const msg = readAgentMessage(
        frame([
          { $type: 'text', text: 'see' },
          { $type: 'file', url: 'javascript:alert(1)', fileName: 'x', mimeType: null },
          { $type: 'image', url: 'data:image/png;base64,AAAA', caption: 'x', mimeType: null },
        ]),
      );
      expect(msg).toEqual({ text: 'see' });
    });

    it('ReadAgentMessage_ShouldIgnoreUnknownAndMalformedBlocks', () => {
      const msg = readAgentMessage(
        frame([
          { $type: 'location', latitude: 1, longitude: 2, name: 'HQ' },
          { $type: 'carousel', items: [] },
          { $type: 'text', text: 42 },
          { $type: 'image' },
          null,
          'text',
          { text: 'no discriminator' },
          { $type: 'text', text: 'kept' },
        ]),
      );
      expect(msg).toEqual({ text: 'kept' });
    });

    it('ReadAgentMessage_ShouldReturnNull_WhenNothingIsRenderable', () => {
      expect(
        readAgentMessage(frame([{ $type: 'location', latitude: 1, longitude: 2 }])),
      ).toBeNull();
      expect(readAgentMessage(frame([]))).toBeNull();
    });

    it('ReadAgentMessage_ShouldReturnNull_WhenDataIsMissingOrMalformed', () => {
      expect(readAgentMessage({ type: 'message' })).toBeNull();
      expect(readAgentMessage({ type: 'message', data: null })).toBeNull();
      expect(readAgentMessage({ type: 'message', data: { blocks: 'x' } })).toBeNull();
      expect(readAgentMessage({ type: 'message', data: 'x' })).toBeNull();
    });
  });
});
