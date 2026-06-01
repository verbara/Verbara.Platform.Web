import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppShell } from '@/shell/app-shell';
import { AuthGuard } from '@/core/auth/auth-guard';
import { LoginPage } from '@/core/auth/login-page';
import { ForgotPasswordPage } from '@/core/auth/forgot-password-page';
import { ResetPasswordPage } from '@/core/auth/reset-password-page';
import { PermissionGuard } from '@/core/auth/permission-guard';
import UnauthorizedPage from '@/pages/unauthorized';
import { RouteErrorBoundary } from '@/core/ui/route-error-boundary';

const AdminLayout = lazy(() => import('@/pages/admin/admin-layout'));
const AdminHomePage = lazy(() => import('@/admin/admin-home-page'));
const UsersPage = lazy(() => import('@/admin/users/users-page'));
const UserDetailPage = lazy(() => import('@/admin/users/user-detail'));
const AgentsPage = lazy(() => import('@/admin/agents/agents-page'));
const AgentDetailPage = lazy(() => import('@/admin/agents/agent-detail'));
const AgentQueuesPage = lazy(() => import('@/admin/agents/agent-queues'));
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
const HolidayCalendarDetailPage = lazy(
  () => import('@/admin/holiday-calendars/holiday-calendar-detail'),
);
const TrunksPage = lazy(() => import('@/admin/trunks/trunks-page'));
const TrunkWizard = lazy(() => import('@/admin/trunks/trunk-wizard'));
const RoutesPage = lazy(() => import('@/admin/routes/routes-page'));
const DidRoutesPage = lazy(() => import('@/admin/did-routes/did-routes-page'));
const DialerSettingsPage = lazy(() => import('@/admin/dialer-settings/dialer-settings-page'));
const BotListPage = lazy(() => import('@/admin/bots/bot-list-page'));
const KbListPage = lazy(() => import('@/admin/knowledge-base/kb-list-page'));
const SkillsPage = lazy(() => import('@/admin/skills/skills-page'));
const AgentAssistConfigPage = lazy(() => import('@/admin/agent-assist/agent-assist-config-page'));
const AgentAssistFeaturePage = lazy(() => import('@/admin/features/agent-assist-page'));
const SurveyListPage = lazy(() => import('@/admin/surveys/survey-list-page'));
const ReportsPage = lazy(() => import('@/admin/reports/reports-page'));
const SetupPage = lazy(() => import('@/core/auth/setup-page'));
const SetupWizard = lazy(() => import('@/admin/setup/setup-wizard'));
const SystemPage = lazy(() => import('@/admin/system/system-page'));
const DiagnosticsPage = lazy(() => import('@/admin/system/diagnostics-page'));
const LicensePage = lazy(() => import('@/admin/license/license-page'));
const ApiKeysPage = lazy(() => import('@/admin/api-keys/api-keys-page'));
const ClusterPage = lazy(() => import('@/admin/cluster/cluster-page'));
const RealtimePage = lazy(() => import('@/admin/realtime/realtime-page'));
const AuditPage = lazy(() => import('@/admin/audit/audit-page'));
const TenantsPage = lazy(() => import('@/admin/tenants/tenants-page'));
const TenantDetailPage = lazy(() => import('@/admin/tenants/tenant-detail-page'));
const RolesPage = lazy(() => import('@/admin/roles/roles-page'));
const RoleDetailPage = lazy(() => import('@/admin/roles/role-detail-page'));
const SecurityPage = lazy(() => import('@/admin/profile/security-page'));
// R5.2 Phase 0 placeholders — implemented by Phase A/B/C subagents.
const MfaAdminPage = lazy(() => import('@/admin/security/mfa/mfa-admin-page'));
const AuditViewerPage = lazy(() => import('@/admin/security/audit/audit-viewer-page'));
const ImpersonationAdminPage = lazy(
  () => import('@/admin/security/impersonation/impersonation-admin-page'),
);
const RetentionAdminPage = lazy(() => import('@/admin/retention/retention-admin-page'));
const MfaEnrollWizard = lazy(() => import('@/profile/security/mfa/mfa-enroll-wizard'));
const UserSessionsPage = lazy(() => import('@/profile/security/sessions/user-sessions-page'));
const RegeneratePage = lazy(() => import('@/profile/security/recovery-codes/regenerate-page'));
const AuthConfigPage = lazy(() => import('@/admin/system/auth-config-page'));
const AuthEventsPage = lazy(() => import('@/admin/system/auth-events-page'));
const AuthSessionsPage = lazy(() => import('@/admin/system/auth-sessions-page'));
const WebhooksPage = lazy(() => import('@/admin/webhooks/webhooks-page'));
const DeadLetterPage = lazy(() => import('@/admin/webhooks/dead-letter-page'));
const NotificationRulesPage = lazy(() => import('@/admin/notifications/rules-page'));
const GdprPage = lazy(() => import('@/admin/gdpr/gdpr-page'));
const PurgeLogPage = lazy(() => import('@/admin/gdpr/purge-log-page'));
const ConsentManagementPage = lazy(() => import('@/admin/compliance/consent-management-page'));
const RateCardsPage = lazy(() => import('@/admin/billing/rate-cards-page'));
const InvoicesPage = lazy(() => import('@/admin/billing/invoices-page'));
const UsagePage = lazy(() => import('@/admin/billing/usage-page'));
const QuotasPage = lazy(() => import('@/admin/billing/quotas-page'));
const CannedResponsesPage = lazy(() => import('@/admin/canned-responses/canned-responses-page'));
const CasesPage = lazy(() => import('@/admin/cases/cases-page'));
const WebChatPage = lazy(() => import('@/admin/webchat/webchat-page'));
const PartnerCustomersPage = lazy(() => import('@/admin/partner/customers-page'));
const PartnerCustomerDetailPage = lazy(() => import('@/admin/partner/customer-detail-page'));
const PartnerRateCardsPage = lazy(() => import('@/admin/partner/partner-rate-cards-page'));
const PartnerRevenuePage = lazy(() => import('@/admin/partner/revenue-page'));
const PartnerSettingsPage = lazy(() => import('@/admin/partner/partner-settings-page'));
const OperationsLayout = lazy(() => import('@/pages/operations/operations-layout'));
const WallboardPage = lazy(() => import('@/operations/wallboard/wallboard-page'));
const AgentStatesPage = lazy(() => import('@/operations/agent-states/agent-states-page'));
const CampaignMonitorPage = lazy(
  () => import('@/operations/campaign-monitor/campaign-monitor-page'),
);
const MonitorPage = lazy(() => import('@/operations/monitor/monitor-page'));
const SseDiagnosticPage = lazy(() => import('@/operations/sse-diagnostic/sse-diagnostic-page'));
const MediaDiagnosticPage = lazy(
  () => import('@/operations/media-diagnostic/media-diagnostic-page'),
);
const AnalyticsLayout = lazy(() => import('@/pages/analytics/analytics-layout'));
const DashboardPage = lazy(() => import('@/analytics/dashboard/dashboard-page'));
const CdrPage = lazy(() => import('@/analytics/cdr/cdr-page'));
const QaPage = lazy(() => import('@/analytics/qa/qa-page'));
const SurveyResultsPage = lazy(() => import('@/analytics/surveys/survey-results-page'));
const IntervalPage = lazy(() => import('@/analytics/intervals/interval-page'));
const AgentIntervalsPage = lazy(() => import('@/analytics/agents/agent-intervals-page'));
const SpeechAnalyticsPage = lazy(
  () => import('@/analytics/speech-analytics/speech-analytics-page'),
);
const RecordingArchivePage = lazy(() => import('@/analytics/recording/recording-archive-page'));
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
    path: '/setup',
    element: (
      <LazyLoad>
        <SetupPage />
      </LazyLoad>
    ),
  },
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
        errorElement: <RouteErrorBoundary />,
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
          {
            index: true,
            element: (
              <LazyLoad>
                <AdminHomePage />
              </LazyLoad>
            ),
          },
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
            // ADR-0026 Phase A.6 — channel-aware membership editor.
            path: 'agents/:agentId/queues',
            element: (
              <PermissionGuard requires="queues:member:assign" redirect>
                <LazyLoad>
                  <AgentQueuesPage />
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
            path: 'trunks/new',
            element: (
              <PermissionGuard requires="system:integration:manage" redirect>
                <LazyLoad>
                  <TrunkWizard />
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
            path: 'did-routes',
            element: (
              <PermissionGuard requires="system:integration:manage" redirect>
                <LazyLoad>
                  <DidRoutesPage />
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
            path: 'features/agent-assist',
            element: (
              <PermissionGuard requires="features:agent-assist:manage" redirect>
                <LazyLoad>
                  <AgentAssistFeaturePage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'system/diagnostics',
            element: (
              <PermissionGuard requires="system:integration:manage" redirect>
                <LazyLoad>
                  <DiagnosticsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'cluster',
            element: (
              <PermissionGuard requires="platform:cluster:manage" redirect>
                <LazyLoad>
                  <ClusterPage />
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
            path: 'license',
            element: (
              <PermissionGuard requires="platform:license:manage" redirect>
                <LazyLoad>
                  <LicensePage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            // Management API keys are PlatformAdmin-only server-side
            // (`PlatformAdminOnly` auth policy). We reuse the existing
            // `platform:tenant:manage` permission — the same gate applied
            // to /admin/tenants — so operators who already administer the
            // host tenant can issue / rotate / revoke keys without a new
            // permission being minted.
            path: 'api-keys',
            element: (
              <PermissionGuard requires="platform:tenant:manage" redirect>
                <LazyLoad>
                  <ApiKeysPage />
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
            // R5.3 Phase B Task B.1 — Tenant settings editor (S4.1).
            // Reuses the same `system:tenant:configure` gate as the list
            // page. The detail page hosts Tabs for General/Operational/
            // Security/Features/Billing/Retention sections; B.5 will wire
            // the canonical RetentionPolicySection into the Retention slot.
            path: 'tenants/:tenantId/settings',
            element: (
              <PermissionGuard requires="system:tenant:configure" redirect>
                <LazyLoad>
                  <TenantDetailPage />
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
            path: 'canned-responses',
            element: (
              <PermissionGuard requires="system:integration:manage" redirect>
                <LazyLoad>
                  <CannedResponsesPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'cases',
            element: (
              <PermissionGuard requires="contacts:contact:view" redirect>
                <LazyLoad>
                  <CasesPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'webchat',
            element: (
              <PermissionGuard requires="system:integration:manage" redirect>
                <LazyLoad>
                  <WebChatPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'partner/customers',
            element: (
              <PermissionGuard requires="partner:customer:view" redirect>
                <LazyLoad>
                  <PartnerCustomersPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'partner/customers/:id',
            element: (
              <PermissionGuard requires="partner:customer:view" redirect>
                <LazyLoad>
                  <PartnerCustomerDetailPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'partner/rate-cards',
            element: (
              <PermissionGuard requires="partner:billing:manage" redirect>
                <LazyLoad>
                  <PartnerRateCardsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'partner/revenue',
            element: (
              <PermissionGuard requires="partner:billing:view" redirect>
                <LazyLoad>
                  <PartnerRevenuePage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'partner/settings',
            element: (
              <PermissionGuard requires="partner:settings:view" redirect>
                <LazyLoad>
                  <PartnerSettingsPage />
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
          // R5.2 Phase 0 placeholders — Phase A/B/C subagents replace
          // these with real components and may tighten the permission gate
          // (auth.read / security.mfa.admin / security.impersonation.manage)
          // once the corresponding Platform permissions land.
          //
          // R5.2 PA.1 (shipped): MFA admin gate tightened from the P0.10
          // fallback (`system:auth:configure`) to the new
          // `security.mfa.admin` permission seeded by P0.9 — matches the
          // backend `/management/mfa/*` policy.
          {
            path: 'security/mfa',
            element: (
              <PermissionGuard requires="security.mfa.admin" redirect>
                <LazyLoad>
                  <MfaAdminPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'security/audit',
            element: (
              <PermissionGuard requires="audit.read" redirect>
                <LazyLoad>
                  <AuditViewerPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'security/impersonation',
            // R5.2 PB.2 — replace P0.10 fallback gate with the seeded
            // dot-notation permission (`security.impersonation.manage`,
            // P0.9 commit f20892e).
            element: (
              <PermissionGuard requires="security.impersonation.manage" redirect>
                <LazyLoad>
                  <ImpersonationAdminPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'retention',
            element: (
              <PermissionGuard requires="retention.read" redirect>
                <LazyLoad>
                  <RetentionAdminPage />
                </LazyLoad>
              </PermissionGuard>
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
          {
            path: 'billing/rate-cards',
            element: (
              <PermissionGuard requires="system:tenant:configure" redirect>
                <LazyLoad>
                  <RateCardsPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'billing/invoices',
            element: (
              <PermissionGuard requires="system:tenant:configure" redirect>
                <LazyLoad>
                  <InvoicesPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'billing/usage',
            element: (
              <PermissionGuard requires="system:tenant:configure" redirect>
                <LazyLoad>
                  <UsagePage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'billing/quotas',
            element: (
              <PermissionGuard requires="system:tenant:configure" redirect>
                <LazyLoad>
                  <QuotasPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'webhooks',
            element: (
              <PermissionGuard requires="system:integration:manage" redirect>
                <LazyLoad>
                  <WebhooksPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'webhooks/dead-letter',
            element: (
              <PermissionGuard requires="system:tenant:configure" redirect>
                <LazyLoad>
                  <DeadLetterPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'notifications/rules',
            element: (
              <PermissionGuard requires="notifications:rule:configure" redirect>
                <LazyLoad>
                  <NotificationRulesPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'gdpr',
            element: (
              <PermissionGuard requires="system:tenant:configure" redirect>
                <LazyLoad>
                  <GdprPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'purge-log',
            element: (
              <PermissionGuard requires="system:tenant:configure" redirect>
                <LazyLoad>
                  <PurgeLogPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'consent',
            element: (
              <PermissionGuard requires="system:tenant:configure" redirect>
                <LazyLoad>
                  <ConsentManagementPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
        ],
      },
      {
        path: 'operations',
        errorElement: <RouteErrorBoundary />,
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
          {
            path: 'sse-diagnostic',
            element: (
              <PermissionGuard requires="reporting:realtime:view" redirect>
                <LazyLoad>
                  <SseDiagnosticPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
          {
            path: 'media-diagnostic',
            element: (
              <PermissionGuard requires="reporting:realtime:view" redirect>
                <LazyLoad>
                  <MediaDiagnosticPage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
        ],
      },
      {
        path: 'analytics',
        errorElement: <RouteErrorBoundary />,
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
          {
            path: 'speech',
            element: (
              <LazyLoad>
                <SpeechAnalyticsPage />
              </LazyLoad>
            ),
          },
          {
            path: 'recordings',
            element: (
              <PermissionGuard requires="analytics:cdr:view" redirect>
                <LazyLoad>
                  <RecordingArchivePage />
                </LazyLoad>
              </PermissionGuard>
            ),
          },
        ],
      },
      // R5.2 Phase 0 — `/profile/security/*` placeholders. AppShell wraps
      // them with the standard AuthGuard, so they require an authenticated
      // session but no extra permission. Phase A/B/C subagents replace
      // each with the real component.
      {
        path: 'profile/security/mfa/enroll',
        errorElement: <RouteErrorBoundary />,
        element: (
          <LazyLoad>
            <MfaEnrollWizard />
          </LazyLoad>
        ),
      },
      {
        path: 'profile/security/sessions',
        errorElement: <RouteErrorBoundary />,
        element: (
          <LazyLoad>
            <UserSessionsPage />
          </LazyLoad>
        ),
      },
      {
        path: 'profile/security/recovery-codes/regenerate',
        errorElement: <RouteErrorBoundary />,
        element: (
          <LazyLoad>
            <RegeneratePage />
          </LazyLoad>
        ),
      },
      {
        path: 'agent',
        errorElement: <RouteErrorBoundary />,
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
