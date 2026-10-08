/**
 * The user detail page's status badge and its edit sheet (spec `user-account-status`), rendered with
 * the real page, form, query hooks and a real i18next instance loaded with the committed locale
 * files. Only `customFetch` and `customFetchWithHeaders` are stubbed. They play a Platform v2.25.0
 * that reports `UserDto.role` and `.status` lower-case, takes `UpdateUserRequest` by enum name, and
 * versions the user with an `ETag` it checks strongly against `If-Match` (412 on a mismatch), so a
 * test can follow a change from the form to the `PUT` and back to the page.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { toast } from 'sonner';
import * as client from '@/core/api/client';
import { ApiError } from '@/core/api/api-error';
import type { User } from '@/core/api/hooks/use-users';
import { ADMIN_LOCALES, TEST_LOCALES, createLocaleI18n, type TestLocale } from '@/test/locale-i18n';
import UserDetailPage from './user-detail';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  customFetch: vi.fn(),
  customFetchWithHeaders: vi.fn(),
}));

const USER_URL = '/api/v1/admin/users/u1';

/** What the fake Platform currently holds for `u1`. */
let stored: User;
/** The stored user's version; every applied `PUT` bumps it. */
let version: number;
/** How the `ETag` reaches the console: as Platform sends it, weakened by a proxy, or not at all. */
let etagMode: 'strong' | 'weak' | 'none';
/** Every `PUT` body the page sent, in order. */
let puts: unknown[];
/** The `If-Match` of every `PUT`, in order (`undefined` when absent). */
let ifMatches: (string | undefined)[];

const currentTag = () => `"v${version}"`;

function answer(config: Parameters<typeof client.customFetch>[0]): unknown {
  const route = `${config.method} ${config.url}`;
  if (route === `GET ${USER_URL}`) return { ...stored };
  if (route === `GET ${USER_URL}/roles` || route === 'GET /api/v1/admin/roles') return [];
  if (route === `PUT ${USER_URL}`) {
    const body = config.data as { role?: string; status?: string };
    const ifMatch = config.headers?.['If-Match'];
    puts.push(body);
    ifMatches.push(ifMatch);
    // Platform compares strongly: anything but the current strong tag is refused, nothing written.
    if (ifMatch !== undefined && ifMatch !== currentTag()) {
      throw new ApiError(412, { title: 'Precondition Failed', status: 412 });
    }
    // Platform takes the enum names and reports them back lower-cased.
    if (body.role !== undefined) stored = { ...stored, role: body.role.toLowerCase() };
    if (body.status !== undefined) stored = { ...stored, status: body.status.toLowerCase() };
    version += 1;
    return { ...stored };
  }
  throw new Error(`unexpected ${route}`);
}

beforeEach(() => {
  puts = [];
  ifMatches = [];
  version = 1;
  etagMode = 'strong';
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.mocked(client.customFetch).mockReset();
  vi.mocked(client.customFetch).mockImplementation(async (config) => answer(config));
  vi.mocked(client.customFetchWithHeaders).mockReset();
  vi.mocked(client.customFetchWithHeaders).mockImplementation(async (config) => {
    const data = answer(config);
    const headers = new Headers();
    if (etagMode === 'strong') headers.set('ETag', currentTag());
    if (etagMode === 'weak') headers.set('ETag', `W/${currentTag()}`);
    return { data, headers };
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

    expect(puts).toStrictEqual([{ displayName: 'Ana Rivera', status: 'Suspended' }]);
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

    expect(puts).toStrictEqual([{ displayName: 'Ana Rivera' }]);
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

    expect(puts).toStrictEqual([{ displayName: 'Ana R.' }]);
    expect(Object.keys(puts[0] as object)).not.toContain('status');
  });

  it('UserDetailPage_ShouldPutActiveAndShowTheUserActive_WhenASuspendedUserIsReactivated', async () => {
    seed('suspended');
    await renderPage();
    await openEdit();

    await chooseStatus('Active');
    expect(screen.queryByTestId('user-form-status-hint')).toBeNull();
    await save();

    expect(puts).toStrictEqual([{ displayName: 'Ana Rivera', status: 'Active' }]);
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

    expect(puts).toStrictEqual([{ displayName: 'Ana R.' }]);
  });
});

describe('UserDetailPage edit form against Platform roles and the update contract (H1, H2)', () => {
  it('UserDetailPage_ShouldSendTheUpdate_WhenAUserWhoseRoleIsApiIsSavedUnchanged', async () => {
    seed('active');
    stored = { ...stored, role: 'api' };
    await renderPage();

    await openEdit();
    fireEvent.click(screen.getByTestId('user-form-submit'));

    await waitFor(() => expect(puts).toHaveLength(1));
  });

  it('UserDetailPage_ShouldSendNoEmailInTheUpdate_WhenTheEditFormIsSaved', async () => {
    seed('active');
    await renderPage();

    await openEdit();
    await save();

    expect(Object.keys(puts[0] as object)).not.toContain('email');
  });
});

