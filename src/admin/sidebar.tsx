import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/core/auth/auth-store';
import {
  Users,
  Headset,
  Radio,
  ListChecks,
  Workflow,
  Megaphone,
  Cable,
  Route,
  Phone,
  ShieldBan,
  ShieldCheck,
  CalendarOff,
  Server,
  MessageCircle,
  Webhook,
  TriangleAlert,
  SlidersHorizontal,
  ChevronDown,
  Bot,
  BookOpen,
  Briefcase,
  Zap,
  FileSearch,
  ClipboardList,
  Calendar,
  Building2,
  Shield,
  KeyRound,
  Activity,
  Monitor,
  MessageSquareText,
  CreditCard,
  Receipt,
  ChartColumn,
  Gauge,
  Network,
  UsersRound,
  TrendingUp,
  Handshake,
  ShieldAlert,
  UserCog,
  Database,
  BellRing,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SidebarItem {
  key: string;
  labelKey: string;
  to: string;
  icon: LucideIcon;
  /** Permission required to see this item */
  requiredPermission?: string;
  /** Any of these permissions required */
  requiredAnyPermission?: string[];
}

interface SidebarGroup {
  key: string;
  labelKey: string;
  items: SidebarItem[];
  /** Permission required to see this entire group */
  requiredPermission?: string;
  /** Any of these permissions required */
  requiredAnyPermission?: string[];
}

const groups: SidebarGroup[] = [
  {
    key: 'people',
    labelKey: 'admin:sidebar.people',
    items: [
      {
        key: 'users',
        labelKey: 'admin:sidebar.users',
        to: '/admin/users',
        icon: Users,
        requiredPermission: 'users:user:view',
      },
      {
        key: 'agents',
        labelKey: 'admin:sidebar.agents',
        to: '/admin/agents',
        icon: Headset,
        requiredAnyPermission: ['users:user:view', 'queues:member:assign'],
      },
      {
        key: 'teams',
        labelKey: 'admin:sidebar.teams',
        to: '/admin/teams',
        icon: UsersRound,
        requiredPermission: 'users:user:view',
      },
      {
        key: 'roles',
        labelKey: 'admin:sidebar.roles',
        to: '/admin/roles',
        icon: Shield,
        requiredPermission: 'users:role:assign',
      },
    ],
  },
  {
    key: 'communication',
    labelKey: 'admin:sidebar.communication',
    items: [
      {
        key: 'channels',
        labelKey: 'admin:sidebar.channels',
        to: '/admin/channels',
        icon: Radio,
        requiredPermission: 'system:integration:manage',
      },
      {
        key: 'webchat',
        labelKey: 'admin:sidebar.webchat',
        to: '/admin/webchat',
        icon: MessageCircle,
        requiredPermission: 'system:integration:manage',
      },
      {
        key: 'queues',
        labelKey: 'admin:sidebar.queues',
        to: '/admin/queues',
        icon: ListChecks,
        requiredPermission: 'queues:queue:view',
      },
      {
        key: 'skills',
        labelKey: 'admin:sidebar.skills',
        to: '/admin/skills',
        icon: Zap,
        requiredPermission: 'routing:skill:view',
      },
      {
        key: 'flows',
        labelKey: 'admin:sidebar.flows',
        to: '/admin/flows',
        icon: Workflow,
        requiredPermission: 'routing:flow:view',
      },
      {
        key: 'campaigns',
        labelKey: 'admin:sidebar.campaigns',
        to: '/admin/campaigns',
        icon: Megaphone,
        requiredPermission: 'campaigns:campaign:view',
      },
      {
        key: 'surveys',
        labelKey: 'admin:sidebar.surveys',
        to: '/admin/surveys',
        icon: ClipboardList,
        requiredPermission: 'system:integration:manage',
      },
      {
        key: 'canned-responses',
        labelKey: 'admin:sidebar.cannedResponses',
        to: '/admin/canned-responses',
        icon: MessageSquareText,
        requiredPermission: 'system:integration:manage',
      },
      {
        key: 'cases',
        labelKey: 'admin:sidebar.cases',
        to: '/admin/cases',
        icon: Briefcase,
        requiredPermission: 'contacts:contact:view',
      },
    ],
  },
  {
    key: 'telephony',
    labelKey: 'admin:sidebar.telephony',
    items: [
      {
        key: 'trunks',
        labelKey: 'admin:sidebar.trunks',
        to: '/admin/trunks',
        icon: Cable,
        requiredPermission: 'system:integration:manage',
      },
      {
        key: 'routes',
        labelKey: 'admin:sidebar.routes',
        to: '/admin/routes',
        icon: Route,
        requiredPermission: 'system:integration:manage',
      },
      {
        key: 'caller-id-pools',
        labelKey: 'admin:sidebar.callerIdPools',
        to: '/admin/caller-id-pools',
        icon: Phone,
        requiredPermission: 'campaigns:campaign:view',
      },
    ],
  },
  {
    key: 'compliance',
    labelKey: 'admin:sidebar.compliance',
    items: [
      {
        key: 'dnc-lists',
        labelKey: 'admin:sidebar.dncLists',
        to: '/admin/dnc-lists',
        icon: ShieldBan,
        requiredPermission: 'campaigns:campaign:view',
      },
      {
        key: 'holiday-calendars',
        labelKey: 'admin:sidebar.holidayCalendars',
        to: '/admin/holiday-calendars',
        icon: CalendarOff,
        requiredPermission: 'campaigns:campaign:view',
      },
      {
        key: 'gdpr',
        labelKey: 'admin:sidebar.gdpr',
        to: '/admin/gdpr',
        icon: ShieldCheck,
        requiredPermission: 'system:tenant:configure',
      },
      {
        key: 'purge-log',
        labelKey: 'admin:sidebar.purgeLog',
        to: '/admin/purge-log',
        icon: FileSearch,
        requiredPermission: 'system:tenant:configure',
      },
      {
        key: 'consent',
        labelKey: 'admin:sidebar.consent',
        to: '/admin/consent',
        icon: ShieldCheck,
        requiredPermission: 'system:tenant:configure',
      },
    ],
  },
  {
    key: 'integrations',
    labelKey: 'admin:sidebar.integrations',
    requiredPermission: 'system:integration:manage',
    items: [
      {
        key: 'webhooks',
        labelKey: 'admin:sidebar.webhooks',
        to: '/admin/webhooks',
        icon: Webhook,
        requiredPermission: 'system:integration:manage',
      },
      {
        key: 'dead-letter',
        labelKey: 'admin:sidebar.deadLetter',
        to: '/admin/webhooks/dead-letter',
        icon: TriangleAlert,
        requiredPermission: 'system:tenant:configure',
      },
    ],
  },
  {
    key: 'notifications',
    labelKey: 'admin:sidebar.notifications',
    requiredPermission: 'notifications:rule:configure',
    items: [
      {
        key: 'notification-rules',
        labelKey: 'admin:sidebar.notificationRules',
        to: '/admin/notifications/rules',
        icon: BellRing,
        requiredPermission: 'notifications:rule:configure',
      },
    ],
  },
  {
    key: 'billing',
    labelKey: 'admin:sidebar.billing',
    requiredPermission: 'system:tenant:configure',
    items: [
      {
        key: 'rate-cards',
        labelKey: 'admin:sidebar.rateCards',
        to: '/admin/billing/rate-cards',
        icon: CreditCard,
        requiredPermission: 'system:tenant:configure',
      },
      {
        key: 'invoices',
        labelKey: 'admin:sidebar.invoices',
        to: '/admin/billing/invoices',
        icon: Receipt,
        requiredPermission: 'system:tenant:configure',
      },
      {
        key: 'usage',
        labelKey: 'admin:sidebar.usage',
        to: '/admin/billing/usage',
        icon: ChartColumn,
        requiredPermission: 'system:tenant:configure',
      },
      {
        key: 'quotas',
        labelKey: 'admin:sidebar.quotas',
        to: '/admin/billing/quotas',
        icon: Gauge,
        requiredPermission: 'system:tenant:configure',
      },
    ],
  },
  {
    key: 'partner-portal',
    labelKey: 'admin:sidebar.partnerPortal',
    requiredPermission: 'partner:customer:view',
    items: [
      {
        key: 'partner-customers',
        labelKey: 'admin:sidebar.partnerCustomers',
        to: '/admin/partner/customers',
        icon: Handshake,
        requiredPermission: 'partner:customer:view',
      },
      {
        key: 'partner-rate-cards',
        labelKey: 'admin:sidebar.partnerRateCards',
        to: '/admin/partner/rate-cards',
        icon: CreditCard,
        requiredPermission: 'partner:billing:manage',
      },
      {
        key: 'partner-revenue',
        labelKey: 'admin:sidebar.partnerRevenue',
        to: '/admin/partner/revenue',
        icon: TrendingUp,
        requiredPermission: 'partner:billing:view',
      },
      {
        key: 'partner-settings',
        labelKey: 'admin:sidebar.partnerSettings',
        to: '/admin/partner/settings',
        icon: SlidersHorizontal,
        requiredPermission: 'partner:settings:view',
      },
    ],
  },
  {
    key: 'ai-automation',
    labelKey: 'admin:sidebar.aiAutomation',
    requiredPermission: 'system:integration:manage',
    items: [
      {
        key: 'bots',
        labelKey: 'admin:sidebar.bots',
        to: '/admin/bots',
        icon: Bot,
        requiredPermission: 'system:integration:manage',
      },
      {
        key: 'knowledge-base',
        labelKey: 'admin:sidebar.knowledgeBase',
        to: '/admin/knowledge-base',
        icon: BookOpen,
        requiredPermission: 'system:integration:manage',
      },
      // agent-assist: deferred to v1.7.0+ (full-stack activation required).
      // See memory/project_agent_assist_deferred.md for full 8-layer spec.
      // Route + page code retained as scaffolding; no nav link exposed.
    ],
  },
  {
    key: 'features',
    labelKey: 'admin:sidebar.features',
    requiredPermission: 'features:agent-assist:manage',
    items: [
      {
        key: 'feature-agent-assist',
        labelKey: 'admin:sidebar.featureAgentAssist',
        to: '/admin/features/agent-assist',
        icon: Zap,
        requiredPermission: 'features:agent-assist:manage',
      },
    ],
  },
  {
    // R5.2 Phase 0 — Security Admin group. Items currently point at
    // placeholder pages; Phase A/B/C subagents replace the targets.
    key: 'security-admin',
    labelKey: 'admin:sidebar.securityAdmin',
    requiredAnyPermission: [
      'system:auth:configure',
      'system:audit:view',
      'system:tenant:configure',
    ],
    items: [
      {
        key: 'security-mfa',
        labelKey: 'admin:sidebar.securityMfa',
        to: '/admin/security/mfa',
        icon: ShieldAlert,
        requiredPermission: 'system:auth:configure',
      },
      {
        key: 'security-audit',
        labelKey: 'admin:sidebar.securityAudit',
        to: '/admin/security/audit',
        icon: FileSearch,
        requiredPermission: 'audit.read',
      },
      {
        key: 'security-impersonation',
        labelKey: 'admin:sidebar.securityImpersonation',
        to: '/admin/security/impersonation',
        icon: UserCog,
        requiredPermission: 'system:auth:configure',
      },
      {
        key: 'retention',
        labelKey: 'admin:sidebar.retention',
        to: '/admin/retention',
        icon: Database,
        requiredPermission: 'system:tenant:configure',
      },
    ],
  },
  {
    key: 'system',
    labelKey: 'admin:sidebar.system',
    requiredAnyPermission: [
      'system:tenant:configure',
      'system:auth:configure',
      'system:audit:view',
      'system:integration:manage',
    ],
    items: [
      {
        key: 'system',
        labelKey: 'admin:sidebar.system',
        to: '/admin/system',
        icon: Server,
        requiredPermission: 'system:integration:manage',
      },
      {
        key: 'license',
        labelKey: 'admin:sidebar.license',
        to: '/admin/license',
        icon: ShieldCheck,
        requiredPermission: 'platform:license:manage',
      },
      {
        key: 'api-keys',
        labelKey: 'admin:sidebar.apiKeys',
        to: '/admin/api-keys',
        icon: KeyRound,
        requiredPermission: 'platform:tenant:manage',
      },
      {
        key: 'diagnostics',
        labelKey: 'admin:sidebar.diagnostics',
        to: '/admin/system/diagnostics',
        icon: Activity,
        requiredPermission: 'system:integration:manage',
      },
      {
        key: 'cluster',
        labelKey: 'admin:sidebar.cluster',
        to: '/admin/cluster',
        icon: Network,
        requiredPermission: 'platform:cluster:manage',
      },
      {
        key: 'tenants',
        labelKey: 'admin:sidebar.tenants',
        to: '/admin/tenants',
        icon: Building2,
        requiredPermission: 'system:tenant:configure',
      },
      {
        key: 'realtime',
        labelKey: 'admin:sidebar.realtime',
        to: '/admin/realtime',
        icon: Radio,
        requiredPermission: 'system:integration:manage',
      },
      {
        key: 'dialer-settings',
        labelKey: 'admin:sidebar.dialerSettings',
        to: '/admin/dialer-settings',
        icon: SlidersHorizontal,
        requiredPermission: 'campaigns:dialer:configure',
      },
      {
        key: 'auth-config',
        labelKey: 'admin:sidebar.authConfig',
        to: '/admin/auth-config',
        icon: KeyRound,
        requiredPermission: 'system:auth:configure',
      },
      {
        key: 'auth-events',
        labelKey: 'admin:sidebar.authEvents',
        to: '/admin/auth-events',
        icon: Activity,
        requiredPermission: 'system:audit:view',
      },
      {
        key: 'auth-sessions',
        labelKey: 'admin:sidebar.authSessions',
        to: '/admin/auth-sessions',
        icon: Monitor,
        requiredPermission: 'system:auth:configure',
      },
      { key: 'security', labelKey: 'admin:sidebar.security', to: '/admin/security', icon: Shield },
      {
        key: 'audit',
        labelKey: 'admin:sidebar.auditLog',
        to: '/admin/audit',
        icon: FileSearch,
        requiredPermission: 'system:audit:view',
      },
      {
        key: 'reports',
        labelKey: 'admin:sidebar.reports',
        to: '/admin/reports',
        icon: Calendar,
        requiredPermission: 'reporting:dashboard:edit',
      },
    ],
  },
];

function CollapsibleGroup({
  label,
  groupKey,
  children,
  containsActiveRoute,
}: {
  label: string;
  groupKey: string;
  children: React.ReactNode;
  containsActiveRoute: boolean;
}) {
  // User's manual toggle (null = "not yet touched, follow active route").
  // Keeping this separate from `containsActiveRoute` lets the group auto-open
  // when the user navigates INTO it, while still letting them manually collapse
  // a group that doesn't contain their current route.
  const [manualOverride, setManualOverride] = useState<boolean | null>(null);

  // Effective open state:
  //   - If this group contains the active route, it MUST be open — otherwise
  //     clicking the header would hide the user's own navigation context.
  //   - Otherwise, use the manual toggle; default closed.
  const open = containsActiveRoute ? true : (manualOverride ?? false);

  function handleClick() {
    if (containsActiveRoute) {
      // Already open and locked-open; a click on the header is a no-op.
      // Clicking a sibling group to open it is the expected way to navigate
      // elsewhere. This keeps tests like `goto /admin/X + click group-X + click
      // link-Y-in-group-X` reliable: the group stays open either way.
      return;
    }
    setManualOverride((prev) => !(prev ?? false));
  }

  return (
    <div>
      <button
        type="button"
        data-testid={`sidebar-group-${groupKey}`}
        onClick={handleClick}
        className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <ul className="space-y-0.5 px-2">{children}</ul>}
    </div>
  );
}

