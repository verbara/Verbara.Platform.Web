import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppShell } from '@/shell/app-shell';
import { AuthGuard } from '@/core/auth/auth-guard';
import { LoginPage } from '@/core/auth/login-page';
import { RoleGuard } from '@/core/auth/role-guard';
import UnauthorizedPage from '@/pages/unauthorized';

const AdminLayout = lazy(() => import('@/pages/admin/admin-layout'));
const UsersPage = lazy(() => import('@/admin/users/users-page'));
const UserDetailPage = lazy(() => import('@/admin/users/user-detail'));
const AgentsPage = lazy(() => import('@/admin/agents/agents-page'));
const AgentDetailPage = lazy(() => import('@/admin/agents/agent-detail'));
const TeamsPage = lazy(() => import('@/admin/agents/teams-page'));
const QueuesPage = lazy(() => import('@/admin/queues/queues-page'));
const QueueDetailPage = lazy(() => import('@/admin/queues/queue-detail'));
const ChannelsPage = lazy(() => import('@/admin/channels/channels-page'));
const FlowListPage = lazy(() => import('@/admin/flows/flow-list-page'));
const FlowDesigner = lazy(() => import('@/admin/flows/flow-designer'));
const CampaignListPage = lazy(() => import('@/admin/campaigns/campaign-list-page'));
const CampaignWizard = lazy(() => import('@/admin/campaigns/campaign-wizard'));
const CampaignDetailPage = lazy(() => import('@/admin/campaigns/campaign-detail-page'));
const DncListsPage = lazy(() => import('@/admin/dnc-lists/dnc-lists-page'));
const DncListDetail = lazy(() => import('@/admin/dnc-lists/dnc-list-detail'));
const CallerIdPoolsPage = lazy(() => import('@/admin/caller-id-pools/caller-id-pools-page'));
const CallerIdPoolDetailPage = lazy(() => import('@/admin/caller-id-pools/caller-id-pool-detail'));
const HolidayCalendarsPage = lazy(() => import('@/admin/holiday-calendars/holiday-calendars-page'));
const HolidayCalendarDetailPage = lazy(() => import('@/admin/holiday-calendars/holiday-calendar-detail'));
const TrunksPage = lazy(() => import('@/admin/trunks/trunks-page'));
const RoutesPage = lazy(() => import('@/admin/routes/routes-page'));
const DialerSettingsPage = lazy(() => import('@/admin/dialer-settings/dialer-settings-page'));
const BotListPage = lazy(() => import('@/admin/bots/bot-list-page'));
const KbListPage = lazy(() => import('@/admin/knowledge-base/kb-list-page'));
const SkillsPage = lazy(() => import('@/admin/skills/skills-page'));
const AgentAssistConfigPage = lazy(() => import('@/admin/agent-assist/agent-assist-config-page'));
const SetupWizard = lazy(() => import('@/admin/setup/setup-wizard'));
const SystemPage = lazy(() => import('@/admin/system/system-page'));
const OperationsLayout = lazy(() => import('@/pages/operations/operations-layout'));
const WallboardPage = lazy(() => import('@/operations/wallboard/wallboard-page'));
const AgentStatesPage = lazy(() => import('@/operations/agent-states/agent-states-page'));
const CampaignMonitorPage = lazy(() => import('@/operations/campaign-monitor/campaign-monitor-page'));
const MonitorPage = lazy(() => import('@/operations/monitor/monitor-page'));
const AnalyticsLayout = lazy(() => import('@/pages/analytics/analytics-layout'));
const DashboardPage = lazy(() => import('@/analytics/dashboard/dashboard-page'));
const CdrPage = lazy(() => import('@/analytics/cdr/cdr-page'));
const QaPage = lazy(() => import('@/analytics/qa/qa-page'));
const AgentLayout = lazy(() => import('@/pages/agent/agent-layout'));
const ConversationView = lazy(() => import('@/pages/agent/conversation-view'));

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
  { path: '/unauthorized', element: <UnauthorizedPage /> },
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
          <RoleGuard allowedRoles={['admin', 'supervisor']}>
            <LazyLoad>
              <AdminLayout />
            </LazyLoad>
          </RoleGuard>
        ),
        children: [
          {
            path: 'setup',
            element: (
              <LazyLoad>
                <SetupWizard />
              </LazyLoad>
            ),
          },
          { index: true, element: <Navigate to="users" replace /> },
          {
            path: 'users',
            element: (
              <RoleGuard allowedRoles={['admin']}>
                <LazyLoad>
                  <UsersPage />
                </LazyLoad>
              </RoleGuard>
            ),
          },
          {
            path: 'users/:userId',
            element: (
              <RoleGuard allowedRoles={['admin']}>
                <LazyLoad>
                  <UserDetailPage />
                </LazyLoad>
              </RoleGuard>
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
          {
            path: 'flows',
            element: (
              <RoleGuard allowedRoles={['admin']}>
                <LazyLoad>
                  <FlowListPage />
                </LazyLoad>
              </RoleGuard>
            ),
          },
          {
            path: 'flows/:flowId',
            element: (
              <RoleGuard allowedRoles={['admin']}>
                <LazyLoad>
                  <FlowDesigner />
                </LazyLoad>
              </RoleGuard>
            ),
          },
          {
            path: 'campaigns',
            element: (
              <RoleGuard allowedRoles={['admin']}>
                <LazyLoad>
                  <CampaignListPage />
                </LazyLoad>
              </RoleGuard>
            ),
          },
          {
            path: 'campaigns/new',
            element: (
              <RoleGuard allowedRoles={['admin']}>
                <LazyLoad>
                  <CampaignWizard />
                </LazyLoad>
              </RoleGuard>
            ),
          },
          {
            path: 'campaigns/:campaignId',
            element: (
              <RoleGuard allowedRoles={['admin']}>
                <LazyLoad>
                  <CampaignDetailPage />
                </LazyLoad>
              </RoleGuard>
            ),
          },
          {
            path: 'dnc-lists',
            element: (
              <LazyLoad>
                <DncListsPage />
              </LazyLoad>
            ),
          },
          {
            path: 'dnc-lists/:listId',
            element: (
              <LazyLoad>
                <DncListDetail />
              </LazyLoad>
            ),
          },
          {
            path: 'caller-id-pools',
            element: (
              <LazyLoad>
                <CallerIdPoolsPage />
              </LazyLoad>
            ),
          },
          {
            path: 'caller-id-pools/:poolId',
            element: (
              <LazyLoad>
                <CallerIdPoolDetailPage />
              </LazyLoad>
            ),
          },
          {
            path: 'holiday-calendars',
            element: (
              <LazyLoad>
                <HolidayCalendarsPage />
              </LazyLoad>
            ),
          },
          {
            path: 'holiday-calendars/:calendarId',
            element: (
              <LazyLoad>
                <HolidayCalendarDetailPage />
              </LazyLoad>
            ),
          },
          {
            path: 'dialer-settings',
            element: (
              <LazyLoad>
                <DialerSettingsPage />
              </LazyLoad>
            ),
          },
          {
            path: 'trunks',
            element: (
              <LazyLoad>
                <TrunksPage />
              </LazyLoad>
            ),
          },
          {
            path: 'routes',
            element: (
              <LazyLoad>
                <RoutesPage />
              </LazyLoad>
            ),
          },
          {
            path: 'channels',
            element: (
              <RoleGuard allowedRoles={['admin']}>
                <LazyLoad>
                  <ChannelsPage />
                </LazyLoad>
              </RoleGuard>
            ),
          },
          {
            path: 'knowledge-base',
            element: (
              <RoleGuard allowedRoles={['admin']}>
                <LazyLoad>
                  <KbListPage />
                </LazyLoad>
              </RoleGuard>
            ),
          },
          {
            path: 'skills',
            element: (
              <RoleGuard allowedRoles={['admin']}>
                <LazyLoad>
                  <SkillsPage />
                </LazyLoad>
              </RoleGuard>
            ),
          },
          {
            path: 'bots',
            element: (
              <RoleGuard allowedRoles={['admin']}>
                <LazyLoad>
                  <BotListPage />
                </LazyLoad>
              </RoleGuard>
            ),
          },
          {
            path: 'agent-assist',
            element: (
              <RoleGuard allowedRoles={['admin']}>
                <LazyLoad>
                  <AgentAssistConfigPage />
                </LazyLoad>
              </RoleGuard>
            ),
          },
          {
            path: 'system',
            element: (
              <LazyLoad>
                <SystemPage />
              </LazyLoad>
            ),
          },
        ],
      },
      {
        path: 'operations',
        element: (
          <RoleGuard allowedRoles={['admin', 'supervisor']}>
            <LazyLoad>
              <OperationsLayout />
            </LazyLoad>
          </RoleGuard>
        ),
        children: [
          { index: true, element: <Navigate to="wallboard" replace /> },
          {
            path: 'wallboard',
            element: (
              <LazyLoad>
                <WallboardPage />
              </LazyLoad>
            ),
          },
          {
            path: 'monitor',
            element: (
              <RoleGuard allowedRoles={['admin', 'supervisor']}>
                <LazyLoad>
                  <MonitorPage />
                </LazyLoad>
              </RoleGuard>
            ),
          },
          {
            path: 'agents',
            element: (
              <LazyLoad>
                <AgentStatesPage />
              </LazyLoad>
            ),
          },
          {
            path: 'campaigns',
            element: (
              <LazyLoad>
                <CampaignMonitorPage />
              </LazyLoad>
            ),
          },
        ],
      },
      {
        path: 'analytics',
        element: (
          <RoleGuard allowedRoles={['admin', 'supervisor']}>
            <LazyLoad>
              <AnalyticsLayout />
            </LazyLoad>
          </RoleGuard>
        ),
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          {
            path: 'dashboard',
            element: (
              <LazyLoad>
                <DashboardPage />
              </LazyLoad>
            ),
          },
          {
            path: 'cdr',
            element: (
              <LazyLoad>
                <CdrPage />
              </LazyLoad>
            ),
          },
          {
            path: 'qa',
            element: (
              <LazyLoad>
                <QaPage />
              </LazyLoad>
            ),
          },
        ],
      },
      {
        path: 'agent',
        element: (
          <RoleGuard allowedRoles={['agent', 'admin', 'supervisor']}>
            <LazyLoad>
              <AgentLayout />
            </LazyLoad>
          </RoleGuard>
        ),
        children: [
          {
            index: true,
            element: (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-slate-400">Select a conversation to begin.</p>
              </div>
            ),
          },
          {
            path: 'conversation/:id',
            element: (
              <LazyLoad>
                <ConversationView />
              </LazyLoad>
            ),
          },
        ],
      },
    ],
  },
]);
