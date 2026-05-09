import { renderMarkdown } from './markdown';
import type { ChatMessage } from './transport/session-api';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isVisitor = message.from === 'visitor';
  const align = isVisitor ? 'items-end' : 'items-start';
  const bubbleColor = isVisitor
    ? 'bg-[var(--vw-primary,#0d9488)] text-white'
    : 'bg-gray-100 text-gray-900';

  const html = renderMarkdown(message.text ?? '');

  return (
    <div className={`flex flex-col ${align} gap-1 px-3`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${bubbleColor}`}>
        {message.attachments && message.attachments.length > 0 ? (
          <div className="space-y-2">
            <div dangerouslySetInnerHTML={{ __html: html }} />
            {message.attachments.map((a) => (
              <Attachment key={a.url} attachment={a} />
            ))}
          </div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
      <span className="text-[10px] text-gray-500">
        {new Date(message.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}

function Attachment({
  attachment,
}: {
  attachment: NonNullable<ChatMessage['attachments']>[number];
}) {
  const isImage = attachment.mimeType.startsWith('image/');
  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer">
        <img src={attachment.url} alt={attachment.name} className="max-w-full rounded" />
      </a>
    );
  }
  return (
    <a
      href={attachment.url}
      download={attachment.name}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded border bg-white p-2 text-xs text-gray-700"
    >
      📎 {attachment.name}
    </a>
  );
}
