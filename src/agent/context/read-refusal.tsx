import { useTranslation } from 'react-i18next';
import { describeApiError } from '@/core/api/api-error';
import { conversationReadRefusals } from '@/core/api/conversation-refusals';

/**
 * A refused conversation read, in place of the content it refused (W9): the message comes from the
 * closed map, never from the server's text, and `data-refusal` is the code or status it was chosen by.
 */
export function ReadRefusal({ error }: { error: unknown }) {
  const { t } = useTranslation(['agent']);
  const entry = describeApiError(error, conversationReadRefusals);
  return (
    <div
      data-testid="read-refusal"
      data-refusal={entry.code}
      className="flex items-center justify-center p-6 text-center text-sm text-slate-500"
    >
      {t(entry.key)}
    </div>
  );
}
