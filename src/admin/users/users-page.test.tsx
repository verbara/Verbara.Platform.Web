/**
 * The users list's status badges and its create sheet (spec `user-account-status`), rendered with
 * the real page, the real query hooks and a real i18next instance loaded with the committed locale
 * files. Only `customFetch` is stubbed, answering as Platform v2.24.0 does: `UserDto.status` is a
 * lower-case string.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import type { User } from '@/core/api/hooks/use-users';
import { ADMIN_LOCALES, TEST_LOCALES, createLocaleI18n, type TestLocale } from '@/test/locale-i18n';
import UsersPage from './users-page';

vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  customFetch: vi.fn(),
}));

function user(id: string, status: string): User {
  return {
    id,
    email: `${id}@demo.test`,
    displayName: `User ${id}`,
    role: 'agent',
    status,
    createdAt: '2026-10-01T00:00:00Z',
  };
}

const USERS = [
  user('u-active', 'active'),
  user('u-suspended', 'suspended'),
  user('u-deactivated', 'deactivated'),
  user('u-unknown', 'pending_review'),
];

beforeEach(() => {
  vi.mocked(client.customFetch).mockReset();
  vi.mocked(client.customFetch).mockImplementation(async (config) => {
    if (config.method === 'GET' && config.url === '/api/v1/admin/users') {
      return { items: USERS, totalCount: USERS.length, page: 1, pageSize: 100 };
    }
    if (config.method === 'POST' && config.url === '/api/v1/admin/users') {
      return user('u-new', 'active');
    }
    throw new Error(`unexpected ${config.method} ${config.url}`);
  });
});

async function renderPage(lng: TestLocale = 'en-US') {
  const i18n = await createLocaleI18n(lng);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/users']}>
          <UsersPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  await waitFor(() => expect(screen.getAllByTestId('user-status-badge')).toHaveLength(4));
}

function badges() {
  return screen.getAllByTestId('user-status-badge').map((b) => ({
    status: b.getAttribute('data-status'),
    label: b.textContent,
    variant: b.getAttribute('data-variant'),
  }));
}

describe.each(TEST_LOCALES)('UsersPage status badges in %s', (lng) => {
  const statuses = ADMIN_LOCALES[lng].users.statuses;

  it('UsersPage_ShouldShowEachRowsTranslatedLabelVariantAndCanonicalStatus_ForEveryStatus', async () => {
    await renderPage(lng);

    expect(badges()).toEqual([
      { status: 'active', label: statuses.active, variant: 'default' },
      { status: 'suspended', label: statuses.suspended, variant: 'secondary' },
      { status: 'deactivated', label: statuses.deactivated, variant: 'destructive' },
      // Unknown: shown as reported, neutral styling, a fixed selector value.
      { status: 'unknown', label: 'pending_review', variant: 'outline' },
    ]);
  });
});

describe('UsersPage status badges', () => {
  it('UsersPage_ShouldGiveTheThreeKnownStatusesDistinctVariants', async () => {
    await renderPage();

    const known = badges().filter((b) => b.status !== 'unknown');
    expect(new Set(known.map((b) => b.variant)).size).toBe(3);
  });
});

describe('UsersPage create sheet', () => {
  it('UsersPage_ShouldOfferNoStatusAndPostNoStatus_WhenCreatingAUser', async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId('users-create-btn'));
    await screen.findByTestId('user-form-email');
    expect(screen.queryByTestId('user-form-status')).toBeNull();
    fireEvent.change(screen.getByTestId('user-form-email'), { target: { value: 'new@demo.test' } });
    fireEvent.change(screen.getByTestId('user-form-displayName'), {
      target: { value: 'New User' },
    });
    fireEvent.click(screen.getByTestId('user-form-submit'));

    await waitFor(() =>
      expect(vi.mocked(client.customFetch)).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const post = vi.mocked(client.customFetch).mock.calls.find(([c]) => c.method === 'POST')![0];
    expect(post).toStrictEqual({
      url: '/api/v1/admin/users',
      method: 'POST',
      // `CreateUserRequest.role` is Platform's `UserRole` enum name (H1).
      data: { email: 'new@demo.test', displayName: 'New User', role: 'Agent' },
    });
  });
});
