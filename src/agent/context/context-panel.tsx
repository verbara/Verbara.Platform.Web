import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/core/ui/tabs';
import { useAgentAiStore } from '@/agent/stores/agent-ai-store';
import { ContactInfo } from './contact-info';
import { ConversationHistory } from './conversation-history';
import { AgentNotes } from './agent-notes';
import { KnowledgeTab } from './knowledge-tab';
import { TranscriptTab } from './transcript-tab';

export function ContextPanel() {
  const { t } = useTranslation(['agent']);
  const isActive = useAgentAiStore((s) => s.isActive);

  return (
    <Tabs defaultValue="contact" className="flex h-full flex-col gap-0">
      <TabsList variant="line" className="w-full shrink-0 border-b border-slate-200 px-2 dark:border-slate-700">
        <TabsTrigger value="contact">{t('agent:context.contact_info')}</TabsTrigger>
        <TabsTrigger value="history">{t('agent:context.history')}</TabsTrigger>
        <TabsTrigger value="notes">{t('agent:context.notes')}</TabsTrigger>
        <TabsTrigger value="knowledge">
          {t('agent:context.knowledge')}
        </TabsTrigger>
        {isActive && (
          <TabsTrigger value="transcript">{t('agent:context.transcript')}</TabsTrigger>
        )}
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

      <TabsContent value="knowledge" className="overflow-y-auto">
        <KnowledgeTab />
      </TabsContent>

      {isActive && (
        <TabsContent value="transcript" className="overflow-y-auto">
          <TranscriptTab />
        </TabsContent>
      )}
    </Tabs>
  );
}
