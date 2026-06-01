import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { answerCallMock, rejectCallMock, hangupCallMock } = vi.hoisted(() => ({
  answerCallMock: vi.fn(),
  rejectCallMock: vi.fn(),
  hangupCallMock: vi.fn(),
}));

vi.mock('@/core/voice/softphone-manager', () => ({
  answerCall: answerCallMock,
  rejectCall: rejectCallMock,
  hangupCall: hangupCallMock,
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
});
