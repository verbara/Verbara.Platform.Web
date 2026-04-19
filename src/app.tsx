import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { router } from './router';
import { ApiQueryProvider } from '@/core/api/query-provider';
import { Toaster } from '@/core/ui/sonner';
import { useAuthStore } from '@/core/auth/auth-store';
import { startPlatformHub, stopPlatformHub } from '@/core/realtime';

function useRealtimeBootstrap() {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) {
      stopPlatformHub().catch(() => undefined);
      return;
    }
    startPlatformHub().catch(() => undefined);
    return () => {
      stopPlatformHub().catch(() => undefined);
    };
  }, [accessToken]);
}

export function App() {
  useRealtimeBootstrap();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ApiQueryProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </ApiQueryProvider>
    </ThemeProvider>
  );
}
