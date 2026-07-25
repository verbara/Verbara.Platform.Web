import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  answerCallMock,
  rejectCallMock,
  hangupCallMock,
  holdCallMock,
  unholdCallMock,
  muteCallMock,
  unmuteCallMock,
  sendDtmfMock,
} = vi.hoisted(() => ({
  answerCallMock: vi.fn(),
  rejectCallMock: vi.fn(),
  hangupCallMock: vi.fn(),
  holdCallMock: vi.fn(),
  unholdCallMock: vi.fn(),
  muteCallMock: vi.fn(),
  unmuteCallMock: vi.fn(),
  sendDtmfMock: vi.fn(),
}));

vi.mock('@/core/voice/softphone-manager', () => ({
  answerCall: answerCallMock,
  rejectCall: rejectCallMock,
  hangupCall: hangupCallMock,
  holdCall: holdCallMock,
  unholdCall: unholdCallMock,
  muteCall: muteCallMock,
  unmuteCall: unmuteCallMock,
  sendDtmf: sendDtmfMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// Stub the transfer dialog (its own suite covers the picker) — here we only assert the call-card
// surfaces the trigger and opens it.
vi.mock('./voice-transfer-dialog', () => ({
  VoiceTransferDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="voice-transfer-dialog-stub" /> : null,
}));

import { CallCard } from './call-card';
import { useVoiceCallStore } from '@/agent/stores/voice-call-store';

describe('CallCard', () => {
  // CallCard uses useNavigate (the "Open conversation" affordance) — it is mounted within the
  // Router in production (agent-layout); tests provide a Router context.
  const renderCard = () => render(<CallCard />, { wrapper: MemoryRouter });

  afterEach(() => {
    useVoiceCallStore.getState().reset();
    answerCallMock.mockClear();
    rejectCallMock.mockClear();
    hangupCallMock.mockClear();
  });

  it('CallCard_ShouldRenderNothing_WhenIdle', () => {
    renderCard();
    expect(screen.queryByTestId('voice-call-card')).toBeNull();
  });

  it('CallCard_ShouldShowAnswerAndReject_WhenRinging', () => {
    useVoiceCallStore.getState().incoming('Acme Corp', '18005551234');
    renderCard();
    expect(screen.getByTestId('voice-call-card')).toHaveAttribute('data-voice-state', 'ringing');
    expect(screen.getByTestId('voice-answer-btn')).toBeInTheDocument();
    expect(screen.getByTestId('voice-reject-btn')).toBeInTheDocument();
  });

  it('CallCard_ShouldCallAnswer_WhenAnswerClicked', () => {
    useVoiceCallStore.getState().incoming('Acme', '123');
    renderCard();
    fireEvent.click(screen.getByTestId('voice-answer-btn'));
    expect(answerCallMock).toHaveBeenCalled();
  });

  it('CallCard_ShouldCallReject_WhenRejectClicked', () => {
    useVoiceCallStore.getState().incoming('Acme', '123');
    renderCard();
    fireEvent.click(screen.getByTestId('voice-reject-btn'));
    expect(rejectCallMock).toHaveBeenCalled();
  });

  it('CallCard_ShouldShowHangupAndTimer_WhenActive', () => {
    useVoiceCallStore.getState().incoming('Acme', '123');
    useVoiceCallStore.getState().answered();
    renderCard();
    expect(screen.getByTestId('voice-call-card')).toHaveAttribute('data-voice-state', 'active');
    expect(screen.getByTestId('voice-hangup-btn')).toBeInTheDocument();
    expect(screen.getByTestId('voice-call-timer')).toBeInTheDocument();
  });

  it('CallCard_ShouldCallHangup_WhenHangupClicked', () => {
    useVoiceCallStore.getState().incoming('Acme', '123');
    useVoiceCallStore.getState().answered();
    renderCard();
    fireEvent.click(screen.getByTestId('voice-hangup-btn'));
    expect(hangupCallMock).toHaveBeenCalled();
  });

  it('CallCard_ShouldShowControlRow_WhenActive', () => {
    useVoiceCallStore.getState().incoming('Acme', '123');
    useVoiceCallStore.getState().answered();
    renderCard();
    expect(screen.getByTestId('voice-hold-btn')).toBeInTheDocument();
    expect(screen.getByTestId('voice-mute-btn')).toBeInTheDocument();
    expect(screen.getByTestId('voice-dialpad-btn')).toBeInTheDocument();
  });

  it('CallCard_ShouldNotShowControlRow_WhenRinging', () => {
    useVoiceCallStore.getState().incoming('Acme', '123');
    renderCard();
    expect(screen.queryByTestId('voice-hold-btn')).toBeNull();
  });

  it('CallCard_ShouldHold_WhenHoldClicked_AndResume_WhenHeld', () => {
    useVoiceCallStore.getState().incoming('Acme', '123');
    useVoiceCallStore.getState().answered();
    const { rerender } = renderCard();
    fireEvent.click(screen.getByTestId('voice-hold-btn'));
    expect(holdCallMock).toHaveBeenCalled();
    // When held, the button resumes instead.
    useVoiceCallStore.getState().setHeld(true);
    rerender(<CallCard />);
    fireEvent.click(screen.getByTestId('voice-hold-btn'));
    expect(unholdCallMock).toHaveBeenCalled();
  });

  it('CallCard_ShouldMute_WhenMuteClicked', () => {
    useVoiceCallStore.getState().incoming('Acme', '123');
    useVoiceCallStore.getState().answered();
    renderCard();
    fireEvent.click(screen.getByTestId('voice-mute-btn'));
    expect(muteCallMock).toHaveBeenCalled();
  });

  it('CallCard_ShouldToggleDialpad_WhenDialpadClicked', () => {
    useVoiceCallStore.getState().incoming('Acme', '123');
    useVoiceCallStore.getState().answered();
    renderCard();
    expect(screen.queryByTestId('voice-dtmf-dialpad')).toBeNull();
    fireEvent.click(screen.getByTestId('voice-dialpad-btn'));
    expect(screen.getByTestId('voice-dtmf-dialpad')).toBeInTheDocument();
  });

  it('CallCard_ShouldNotShowTransfer_WhenNotAssociated', () => {
    useVoiceCallStore.getState().incoming('Acme', '123');
    useVoiceCallStore.getState().answered();
    renderCard();
    // Transfer POSTs to /conversations/{id}/voice-transfer — without the screen-pop correlation
    // there is no conversation id, so the trigger stays hidden.
    expect(screen.queryByTestId('voice-transfer-btn')).toBeNull();
  });

  it('CallCard_ShouldShowTransfer_WhenActiveAndAssociated', () => {
    useVoiceCallStore.getState().incoming('Acme', '123');
    useVoiceCallStore.getState().answered();
    useVoiceCallStore.getState().associateConversation({
      conversationId: 'conv-1',
      callerName: 'Acme',
      callerNumber: '123',
    });
    renderCard();
    expect(screen.getByTestId('voice-transfer-btn')).toBeInTheDocument();
  });

  it('CallCard_ShouldOpenTransferDialog_WhenTransferClicked', () => {
    useVoiceCallStore.getState().incoming('Acme', '123');
    useVoiceCallStore.getState().answered();
    useVoiceCallStore.getState().associateConversation({
      conversationId: 'conv-1',
      callerName: 'Acme',
      callerNumber: '123',
    });
    renderCard();
    expect(screen.queryByTestId('voice-transfer-dialog-stub')).toBeNull();
    fireEvent.click(screen.getByTestId('voice-transfer-btn'));
    expect(screen.getByTestId('voice-transfer-dialog-stub')).toBeInTheDocument();
  });

  it('CallCard_ShouldShowDialingVariant_WhenOutboundRinging', () => {
    useVoiceCallStore
      .getState()
      .startOutbound({ number: '+15551234567', correlationId: 'conv-out' });
    renderCard();
    // Outbound ringing = "Dialing": a cancel button, NOT answer/reject.
    expect(screen.getByTestId('voice-cancel-dial-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('voice-answer-btn')).toBeNull();
    expect(screen.queryByTestId('voice-reject-btn')).toBeNull();
    expect(screen.getByTestId('voice-caller-id')).toHaveTextContent('+15551234567');
  });

  it('CallCard_ShouldHangup_WhenCancelDialClicked', () => {
    useVoiceCallStore.getState().startOutbound({ number: '+1', correlationId: 'conv-out' });
    renderCard();
    fireEvent.click(screen.getByTestId('voice-cancel-dial-btn'));
    expect(hangupCallMock).toHaveBeenCalled();
  });
});
