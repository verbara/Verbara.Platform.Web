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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SidebarItem {
  key: string;
  labelKey: string;
  to: string;
  icon: LucideIcon;
  /** Roles that can see this item. Undefined = all roles. */
  allowedRoles?: string[];
}

interface SidebarGroup {
  key: string;
  labelKey: string;
  items: SidebarItem[];
  /** Roles that can see this group. Undefined = all roles. */
  allowedRoles?: string[];
}

const groups: SidebarGroup[] = [
  {
    key: 'people',
    labelKey: 'admin:sidebar.people',
    items: [
      { key: 'users', labelKey: 'admin:sidebar.users', to: '/admin/users', icon: Users, allowedRoles: ['admin'] },
      { key: 'agents', labelKey: 'admin:sidebar.agents', to: '/admin/agents', icon: Headset, allowedRoles: ['admin', 'supervisor'] },
    ],
  },
  {
    key: 'communication',
    labelKey: 'admin:sidebar.communication',
    items: [
      { key: 'channels', labelKey: 'admin:sidebar.channels', to: '/admin/channels', icon: Radio, allowedRoles: ['admin'] },
      { key: 'queues', labelKey: 'admin:sidebar.queues', to: '/admin/queues', icon: ListChecks, allowedRoles: ['admin', 'supervisor'] },
      { key: 'flows', labelKey: 'admin:sidebar.flows', to: '/admin/flows', icon: Workflow, allowedRoles: ['admin'] },
      { key: 'campaigns', labelKey: 'admin:sidebar.campaigns', to: '/admin/campaigns', icon: Megaphone, allowedRoles: ['admin'] },
    ],
  },
  {
    key: 'telephony',
    labelKey: 'admin:sidebar.telephony',
    items: [
      { key: 'trunks', labelKey: 'admin:sidebar.trunks', to: '/admin/trunks', icon: Cable, allowedRoles: ['admin'] },
      { key: 'routes', labelKey: 'admin:sidebar.routes', to: '/admin/routes', icon: Route, allowedRoles: ['admin'] },
      { key: 'caller-id-pools', labelKey: 'admin:sidebar.callerIdPools', to: '/admin/caller-id-pools', icon: Phone, allowedRoles: ['admin'] },
    ],
  },
  {
    key: 'compliance',
    labelKey: 'admin:sidebar.compliance',
    items: [
      { key: 'dnc-lists', labelKey: 'admin:sidebar.dncLists', to: '/admin/dnc-lists', icon: ShieldBan, allowedRoles: ['admin'] },
      { key: 'holiday-calendars', labelKey: 'admin:sidebar.holidayCalendars', to: '/admin/holiday-calendars', icon: CalendarOff, allowedRoles: ['admin'] },
    ],
  },
  {
    key: 'ai-automation',
    labelKey: 'admin:sidebar.aiAutomation',
    allowedRoles: ['admin'],
    items: [
      { key: 'bots', labelKey: 'admin:sidebar.bots', to: '/admin/bots', icon: Bot, allowedRoles: ['admin'] },
      { key: 'knowledge-base', labelKey: 'admin:sidebar.knowledgeBase', to: '/admin/knowledge-base', icon: BookOpen, allowedRoles: ['admin'] },
      { key: 'agent-assist', labelKey: 'admin:sidebar.agent_assist', to: '/admin/agent-assist', icon: Sparkles, allowedRoles: ['admin'] },
    ],
  },
  {
    key: 'system',
    labelKey: 'admin:sidebar.system',
    allowedRoles: ['admin'],
    items: [
      { key: 'system', labelKey: 'admin:sidebar.system', to: '/admin/system', icon: Server, allowedRoles: ['admin'] },
      { key: 'dialer-settings', labelKey: 'admin:sidebar.dialerSettings', to: '/admin/dialer-settings', icon: SlidersHorizontal, allowedRoles: ['admin'] },
    ],
  },
];

function CollapsibleGroup({
  label,
  children,
  defaultOpen,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
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
  const role = useAuthStore((s) => s.user?.role);
  const location = useLocation();

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.allowedRoles || (role !== undefined && item.allowedRoles.includes(role)),
      ),
    }))
    .filter((group) => {
      if (group.items.length === 0) return false;
      if (!group.allowedRoles) return true;
      return role !== undefined && group.allowedRoles.includes(role);
    });

  return (
    <nav className="flex h-full flex-col gap-2 py-3">
      <p className="px-4 pb-1 text-sm font-medium text-slate-500">
        {t('nav.admin')}
      </p>
      {visibleGroups.map((group) => (
        <CollapsibleGroup
          key={group.key}
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
