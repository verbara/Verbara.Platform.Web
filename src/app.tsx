import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { router } from './router';
import { ApiQueryProvider } from '@/core/api/query-provider';
import { Toaster } from '@/core/ui/sonner';
import { useAuthStore } from '@/core/auth/auth-store';
import { useHtmlLang } from '@/core/i18n/use-html-lang';
import { PaymentRequiredDialogHost } from '@/core/licensing';
import { startPlatformHub, stopPlatformHub } from '@/core/realtime';

function useRealtimeBootstrap() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const signalREnabled = useAuthStore((s) => s.features?.realtimePushSignalR === true);

  useEffect(() => {
    if (!accessToken || !signalREnabled) {
      stopPlatformHub().catch(() => undefined);
      return;
    }
    startPlatformHub().catch(() => undefined);
    return () => {
      stopPlatformHub().catch(() => undefined);
    };
  }, [accessToken, signalREnabled]);
}

export function App() {
  useRealtimeBootstrap();
  useHtmlLang();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ApiQueryProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
        <PaymentRequiredDialogHost />
      </ApiQueryProvider>
    </ThemeProvider>
  );
}
