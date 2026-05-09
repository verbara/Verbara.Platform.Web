import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { PermissionButton } from './permission-button';

let perms: string[] = [];
vi.mock('@/core/auth/use-has-permission', () => ({
  useHasPermission: (p: string) => perms.includes(p),
  useHasAnyPermission: (...ps: string[]) => ps.some((p) => perms.includes(p)),
}));

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      defaultNS: 'common',
      ns: ['common'],
      resources: {
        'en-US': {
          common: {
            permission: {
              button: {
                requires: 'Requires permission: {{permission}}',
                requiresAny: 'Requires one of: {{permissions}}',
              },
            },
          },
        },
      },
    });
  }
});

function wrap(ui: ReactNode) {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

describe('PermissionButton', () => {
  it('Renders_AsRegularButton_WhenPermissionAllowed', () => {
    perms = ['users:user:edit'];
    const onClick = vi.fn();
    render(
      wrap(
        <PermissionButton requires="users:user:edit" onClick={onClick}>
          Edit
        </PermissionButton>,
      ),
    );
    const btn = screen.getByRole('button', { name: /edit/i });
    expect(btn).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it('Renders_AriaDisabled_AndPreventsClick_WhenPermissionMissing', () => {
    perms = [];
    const onClick = vi.fn();
    render(
      wrap(
        <PermissionButton requires="users:user:edit" onClick={onClick}>
          Edit
        </PermissionButton>,
      ),
    );
    const btn = screen.getByRole('button', { name: /edit/i });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('HonorsRequiresAny_AsAnyOfPermissions', () => {
    perms = ['users:user:view'];
    render(
      wrap(
        <PermissionButton requiresAny={['users:user:edit', 'users:user:view']}>
          Open
        </PermissionButton>,
      ),
    );
    const btn = screen.getByRole('button', { name: /open/i });
    expect(btn).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('CallerProvidedDisabled_TakesPrecedence_OverPermissionAllowed', () => {
    perms = ['users:user:edit'];
    const onClick = vi.fn();
    render(
      wrap(
        <PermissionButton requires="users:user:edit" disabled onClick={onClick}>
          Edit
        </PermissionButton>,
      ),
    );
    const btn = screen.getByRole('button', { name: /edit/i });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('TooltipText_UsesI18n_WithPermissionInterpolated', () => {
    perms = [];
    render(wrap(<PermissionButton requires="users:user:edit">Edit</PermissionButton>));
    const btn = screen.getByRole('button', { name: /edit/i });
    const describedBy = btn.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    if (describedBy) {
      const tooltipEl = document.getElementById(describedBy);
      expect(tooltipEl?.textContent).toContain('users:user:edit');
    }
  });
});
