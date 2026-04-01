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
  CalendarOff,
  Server,
  SlidersHorizontal,
  ChevronDown,
  Bot,
  BookOpen,
  Sparkles,
  Zap,
  FileSearch,
  ClipboardList,
  Calendar,
  Building2,
  Shield,
  KeyRound,
  Activity,
  Monitor,
  CreditCard,
  Receipt,
  BarChart3,
  Gauge,
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
      { key: 'users', labelKey: 'admin:sidebar.users', to: '/admin/users', icon: Users, requiredPermission: 'users:user:view' },
      { key: 'agents', labelKey: 'admin:sidebar.agents', to: '/admin/agents', icon: Headset, requiredAnyPermission: ['users:user:view', 'queues:member:assign'] },
      { key: 'roles', labelKey: 'admin:sidebar.roles', to: '/admin/roles', icon: Shield, requiredPermission: 'users:role:assign' },
    ],
  },
  {
    key: 'communication',
    labelKey: 'admin:sidebar.communication',
    items: [
      { key: 'channels', labelKey: 'admin:sidebar.channels', to: '/admin/channels', icon: Radio, requiredPermission: 'system:integration:manage' },
      { key: 'queues', labelKey: 'admin:sidebar.queues', to: '/admin/queues', icon: ListChecks, requiredPermission: 'queues:queue:view' },
      { key: 'skills', labelKey: 'admin:sidebar.skills', to: '/admin/skills', icon: Zap, requiredPermission: 'routing:skill:view' },
      { key: 'flows', labelKey: 'admin:sidebar.flows', to: '/admin/flows', icon: Workflow, requiredPermission: 'routing:flow:view' },
      { key: 'campaigns', labelKey: 'admin:sidebar.campaigns', to: '/admin/campaigns', icon: Megaphone, requiredPermission: 'campaigns:campaign:view' },
      { key: 'surveys', labelKey: 'admin:sidebar.surveys', to: '/admin/surveys', icon: ClipboardList, requiredPermission: 'system:integration:manage' },
    ],
  },
  {
    key: 'telephony',
    labelKey: 'admin:sidebar.telephony',
    items: [
      { key: 'trunks', labelKey: 'admin:sidebar.trunks', to: '/admin/trunks', icon: Cable, requiredPermission: 'system:integration:manage' },
      { key: 'routes', labelKey: 'admin:sidebar.routes', to: '/admin/routes', icon: Route, requiredPermission: 'system:integration:manage' },
      { key: 'caller-id-pools', labelKey: 'admin:sidebar.callerIdPools', to: '/admin/caller-id-pools', icon: Phone, requiredPermission: 'campaigns:campaign:view' },
    ],
  },
  {
    key: 'compliance',
    labelKey: 'admin:sidebar.compliance',
    items: [
      { key: 'dnc-lists', labelKey: 'admin:sidebar.dncLists', to: '/admin/dnc-lists', icon: ShieldBan, requiredPermission: 'campaigns:campaign:view' },
      { key: 'holiday-calendars', labelKey: 'admin:sidebar.holidayCalendars', to: '/admin/holiday-calendars', icon: CalendarOff, requiredPermission: 'campaigns:campaign:view' },
    ],
  },
  {
    key: 'billing',
    labelKey: 'admin:sidebar.billing',
    requiredPermission: 'system:tenant:configure',
    items: [
      { key: 'rate-cards', labelKey: 'admin:sidebar.rateCards', to: '/admin/billing/rate-cards', icon: CreditCard, requiredPermission: 'system:tenant:configure' },
      { key: 'invoices', labelKey: 'admin:sidebar.invoices', to: '/admin/billing/invoices', icon: Receipt, requiredPermission: 'system:tenant:configure' },
      { key: 'usage', labelKey: 'admin:sidebar.usage', to: '/admin/billing/usage', icon: BarChart3, requiredPermission: 'system:tenant:configure' },
      { key: 'quotas', labelKey: 'admin:sidebar.quotas', to: '/admin/billing/quotas', icon: Gauge, requiredPermission: 'system:tenant:configure' },
    ],
  },
  {
    key: 'ai-automation',
    labelKey: 'admin:sidebar.aiAutomation',
    requiredPermission: 'system:integration:manage',
    items: [
      { key: 'bots', labelKey: 'admin:sidebar.bots', to: '/admin/bots', icon: Bot, requiredPermission: 'system:integration:manage' },
      { key: 'knowledge-base', labelKey: 'admin:sidebar.knowledgeBase', to: '/admin/knowledge-base', icon: BookOpen, requiredPermission: 'system:integration:manage' },
      { key: 'agent-assist', labelKey: 'admin:sidebar.agent_assist', to: '/admin/agent-assist', icon: Sparkles, requiredPermission: 'agentassist:config:manage' },
    ],
  },
  {
    key: 'system',
    labelKey: 'admin:sidebar.system',
    requiredAnyPermission: ['system:tenant:configure', 'system:auth:configure', 'system:audit:view', 'system:integration:manage'],
    items: [
      { key: 'system', labelKey: 'admin:sidebar.system', to: '/admin/system', icon: Server, requiredPermission: 'system:integration:manage' },
      { key: 'diagnostics', labelKey: 'admin:sidebar.diagnostics', to: '/admin/system/diagnostics', icon: Activity, requiredPermission: 'system:integration:manage' },
      { key: 'tenants', labelKey: 'admin:sidebar.tenants', to: '/admin/tenants', icon: Building2, requiredPermission: 'system:tenant:configure' },
      { key: 'realtime', labelKey: 'admin:sidebar.realtime', to: '/admin/realtime', icon: Radio, requiredPermission: 'system:integration:manage' },
      { key: 'dialer-settings', labelKey: 'admin:sidebar.dialerSettings', to: '/admin/dialer-settings', icon: SlidersHorizontal, requiredPermission: 'campaigns:dialer:configure' },
      { key: 'auth-config', labelKey: 'admin:sidebar.authConfig', to: '/admin/auth-config', icon: KeyRound, requiredPermission: 'system:auth:configure' },
      { key: 'auth-events', labelKey: 'admin:sidebar.authEvents', to: '/admin/auth-events', icon: Activity, requiredPermission: 'system:audit:view' },
      { key: 'auth-sessions', labelKey: 'admin:sidebar.authSessions', to: '/admin/auth-sessions', icon: Monitor, requiredPermission: 'system:auth:configure' },
      { key: 'security', labelKey: 'admin:sidebar.security', to: '/admin/security', icon: Shield },
      { key: 'audit', labelKey: 'admin:sidebar.auditLog', to: '/admin/audit', icon: FileSearch, requiredPermission: 'system:audit:view' },
      { key: 'reports', labelKey: 'admin:sidebar.reports', to: '/admin/reports', icon: Calendar, requiredPermission: 'reporting:dashboard:edit' },
    ],
  },
];

function CollapsibleGroup({
  label,
  groupKey,
  children,
  defaultOpen,
}: {
  label: string;
  groupKey: string;
  children: React.ReactNode;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        data-testid={`sidebar-group-${groupKey}`}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`}
        />
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
      <p className="px-4 pb-1 text-sm font-medium text-slate-500">
        {t('nav.admin')}
      </p>
      {visibleGroups.map((group) => (
        <CollapsibleGroup
          key={group.key}
          groupKey={group.key}
          label={t(group.labelKey)}
          defaultOpen={group.items.some((item) => location.pathname.startsWith(item.to))}
        >
          {group.items.map((item) => (
            <SidebarLink key={item.key} item={item} />
          ))}
        </CollapsibleGroup>
      ))}
    </nav>
  );
}
