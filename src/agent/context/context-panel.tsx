import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/core/ui/tabs';
import { ContactInfo } from './contact-info';
import { ConversationHistory } from './conversation-history';
import { AgentNotes } from './agent-notes';

export function ContextPanel() {
  const { t } = useTranslation(['agent']);

  return (
    <Tabs defaultValue="contact" className="flex h-full flex-col gap-0">
      <TabsList variant="line" className="w-full shrink-0 border-b border-slate-200 px-2 dark:border-slate-700">
        <TabsTrigger value="contact">{t('agent:context.contact_info')}</TabsTrigger>
        <TabsTrigger value="history">{t('agent:context.history')}</TabsTrigger>
        <TabsTrigger value="notes">{t('agent:context.notes')}</TabsTrigger>
        <TabsTrigger value="ai" disabled>
          {t('agent:context.ai_assist')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="contact" className="overflow-y-auto">
        <ContactInfo />
      </TabsContent>

      <TabsContent value="history" className="overflow-y-auto">
        <ConversationHistory />
      </TabsContent>

      <TabsContent value="notes" className="overflow-y-auto">
        <AgentNotes />
      </TabsContent>

      <TabsContent value="ai">
        <div className="flex items-center justify-center p-6 text-sm text-slate-400">
          {t('agent:context.ai_assist_placeholder')}
        </div>
      </TabsContent>
    </Tabs>
  );
}
