/**
 * The admin user detail's listen phone (design D8; spec `supervisor-listen-console`, "An
 * administrator SHALL set or clear a user's listen phone"). Real hooks and a real i18next loaded with
 * the committed locale files; only `customFetch` is stubbed, answering the host's fixture bodies.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import * as client from '@/core/api/client';
import { ApiError } from '@/core/api/api-error';
import { ADMIN_LOCALES, TEST_LOCALES, createLocaleI18n, type TestLocale } from '@/test/locale-i18n';
import { UserListenPhone } from './user-listen-phone';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  customFetch: vi.fn(),
}));

type Entry = { status: number; body: Record<string, unknown> };
const phoneFx = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'tests/fixtures/contracts/supervisor-listen-phone.v1.json'),
    'utf-8',
  ),
) as { get: Entry; set: Entry; invalid: Entry };

const USER = '7d2c9e4b1a5f4c3e8b6d0f1a2c3e4b5d';
const URL = `/api/v1/admin/users/${USER}/listen-phone`;

let stored: string | null;
let puts: unknown[];
let putRefusal: ApiError | null;
let getRefusal: ApiError | null;

beforeEach(() => {
  stored = phoneFx.get.body.phoneNumber as string;
  puts = [];
  putRefusal = null;
  getRefusal = null;
  vi.mocked(toast.error).mockClear();
  vi.mocked(client.customFetch).mockReset();
  vi.mocked(client.customFetch).mockImplementation(async (config) => {
    const route = `${config.method} ${config.url}`;
    if (route === `GET ${URL}`) {
      if (getRefusal) throw getRefusal;
      return { userId: USER, phoneNumber: stored };
    }
    if (route === `PUT ${URL}`) {
      puts.push(config.data);
      if (putRefusal) throw putRefusal;
      stored = (config.data as { phoneNumber: string | null }).phoneNumber;
      return { userId: USER, phoneNumber: stored };
    }
    throw new Error(`unexpected ${route}`);
  });
});

async function renderPhone(lng: TestLocale = 'en-US') {
  const i18n = await createLocaleI18n(lng);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <UserListenPhone userId={USER} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return i18n;
}

function lastToastCode(): string | null {
  const content = vi.mocked(toast.error).mock.calls.at(-1)?.[0] as ReactNode;
  if (content === undefined) return null;
  const { container, unmount } = render(<div>{content}</div>);
  const code = container.querySelector('[data-error-code]')?.getAttribute('data-error-code');
  unmount();
  return code ?? null;
}

async function edit(value: string) {
  fireEvent.click(await screen.findByTestId('user-listen-phone-edit'));
  fireEvent.change(screen.getByTestId('user-listen-phone-input'), { target: { value } });
}

describe('UserListenPhone', () => {
  it.each(TEST_LOCALES)(
    'UserListenPhone_ShouldShowTheStoredNumberWithTranslatedLabels_WhenOneIsStored (%s)',
    async (lng) => {
      await renderPhone(lng);
      await waitFor(() =>
        expect(screen.getByTestId('user-listen-phone-value')).toHaveTextContent('+573001234567'),
      );
      expect(screen.getByTestId('user-listen-phone')).toHaveTextContent(
        ADMIN_LOCALES[lng].users.listen_phone.label,
      );
    },
  );

  it('UserListenPhone_ShouldShowNone_WhenNoNumberIsStored', async () => {
    stored = null;
    await renderPhone();
    await waitFor(() =>
      expect(screen.getByTestId('user-listen-phone-value')).toHaveTextContent(
        ADMIN_LOCALES['en-US'].users.listen_phone.none,
      ),
    );
    expect(screen.getByTestId('user-listen-phone-value')).toHaveAttribute('data-empty', 'true');
  });

  it('UserListenPhone_ShouldSaveTheTrimmedTextAsTyped_WhenTheAdministratorSaves', async () => {
    await renderPhone();
    await edit('  +57 (300) 123-4567  ');
    expect(screen.getByTestId('user-listen-phone-input')).toHaveAttribute('inputmode', 'tel');
    await act(async () => {
      fireEvent.click(screen.getByTestId('user-listen-phone-save'));
    });
    expect(puts).toEqual([{ phoneNumber: '+57 (300) 123-4567' }]);
    await waitFor(() => expect(screen.queryByTestId('user-listen-phone-input')).toBeNull());
    expect(screen.getByTestId('user-listen-phone-value')).toHaveTextContent('+57 (300) 123-4567');
  });

  it('UserListenPhone_ShouldSendNullAndShowNone_WhenTheAdministratorClears', async () => {
    await renderPhone();
    await screen.findByTestId('user-listen-phone-edit');
    await act(async () => {
      fireEvent.click(await screen.findByTestId('user-listen-phone-clear'));
    });
    expect(puts).toEqual([{ phoneNumber: null }]);
    await waitFor(() =>
      expect(screen.getByTestId('user-listen-phone-value')).toHaveAttribute('data-empty', 'true'),
    );
  });

  it.each(TEST_LOCALES)(
    'UserListenPhone_ShouldKeepTheEditorOpenWithTheInvalidCode_WhenPlatformAnswers400 (%s)',
    async (lng) => {
      putRefusal = new ApiError(phoneFx.invalid.status, phoneFx.invalid.body);
      const i18n = await renderPhone(lng);
      await edit('300 123 4567');
      await act(async () => {
        fireEvent.click(screen.getByTestId('user-listen-phone-save'));
      });
      const shown = await screen.findByTestId('user-listen-phone-error');
      expect(shown).toHaveAttribute('data-error-code', 'listen-phone-invalid');
      expect(shown).toHaveTextContent(
        i18n.t('common:errors.supervisor_listen.listen_phone_invalid'),
      );
      expect(screen.getByTestId('user-listen-phone-input')).toHaveValue('300 123 4567');
      expect(stored).toBe('+573001234567');
    },
  );

  it('UserListenPhone_ShouldToastUserNotFound_WhenTheSaveAnswers404', async () => {
    putRefusal = new ApiError(404, null);
    await renderPhone();
    await edit('+573001234567');
    await act(async () => {
      fireEvent.click(screen.getByTestId('user-listen-phone-save'));
    });
    await waitFor(() => expect(lastToastCode()).toBe('user-not-found'));
  });

  it('UserListenPhone_ShouldShowUserNotFound_WhenTheReadAnswers404', async () => {
    getRefusal = new ApiError(404, null);
    await renderPhone();
    const shown = await screen.findByTestId('user-listen-phone-error');
    expect(shown).toHaveAttribute('data-error-code', 'user-not-found');
  });

  it('UserListenPhone_ShouldDiscardTheDraft_WhenTheAdministratorCancels', async () => {
    await renderPhone();
    await edit('+1 555');
    fireEvent.click(screen.getByTestId('user-listen-phone-cancel'));
    expect(screen.queryByTestId('user-listen-phone-input')).toBeNull();
    expect(puts).toEqual([]);
  });
});
