import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '@/core/auth/auth-store';
import { mapPlatformContact } from '@/core/api/platform-conversation';
import { consentContactVoiceYes, consentEmailYesRequest } from '@/tests/utils/contract-doubles';
import ConsentManagementPage from './consent-management-page';

/** The verbatim copy of the host fixture (`contact-channel-consent.v1.json`). */
const consentFixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'tests/fixtures/contracts/contact-channel-consent.v1.json'),
    'utf-8',
  ),
) as {
  update: { request: { body: Record<string, unknown> } };
  read: { bodyChannelConsent: Record<string, boolean> };
};

/** The eleven `ChannelType` names, verbatim from the fixture's `_comment`. */
const SERVER_CHANNELS = [
  'Voice',
  'WhatsApp',
  'Sms',
  'WebChat',
  'Email',
  'Messenger',
  'Instagram',
  'Telegram',
  'Twitter',
  'Video',
  'Rcs',
] as const;

const { mutate, mutateAsync } = vi.hoisted(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() }));

vi.mock('@/core/api/hooks/use-contacts', () => ({
  useSearchContacts: vi.fn(() => ({ data: [], isLoading: false })),
  useUpdateContact: () => ({ mutate, mutateAsync, isPending: false }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@/core/ui/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <h1 data-testid="page-header">{title}</h1>,
}));

vi.mock('@/core/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/core/ui/confirm-delete-dialog', () => ({
  ConfirmDeleteDialog: () => null,
}));

vi.mock('@/core/ui/badge', () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock('@/core/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      data-testid="checkbox"
      checked={checked ?? false}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

vi.mock('@/core/ui/switch', () => ({
  Switch: (props: Record<string, unknown>) => <button data-testid="switch" {...props} />,
}));

vi.mock('@/core/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/core/ui/input', () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));

vi.mock('@/core/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

describe('ConsentManagementPage', () => {
  it('renders page header', () => {
    render(<ConsentManagementPage />);
    expect(screen.getByTestId('page-header')).toHaveTextContent('consent.title');
  });

  it('shows empty state with no search results', async () => {
    const { useSearchContacts } = await import('@/core/api/hooks/use-contacts');
    vi.mocked(useSearchContacts).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useSearchContacts>);

    render(<ConsentManagementPage />);
    // Without a search of >= 2 chars, no empty message shown
    expect(screen.queryByTestId('consent-empty')).not.toBeInTheDocument();
  });

  it('renders contacts with consent badges when search returns results', async () => {
    const { useSearchContacts } = await import('@/core/api/hooks/use-contacts');
    vi.mocked(useSearchContacts).mockReturnValue({
      data: [
        {
          id: '1',
          firstName: 'John',
          lastName: 'Doe',
          company: 'Acme',
          addresses: [],
          createdAt: '2025-01-01',
          doNotContact: false,
          channelConsent: { Voice: true, Email: true, Sms: false, WhatsApp: false, WebChat: true },
        },
      ],
      isLoading: false,
    } as ReturnType<typeof useSearchContacts>);

    render(<ConsentManagementPage />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^channel-badge-/).length).toBe(11);
  });

  it('shows edit button per row', async () => {
    const { useSearchContacts } = await import('@/core/api/hooks/use-contacts');
    vi.mocked(useSearchContacts).mockReturnValue({
      data: [
        {
          id: '1',
          firstName: 'Jane',
          lastName: 'Smith',
          addresses: [],
          createdAt: '2025-01-01',
          channelConsent: {},
        },
        {
          id: '2',
          firstName: 'Bob',
          lastName: 'Jones',
          addresses: [],
          createdAt: '2025-01-01',
          channelConsent: {},
        },
      ],
      isLoading: false,
    } as ReturnType<typeof useSearchContacts>);

    render(<ConsentManagementPage />);
    const editButtons = screen.getAllByTestId('edit-consent-btn');
    expect(editButtons).toHaveLength(2);
  });

  describe('consent per channel, by the server channel names (W9)', () => {
    beforeEach(() => {
      mutate.mockReset();
      mutateAsync.mockReset();
      useAuthStore.setState({ permissions: ['contacts:contact:edit'] });
    });

    /** A press starts on the option, as a real click does: base-ui ignores any other click. */
    async function chooseConsent(channel: string, state: 'yes' | 'no' | 'unrecorded') {
      fireEvent.click(screen.getByTestId(`consent-channel-${channel}`));
      const option = await screen.findByTestId(`consent-channel-${channel}-option-${state}`);
      fireEvent.pointerDown(option);
      fireEvent.click(option);
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
    }

    it('saveConsent_ShouldSendOnlyTheChangedChannel_WhenEmailIsSetToYesOnARecordedVoice', async () => {
      const { useSearchContacts } = await import('@/core/api/hooks/use-contacts');
      vi.mocked(useSearchContacts).mockReturnValue({
        data: [mapPlatformContact(consentContactVoiceYes)],
        isLoading: false,
      } as unknown as ReturnType<typeof useSearchContacts>);

      render(<ConsentManagementPage />);
      fireEvent.click(screen.getByTestId('edit-consent-btn'));

      // Soft, so one run against the unfixed page records every way it differs.
      expect
        .soft(screen.queryByTestId('consent-channel-Voice'), 'Voice opens as "yes"')
        .toHaveAttribute('data-consent', 'yes');
      expect
        .soft(screen.queryByTestId('consent-channel-Email'), 'Email opens as "no record"')
        .toHaveAttribute('data-consent', 'unrecorded');
      const emailControl = screen.queryByTestId('consent-channel-Email');
      expect.soft(emailControl, 'Email has a consent control').not.toBeNull();
      if (emailControl) await chooseConsent('Email', 'yes');

      fireEvent.click(screen.getByRole('button', { name: 'consent.save' }));

      expect(mutate).toHaveBeenCalledTimes(1);
      const { id, ...body } = mutate.mock.calls[0]![0] as { id: string };
      expect(id).toBe(String(consentContactVoiceYes.contactId));
      expect(body).toEqual(consentEmailYesRequest);
    });

    /** The contact the search answers, with `channelConsent` as given; the rest from the fixture double. */
    async function showContact(channelConsent: Record<string, boolean>, doNotContact = false) {
      const { useSearchContacts } = await import('@/core/api/hooks/use-contacts');
      vi.mocked(useSearchContacts).mockReturnValue({
        data: [mapPlatformContact({ ...consentContactVoiceYes, channelConsent, doNotContact })],
        isLoading: false,
      } as unknown as ReturnType<typeof useSearchContacts>);
      render(<ConsentManagementPage />);
    }

    function savedBody(): Record<string, unknown> {
      fireEvent.click(screen.getByRole('button', { name: 'consent.save' }));
      expect(mutate).toHaveBeenCalledTimes(1);
      const { id, ...body } = mutate.mock.calls[0]![0] as { id: string };
      expect(id).toBe(String(consentContactVoiceYes.contactId));
      return body;
    }

    function sheetStates(): Record<string, string | null> {
      return Object.fromEntries(
        SERVER_CHANNELS.map((ch) => [
          ch,
          screen.getByTestId(`consent-channel-${ch}`).getAttribute('data-consent'),
        ]),
      );
    }

    function rowStates(): Record<string, string | null> {
      return Object.fromEntries(
        SERVER_CHANNELS.map((ch) => [
          ch,
          screen.getByTestId(`channel-badge-${ch}`).getAttribute('data-consent'),
        ]),
      );
    }

    const allUnrecorded = (): Record<string, string> =>
      Object.fromEntries(SERVER_CHANNELS.map((ch) => [ch, 'unrecorded']));

    it('consentSheet_ShouldListEveryChannelTypeNameUnderItsLabel_WhenOpened', async () => {
      await showContact({});
      fireEvent.click(screen.getByTestId('edit-consent-btn'));

      for (const ch of SERVER_CHANNELS) {
        expect(screen.getByTestId(`consent-channel-${ch}`)).toBeInTheDocument();
        expect(screen.getByTestId(`channel-badge-${ch}`)).toHaveTextContent(
          `consent.channels.${ch.toLowerCase()}`,
        );
      }
      expect(screen.getAllByTestId(/^consent-channel-[A-Za-z]+$/)).toHaveLength(11);
    });

    it('consentSheet_ShouldShowVoiceYesAndEveryOtherChannelNoRecord_WhenOnlyVoiceIsRecorded', async () => {
      await showContact({ Voice: true });
      fireEvent.click(screen.getByTestId('edit-consent-btn'));

      const expected = { ...allUnrecorded(), Voice: 'yes' };
      expect(sheetStates()).toEqual(expected);
      expect(rowStates()).toEqual(expected);
    });

    it('consentPage_ShouldShowTheFixtureReadAsServed_WhenTheRowAndTheSheetRender', async () => {
      await showContact(consentFixture.read.bodyChannelConsent);
      fireEvent.click(screen.getByTestId('edit-consent-btn'));

      const expected = {
        ...allUnrecorded(),
        Voice: 'yes',
        Email: 'yes',
        Sms: 'yes',
        WhatsApp: 'no',
      };
      expect(rowStates()).toEqual(expected);
      expect(sheetStates()).toEqual(expected);
    });

    it('consentSheet_ShouldShowEveryChannelNoRecord_WhenNothingIsRecorded', async () => {
      await showContact({});
      fireEvent.click(screen.getByTestId('edit-consent-btn'));

      expect(sheetStates()).toEqual(allUnrecorded());
      expect(rowStates()).toEqual(allUnrecorded());
    });

    it('saveConsent_ShouldSendSmsFalse_WhenNoIsSetOnAnUnansweredChannel', async () => {
      await showContact({});
      fireEvent.click(screen.getByTestId('edit-consent-btn'));
      await chooseConsent('Sms', 'no');

      expect(savedBody()).toEqual({ doNotContact: false, channelConsent: { Sms: false } });
    });

    it('saveConsent_ShouldSendTheFixtureUpdateBody_WhenVoiceAndEmailAreSetToYesAndWhatsAppToNo', async () => {
      await showContact({ WhatsApp: true });
      fireEvent.click(screen.getByTestId('edit-consent-btn'));
      await chooseConsent('Voice', 'yes');
      await chooseConsent('Email', 'yes');
      await chooseConsent('WhatsApp', 'no');

      expect(savedBody()).toEqual(consentFixture.update.request.body);
    });

    it('saveConsent_ShouldSendNoChannelConsentMember_WhenAValueIsChangedAndChangedBack', async () => {
      await showContact({});
      fireEvent.click(screen.getByTestId('edit-consent-btn'));
      await chooseConsent('Sms', 'yes');
      await chooseConsent('Sms', 'unrecorded');

      const body = savedBody();
      expect(body).toEqual({ doNotContact: false });
      expect(body).not.toHaveProperty('channelConsent');
    });

    it('consentSheet_ShouldOfferOnlyYesAndNo_WhenTheChannelHoldsARecordedAnswer', async () => {
      await showContact({ Voice: false });
      fireEvent.click(screen.getByTestId('edit-consent-btn'));

      fireEvent.click(screen.getByTestId('consent-channel-Voice'));
      expect(await screen.findByTestId('consent-channel-Voice-option-yes')).toBeInTheDocument();
      expect(screen.getByTestId('consent-channel-Voice-option-no')).toBeInTheDocument();
      expect(screen.queryByTestId('consent-channel-Voice-option-unrecorded')).toBeNull();
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    it('consentSheet_ShouldOfferNoRecord_WhenNothingIsRecordedOnTheChannel', async () => {
      await showContact({ Voice: false });
      fireEvent.click(screen.getByTestId('edit-consent-btn'));

      fireEvent.click(screen.getByTestId('consent-channel-Email'));
      expect(
        await screen.findByTestId('consent-channel-Email-option-unrecorded'),
      ).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(3);
    });

    it('saveConsent_ShouldKeepTheSheetOpen_WhenTheSaveIsNotAnswered', async () => {
      await showContact({ Voice: true });
      fireEvent.click(screen.getByTestId('edit-consent-btn'));
      savedBody();

      // The sheet closes only from the mutation's own onSuccess: a refusal never calls it.
      const options = mutate.mock.calls[0]![1] as { onSuccess?: () => void };
      expect(options.onSuccess).toBeTypeOf('function');
      expect(screen.getByTestId('consent-channel-Voice')).toBeInTheDocument();
    });

    it('consentPage_ShouldDisableSaveAndBulkSetDnc_WhenThePermissionsLackContactEdit', async () => {
      useAuthStore.setState({ permissions: ['contacts:contact:view'] });
      await showContact({ Voice: true });
      fireEvent.click(screen.getAllByTestId('checkbox')[1]!);
      fireEvent.click(screen.getByTestId('edit-consent-btn'));

      const save = screen.getByRole('button', { name: 'consent.save' });
      const bulk = screen.getByTestId('bulk-dnc-btn');
      expect(save).toHaveAttribute('aria-disabled', 'true');
      expect(bulk).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(save);
      expect(mutate).not.toHaveBeenCalled();
      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('consentPage_ShouldEnableSaveAndBulkSetDnc_WhenThePermissionsHoldContactEdit', async () => {
      await showContact({ Voice: true });
      fireEvent.click(screen.getAllByTestId('checkbox')[1]!);
      fireEvent.click(screen.getByTestId('edit-consent-btn'));

      expect(screen.getByRole('button', { name: 'consent.save' })).toHaveAttribute(
        'aria-disabled',
        'false',
      );
      expect(screen.getByTestId('bulk-dnc-btn')).toHaveAttribute('aria-disabled', 'false');
    });
  });
});
