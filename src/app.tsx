import { Suspense, useEffect } from 'react';
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
        {/*
          Top-level Suspense boundary so react-i18next (configured with
          useSuspense: true) can suspend on the first paint while
          i18next-http-backend fetches /locales/{lng}/{ns}.json. Without
          this boundary the thrown Promise bubbles to the root ErrorBoundary
          which silently falls back, rendering raw translation keys
          (auth.email, app.name, etc.) instead of localized strings —
          the visible bug fixed in v3.1.1-web.

          Non-i18n Suspense fallbacks (lazy-loaded admin/agent pages) keep
          their inner LazyLoad wrappers per router.tsx.
        */}
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center text-slate-400 dark:text-slate-600">
              Loading...
            </div>
          }
        >
          <RouterProvider router={router} />
        </Suspense>
        <Toaster richColors position="top-right" />
        <PaymentRequiredDialogHost />
      </ApiQueryProvider>
    </ThemeProvider>
  );
}
