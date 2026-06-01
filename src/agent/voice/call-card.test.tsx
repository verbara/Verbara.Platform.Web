import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
});
