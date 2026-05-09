import { useId, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { useHasPermission, useHasAnyPermission } from '@/core/auth/use-has-permission';

type ButtonOwnProps = ComponentProps<typeof Button>;
type ButtonClickHandler = NonNullable<ButtonOwnProps['onClick']>;
type ButtonClickEvent = Parameters<ButtonClickHandler>[0];

interface PermissionButtonProps extends Omit<ButtonOwnProps, 'disabled'> {
  /** Single permission required (mutually exclusive with `requiresAny`) */
  readonly requires?: string;
  /** Any of these permissions allowed */
  readonly requiresAny?: string[];
  /** Force-disable from caller (takes precedence over permission state) */
  readonly disabled?: boolean;
  readonly children?: ReactNode;
}

export function PermissionButton({
  requires,
  requiresAny,
  disabled: callerDisabled = false,
  onClick,
  children,
  ...buttonProps
}: PermissionButtonProps) {
  const { t } = useTranslation('common');
  const hasSingle = useHasPermission(requires ?? '');
  const hasAny = useHasAnyPermission(...(requiresAny ?? []));

  const allowed = requires ? hasSingle : requiresAny && requiresAny.length > 0 ? hasAny : true;
  const isDisabled = callerDisabled || !allowed;
  const tooltipId = useId();

  const tooltipText = !allowed
    ? requires
      ? t('permission.button.requires', { permission: requires })
      : t('permission.button.requiresAny', { permissions: (requiresAny ?? []).join(', ') })
    : undefined;

  function handleClick(e: ButtonClickEvent) {
    if (isDisabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick?.(e);
  }

  return (
    <>
      <Button
        {...buttonProps}
        aria-disabled={isDisabled}
        aria-describedby={!allowed ? tooltipId : undefined}
        onClick={handleClick}
      >
        {children}
      </Button>
      {!allowed && tooltipText && (
        <span id={tooltipId} role="tooltip" className="sr-only">
          {tooltipText}
        </span>
      )}
    </>
  );
}
