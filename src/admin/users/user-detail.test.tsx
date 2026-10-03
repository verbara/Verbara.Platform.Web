/**
 * The user detail page's status badge and its edit sheet (spec `user-account-status`), rendered with
 * the real page, form, query hooks and a real i18next instance loaded with the committed locale
 * files. Only `customFetch` is stubbed. It plays a Platform v2.24.0 that reports `UserDto.status`
 * lower-case and takes `UpdateUserRequest.status` by enum name, so a test can follow a change from
 * the form to the `PUT` body and back to the badge.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import type { User } from '@/core/api/hooks/use-users';
import { ADMIN_LOCALES, TEST_LOCALES, createLocaleI18n, type TestLocale } from '@/test/locale-i18n';
import UserDetailPage from './user-detail';

vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  customFetch: vi.fn(),
}));

const USER_URL = '/api/v1/admin/users/u1';

/** What the fake Platform currently holds for `u1`. */
let stored: User;
/** Every `PUT` body the page sent, in order. */
let puts: unknown[];

beforeEach(() => {
  puts = [];
  vi.mocked(client.customFetch).mockReset();
  vi.mocked(client.customFetch).mockImplementation(async (config) => {
    const route = `${config.method} ${config.url}`;
    if (route === `GET ${USER_URL}`) return { ...stored };
    if (route === `GET ${USER_URL}/roles` || route === 'GET /api/v1/admin/roles') return [];
    if (route === `PUT ${USER_URL}`) {
      const body = config.data as { status?: string };
      puts.push(body);
      // Platform takes the enum name and reports it back lower-cased.
      if (body.status !== undefined) stored = { ...stored, status: body.status.toLowerCase() };
      return { ...stored };
    }
    throw new Error(`unexpected ${route}`);
  });
});

function seed(status: string) {
  stored = {
    id: 'u1',
    email: 'ana@demo.test',
    displayName: 'Ana Rivera',
    role: 'supervisor',
    status,
    createdAt: '2026-10-01T00:00:00Z',
  };
}

