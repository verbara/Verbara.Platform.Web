import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

import { VoiceTransferDialog } from './voice-transfer-dialog';

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
});
