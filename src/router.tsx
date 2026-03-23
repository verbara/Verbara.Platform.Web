import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppShell } from '@/shell/app-shell';
import { AuthGuard } from '@/core/auth/auth-guard';
import { LoginPage } from '@/core/auth/login-page';

const AdminLayout = lazy(() => import('@/pages/admin/admin-layout'));
const UsersPage = lazy(() => import('@/admin/users/users-page'));
const UserDetailPage = lazy(() => import('@/admin/users/user-detail'));
const AgentsPage = lazy(() => import('@/admin/agents/agents-page'));
const AgentDetailPage = lazy(() => import('@/admin/agents/agent-detail'));
const TeamsPage = lazy(() => import('@/admin/agents/teams-page'));
const QueuesPage = lazy(() => import('@/admin/queues/queues-page'));
const QueueDetailPage = lazy(() => import('@/admin/queues/queue-detail'));
const OperationsLayout = lazy(() => import('@/pages/operations/operations-layout'));
const AnalyticsLayout = lazy(() => import('@/pages/analytics/analytics-layout'));
const AgentLayout = lazy(() => import('@/pages/agent/agent-layout'));

function LazyLoad({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-slate-400">Loading...</div>
      }
    >
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/admin" replace /> },
      {
        path: 'admin',
        element: (
          <LazyLoad>
            <AdminLayout />
          </LazyLoad>
        ),
        children: [
          { index: true, element: <Navigate to="users" replace /> },
          {
            path: 'users',
            element: (
              <LazyLoad>
                <UsersPage />
              </LazyLoad>
            ),
          },
          {
            path: 'users/:userId',
            element: (
              <LazyLoad>
                <UserDetailPage />
              </LazyLoad>
            ),
          },
          {
            path: 'agents',
            element: (
              <LazyLoad>
                <AgentsPage />
              </LazyLoad>
            ),
          },
          {
            path: 'agents/:agentId',
            element: (
              <LazyLoad>
                <AgentDetailPage />
              </LazyLoad>
            ),
          },
          {
            path: 'teams',
            element: (
              <LazyLoad>
                <TeamsPage />
              </LazyLoad>
            ),
          },
          {
            path: 'queues',
            element: (
              <LazyLoad>
                <QueuesPage />
              </LazyLoad>
            ),
          },
          {
            path: 'queues/:queueId',
            element: (
              <LazyLoad>
                <QueueDetailPage />
              </LazyLoad>
            ),
          },
        ],
      },
      {
        path: 'operations/*',
        element: (
          <LazyLoad>
            <OperationsLayout />
          </LazyLoad>
        ),
      },
      {
        path: 'analytics/*',
        element: (
          <LazyLoad>
            <AnalyticsLayout />
          </LazyLoad>
        ),
      },
      {
        path: 'agent/*',
        element: (
          <LazyLoad>
            <AgentLayout />
          </LazyLoad>
        ),
      },
    ],
  },
]);
