import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { toast } from 'sonner';
import { ApiError } from '@/core/api/api-error';
import * as client from '@/core/api/client';
import type { ChannelConfig } from '@/core/api/hooks/use-channels';
import { useTenantStore } from '@/core/tenant/tenant-store';
import {
  serverManagedPreviousSecretRefusal,
  serverManagedReplacedAtRefusal,
  unknownCredentialKeyRefusal,
  weakIdentityTokenSecretRefusal,
  webchatChannelAfterRevokePrevious,
  webchatChannelAfterRotate,
  webchatChannelAfterSet,
  webchatChannelRead,
} from '@/tests/utils/contract-doubles';
import enAdmin from '../../../public/locales/en-US/admin.json';
import esAdmin from '../../../public/locales/es-419/admin.json';
import ptAdmin from '../../../public/locales/pt-BR/admin.json';
import WebChatPage from './webchat-page';

/**
 * The identity section of the WebChat page (W10, spec `webchat-identity-secret-console`): the real `useChannel`
 * and `useUpdateChannel` over a real query client, in a non-English locale, with only `customFetch` answered.
 */

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  const { createLocaleI18n } = await import('@/test/locale-i18n');
  const i18n = await createLocaleI18n('es-419');
  return {
    ...actual,
    useTranslation: (ns?: string | string[]) => ({
      t: i18n.getFixedT('es-419', Array.isArray(ns) ? ns[0] : (ns ?? 'common')),
      i18n,
    }),
  };
});
vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const READ_URL = '/api/v1/admin/channels/webchat';
const IDENTITY = esAdmin.webchat.identity;

interface Put {
  isActive: boolean;
  credentials: Record<string, string | null>;
}

const customFetch = vi.mocked(client.customFetch);
let stored: ChannelConfig;
let answerPut: (body: Put) => Promise<unknown>;
let queryClient: QueryClient;

function credentialsOf(config: ChannelConfig, set: Record<string, boolean>): ChannelConfig {
  return {
    ...config,
    credentials: config.credentials.map((c) => ({ key: c.key, isSet: set[c.key] ?? c.isSet })),
  };
}

/** The fixture's first-set case reads this before the PUT: nothing but the queue is stored. */
const NOTHING_SET = credentialsOf(webchatChannelRead, { identityTokenSecret: false });

/**
 * The fixture's `disableLevel2` case states only its status 200. The body is the channel's response shape with
 * both keys it removes reading `isSet` false, built from the `read` double.
 */
const AFTER_TURN_OFF = NOTHING_SET;

const puts = (): Put[] =>
  customFetch.mock.calls
    .filter(([config]) => config.method === 'PUT')
    .map(([config]) => config.data as Put);

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector);
const click = (selector: string) => fireEvent.click(q(selector)!);
const statusOf = () => q('[data-identity-secret-status]')?.dataset.identitySecretStatus;
const shownValue = () => q<HTMLInputElement>('[data-identity-secret-value]')?.value;

async function renderPage(config: ChannelConfig) {
  stored = config;
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WebChatPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(statusOf()).toBeDefined());
  return view;
}

/** The dialog's confirm button, once the dialog named by its test id is open. */
async function confirm(testId: string) {
  const dialog = await screen.findByTestId(testId);
  fireEvent.click(dialog.querySelector('[data-testid="confirm-dialog-confirm"]')!);
}

async function cancelDialog(testId: string) {
  const dialog = await screen.findByTestId(testId);
  fireEvent.click(dialog.querySelector('[data-testid="confirm-dialog-cancel"]')!);
  await waitFor(() => expect(screen.queryByTestId(testId)).toBeNull());
}

/** Generate, then read the value on screen. The value is compared, never printed. */
function generate(): string {
  click('[data-identity-secret-generate]');
  return shownValue()!;
}

/** What a toast showed, as text. A rendered element's internals are not part of it. */
const toastTexts = () =>
  [...vi.mocked(toast.error).mock.calls, ...vi.mocked(toast.success).mock.calls].map(([content]) =>
    JSON.stringify(content, (key, value: unknown) => (key.startsWith('_') ? undefined : value)),
  );

const errorCode = () => {
  const content = vi.mocked(toast.error).mock.calls.at(-1)?.[0] as {
    props: { 'data-error-code': string; children: string };
  };
  return { code: content.props['data-error-code'], text: content.props.children };
};

