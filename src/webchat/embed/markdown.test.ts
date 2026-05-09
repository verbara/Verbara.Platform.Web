import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('Renders_PlainText', () => {
    expect(renderMarkdown('hello')).toContain('hello');
  });
  it('Renders_BoldAndItalic', () => {
    const html = renderMarkdown('**bold** and *italic*');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });
  it('Renders_Links_WithRelNoopener', () => {
    const html = renderMarkdown('[Verbara](https://verbara.io)');
    expect(html).toContain('href="https://verbara.io"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });
  it('Renders_InlineCode', () => {
    expect(renderMarkdown('use `npm install`')).toContain('<code>npm install</code>');
  });
  it('Strips_ScriptTags', () => {
    const html = renderMarkdown('<script>alert(1)</script>hello');
    expect(html).not.toContain('<script>');
    expect(html).toContain('hello');
  });
  it('Strips_OnclickAttributes', () => {
    const html = renderMarkdown('<a href="x" onclick="alert(1)">link</a>');
    expect(html).not.toContain('onclick');
  });
  it('PreservesLineBreaks_AsBr', () => {
    const html = renderMarkdown('line1\nline2');
    expect(html).toMatch(/line1.*<br.*line2/s);
  });
});
