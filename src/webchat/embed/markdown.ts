import DOMPurify from 'dompurify';

const CODE_RE = /`([^`]+)`/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const ITALIC_RE = /\*([^*]+)\*/g;
const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function escapeHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function inlineMarkdown(s: string): string {
  return s
    .replaceAll(CODE_RE, '<code>$1</code>')
    .replaceAll(BOLD_RE, '<strong>$1</strong>')
    .replaceAll(ITALIC_RE, '<em>$1</em>')
    .replaceAll(LINK_RE, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function renderMarkdown(src: string): string {
  // First pass: sanitize raw HTML in the source (strips <script>, event handlers, etc.)
  const sanitizedSrc = DOMPurify.sanitize(src, {
    ALLOWED_TAGS: ['a'],
    ALLOWED_ATTR: ['href'],
    ALLOW_DATA_ATTR: false,
  });
  // Second pass: escape remaining HTML entities, then apply markdown inline rules
  const lines = sanitizedSrc.split('\n').map(escapeHtml).map(inlineMarkdown);
  const joined = lines.join('<br>');
  // Final pass: allow only safe rendered tags
  return DOMPurify.sanitize(joined, {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'code', 'br', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}
