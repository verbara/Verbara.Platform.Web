import { describe, it, expect } from 'vitest';
import { parseAttachments } from './parse-attachments';

describe('parseAttachments', () => {
  it('ReturnsUndefined_ForNonArray', () => {
    expect(parseAttachments(null)).toBeUndefined();
    expect(parseAttachments({ url: 'x' })).toBeUndefined();
    expect(parseAttachments(undefined)).toBeUndefined();
  });
  it('ReturnsValidAttachments', () => {
    const result = parseAttachments([
      { url: 'https://x/a.png', name: 'a.png', mimeType: 'image/png' },
    ]);
    expect(result).toHaveLength(1);
    expect(result?.[0]?.name).toBe('a.png');
  });
  it('FiltersOutMalformed', () => {
    const result = parseAttachments([
      { url: 'https://x/a.png', name: 'a.png', mimeType: 'image/png' },
      { url: 'no-name' },
      'string',
      null,
    ]);
    expect(result).toHaveLength(1);
  });
  it('ReturnsUndefined_WhenAllInvalid', () => {
    expect(parseAttachments(['x', null, 5])).toBeUndefined();
  });
});
