import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { CsatPanel } from './csat-panel';
import type { CsatEmbedContext } from './chat-widget';

// The panel posts through the embed transport; mock it so these are pure
// component tests (the transport's own wire-shape contract lives in
// transport/csat-api.test.ts).
const captureMock = vi.fn<(input: unknown) => Promise<void>>();
vi.mock('./transport/csat-api', () => ({
  captureCsatResponse: (input: unknown) => captureMock(input),
}));

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      defaultNS: 'webchat',
      ns: ['webchat'],
      resources: {
        'en-US': {
          webchat: {
            csat: {
              title: 'How did we do?',
              subtitle: 'Rate your chat',
              ratingLabel: 'Your rating',
              starAriaLabel: '{{count}} star',
              commentLabel: 'Comment',
              commentPlaceholder: 'Tell us more…',
              submit: 'Submit',
              dismiss: 'No thanks',
              thankYou: 'Thanks for your feedback!',
              error: 'Something went wrong. Please try again.',
            },
          },
        },
      },
    });
  }
});

const CONTEXT: CsatEmbedContext = {
  responseToken: 'v1.token',
  surveyId: 'srv-csat-v1',
  questionId: 'csat-rating-v1',
  channel: 'webchat',
  queueName: 'support-tier1',
  conversationId: 'conv-8f2a1c4e',
};

function wrap(ui: ReactNode) {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

function renderPanel(onDismiss = vi.fn()) {
  return render(wrap(<CsatPanel context={CONTEXT} apiBase="/api/v1" onDismiss={onDismiss} />));
}

describe('CsatPanel', () => {
  afterEach(() => {
    captureMock.mockReset();
  });

  it('Renders_InIdleState_WithSubmitDisabled_WhenNoRatingSelected', () => {
    renderPanel();
    const panel = screen.getByTestId('webchat-csat-panel');
    expect(panel).toHaveAttribute('data-csat-state', 'idle');
    expect(screen.getByTestId('webchat-csat-submit')).toBeDisabled();
  });

  it('Submit_ShouldPostContextPlusRatingComment_WhenRatingSelected', async () => {
    captureMock.mockResolvedValueOnce(undefined);
    renderPanel();

    fireEvent.click(screen.getByTestId('webchat-csat-star-4'));
    fireEvent.change(screen.getByTestId('webchat-csat-comment'), {
      target: { value: '  great  ' },
    });
    fireEvent.click(screen.getByTestId('webchat-csat-submit'));

    await waitFor(() => expect(captureMock).toHaveBeenCalledOnce());
    expect(captureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiBase: '/api/v1',
        body: expect.objectContaining({
          responseToken: CONTEXT.responseToken,
          surveyId: CONTEXT.surveyId,
          questionId: CONTEXT.questionId,
          channel: CONTEXT.channel,
          queueName: CONTEXT.queueName,
          conversationId: CONTEXT.conversationId,
          rating: 4,
          comment: 'great', // trimmed
        }),
      }),
    );
    const body = captureMock.mock.calls[0][0] as { body: { capturedAt: string } };
    expect(body.body.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO-8601 stamp
  });

  it('Submit_ShouldSendNullComment_WhenCommentBlank', async () => {
    captureMock.mockResolvedValueOnce(undefined);
    renderPanel();
    fireEvent.click(screen.getByTestId('webchat-csat-star-5'));
    fireEvent.click(screen.getByTestId('webchat-csat-submit'));
    await waitFor(() => expect(captureMock).toHaveBeenCalledOnce());
    const body = captureMock.mock.calls[0][0] as { body: { comment: string | null } };
    expect(body.body.comment).toBeNull();
  });

  it('Submit_ShouldReachDoneState_WhenCaptureSucceeds', async () => {
    captureMock.mockResolvedValueOnce(undefined);
    renderPanel();
    fireEvent.click(screen.getByTestId('webchat-csat-star-3'));
    fireEvent.click(screen.getByTestId('webchat-csat-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('webchat-csat-panel')).toHaveAttribute('data-csat-state', 'done'),
    );
    expect(screen.getByTestId('webchat-csat-thankyou')).toBeInTheDocument();
  });

  it('Submit_ShouldReachErrorState_WhenCaptureFails', async () => {
    captureMock.mockRejectedValueOnce(new Error('boom'));
    renderPanel();
    fireEvent.click(screen.getByTestId('webchat-csat-star-2'));
    fireEvent.click(screen.getByTestId('webchat-csat-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('webchat-csat-panel')).toHaveAttribute('data-csat-state', 'error'),
    );
    expect(screen.getByTestId('webchat-csat-error')).toBeInTheDocument();
  });

  it('Dismiss_ShouldCallOnDismiss_WhenClicked', () => {
    const onDismiss = vi.fn();
    renderPanel(onDismiss);
    fireEvent.click(screen.getByTestId('webchat-csat-dismiss'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
