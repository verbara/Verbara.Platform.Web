import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function ConversationView() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation(['agent']);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center border-b border-slate-200 px-4 dark:border-slate-700">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('agent:inbox.title')} &mdash; {id}
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-slate-400">Conversation {id}</p>
      </div>
    </div>
  );
}
