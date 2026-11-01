import { useTranslation } from 'react-i18next';

/** The `/agent` index route: the pane before a conversation is selected. */
export function AgentIndexPrompt() {
  const { t } = useTranslation('common');

  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-slate-500">{t('agent_layout.select_conversation')}</p>
    </div>
  );
}
