import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { router } from './router';
import { ApiQueryProvider } from '@/core/api/query-provider';
import { Toaster } from '@/core/ui/sonner';

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ApiQueryProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </ApiQueryProvider>
    </ThemeProvider>
  );
}