/** The value as held by the query client's mutations. */
const heldByMutations = (value: string) =>
  queryClient
    .getMutationCache()
    .getAll()
    .some((m) => JSON.stringify(m.state.variables ?? null).includes(value));

describe('the identity section of the WebChat page', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    customFetch.mockReset();
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
    useTenantStore.setState({ activeTenantId: 'tenant-a' });
    answerPut = () => Promise.resolve(webchatChannelAfterSet);
    customFetch.mockImplementation((config) => {
      if (config.method === 'PUT') return answerPut(config.data as Put) as Promise<never>;
      return Promise.resolve(stored) as Promise<never>;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('what the section shows', () => {
    it('Section_ShouldShowConfiguredAndNoPreviousAndNoValue_WhenThePageLoadsTheFixtureRead', async () => {
      await renderPage(webchatChannelRead);

      expect(customFetch).toHaveBeenCalledWith({ url: READ_URL, method: 'GET' });
      expect(statusOf()).toBe('configured');
      expect(q('[data-identity-secret-status]')!.textContent).toBe(IDENTITY.status_configured);
      expect(q('[data-identity-secret-previous]')).toBeNull();
      expect(q('[data-identity-secret-revoke]')).toBeNull();
      expect(q('[data-identity-secret-value]')).toBeNull();
    });

    it('Section_ShouldShowNotConfiguredAndOfferOnlyGenerate_WhenNoSecretIsSet', async () => {
      await renderPage(NOTHING_SET);

      expect(statusOf()).toBe('not-configured');
      expect(q('[data-identity-secret-status]')!.textContent).toBe(IDENTITY.status_not_configured);
      expect(q('[data-identity-secret-generate]')!.textContent).toBe(IDENTITY.generate);
      expect(q('[data-identity-secret-turn-off]')).toBeNull();
      expect(q('[data-identity-secret-revoke]')).toBeNull();
    });

    it('Section_ShouldStillOfferTheRevoke_WhenOnlyAPreviousSecretIsStored', async () => {
      await renderPage(
        credentialsOf(webchatChannelAfterRotate, {
          identityTokenSecret: false,
        }),
      );

      expect(statusOf()).toBe('not-configured');
      expect(q('[data-identity-secret-previous]')).not.toBeNull();
      expect(q('[data-identity-secret-revoke]')).not.toBeNull();
    });

    it('Section_ShouldClaimNothing_WhileTheChannelIsLoading', async () => {
      customFetch.mockImplementation(() => new Promise<never>(() => undefined));
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <WebChatPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await waitFor(() => expect(customFetch).toHaveBeenCalled());

      expect(statusOf()).toBeUndefined();
      expect(q('[data-identity-secret-generate]')).toBeNull();
      expect(q('[data-identity-secret-unavailable]')).toBeNull();
    });

    it('Section_ShouldSayItCannotRead_AndOfferNoAction_WhenTheChannelReadFails', async () => {
      customFetch.mockImplementation(() => Promise.reject(new ApiError(500, null)));
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <WebChatPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => expect(q('[data-identity-secret-unavailable]')).not.toBeNull());
      expect(q('[data-identity-secret-unavailable]')!.textContent).toBe(IDENTITY.unavailable);
      expect(statusOf()).toBeUndefined();
      expect(q('[data-identity-secret-generate]')).toBeNull();
    });
  });

  describe('set the first secret', () => {
    it('Set_ShouldShowA43CharacterValue_WhenTheAdminGenerates', async () => {
      await renderPage(NOTHING_SET);

      const value = generate();

      expect(/^[A-Za-z0-9_-]{43}$/.test(value)).toBe(true);
      expect(q<HTMLInputElement>('[data-identity-secret-value]')!.readOnly).toBe(true);
      expect(q('[data-identity-secret-warning]')!.textContent).toBe(IDENTITY.draft_warning);
      expect(puts()).toEqual([]);
    });

    it('Set_ShouldPutTheValueAloneWithTheCurrentIsActive_AndDropIt_WhenTheAdminSaves', async () => {
      await renderPage(NOTHING_SET);

      const value = generate();
      click('[data-identity-secret-save]');

      await waitFor(() => expect(statusOf()).toBe('configured'));
      expect(customFetch).toHaveBeenCalledWith({
        url: READ_URL,
        method: 'PUT',
        data: { isActive: true, credentials: { identityTokenSecret: value } },
      });
      expect(q('[data-identity-secret-value]')).toBeNull();
      expect(document.body.innerHTML.includes(value)).toBe(false);
    });

    it('Set_ShouldSendFalse_WhenTheChannelIsOff', async () => {
      await renderPage({ ...NOTHING_SET, isActive: false });

      generate();
      click('[data-identity-secret-save]');

      await waitFor(() => expect(puts()).toHaveLength(1));
      expect(puts()[0]!.isActive).toBe(false);
    });

    it('Set_ShouldKeepNoCopyInTheQueryClient_AfterTheSave', async () => {
      await renderPage(NOTHING_SET);

      const value = generate();
      click('[data-identity-secret-save]');

      await waitFor(() => expect(statusOf()).toBe('configured'));
      await waitFor(() => expect(heldByMutations(value)).toBe(false));
      expect(
        JSON.stringify(
          queryClient
            .getQueryCache()
            .getAll()
            .map((c) => c.state.data),
        ),
      ).not.toContain(value);
    });

    it('Set_ShouldKeepNoCopyInTheQueryClient_WhenThePageLeavesAfterARefusal', async () => {
      answerPut = () => Promise.reject(new ApiError(500, null));
      const { unmount } = await renderPage(NOTHING_SET);

      const value = generate();
      click('[data-identity-secret-save]');
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      unmount();

      await waitFor(() => expect(heldByMutations(value)).toBe(false));
    });

    it('Copy_ShouldWriteTheValueToTheClipboard_AndNameItInNoToast', async () => {
      const writeText = vi.fn(() => Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
      await renderPage(NOTHING_SET);

      const value = generate();
      fireEvent.click(q('[data-identity-secret-copy] button')!);

      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      expect((writeText.mock.calls[0] as unknown as string[])[0] === value).toBe(true);
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
      expect(toastTexts().some((t) => t.includes(value))).toBe(false);
    });

    it('Cancel_ShouldDropTheValueAndSendNothing_WhenTheAdminCancels', async () => {
      await renderPage(NOTHING_SET);

      const first = generate();
      click('[data-identity-secret-cancel]');

      expect(q('[data-identity-secret-value]')).toBeNull();
      expect(document.body.innerHTML.includes(first)).toBe(false);
      expect(puts()).toEqual([]);

      expect(generate() === first).toBe(false);
    });

    it('Unmount_ShouldLeaveNoWayToShowTheValueAgain_WhenTheAdminLeaves', async () => {
      const { unmount } = await renderPage(NOTHING_SET);

      const value = generate();
      unmount();
      await renderPage(NOTHING_SET);

      expect(q('[data-identity-secret-value]')).toBeNull();
      expect(document.body.innerHTML.includes(value)).toBe(false);
      expect(puts()).toEqual([]);
    });

    it('TenantSwitch_ShouldDropTheValue_SoItIsNeverSavedForAnotherTenant', async () => {
      await renderPage(NOTHING_SET);

      const value = generate();
      act(() => useTenantStore.setState({ activeTenantId: 'tenant-b' }));

      expect(q('[data-identity-secret-value]')).toBeNull();
      expect(document.body.innerHTML.includes(value)).toBe(false);
    });

    it('Save_ShouldSendOnePut_WhenTheAdminClicksTwiceWhileItIsPending', async () => {
      let finish: (config: ChannelConfig) => void = () => undefined;
      answerPut = () =>
        new Promise((resolve) => {
          finish = resolve;
        });
      await renderPage(NOTHING_SET);

      generate();
      click('[data-identity-secret-save]');
      await waitFor(() => expect(puts()).toHaveLength(1));
      await waitFor(() =>
        expect(q<HTMLButtonElement>('[data-identity-secret-save]')!.disabled).toBe(true),
      );
      click('[data-identity-secret-save]');
      expect(puts()).toHaveLength(1);

      await act(async () => {
        finish(webchatChannelAfterSet);
        await Promise.resolve();
      });
      await waitFor(() => expect(statusOf()).toBe('configured'));
    });
  });

  describe('rotate', () => {
    it('Rotate_ShouldReadAsRotate_AndSayTheOldOneLasts24Hours_BeforeItSendsAnything', async () => {
      await renderPage(webchatChannelRead);

      expect(q('[data-identity-secret-generate]')!.textContent).toBe(IDENTITY.rotate);
      generate();
      click('[data-identity-secret-save]');

      const dialog = await screen.findByTestId('identity-secret-rotate-confirm');
      expect(dialog.textContent).toContain(IDENTITY.confirm_rotate_description);
      expect(IDENTITY.confirm_rotate_description).toContain('24');
      expect(puts()).toEqual([]);
    });

    it('Rotate_ShouldSendOnlyTheNewSecret_AndShowThePreviousNotice_WhenConfirmed', async () => {
      answerPut = () => Promise.resolve(webchatChannelAfterRotate);
      await renderPage(webchatChannelRead);

      const value = generate();
      click('[data-identity-secret-save]');
      await confirm('identity-secret-rotate-confirm');

      await waitFor(() => expect(q('[data-identity-secret-previous]')).not.toBeNull());
      expect(puts()).toEqual([{ isActive: true, credentials: { identityTokenSecret: value } }]);
      expect(q('[data-identity-secret-previous]')!.textContent).toContain(IDENTITY.previous_stored);
      expect(q('[data-identity-secret-previous]')!.textContent).toContain(
        IDENTITY.previous_explanation,
      );
      expect(q('[data-identity-secret-revoke]')).not.toBeNull();
      expect(q('[data-identity-secret-value]')).toBeNull();
      expect(document.body.innerHTML.includes(value)).toBe(false);
    });

    it('Rotate_ShouldKeepTheValueAndSendNothing_WhenTheAdminCancelsTheConfirm', async () => {
      await renderPage(webchatChannelRead);

      const value = generate();
      click('[data-identity-secret-save]');
      await cancelDialog('identity-secret-rotate-confirm');

      expect(puts()).toEqual([]);
      expect(shownValue() === value).toBe(true);
    });

    // `isSet` means only that the key holds a value: the page cannot tell whether the 24 hours have passed.
    it('Previous_ShouldShowTheSameNotice_WhenReadAfterItsGraceEnded', async () => {
      await renderPage(webchatChannelAfterRotate);

      const notice = q('[data-identity-secret-previous]')!;
      expect(notice.textContent).toContain(IDENTITY.previous_stored);
      expect(notice.textContent).toContain(IDENTITY.previous_explanation);
      expect(q('[data-identity-secret-revoke]')).not.toBeNull();
      // No end time: the response carries none.
      expect(/\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}/.test(notice.textContent ?? '')).toBe(false);
    });

    it.each([
      ['en-US', enAdmin.webchat.identity],
      ['es-419', esAdmin.webchat.identity],
      ['pt-BR', ptAdmin.webchat.identity],
    ])('Previous_ShouldNeverSayTheSecretIsAccepted_In %s', (_locale, identity) => {
      expect(/accept|acept|aceit/i.test(identity.previous_stored)).toBe(false);
      expect(/still|is accepted|todav[ií]a|ainda/i.test(identity.previous_explanation)).toBe(false);
      expect(identity.previous_explanation).toContain('24');
    });
  });

  describe('revoke and turn off', () => {
    it('Revoke_ShouldSendExactlyNullForThePrevious_AndClearTheNotice_WhenConfirmed', async () => {
      answerPut = () => Promise.resolve(webchatChannelAfterRevokePrevious);
      await renderPage(webchatChannelAfterRotate);

      click('[data-identity-secret-revoke]');
      await confirm('identity-secret-revoke-confirm');

      await waitFor(() => expect(q('[data-identity-secret-previous]')).toBeNull());
      expect(puts()).toEqual([
        { isActive: true, credentials: { identityTokenSecretPrevious: null } },
      ]);
      expect(statusOf()).toBe('configured');
      expect(q('[data-identity-secret-revoke]')).toBeNull();
    });

    it('Revoke_ShouldSendNothing_WhenTheAdminCancelsTheConfirm', async () => {
      await renderPage(webchatChannelAfterRotate);

      click('[data-identity-secret-revoke]');
      await cancelDialog('identity-secret-revoke-confirm');

      expect(puts()).toEqual([]);
      expect(q('[data-identity-secret-previous]')).not.toBeNull();
    });

    it('TurnOff_ShouldSendExactlyBothNulls_AndShowNotConfigured_WhenConfirmed', async () => {
      answerPut = () => Promise.resolve(AFTER_TURN_OFF);
      await renderPage(webchatChannelAfterRotate);

      click('[data-identity-secret-turn-off]');
      await confirm('identity-secret-turn-off-confirm');

      await waitFor(() => expect(statusOf()).toBe('not-configured'));
      expect(puts()).toEqual([
        {
          isActive: true,
          credentials: { identityTokenSecret: null, identityTokenSecretPrevious: null },
        },
      ]);
    });

    it('TurnOff_ShouldSendNothing_WhenTheAdminCancelsTheConfirm', async () => {
      await renderPage(webchatChannelRead);

      click('[data-identity-secret-turn-off]');
      await cancelDialog('identity-secret-turn-off-confirm');

      expect(puts()).toEqual([]);
      expect(statusOf()).toBe('configured');
    });

    it('Requests_ShouldNeverNameTheRotationStamp_NorSendAValueForThePrevious_WhenEveryActionRuns', async () => {
      const first = await renderPage(NOTHING_SET);
      generate();
      click('[data-identity-secret-save]');
      await waitFor(() => expect(puts()).toHaveLength(1));
      first.unmount();

      queryClient = new QueryClient();
      answerPut = () => Promise.resolve(webchatChannelAfterRotate);
      await renderPage(webchatChannelAfterSet);
      generate();
      click('[data-identity-secret-save]');
      await confirm('identity-secret-rotate-confirm');
      await waitFor(() => expect(q('[data-identity-secret-revoke]')).not.toBeNull());

      answerPut = () => Promise.resolve(webchatChannelAfterRotate);
      click('[data-identity-secret-revoke]');
      await confirm('identity-secret-revoke-confirm');
      await waitFor(() => expect(puts()).toHaveLength(3));
      await waitFor(() =>
        expect(q<HTMLButtonElement>('[data-identity-secret-turn-off]')!.disabled).toBe(false),
      );

      answerPut = () => Promise.resolve(AFTER_TURN_OFF);
      click('[data-identity-secret-turn-off]');
      await confirm('identity-secret-turn-off-confirm');
      await waitFor(() => expect(puts()).toHaveLength(4));

      for (const put of puts()) {
        expect(Object.keys(put.credentials)).not.toContain('identityTokenSecretReplacedAt');
        expect(put.credentials.identityTokenSecretPrevious ?? null).toBeNull();
      }
    });
  });

  describe('the refusals', () => {
    it.each([
      [
        'weak-identity-token-secret',
        weakIdentityTokenSecretRefusal,
        esAdmin.channels.errors.weak_identity_token_secret,
      ],
      [
        'server-managed-credential-key',
        serverManagedPreviousSecretRefusal,
        esAdmin.channels.errors.server_managed_credential_key,
      ],
      [
        'server-managed-credential-key',
        serverManagedReplacedAtRefusal,
        esAdmin.channels.errors.server_managed_credential_key,
      ],
      [
        'unknown-credential-key',
        unknownCredentialKeyRefusal,
        esAdmin.channels.errors.unknown_credential_key,
      ],
    ])(
      'Refusal_ShouldShowTheLocalizedMessage_AndKeepTheValue_When %s',
      async (code, body, text) => {
        answerPut = () => Promise.reject(new ApiError(400, body));
        await renderPage(NOTHING_SET);

        const value = generate();
        click('[data-identity-secret-save]');

        await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
        expect(errorCode()).toEqual({ code, text });
        expect(toast.success).not.toHaveBeenCalled();
        // Nothing was saved, and the admin may already have copied this value.
        expect(shownValue() === value).toBe(true);
        expect(statusOf()).toBe('not-configured');
      },
    );
  });

  describe('where the value never goes', () => {
    it('Value_ShouldReachNoLogAndNoToast_WhenItIsSavedOrRefused', async () => {
      const logged = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
        vi.spyOn(console, method).mockImplementation(() => undefined),
      );
      answerPut = () => Promise.reject(new ApiError(400, weakIdentityTokenSecretRefusal));
      await renderPage(NOTHING_SET);

      const value = generate();
      click('[data-identity-secret-save]');
      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));

      answerPut = () => Promise.resolve(webchatChannelAfterSet);
      click('[data-identity-secret-save]');
      await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));

      expect(toastTexts().some((t) => t.includes(value))).toBe(false);
      for (const spy of logged) {
        expect(spy.mock.calls.some((args) => args.some((a) => String(a).includes(value)))).toBe(
          false,
        );
      }
    });
  });
});
