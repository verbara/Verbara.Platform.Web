import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/core/auth/auth-store';
import { useUiStore } from '@/core/stores/ui-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from '@/core/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/core/ui/avatar';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/core/i18n/i18n';
import { Lock, LogOut, Sun, Moon, Monitor, Languages, Check } from 'lucide-react';

const LANGUAGE_SHORT: Record<SupportedLanguage, string> = {
  'es-419': 'ES',
  'en-US': 'EN',
  'pt-BR': 'PT',
};

export function UserMenu() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setTheme = useUiStore((s) => s.setTheme);
  const currentLang = (i18n.resolvedLanguage ?? i18n.language) as SupportedLanguage;

  const initials =
    user?.displayName
      ?.split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '?';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <button
            {...props}
            data-testid="user-menu-trigger"
            className="flex h-10 w-10 items-center justify-center rounded-md text-rail-icon hover:bg-slate-800 hover:text-rail-icon-active"
          />
        )}
      >
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-brand text-xs text-brand-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{user?.displayName ?? 'User'}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun className="mr-2 h-4 w-4 dark:hidden" />
            <Moon className="mr-2 hidden h-4 w-4 dark:block" />
            {t('theme.label', 'Theme')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun className="mr-2 h-4 w-4" /> {t('theme.light')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon className="mr-2 h-4 w-4" /> {t('theme.dark')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Monitor className="mr-2 h-4 w-4" /> {t('theme.system')}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-testid="user-menu-language-trigger">
            <Languages className="mr-2 h-4 w-4" />
            {t('language.label')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {SUPPORTED_LANGUAGES.map((lng) => (
              <DropdownMenuItem
                key={lng}
                onClick={() => void i18n.changeLanguage(lng)}
                data-testid={`user-menu-language-${lng}`}
              >
                <span className="mr-2 inline-flex w-6 justify-center text-xs font-semibold text-muted-foreground">
                  {LANGUAGE_SHORT[lng]}
                </span>
                <span className="flex-1">{t(`language.${lng}`)}</span>
                {currentLang === lng && <Check className="ml-2 h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={() => navigate('/admin/security')}>
          <Lock className="mr-2 h-4 w-4" /> {t('admin:sidebar.security')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="user-menu-logout" onClick={handleLogout} className="text-critical">
          <LogOut className="mr-2 h-4 w-4" /> {t('auth.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
