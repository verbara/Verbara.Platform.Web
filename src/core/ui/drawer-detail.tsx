import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/core/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/core/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/ui/tabs';
import { cn } from '@/lib/utils';

// ─── Public types ────────────────────────────────────────────────────────────

export interface DrawerDetailTab {
  readonly key: string;
  readonly label: ReactNode;
  readonly content: ReactNode;
  /** Optional adornment rendered next to the label (count, StatusBadge, etc.). */
  readonly badge?: ReactNode;
}

export type DrawerDetailActionVariant = 'default' | 'destructive' | 'ghost' | 'outline';

export interface DrawerDetailAction {
  readonly key: string;
  readonly label: ReactNode;
  readonly icon?: ReactNode;
  readonly variant?: DrawerDetailActionVariant;
  readonly onAction: () => void | Promise<void>;
  readonly disabled?: boolean;
  /** When true, shows a spinner and disables the button. Consumer-controlled. */
  readonly loading?: boolean;
  /** Optional passthrough for E2E hooks. Forwarded to the rendered button. */
  readonly 'data-testid'?: string;
}

export type DrawerDetailWidth = 'sm' | 'md' | 'lg' | 'xl';

export interface DrawerDetailProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  /** When empty/undefined, the drawer renders `children` directly (single-pane mode). */
  readonly tabs?: ReadonlyArray<DrawerDetailTab>;
  /** Footer buttons, rendered right-aligned. */
  readonly actions?: ReadonlyArray<DrawerDetailAction>;
  /** Uncontrolled: first-active tab key. Ignored if `activeTab` is supplied. */
  readonly defaultTab?: string;
  /** Controlled: external tab state. When provided, consumer owns the state. */
  readonly activeTab?: string;
  readonly onTabChange?: (key: string) => void;
  readonly width?: DrawerDetailWidth;
  readonly children?: ReactNode;
}

// ─── Width mapping ───────────────────────────────────────────────────────────
// Tailwind arbitrary values keyed on the `sm:` breakpoint so the drawer goes
// full-width on mobile and snaps to these sizes on tablets+.

const WIDTH_CLASSES: Record<DrawerDetailWidth, string> = {
  sm: 'sm:max-w-[400px]',
  md: 'sm:max-w-[560px]',
  lg: 'sm:max-w-[720px]',
  xl: 'sm:max-w-[960px]',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function DrawerDetail({
  open,
  onOpenChange,
  title,
  subtitle,
  tabs,
  actions,
  defaultTab,
  activeTab,
  onTabChange,
  width = 'md',
  children,
}: DrawerDetailProps) {
  const tabList = tabs ?? [];
  const hasTabs = tabList.length > 0;
  const firstTabKey = tabList[0]?.key;

  // Tabs.Root uncontrolled default — if neither `activeTab` nor `defaultTab`
  // is supplied, fall back to the first tab so the drawer never renders empty.
  const resolvedDefault = defaultTab ?? firstTabKey;

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };

  const handleValueChange = (value: unknown) => {
    // Tabs.Value is `any`, but our public API restricts keys to strings.
    if (typeof value === 'string' && onTabChange !== undefined) {
      onTabChange(value);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className={cn('flex flex-col gap-0 p-0', WIDTH_CLASSES[width])}
      >
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          {subtitle !== undefined && subtitle !== null && (
            <SheetDescription>{subtitle}</SheetDescription>
          )}
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {hasTabs ? (
            <Tabs
              value={activeTab}
              defaultValue={activeTab === undefined ? resolvedDefault : undefined}
              onValueChange={handleValueChange}
              className="flex flex-1 flex-col gap-3 p-4"
            >
              <TabsList>
                {tabList.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key}>
                    <span className="inline-flex items-center gap-1.5">
                      {tab.label}
                      {tab.badge !== undefined && tab.badge !== null && (
                        <span className="inline-flex items-center">{tab.badge}</span>
                      )}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {tabList.map((tab) => (
                <TabsContent key={tab.key} value={tab.key}>
                  {tab.content}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
          )}
        </div>

        {actions !== undefined && actions.length > 0 && (
          <SheetFooter className="flex flex-row justify-end gap-2 border-t">
            {actions.map((action) => {
              const isLoading = action.loading === true;
              const isDisabled = action.disabled === true || isLoading;
              return (
                <Button
                  key={action.key}
                  type="button"
                  variant={action.variant ?? 'default'}
                  disabled={isDisabled}
                  data-testid={action['data-testid']}
                  onClick={() => {
                    void action.onAction();
                  }}
                >
                  {isLoading ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    action.icon
                  )}
                  <span>{action.label}</span>
                </Button>
              );
            })}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
