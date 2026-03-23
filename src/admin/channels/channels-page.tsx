import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Smartphone,
  Mail,
  Globe,
  Phone,
  MessagesSquare,
  Camera,
  Send,
  Twitter,
  Video,
  MessageCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { ChannelConfigForm } from './channel-config-form';

export interface ChannelInfo {
  id: string;
  name: string;
  icon: LucideIcon;
  isActive: boolean;
  group: 'core' | 'extended';
}

const MOCK_CHANNELS: ChannelInfo[] = [
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, isActive: true, group: 'core' },
  { id: 'sms', name: 'SMS', icon: Smartphone, isActive: true, group: 'core' },
  { id: 'email', name: 'Email', icon: Mail, isActive: true, group: 'core' },
  { id: 'webchat', name: 'WebChat', icon: Globe, isActive: false, group: 'core' },
  { id: 'voice', name: 'Voice', icon: Phone, isActive: true, group: 'core' },
  { id: 'messenger', name: 'Messenger', icon: MessagesSquare, isActive: false, group: 'extended' },
  { id: 'instagram', name: 'Instagram', icon: Camera, isActive: false, group: 'extended' },
  { id: 'telegram', name: 'Telegram', icon: Send, isActive: false, group: 'extended' },
  { id: 'twitter', name: 'Twitter', icon: Twitter, isActive: false, group: 'extended' },
  { id: 'video', name: 'Video', icon: Video, isActive: false, group: 'extended' },
  { id: 'rcs', name: 'RCS', icon: MessageCircle, isActive: false, group: 'extended' },
];

export default function ChannelsPage() {
  const { t } = useTranslation(['admin']);
  const [channels] = useState<ChannelInfo[]>(MOCK_CHANNELS);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const coreChannels = channels.filter((c) => c.group === 'core');
  const extendedChannels = channels.filter((c) => c.group === 'extended');

  const handleConfigure = (channelId: string) => {
    setSelectedChannel(channelId);
    setFormOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <h1 className="font-heading text-2xl font-semibold">{t('admin:channels.title')}</h1>

      {/* Core channels */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('admin:channels.core')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coreChannels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onConfigure={handleConfigure}
              t={t}
            />
          ))}
        </div>
      </section>

      {/* Extended / Beta channels */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('admin:channels.extended')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {extendedChannels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onConfigure={handleConfigure}
              t={t}
            />
          ))}
        </div>
      </section>

      {/* Config form sheet */}
      <ChannelConfigForm
        open={formOpen}
        onOpenChange={setFormOpen}
        channelId={selectedChannel}
      />
    </div>
  );
}

function ChannelCard({
  channel,
  onConfigure,
  t,
}: {
  channel: ChannelInfo;
  onConfigure: (id: string) => void;
  t: (key: string) => string;
}) {
  const Icon = channel.icon;

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{channel.name}</p>
        <Badge variant={channel.isActive ? 'default' : 'outline'}>
          {channel.isActive ? t('admin:channels.enabled') : t('admin:channels.disabled')}
        </Badge>
      </div>
      <Button variant="outline" size="sm" onClick={() => onConfigure(channel.id)}>
        {t('admin:channels.configure')}
      </Button>
    </div>
  );
}
