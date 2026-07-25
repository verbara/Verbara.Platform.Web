import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/core/ui/command';
import { Settings, Activity, ChartColumn, MessageSquare } from 'lucide-react';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const go = useCallback(
    (path: string) => {
      navigate(path);
      setOpen(false);
    },
    [navigate],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t('actions.search') + '...'} />
      <CommandList>
        <CommandEmpty>{t('status.no_results')}</CommandEmpty>

        <CommandGroup heading={t('nav.admin')}>
          <CommandItem onSelect={() => go('/admin')}>
            <Settings className="mr-2 h-4 w-4" />
            {t('nav.admin')}
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading={t('nav.operations')}>
          <CommandItem onSelect={() => go('/operations')}>
            <Activity className="mr-2 h-4 w-4" />
            {t('nav.operations')}
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading={t('nav.analytics')}>
          <CommandItem onSelect={() => go('/analytics')}>
            <ChartColumn className="mr-2 h-4 w-4" />
            {t('nav.analytics')}
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading={t('nav.agent')}>
          <CommandItem onSelect={() => go('/agent')}>
            <MessageSquare className="mr-2 h-4 w-4" />
            {t('nav.agent')}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
