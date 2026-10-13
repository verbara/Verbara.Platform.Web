import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/api-error';

const { mutateMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('@/core/api/hooks/use-queues', () => ({
  useQueues: () => ({
    data: [
      { id: 'q1', name: 'Sales' },
      { id: 'q2', name: 'Support' },
    ],
  }),
}));

vi.mock('@/core/api/hooks/use-agents', () => ({
  useAgents: () => ({
    data: [
      { id: 'a1', displayName: 'Alice', state: 'available' },
      { id: 'a2', displayName: 'Bob', state: 'busy' },
    ],
  }),
}));

vi.mock('@/core/api/hooks/use-conversations', () => ({
  useVoiceTransfer: () => ({ mutate: mutateMock, isPending: false }),
}));

vi.mock('react-i18next', async () => {
  const { createLocaleI18n } = await import('@/test/locale-i18n');
  const i18n = await createLocaleI18n('en-US');
  const t = i18n.getFixedT('en-US', 'agent');
  return { useTranslation: () => ({ t, i18n }) };
});

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

import { VoiceTransferDialog } from './voice-transfer-dialog';

type Entry = { status: number; body: Record<string, unknown> };
const transferTrunkNotDialable = (
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'tests/fixtures/contracts/voice-dial-transfer.v1.json'),
      'utf-8',
    ),
  ) as Record<string, Entry>
).transferTrunkNotDialable!;

function renderedToast(): HTMLElement {
  const content = toastErrorMock.mock.calls.at(-1)?.[0] as ReactElement;
  render(<div data-testid="toast">{content}</div>);
  return screen.getByTestId('toast').firstElementChild as HTMLElement;
}

describe('VoiceTransferDialog', () => {
  afterEach(() => {
    mutateMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  const renderOpen = (onOpenChange = vi.fn()) => {
    render(<VoiceTransferDialog open onOpenChange={onOpenChange} conversationId="conv-1" />);
    return onOpenChange;
  };

  it('VoiceTransferDialog_ShouldShowQueueAndAgentToggles_WhenOpen', async () => {
    renderOpen();
    expect(await screen.findByTestId('voice-transfer-to-queue')).toBeInTheDocument();
    expect(screen.getByTestId('voice-transfer-to-agent')).toBeInTheDocument();
  });

  it('VoiceTransferDialog_ShouldListQueues_ByDefault', async () => {
    renderOpen();
    expect(await screen.findByTestId('voice-transfer-item-q1')).toHaveTextContent('Sales');
    expect(screen.getByTestId('voice-transfer-item-q2')).toHaveTextContent('Support');
  });

  it('VoiceTransferDialog_ShouldListAgents_WhenAgentToggleClicked', async () => {
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-to-agent'));
    expect(await screen.findByTestId('voice-transfer-item-a1')).toHaveTextContent('Alice');
    expect(screen.queryByTestId('voice-transfer-item-q1')).toBeNull();
  });

  it('VoiceTransferDialog_ShouldDisableSubmit_WhenNoSelection', async () => {
    renderOpen();
    expect(await screen.findByTestId('voice-transfer-submit')).toBeDisabled();
  });

  it('VoiceTransferDialog_ShouldMutateWithQueueTarget_WhenQueueSubmitted', async () => {
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-item-q1'));
    fireEvent.click(screen.getByTestId('voice-transfer-submit'));
    expect(mutateMock).toHaveBeenCalledWith(
      { id: 'conv-1', kind: 'queue', target: 'q1' },
      expect.any(Object),
    );
  });

  it('VoiceTransferDialog_ShouldMutateWithAgentTarget_WhenAgentSubmitted', async () => {
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-to-agent'));
    fireEvent.click(await screen.findByTestId('voice-transfer-item-a1'));
    fireEvent.click(screen.getByTestId('voice-transfer-submit'));
    expect(mutateMock).toHaveBeenCalledWith(
      { id: 'conv-1', kind: 'agent', target: 'a1' },
      expect.any(Object),
    );
  });

  it('VoiceTransferDialog_ShouldShowExternalNumberInput_WhenExternalToggleClicked', async () => {
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-to-external'));
    expect(await screen.findByTestId('voice-transfer-external-number')).toBeInTheDocument();
    // The queue/agent picker is hidden in external mode.
    expect(screen.queryByTestId('voice-transfer-search')).toBeNull();
  });

  it('VoiceTransferDialog_ShouldMutateWithExternalTarget_WhenExternalSubmitted', async () => {
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-to-external'));
    fireEvent.change(await screen.findByTestId('voice-transfer-external-number'), {
      target: { value: '+15559998888' },
    });
    fireEvent.click(screen.getByTestId('voice-transfer-submit'));
    expect(mutateMock).toHaveBeenCalledWith(
      { id: 'conv-1', kind: 'external', target: '+15559998888' },
      expect.any(Object),
    );
  });

  it('VoiceTransferDialog_ShouldDisableSubmit_WhenExternalNumberEmpty', async () => {
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-to-external'));
    expect(screen.getByTestId('voice-transfer-submit')).toBeDisabled();
  });

  it('VoiceTransferDialog_ShouldNotSelectBusyAgent_WhenBusy', async () => {
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-to-agent'));
    fireEvent.click(await screen.findByTestId('voice-transfer-item-a2')); // Bob is busy
    expect(screen.getByTestId('voice-transfer-submit')).toBeDisabled();
  });

  it('VoiceTransferDialog_ShouldCloseAndToast_OnMutateSuccess', async () => {
    // Drive the success path through the mutate options the dialog passes.
    mutateMock.mockImplementation((_vars: unknown, opts?: { onSuccess?: (r: unknown) => void }) =>
      opts?.onSuccess?.({ accepted: true, error: null }),
    );
    const onOpenChange = renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-item-q1'));
    fireEvent.click(screen.getByTestId('voice-transfer-submit'));
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('VoiceTransferDialog_ShouldToastError_OnMutateError', async () => {
    mutateMock.mockImplementation((_vars: unknown, opts?: { onError?: (e: Error) => void }) =>
      opts?.onError?.(new Error('boom')),
    );
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-item-q1'));
    fireEvent.click(screen.getByTestId('voice-transfer-submit'));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
  });

  it('VoiceTransferDialog_ShouldToastTrunkNotDialableAndStayOpen_WhenTheTransferIsRefused', async () => {
    mutateMock.mockImplementation((_vars: unknown, opts?: { onError?: (e: unknown) => void }) =>
      opts?.onError?.(new ApiError(transferTrunkNotDialable.status, transferTrunkNotDialable.body)),
    );
    const onOpenChange = renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-to-external'));
    fireEvent.change(await screen.findByTestId('voice-transfer-external-number'), {
      target: { value: '+15559998888' },
    });
    fireEvent.click(screen.getByTestId('voice-transfer-submit'));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    const el = renderedToast();
    expect(el).toHaveAttribute('data-error-code', 'trunk-not-dialable');
    expect(el.textContent).toContain('Trunk 5');
    expect(el.textContent).not.toContain('trunk-not-dialable');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('VoiceTransferDialog_ShouldToastVoiceTransferFailed_WhenTheErrorIsAnythingElse', async () => {
    mutateMock.mockImplementation((_vars: unknown, opts?: { onError?: (e: unknown) => void }) =>
      opts?.onError?.(new ApiError(404, { error: 'conversation-not-found' })),
    );
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-item-q1'));
    fireEvent.click(screen.getByTestId('voice-transfer-submit'));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    const el = renderedToast();
    expect(el).toHaveAttribute('data-error-code', 'voice-transfer-failed');
    expect(el.textContent).toBe('Could not transfer the call');
  });
});