async function renderPage(lng: TestLocale = 'en-US') {
  const i18n = await createLocaleI18n(lng);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/users/u1']}>
          <Routes>
            <Route path="/admin/users/:userId" element={<UserDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  await screen.findByTestId('user-status-badge');
}

function badge() {
  const el = screen.getByTestId('user-status-badge');
  return {
    status: el.getAttribute('data-status'),
    label: el.textContent,
    variant: el.getAttribute('data-variant'),
  };
}

/** Clicks an option the way a mouse does: the press starts on the option (see user-form.test). */
async function chooseStatus(status: string) {
  fireEvent.click(screen.getByTestId('user-form-status'));
  const option = await screen.findByTestId(`user-form-status-option-${status}`);
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
}

async function openEdit() {
  fireEvent.click(screen.getByTestId('user-edit-btn'));
  await screen.findByTestId('user-form-status');
}

async function save() {
  fireEvent.click(screen.getByTestId('user-form-submit'));
  await waitFor(() => expect(puts).toHaveLength(1));
}

describe('UserDetailPage status badge', () => {
  it.each([
    ['active', { status: 'active', label: 'Active', variant: 'default' }],
    ['suspended', { status: 'suspended', label: 'Suspended', variant: 'secondary' }],
    ['deactivated', { status: 'deactivated', label: 'Deactivated', variant: 'destructive' }],
    ['SUSPENDED', { status: 'suspended', label: 'Suspended', variant: 'secondary' }],
    ['pending_review', { status: 'unknown', label: 'pending_review', variant: 'outline' }],
  ])('UserDetailPage_ShouldRenderTheBadge_WhenTheStatusIsReportedAs_%j', async (raw, expected) => {
    seed(raw);

    await renderPage();

    expect(badge()).toEqual(expected);
  });
});

describe.each(TEST_LOCALES)('UserDetailPage status badge in %s', (lng) => {
  it('UserDetailPage_ShouldLabelTheBadgeFromTheLocale_WhileDataStatusStaysSuspended', async () => {
    seed('suspended');

    await renderPage(lng);

    expect(badge()).toEqual({
      status: 'suspended',
      label: ADMIN_LOCALES[lng].users.statuses.suspended,
      variant: 'secondary',
    });
  });
});

describe('UserDetailPage edit sheet', () => {
  it('UserDetailPage_ShouldPutTheSuspendedEnumNameAndShowTheUserSuspended_WhenSuspendedIsSaved', async () => {
    seed('active');
    await renderPage();
    await openEdit();

    await chooseStatus('Suspended');
    expect(screen.getByTestId('user-form-status-hint')).toBeInTheDocument();
    await save();

    expect(puts).toStrictEqual([
      {
        email: 'ana@demo.test',
        displayName: 'Ana Rivera',
        role: 'supervisor',
        status: 'Suspended',
      },
    ]);
    // The update invalidates the user's query: the badge follows without a reload.
    await waitFor(() => expect(badge().status).toBe('suspended'));
    expect(badge().label).toBe('Suspended');
  });

  it('UserDetailPage_ShouldOpenTheSheetOnSuspendedAndPutNoStatusKey_WhenSuspendedIsChosenAgain', async () => {
    seed('suspended');
    await renderPage();
    await openEdit();

    // The sheet opens on the status the GET reported, with no leaving-Active hint.
    expect(
      screen.getByTestId('user-form-status').querySelector('[data-slot="select-value"]')
        ?.textContent,
    ).toBe('Suspended');
    expect(screen.queryByTestId('user-form-status-hint')).toBeNull();
    fireEvent.click(screen.getByTestId('user-form-status'));
    const current = await screen.findByTestId('user-form-status-option-Suspended');
    expect(current).toHaveAttribute('aria-selected', 'true');

    // Choosing the current status again is not a change.
    fireEvent.pointerDown(current);
    fireEvent.click(current);
    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
    expect(screen.queryByTestId('user-form-status-hint')).toBeNull();
    await save();

    expect(puts).toStrictEqual([
      { email: 'ana@demo.test', displayName: 'Ana Rivera', role: 'supervisor' },
    ]);
    expect(Object.keys(puts[0] as object)).not.toContain('status');
  });

  it('UserDetailPage_ShouldPutNoStatusKey_WhenOnlyTheNameOfASuspendedUserIsEdited', async () => {
    seed('suspended');
    await renderPage();
    await openEdit();

    fireEvent.change(screen.getByTestId('user-form-displayName'), {
      target: { value: 'Ana R.' },
    });
    await save();

    expect(puts).toStrictEqual([
      { email: 'ana@demo.test', displayName: 'Ana R.', role: 'supervisor' },
    ]);
    expect(Object.keys(puts[0] as object)).not.toContain('status');
  });

  it('UserDetailPage_ShouldPutActiveAndShowTheUserActive_WhenASuspendedUserIsReactivated', async () => {
    seed('suspended');
    await renderPage();
    await openEdit();

    await chooseStatus('Active');
    expect(screen.queryByTestId('user-form-status-hint')).toBeNull();
    await save();

    expect(puts).toStrictEqual([
      { email: 'ana@demo.test', displayName: 'Ana Rivera', role: 'supervisor', status: 'Active' },
    ]);
    await waitFor(() => expect(badge().status).toBe('active'));
  });

  it('UserDetailPage_ShouldPutNoStatusKey_WhenTheUsersStatusIsUnknownAndOnlyTheNameChanged', async () => {
    seed('pending_review');
    await renderPage();
    await openEdit();

    fireEvent.change(screen.getByTestId('user-form-displayName'), {
      target: { value: 'Ana R.' },
    });
    await save();

    expect(puts).toStrictEqual([
      { email: 'ana@demo.test', displayName: 'Ana R.', role: 'supervisor' },
    ]);
  });
});
