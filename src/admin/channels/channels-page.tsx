import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueries } from '@tanstack/react-query';
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
import { Label } from '@/core/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/ui/dialog';
import { ChannelConfigForm } from './channel-config-form';
import { customFetch } from '@/core/api/client';
import { useChannel } from '@/core/api/hooks/use-channels';
import type { ChannelConfig } from '@/core/api/hooks/use-channels';

export interface ChannelInfo {
  id: string;
  name: string;
  icon: LucideIcon;
  isActive: boolean;
  group: 'core' | 'extended';
}

const CHANNEL_LIST: Omit<ChannelInfo, 'isActive'>[] = [
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, group: 'core' },
  { id: 'sms', name: 'SMS', icon: Smartphone, group: 'core' },
  { id: 'email', name: 'Email', icon: Mail, group: 'core' },
  { id: 'webchat', name: 'WebChat', icon: Globe, group: 'core' },
  { id: 'voice', name: 'Voice', icon: Phone, group: 'core' },
  { id: 'messenger', name: 'Messenger', icon: MessagesSquare, group: 'extended' },
  { id: 'instagram', name: 'Instagram', icon: Camera, group: 'extended' },
  { id: 'telegram', name: 'Telegram', icon: Send, group: 'extended' },
  { id: 'twitter', name: 'Twitter', icon: Twitter, group: 'extended' },
  { id: 'video', name: 'Video', icon: Video, group: 'extended' },
  { id: 'rcs', name: 'RCS', icon: MessageCircle, group: 'extended' },
];

export default function ChannelsPage() {
  const { t } = useTranslation(['admin']);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailChannel, setDetailChannel] = useState<string | null>(null);
  const { data: channelDetail } = useChannel(detailChannel ?? undefined);

  // Fetch config for each known channel to get isActive status
  const channelQueries = useQueries({
    queries: CHANNEL_LIST.map((ch) => ({
      queryKey: ['channels', ch.id],
      queryFn: () =>
        customFetch<ChannelConfig>({
          url: `/api/admin/channels/${ch.id}`,
          method: 'GET' as const,
        }).catch(() => null),
      staleTime: 60_000,
    })),
  });

  const channels: ChannelInfo[] = useMemo(
    () =>
      CHANNEL_LIST.map((ch, i) => ({
        ...ch,
        isActive: channelQueries[i]?.data?.isActive ?? false,
      })),
    [channelQueries],
  );

  const coreChannels = channels.filter((c) => c.group === 'core');
  const extendedChannels = channels.filter((c) => c.group === 'extended');

  const handleConfigure = (channelId: string) => {
    setSelectedChannel(channelId);
    setFormOpen(true);
  };

  return (
    <div className="space-y-8" data-testid="channels-page">
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
              onDetail={setDetailChannel}
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
              onDetail={setDetailChannel}
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

      {/* Channel detail dialog */}
      <Dialog open={detailChannel !== null} onOpenChange={(o) => { if (!o) setDetailChannel(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Channel: {channelDetail?.channel ?? detailChannel}</DialogTitle>
          </DialogHeader>
          {channelDetail && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <Label>Status</Label>
                <Badge variant={channelDetail.isActive ? 'default' : 'destructive'}>
                  {channelDetail.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {channelDetail.credentials && Object.keys(channelDetail.credentials).length > 0 && (
                <div>
                  <Label className="mb-2 block">Configuration</Label>
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                    {Object.entries(channelDetail.credentials).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-mono text-xs">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailChannel(null)}>Close</Button>
            <Button onClick={() => { setDetailChannel(null); handleConfigure(detailChannel!); }}>
              Configure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChannelCard({
  channel,
  onConfigure,
  onDetail,
  t,
}: {
  channel: ChannelInfo;
  onConfigure: (id: string) => void;
  onDetail: (id: string) => void;
  t: (key: string) => string;
}) {
  const Icon = channel.icon;

  return (
    <div
      className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30 cursor-pointer"
      onClick={() => onDetail(channel.id)}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{channel.name}</p>
        <Badge variant={channel.isActive ? 'default' : 'outline'}>
          {channel.isActive ? t('admin:channels.enabled') : t('admin:channels.disabled')}
        </Badge>
      </div>
      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onConfigure(channel.id); }}>
        {t('admin:channels.configure')}
      </Button>
    </div>
  );
}
