import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppShell } from '@/shell/app-shell';
import { AuthGuard } from '@/core/auth/auth-guard';
import { LoginPage } from '@/core/auth/login-page';
import { ForgotPasswordPage } from '@/core/auth/forgot-password-page';
import { ResetPasswordPage } from '@/core/auth/reset-password-page';
import { PermissionGuard } from '@/core/auth/permission-guard';
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
const SurveyListPage = lazy(() => import('@/admin/surveys/survey-list-page'));
const ReportsPage = lazy(() => import('@/admin/reports/reports-page'));
const SetupWizard = lazy(() => import('@/admin/setup/setup-wizard'));
const SystemPage = lazy(() => import('@/admin/system/system-page'));
const RealtimePage = lazy(() => import('@/admin/realtime/realtime-page'));
const AuditPage = lazy(() => import('@/admin/audit/audit-page'));
const TenantsPage = lazy(() => import('@/admin/tenants/tenants-page'));
const RolesPage = lazy(() => import('@/admin/roles/roles-page'));
const RoleDetailPage = lazy(() => import('@/admin/roles/role-detail-page'));
const SecurityPage = lazy(() => import('@/admin/profile/security-page'));
const AuthConfigPage = lazy(() => import('@/admin/system/auth-config-page'));
const AuthEventsPage = lazy(() => import('@/admin/system/auth-events-page'));
const AuthSessionsPage = lazy(() => import('@/admin/system/auth-sessions-page'));
const OperationsLayout = lazy(() => import('@/pages/operations/operations-layout'));
const WallboardPage = lazy(() => import('@/operations/wallboard/wallboard-page'));
const AgentStatesPage = lazy(() => import('@/operations/agent-states/agent-states-page'));
const CampaignMonitorPage = lazy(() => import('@/operations/campaign-monitor/campaign-monitor-page'));
const MonitorPage = lazy(() => import('@/operations/monitor/monitor-page'));
const AnalyticsLayout = lazy(() => import('@/pages/analytics/analytics-layout'));
const DashboardPage = lazy(() => import('@/analytics/dashboard/dashboard-page'));
const CdrPage = lazy(() => import('@/analytics/cdr/cdr-page'));
const QaPage = lazy(() => import('@/analytics/qa/qa-page'));
const SurveyResultsPage = lazy(() => import('@/analytics/surveys/survey-results-page'));
const IntervalPage = lazy(() => import('@/analytics/intervals/interval-page'));
const AgentIntervalsPage = lazy(() => import('@/analytics/agents/agent-intervals-page'));
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
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
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
          <PermissionGuard
            requiresAny={[
              'users:user:view',
              'queues:queue:view',
              'campaigns:campaign:view',
              'routing:flow:view',
              'system:tenant:configure',
            ]}
            redirect
          >
            <LazyLoad>
              <AdminLayout />
            </LazyLoad>
          </PermissionGuard>
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
              <PermissionGuard requires="users:user:view" redirect>
                <LazyLoad>
                  <UsersPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'users/:userId',
            element: (
              <PermissionGuard requires="users:user:view" redirect>
                <LazyLoad>
                  <UserDetailPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'agents',
            element: (
              <PermissionGuard requiresAny={['users:user:view', 'queues:member:assign']} redirect>
                <LazyLoad>
                  <AgentsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'agents/:agentId',
            element: (
              <PermissionGuard requiresAny={['users:user:view', 'queues:member:assign']} redirect>
                <LazyLoad>
                  <AgentDetailPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'teams',
            element: (
              <PermissionGuard requiresAny={['users:user:view', 'queues:member:assign']} redirect>
                <LazyLoad>
                  <TeamsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'queues',
            element: (
              <PermissionGuard requires="queues:queue:view" redirect>
                <LazyLoad>
                  <QueuesPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'queues/:queueId',
            element: (
              <PermissionGuard requires="queues:queue:view" redirect>
                <LazyLoad>
                  <QueueDetailPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'flows',
            element: (
              <PermissionGuard requires="routing:flow:view" redirect>
                <LazyLoad>
                  <FlowListPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'flows/:flowId',
            element: (
              <PermissionGuard requires="routing:flow:view" redirect>
                <LazyLoad>
                  <FlowDesigner />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'campaigns',
            element: (
              <PermissionGuard requires="campaigns:campaign:view" redirect>
                <LazyLoad>
                  <CampaignListPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'campaigns/new',
            element: (
              <PermissionGuard requires="campaigns:campaign:view" redirect>
                <LazyLoad>
                  <CampaignWizard />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'campaigns/:campaignId',
            element: (
              <PermissionGuard requires="campaigns:campaign:view" redirect>
                <LazyLoad>
                  <CampaignDetailPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'dnc-lists',
            element: (
              <PermissionGuard requires="campaigns:campaign:view" redirect>
                <LazyLoad>
                  <DncListsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'dnc-lists/:listId',
            element: (
              <PermissionGuard requires="campaigns:campaign:view" redirect>
                <LazyLoad>
                  <DncListDetail />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'caller-id-pools',
            element: (
              <PermissionGuard requires="campaigns:campaign:view" redirect>
                <LazyLoad>
                  <CallerIdPoolsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'caller-id-pools/:poolId',
            element: (
              <PermissionGuard requires="campaigns:campaign:view" redirect>
                <LazyLoad>
                  <CallerIdPoolDetailPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'holiday-calendars',
            element: (
              <PermissionGuard requires="campaigns:campaign:view" redirect>
                <LazyLoad>
                  <HolidayCalendarsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'holiday-calendars/:calendarId',
            element: (
              <PermissionGuard requires="campaigns:campaign:view" redirect>
                <LazyLoad>
                  <HolidayCalendarDetailPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'dialer-settings',
            element: (
              <PermissionGuard requires="campaigns:dialer:configure" redirect>
                <LazyLoad>
                  <DialerSettingsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'trunks',
            element: (
              <PermissionGuard requires="system:integration:manage" redirect>
                <LazyLoad>
                  <TrunksPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'routes',
            element: (
              <PermissionGuard requires="system:integration:manage" redirect>
                <LazyLoad>
                  <RoutesPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'channels',
            element: (
              <PermissionGuard requires="system:integration:manage" redirect>
                <LazyLoad>
                  <ChannelsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'knowledge-base',
            element: (
              <PermissionGuard requires="system:integration:manage" redirect>
                <LazyLoad>
                  <KbListPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'skills',
            element: (
              <PermissionGuard requires="routing:skill:view" redirect>
                <LazyLoad>
                  <SkillsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'bots',
            element: (
              <PermissionGuard requires="system:integration:manage" redirect>
                <LazyLoad>
                  <BotListPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'agent-assist',
            element: (
              <PermissionGuard requires="agentassist:config:manage" redirect>
                <LazyLoad>
                  <AgentAssistConfigPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'system',
            element: (
              <PermissionGuard requires="system:integration:manage" redirect>
                <LazyLoad>
                  <SystemPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'tenants',
            element: (
              <PermissionGuard requires="system:tenant:configure" redirect>
                <LazyLoad>
                  <TenantsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'realtime',
            element: (
              <PermissionGuard requires="system:integration:manage" redirect>
                <LazyLoad>
                  <RealtimePage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'audit',
            element: (
              <PermissionGuard requires="system:audit:view" redirect>
                <LazyLoad>
                  <AuditPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'surveys',
            element: (
              <PermissionGuard requires="system:integration:manage" redirect>
                <LazyLoad>
                  <SurveyListPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'reports',
            element: (
              <PermissionGuard requires="reporting:dashboard:edit" redirect>
                <LazyLoad>
                  <ReportsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'roles',
            element: (
              <PermissionGuard requires="users:role:assign" redirect>
                <LazyLoad>
                  <RolesPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'roles/:id',
            element: (
              <PermissionGuard requires="users:role:assign" redirect>
                <LazyLoad>
                  <RoleDetailPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'security',
            element: (
              <LazyLoad>
                <SecurityPage />
              </LazyLoad>
            ),
          },
          {
            path: 'auth-config',
            element: (
              <PermissionGuard requires="system:auth:configure" redirect>
                <LazyLoad>
                  <AuthConfigPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'auth-events',
            element: (
              <PermissionGuard requires="system:audit:view" redirect>
                <LazyLoad>
                  <AuthEventsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'auth-sessions',
            element: (
              <PermissionGuard requires="system:auth:configure" redirect>
                <LazyLoad>
                  <AuthSessionsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
        ],
      },
      {
        path: 'operations',
        element: (
          <PermissionGuard
            requiresAny={['reporting:realtime:view', 'contacts:conversation:monitor']}
            redirect
          >
            <LazyLoad>
              <OperationsLayout />
            </LazyLoad>
          </PermissionGuard>
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
              <PermissionGuard requires="contacts:conversation:monitor" redirect>
                <LazyLoad>
                  <MonitorPage />
                </LazyLoad>
              </PermissionGuard>
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
          <PermissionGuard
            requiresAny={['analytics:cdr:view', 'reporting:historical:view']}
            redirect
          >
            <LazyLoad>
              <AnalyticsLayout />
            </LazyLoad>
          </PermissionGuard>
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
          {
            path: 'surveys',
            element: (
              <PermissionGuard requires="reporting:historical:view" redirect>
                <LazyLoad>
                  <SurveyResultsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'intervals',
            element: (
              <PermissionGuard requires="reporting:historical:view" redirect>
                <LazyLoad>
                  <IntervalPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'agent-intervals',
            element: (
              <PermissionGuard requires="reporting:historical:view" redirect>
                <LazyLoad>
                  <AgentIntervalsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
        ],
      },
      {
        path: 'agent',
        element: (
          <PermissionGuard requires="contacts:conversation:handle" redirect>
            <LazyLoad>
              <AgentLayout />
            </LazyLoad>
          </PermissionGuard>
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
