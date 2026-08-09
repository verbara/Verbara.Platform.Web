import { NavLink } from 'react-router';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/core/ui/tooltip';
import type { LucideIcon } from 'lucide-react';

interface RailIconProps {
  readonly to: string;
  readonly icon: LucideIcon;
  readonly label: string;
}

export function RailIcon({ to, icon: Icon, label }: RailIconProps) {
  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger
          render={(props) => (
            <NavLink
              {...props}
              to={to}
              // Icon-only link: the tooltip is not an accessible name, so axe flags `link-name`.
              // Reuses the already-translated label — no new i18n key.
              aria-label={label}
              className={({ isActive }) =>
                `flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                  isActive
                    ? 'border-l-2 border-rail-active-border bg-slate-800 text-rail-icon-active'
                    : 'text-rail-icon hover:bg-slate-800 hover:text-rail-icon-active'
                }`
              }
            />
          )}
        >
          <Icon className="h-5 w-5" />
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
