import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plug } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/core/ui/button';

interface ChannelTestButtonProps {
  channelId: string;
}

export function ChannelTestButton({ channelId }: ChannelTestButtonProps) {
  const { t } = useTranslation(['admin']);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      // TODO: call real API — POST /api/channels/{channelId}/test
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate success for now
      toast.success(t('admin:channels.test_success'));
    } catch {
      toast.error(t('admin:channels.test_failure'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <Button type="button" variant="outline" disabled={testing} onClick={handleTest}>
      {testing ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <Plug className="mr-1.5 h-4 w-4" />
      )}
      {t('admin:channels.test_connection')}
    </Button>
  );
}