describe('UserDetailPage email on edit (H2)', () => {
  it('UserDetailPage_ShouldShowTheEmailReadOnly_WhenTheEditSheetOpens', async () => {
    seed('active');
    await renderPage();

    await openEdit();

    const email = screen.getByTestId('user-form-email') as HTMLInputElement;
    expect({ value: email.value, readOnly: email.readOnly }).toEqual({
      value: 'ana@demo.test',
      readOnly: true,
    });
  });
});

/** Opens the role field and clicks `role`'s option, the press starting on the option. */
async function chooseRole(role: string) {
  fireEvent.click(screen.getByTestId('user-form-role'));
  const option = await screen.findByTestId(`user-form-role-option-${role}`);
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
}

describe('UserDetailPage role (H1, H15)', () => {
  it('UserDetailPage_ShouldPutTheRoleEnumNameAndShowTheNewRole_WhenTheRoleIsChanged', async () => {
    seed('active');
    await renderPage();
    expect(screen.getByTestId('user-detail-role')).toHaveAttribute('data-role', 'supervisor');
    await openEdit();

    await chooseRole('Admin');
    await save();

    expect(puts).toStrictEqual([{ displayName: 'Ana Rivera', role: 'Admin' }]);
    await waitFor(() =>
      expect(screen.getByTestId('user-detail-role')).toHaveAttribute('data-role', 'admin'),
    );
    expect(screen.getByTestId('user-detail-role').textContent).toBe('Administrator');
  });

  it('UserDetailPage_ShouldShowTheRoleHint_WhenASupervisorIsLoweredToAgent', async () => {
    seed('active');
    await renderPage();
    await openEdit();
    expect(screen.queryByTestId('user-form-role-hint')).toBeNull();

    await chooseRole('Agent');

    expect(screen.getByTestId('user-form-role-hint').textContent).toBe(
      ADMIN_LOCALES['en-US'].users.role_hint_lower,
    );
  });
});

describe('UserDetailPage concurrent edit (H14)', () => {
  /** The error toast's `data-error-code` and text, once one is shown. */
  async function errorToast() {
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const content = vi.mocked(toast.error).mock.calls[0]![0] as ReactElement;
    render(<div data-testid="error-toast">{content}</div>);
    const el = screen.getByTestId('error-toast').firstElementChild!;
    return { code: el.getAttribute('data-error-code'), text: el.textContent };
  }

  it('UserDetailPage_ShouldSendTheReadTagInIfMatch_WhenPlatformSentAStrongETag', async () => {
    seed('active');
    await renderPage();
    await openEdit();

    await chooseStatus('Suspended');
    await save();

    expect(ifMatches).toEqual(['"v1"']);
    await waitFor(() => expect(badge().status).toBe('suspended'));
  });

  it('UserDetailPage_ShouldSendNoIfMatch_WhenTheETagWasWeakened', async () => {
    seed('active');
    etagMode = 'weak';
    await renderPage();
    await openEdit();

    await chooseStatus('Suspended');
    await save();

    expect(ifMatches).toEqual([undefined]);
    await waitFor(() => expect(badge().status).toBe('suspended'));
  });

  it('UserDetailPage_ShouldSendNoIfMatch_WhenPlatformSentNoETag', async () => {
    seed('active');
    etagMode = 'none';
    await renderPage();
    await openEdit();

    await chooseStatus('Suspended');
    await save();

    expect(ifMatches).toEqual([undefined]);
    await waitFor(() => expect(badge().status).toBe('suspended'));
  });

  it('UserDetailPage_ShouldReportUserChangedAndShowTheOtherAdminsRole_WhenTheSaveIsStale', async () => {
    seed('active');
    await renderPage();
    await openEdit();

    // Another administrator lowers the role after this page read the user.
    stored = { ...stored, role: 'agent' };
    version += 1;
    await chooseStatus('Suspended');
    await save();

    expect(ifMatches).toEqual(['"v1"']);
    expect(await errorToast()).toEqual({
      code: 'user-changed',
      text: ADMIN_LOCALES['en-US'].users.errors.user_changed,
    });
    expect(toast.success).not.toHaveBeenCalled();
    // Nothing was written, and the page reads the user again: the other administrator's role shows.
    await waitFor(() =>
      expect(screen.getByTestId('user-detail-role')).toHaveAttribute('data-role', 'agent'),
    );
    expect(badge().status).toBe('active');
  });
});
