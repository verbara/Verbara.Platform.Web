/**
 * The voice transfer dialog reads its targets through the real hooks and the real `customFetch`, with
 * msw answering the shapes of `contract-doubles`; only the transfer POST is a mock. The admin routes
 * answer too, with the same rows: an Agent gets a 403 there in production, but a row is what shows
 * the casing and label bugs of a dialog that still reads them, and the counter proves it does not.
 */
import { act, cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/api-error';
import { server } from '@/test/msw-server';
import type { TestLocale } from '@/test/locale-i18n';
import { useAuthStore } from '@/core/auth/auth-store';
import {
  availableAgent,
  billingQueue,
  busyAgent,
  emptyTransferTargetQueuesPage,
  escalationsQueue,
  offlineAgent,
  onBreakAgent,
  transferTargetAgentsPage,
  transferTargetQueuesPage,
  wrapUpAgent,
} from '@/tests/utils/contract-doubles';
import enAgent from '../../../public/locales/en-US/agent.json';
import esAgent from '../../../public/locales/es-419/agent.json';
import ptAgent from '../../../public/locales/pt-BR/agent.json';

const { mutateMock, toastSuccessMock, toastErrorMock, activeLocale } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  activeLocale: { current: 'en-US' as TestLocale },
}));

vi.mock('@/core/api/hooks/use-conversations', () => ({
  useVoiceTransfer: () => ({ mutate: mutateMock, isPending: false }),
}));

