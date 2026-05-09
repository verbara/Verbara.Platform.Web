export interface IncomingAttachment {
  url: string;
  name: string;
  mimeType: string;
}

export function parseAttachments(raw: unknown): IncomingAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid = raw.filter(
    (a): a is IncomingAttachment =>
      typeof a === 'object' &&
      a !== null &&
      typeof (a as { url?: unknown }).url === 'string' &&
      typeof (a as { name?: unknown }).name === 'string' &&
      typeof (a as { mimeType?: unknown }).mimeType === 'string',
  );
  return valid.length > 0 ? valid : undefined;
}
