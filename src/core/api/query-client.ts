import { QueryClient } from '@tanstack/react-query';

/**
 * The single app-wide TanStack Query client. Lives in its own (component-free)
 * module so non-React modules that run outside the component tree — e.g.
 * `core/realtime/platform-hub.ts`, which invalidates queries on SignalR pushes —
 * can import the exact client instance the `QueryClientProvider` hands to hooks,
 * without importing a React component file (which `react-refresh` forbids
 * exporting non-components from).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
