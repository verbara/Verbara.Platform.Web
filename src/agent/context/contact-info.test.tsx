import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/api-error';

/**
 * Click-to-dial feedback (design D4; spec `conversation-action-feedback`, the click-to-dial
 * scenarios). The bodies come from the verbatim copy of the host's `voice-dial-transfer.v1.json`.
 */

const { mutateMock, toastErrorMock, startOutboundMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  toastErrorMock: vi.fn(),
  startOutboundMock: vi.fn(),
}));

vi.mock('@/core/api/hooks/use-conversations', () => ({
  useVoiceDial: () => ({ mutate: mutateMock, isPending: false }),
}));

vi.mock('@/core/api/hooks/use-contacts', () => ({
  useContact: () => ({
    data: {
      id: 'contact-1',
      firstName: 'Ana',
      lastName: 'Diaz',
      company: null,
      segment: null,
      preferredChannel: 'voice',
      preferredLanguage: null,
      timezone: null,
      addresses: [{ channel: 'voice', address: '+15551234567' }],
    },
  }),
  useUpdateContact: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteContact: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/core/i18n/use-format-phone', () => ({
  useFormatPhone: () => ({ formatPhone: (raw: string) => raw }),
}));

vi.mock('@/core/ui/permission-button', () => ({
  PermissionButton: () => null,
}));

vi.mock('@/agent/stores/conversation-store', () => ({
  useConversationStore: (select: (s: unknown) => unknown) =>
    select({ selectedId: 'conv-1', conversations: { 'conv-1': { contactId: 'contact-1' } } }),
}));

vi.mock('@/core/stores/voice-call-store', () => ({
  useVoiceCallStore: (select: (s: unknown) => unknown) =>
    select({ registration: 'registered', phase: 'idle', startOutbound: startOutboundMock }),
}));

vi.mock('react-i18next', async () => {
  const { createLocaleI18n } = await import('@/test/locale-i18n');
  const i18n = await createLocaleI18n('en-US');
  const t = i18n.getFixedT('en-US', 'agent');
  return { useTranslation: () => ({ t, i18n }) };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: toastErrorMock },
}));

import { ContactInfo } from './contact-info';

type Entry = { status: number; body: Record<string, unknown> };
const fixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'tests/fixtures/contracts/voice-dial-transfer.v1.json'),
    'utf-8',
  ),
) as Record<string, Entry>;
const dialAccepted = fixture.dialAccepted!;
const dialTrunkNotDialable = fixture.dialTrunkNotDialable!;

function renderedToast(): HTMLElement {
  const content = toastErrorMock.mock.calls.at(-1)?.[0] as ReactElement;
  render(<div data-testid="toast">{content}</div>);
  return screen.getByTestId('toast').firstElementChild as HTMLElement;
}

function clickCall() {
  render(<ContactInfo />);
  fireEvent.click(screen.getByTestId('contact-call-btn'));
}

describe('ContactInfo click-to-dial', () => {
  afterEach(() => {
    mutateMock.mockReset();
    toastErrorMock.mockReset();
    startOutboundMock.mockReset();
  });

  it('ContactInfo_ShouldToastTrunkNotDialableNamingTheTrunk_WhenTheDialIsRefused', async () => {
    mutateMock.mockImplementation((_vars: unknown, opts?: { onError?: (e: unknown) => void }) =>
      opts?.onError?.(new ApiError(dialTrunkNotDialable.status, dialTrunkNotDialable.body)),
    );
    clickCall();
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    const el = renderedToast();
    expect(el).toHaveAttribute('data-error-code', 'trunk-not-dialable');
    expect(el.textContent).toContain('Trunk 4');
    expect(el.textContent).not.toContain('trunk-not-dialable');
    expect(startOutboundMock).not.toHaveBeenCalled();
  });

  it('ContactInfo_ShouldToastDialFailed_WhenTheDialFailsWithAnotherCode', async () => {
    mutateMock.mockImplementation((_vars: unknown, opts?: { onError?: (e: unknown) => void }) =>
      opts?.onError?.(new ApiError(409, { accepted: false, error: 'brand-new-code' })),
    );
    clickCall();
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    const el = renderedToast();
    expect(el).toHaveAttribute('data-error-code', 'dial-failed');
    expect(el.textContent).toBe('Could not place the call');
  });

  it('ContactInfo_ShouldToastDialFailed_WhenTheNetworkFails', async () => {
    mutateMock.mockImplementation((_vars: unknown, opts?: { onError?: (e: unknown) => void }) =>
      opts?.onError?.(new TypeError('Failed to fetch')),
    );
    clickCall();
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    expect(renderedToast()).toHaveAttribute('data-error-code', 'dial-failed');
  });

  it('ContactInfo_ShouldToastDialFailed_WhenTheDialIsNotAccepted', async () => {
    mutateMock.mockImplementation((_vars: unknown, opts?: { onSuccess?: (r: unknown) => void }) =>
      opts?.onSuccess?.({ accepted: false, trunkId: null }),
    );
    clickCall();
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    expect(renderedToast()).toHaveAttribute('data-error-code', 'dial-failed');
    expect(startOutboundMock).not.toHaveBeenCalled();
  });

  it('ContactInfo_ShouldStartTheOutboundCall_WhenTheDialIsAccepted', () => {
    mutateMock.mockImplementation((_vars: unknown, opts?: { onSuccess?: (r: unknown) => void }) =>
      opts?.onSuccess?.(dialAccepted.body),
    );
    clickCall();
    expect(mutateMock).toHaveBeenCalledWith(
      { toNumber: '+15551234567', contactId: 'contact-1' },
      expect.any(Object),
    );
    expect(startOutboundMock).toHaveBeenCalledWith({
      number: '+15551234567',
      correlationId: dialAccepted.body.correlationId,
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
