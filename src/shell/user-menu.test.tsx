import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation } from 'react-router';
import { useAuthStore } from '@/core/auth/auth-store';
import { createLocaleI18n } from '@/test/locale-i18n';
import { UserMenu } from './user-menu';

// The theme store reads `matchMedia` when it is imported, and jsdom does not implement it.
vi.hoisted(() => {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList;
});

function CurrentPath() {
  return <output data-testid="current-path">{useLocation().pathname}</output>;
}

async function renderMenu() {
  const i18n = await createLocaleI18n('en-US');
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/agent']}>
        <UserMenu />
        <CurrentPath />
      </MemoryRouter>
    </I18nextProvider>,
  );
  fireEvent.click(screen.getByTestId('user-menu-trigger'));
  return screen.findByRole('menuitem', { name: 'Security' });
}

describe('UserMenu', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore
      .getState()
      .setAuth(
        'token',
        Date.now() + 60_000,
        { id: 'u-1', email: 'agent@example.test', displayName: 'Ana Agent', role: 'agent' },
        'tenant-1',
        [
          'contacts:conversation:handle',
          'contacts:conversation:transfer',
          'contacts:contact:view',
          'reporting:realtime:view',
        ],
        {},
      );
  });

  afterEach(() => {
    cleanup();
    useAuthStore.getState().logout();
  });

  it('securityItem_ShouldGoToTheProfileRoute_WhenPicked', async () => {
    const item = await renderMenu();

    fireEvent.click(item);

    expect(screen.getByTestId('current-path').textContent).toBe('/profile/security');
  });

  it('securityItem_ShouldCarryItsTestId_WhenTheMenuIsOpen', async () => {
    const item = await renderMenu();

    expect(item).toHaveAttribute('data-testid', 'user-menu-security');
  });
});