vi.mock('react-i18next', async () => {
  const { createLocaleI18n } = await import('@/test/locale-i18n');
  const i18n = await createLocaleI18n('en-US');
  return {
    useTranslation: () => ({ t: i18n.getFixedT(activeLocale.current, 'agent'), i18n }),
  };
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

const queueA = billingQueue;
const queueB = escalationsQueue;

let queueReads: URL[];
let agentReads: URL[];
let adminReads: string[];
let answerQueues: () => Response;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  activeLocale.current = 'en-US';
  queueReads = [];
  agentReads = [];
  adminReads = [];
  answerQueues = () => HttpResponse.json(transferTargetQueuesPage);
  server.use(
    http.get('/api/v1/transfer-targets/queues', ({ request }) => {
      queueReads.push(new URL(request.url));
      return answerQueues();
    }),
    http.get('/api/v1/transfer-targets/agents', ({ request }) => {
      agentReads.push(new URL(request.url));
      return HttpResponse.json({
        ...transferTargetAgentsPage,
        items: [...transferTargetAgentsPage.items, onBreakAgent],
      });
    }),
    http.get('/api/v1/admin/queues', () => {
      adminReads.push('queues');
      return HttpResponse.json(transferTargetQueuesPage);
    }),
    http.get('/api/v1/admin/agents', () => {
      adminReads.push('agents');
      return HttpResponse.json({
        items: [...transferTargetAgentsPage.items, onBreakAgent].map((a) => ({
          agentId: a.id,
          displayName: a.displayName,
          state: a.state,
        })),
      });
    }),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  mutateMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
});

describe('VoiceTransferDialog', () => {
  const renderDialog = (open: boolean, onOpenChange = vi.fn()) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <VoiceTransferDialog open={open} onOpenChange={onOpenChange} conversationId="conv-1" />
      </QueryClientProvider>,
    );
    return { onOpenChange, queryClient };
  };

  const renderOpen = (onOpenChange = vi.fn()) => renderDialog(true, onOpenChange).onOpenChange;

  const settle = () =>
    act(async () => {
      for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    });

  it('VoiceTransferDialog_ShouldShowQueueAndAgentToggles_WhenOpen', async () => {
    renderOpen();
    expect(await screen.findByTestId('voice-transfer-to-queue')).toBeInTheDocument();
    expect(screen.getByTestId('voice-transfer-to-agent')).toBeInTheDocument();
  });

  it('VoiceTransferDialog_ShouldListQueues_ByDefault', async () => {
    renderOpen();
    expect(await screen.findByTestId(`voice-transfer-item-${queueA.id}`)).toHaveTextContent(
      queueA.name,
    );
    expect(screen.getByTestId(`voice-transfer-item-${queueB.id}`)).toHaveTextContent(queueB.name);
    expect(adminReads).toEqual([]);
  });

  it('VoiceTransferDialog_ShouldListAgents_WhenAgentToggleClicked', async () => {
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-to-agent'));
    expect(await screen.findByTestId(`voice-transfer-item-${availableAgent.id}`)).toHaveTextContent(
      availableAgent.displayName,
    );
    expect(screen.queryByTestId(`voice-transfer-item-${queueA.id}`)).toBeNull();
  });

  it('VoiceTransferDialog_ShouldDisableSubmit_WhenNoSelection', async () => {
    renderOpen();
    expect(await screen.findByTestId('voice-transfer-submit')).toBeDisabled();
  });

  it('VoiceTransferDialog_ShouldMutateWithQueueTarget_WhenQueueSubmitted', async () => {
    renderOpen();
    fireEvent.click(await screen.findByTestId(`voice-transfer-item-${queueA.id}`));
    fireEvent.click(screen.getByTestId('voice-transfer-submit'));
    expect(mutateMock).toHaveBeenCalledWith(
      { id: 'conv-1', kind: 'queue', target: queueA.id },
      expect.any(Object),
    );
  });

  it('VoiceTransferDialog_ShouldMutateWithAgentTarget_WhenAgentSubmitted', async () => {
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-to-agent'));
    fireEvent.click(await screen.findByTestId(`voice-transfer-item-${availableAgent.id}`));
    fireEvent.click(screen.getByTestId('voice-transfer-submit'));
    expect(mutateMock).toHaveBeenCalledWith(
      { id: 'conv-1', kind: 'agent', target: availableAgent.id },
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
    const row = await screen.findByTestId(`voice-transfer-item-${busyAgent.id}`);
    expect(busyAgent.canAcceptWork).toBe(true);
    expect(row).toBeDisabled();
    fireEvent.click(row);
    expect(screen.getByTestId('voice-transfer-submit')).toBeDisabled();
  });

  it('VoiceTransferDialog_ShouldCloseAndToast_OnMutateSuccess', async () => {
    // Drive the success path through the mutate options the dialog passes.
    mutateMock.mockImplementation((_vars: unknown, opts?: { onSuccess?: (r: unknown) => void }) =>
      opts?.onSuccess?.({ accepted: true, error: null }),
    );
    const onOpenChange = renderOpen();
    fireEvent.click(await screen.findByTestId(`voice-transfer-item-${queueA.id}`));
    fireEvent.click(screen.getByTestId('voice-transfer-submit'));
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('VoiceTransferDialog_ShouldToastError_OnMutateError', async () => {
    mutateMock.mockImplementation((_vars: unknown, opts?: { onError?: (e: Error) => void }) =>
      opts?.onError?.(new Error('boom')),
    );
    renderOpen();
    fireEvent.click(await screen.findByTestId(`voice-transfer-item-${queueA.id}`));
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
    fireEvent.click(await screen.findByTestId(`voice-transfer-item-${queueA.id}`));
    fireEvent.click(screen.getByTestId('voice-transfer-submit'));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    const el = renderedToast();
    expect(el).toHaveAttribute('data-error-code', 'voice-transfer-failed');
    expect(el.textContent).toBe('Could not transfer the call');
  });

  it('VoiceTransferDialog_ShouldReadNothing_WhenClosed', async () => {
    renderDialog(false);
    await settle();
    expect(queueReads).toEqual([]);
    expect(agentReads).toEqual([]);
    expect(adminReads).toEqual([]);
  });

  it('VoiceTransferDialog_ShouldReadOnlyTheKindOnView_WhenOpen', async () => {
    renderOpen();
    await screen.findByTestId(`voice-transfer-item-${queueA.id}`);
    await settle();
    expect(queueReads).toHaveLength(1);
    expect(agentReads).toEqual([]);
  });

  it('VoiceTransferDialog_ShouldReadNoList_WhenExternalIsOnView', async () => {
    renderOpen();
    await screen.findByTestId(`voice-transfer-item-${queueA.id}`);
    fireEvent.click(screen.getByTestId('voice-transfer-to-external'));
    await settle();
    expect(queueReads).toHaveLength(1);
    expect(agentReads).toEqual([]);
  });

  it('VoiceTransferDialog_ShouldSendOneSearchRead_WhenAWordIsTypedWithoutPausing', async () => {
    renderOpen();
    await screen.findByTestId(`voice-transfer-item-${queueA.id}`);
    for (const value of ['b', 'bi', 'bil', 'bill']) {
      fireEvent.change(screen.getByTestId('voice-transfer-search'), { target: { value } });
    }
    await waitFor(() => expect(queueReads).toHaveLength(2));
    await settle();
    expect(queueReads.map((url) => url.searchParams.get('search'))).toEqual([null, 'bill']);
    expect(Object.fromEntries(queueReads[1]!.searchParams)).toEqual({
      search: 'bill',
      page: '1',
      pageSize: '100',
    });
  });

  it('VoiceTransferDialog_ShouldNotCarryTheTerm_WhenTheKindChanges', async () => {
    renderOpen();
    await screen.findByTestId(`voice-transfer-item-${queueA.id}`);
    fireEvent.change(screen.getByTestId('voice-transfer-search'), { target: { value: 'bill' } });
    await waitFor(() => expect(queueReads.at(-1)?.searchParams.get('search')).toBe('bill'));
    fireEvent.click(screen.getByTestId('voice-transfer-to-agent'));
    await screen.findByTestId(`voice-transfer-item-${availableAgent.id}`);
    expect(agentReads.map((url) => url.searchParams.get('search'))).toEqual([null]);
  });

  it('VoiceTransferDialog_ShouldShowNoResults_WhenTheReadSettledEmpty', async () => {
    answerQueues = () => HttpResponse.json(emptyTransferTargetQueuesPage);
    renderOpen();
    expect(await screen.findByText(enAgent.voice.transfer.no_results)).toBeInTheDocument();
  });

  it('VoiceTransferDialog_ShouldShowNoResults_WhenTheReadIsRefused', async () => {
    answerQueues = () => new HttpResponse(null, { status: 403 });
    renderOpen();
    expect(await screen.findByText(enAgent.voice.transfer.no_results)).toBeInTheDocument();
  });

  it('VoiceTransferDialog_ShouldOfferNoNoteAndNoWarmControl', async () => {
    renderOpen();
    await screen.findByTestId(`voice-transfer-item-${queueA.id}`);
    const dialog = screen.getByTestId('voice-transfer-dialog');
    expect(dialog.querySelector('textarea')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('VoiceTransferDialog_ShouldShowAvailableInTheAvailableColour', async () => {
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-to-agent'));
    const row = await screen.findByTestId(`voice-transfer-item-${availableAgent.id}`);
    expect(row).toBeEnabled();
    expect(row).toHaveAttribute('data-agent-state', 'Available');
    expect(within(row).getByText(enAgent.agent_status.available)).toHaveClass('text-green-600');
  });

  it.each([
    ['ACW', wrapUpAgent],
    ['Offline', offlineAgent],
  ])('VoiceTransferDialog_ShouldKeepSelectable_WhenTheStateIs_%s', async (_state, agent) => {
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-to-agent'));
    expect(agent.canAcceptWork).toBe(false);
    expect(await screen.findByTestId(`voice-transfer-item-${agent.id}`)).toBeEnabled();
  });

  it('VoiceTransferDialog_ShouldLocalizeTheState_InEs419', async () => {
    activeLocale.current = 'es-419';
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-to-agent'));
    const row = await screen.findByTestId(`voice-transfer-item-${offlineAgent.id}`);
    expect(within(row).getByText(esAgent.agent_status.offline)).toBeInTheDocument();
    expect(within(row).queryByText('Offline')).toBeNull();
  });

  it('VoiceTransferDialog_ShouldLocalizeTheBreakAuxState_InPtBr', async () => {
    activeLocale.current = 'pt-BR';
    renderOpen();
    fireEvent.click(await screen.findByTestId('voice-transfer-to-agent'));
    const row = await screen.findByTestId(`voice-transfer-item-${onBreakAgent.id}`);
    expect(within(row).getByText(ptAgent.agent_status.on_break)).toBeInTheDocument();
  });
});