function SidebarLink({ item }: { item: SidebarItem }) {
  const { t } = useTranslation(['common', 'admin']);
  const Icon = item.icon;

  return (
    <li>
      <NavLink
        to={item.to}
        data-testid={`sidebar-link-${item.key}`}
        className={({ isActive }) =>
          `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
            isActive
              ? 'bg-brand/10 font-medium text-brand'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
          }`
        }
      >
        <Icon className="h-4 w-4 shrink-0" />
        {t(item.labelKey)}
      </NavLink>
    </li>
  );
}

export function AdminSidebar() {
  const { t } = useTranslation(['common', 'admin']);
  const permissions = useAuthStore((s) => s.permissions);
  const location = useLocation();

  function hasPermission(p: string) {
    return permissions.includes(p);
  }

  function hasAny(ps: string[]) {
    return ps.some((p) => permissions.includes(p));
  }

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.requiredPermission) return hasPermission(item.requiredPermission);
        if (item.requiredAnyPermission) return hasAny(item.requiredAnyPermission);
        return true; // No permission required = visible
      }),
    }))
    .filter((group) => {
      if (group.items.length === 0) return false;
      if (group.requiredPermission) return hasPermission(group.requiredPermission);
      if (group.requiredAnyPermission) return hasAny(group.requiredAnyPermission);
      return true;
    });

  return (
    <nav className="flex h-full flex-col gap-2 py-3">
      <p className="px-4 pb-1 text-sm font-medium text-slate-500">{t('nav.admin')}</p>
      {visibleGroups.map((group) => (
        <CollapsibleGroup
          key={group.key}
          groupKey={group.key}
          label={t(group.labelKey)}
          containsActiveRoute={group.items.some((item) => location.pathname.startsWith(item.to))}
        >
          {group.items.map((item) => (
            <SidebarLink key={item.key} item={item} />
          ))}
        </CollapsibleGroup>
      ))}
    </nav>
  );
}
