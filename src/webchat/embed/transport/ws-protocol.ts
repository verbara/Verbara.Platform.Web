import { parseAttachments, type IncomingAttachment } from './parse-attachments';

/**
 * The WebSocket contract with Platform's `/ws/webchat/{sessionId}` endpoint.
 *
 * Client → Platform: Platform reads `WebChatClientMessage(Type, Text)` and accepts `message` (with a non-empty
 * `text`) and `typing`. Platform → client: `WebChatWsMessage(Type, Data)`, where `Data` is a `MessageEnvelope` of
 * polymorphic `MessageBlock`s discriminated by `$type`. Platform sends `connected` once when the socket is
 * accepted and `message` for every agent reply. Verbatim frames live in `__fixtures__/ws-frames.json`.
 */

/** A visitor message, as Platform's `WebChatClientMessage` reads it. */
export interface ClientMessageFrame {
  type: 'message';
  text: string;
}

export type ClientFrame = ClientMessageFrame;

/** Any frame Platform sends. `data` is untrusted until read by {@link readAgentMessage}. */
export interface ServerFrame {
  type: string;
  data?: unknown;
}

/** What an agent reply renders as. */
export interface AgentMessage {
  text: string;
  attachments?: IncomingAttachment[];
}

export function messageFrame(text: string): ClientMessageFrame {
  return { type: 'message', text };
}

/** True when `value` is a JSON object with a string `type`, i.e. something that can be a {@link ServerFrame}. */
export function isServerFrame(value: unknown): value is ServerFrame {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

type Block = Record<string, unknown>;

function str(block: Block, key: string): string | undefined {
  const v = block[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/** Only http(s) links, absolute or relative to the widget, become attachments. */
function safeUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const { protocol } = new URL(raw, 'https://relative.invalid/');
    return protocol === 'https:' || protocol === 'http:' ? raw : undefined;
  } catch {
    return undefined;
  }
}

function nameFromUrl(url: string, fallback: string): string {
  const last = url.split(/[?#]/)[0]?.split('/').pop();
  if (!last) return fallback;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function toAttachment(block: Block, kind: string): Partial<IncomingAttachment> | undefined {
  const url = safeUrl(str(block, 'url'));
  if (!url) return undefined;
  const mimeType = str(block, 'mimeType');
  switch (kind) {
    case 'image':
    case 'video':
      return {
        url,
        name: str(block, 'caption') ?? nameFromUrl(url, kind),
        mimeType: mimeType ?? `${kind}/*`,
      };
    case 'audio':
      return { url, name: nameFromUrl(url, 'audio'), mimeType: mimeType ?? 'audio/*' };
    case 'file':
      return {
        url,
        name: str(block, 'fileName') ?? nameFromUrl(url, 'file'),
        mimeType: mimeType ?? 'application/octet-stream',
      };
    default:
      return undefined;
  }
}

/**
 * Reads an agent reply out of a Platform frame. Text and interactive blocks become the message text, joined in
 * order; image, video, audio and file blocks become attachments. Other block types (location, anything newer)
 * are skipped. Returns null for every frame that is not a `message`, and for a message with nothing to show.
 */
export function readAgentMessage(frame: ServerFrame): AgentMessage | null {
  if (frame.type !== 'message') return null;
  const data = frame.data;
  if (typeof data !== 'object' || data === null) return null;
  const blocks = (data as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return null;

  const texts: string[] = [];
  const candidates: Partial<IncomingAttachment>[] = [];
  for (const raw of blocks as unknown[]) {
    if (typeof raw !== 'object' || raw === null) continue;
    const block = raw as Block;
    const kind = block['$type'];
    if (kind === 'text') {
      const text = block['text'];
      if (typeof text === 'string') texts.push(text);
    } else if (kind === 'interactive') {
      const body = block['body'];
      if (typeof body === 'string') texts.push(body);
    } else if (typeof kind === 'string') {
      const attachment = toAttachment(block, kind);
      if (attachment) candidates.push(attachment);
    }
  }

  const text = texts.join('\n');
  const attachments = parseAttachments(candidates);
  if (text.length === 0 && !attachments) return null;
  return attachments ? { text, attachments } : { text };
}
