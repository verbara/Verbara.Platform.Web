import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { Button } from '@base-ui/react/button';
import { Star } from 'lucide-react';
import type { CsatEmbedContext } from './chat-widget';
import { captureCsatResponse } from './transport/csat-api';

export interface CsatPanelProps {
  /** Server-issued CSAT survey context threaded from the embed session config. */
  readonly context: CsatEmbedContext;
  /** API base the embed posts to (defaults handled by the caller). */
  readonly apiBase: string;
  /** Called when the visitor dismisses the panel (or after a successful submit). */
  readonly onDismiss: () => void;
}

const STARS = [1, 2, 3, 4, 5] as const;

type PanelState = 'idle' | 'submitting' | 'done' | 'error';

/**
 * Webchat embed CSAT rating panel (csat-runner 2.1 / 2.2).
 *
 * A 1–5 star control built with `@base-ui/react` primitives via the `render`
 * prop (never `asChild` — this repo is base-ui, not Radix), an optional comment
 * field, and dismiss/submit actions. The panel owns only `rating`, `comment`
 * and `capturedAt` (stamped at submit); the other six wire fields come from the
 * server-issued {@link CsatEmbedContext}. All copy resolves through the
 * `webchat.csat.*` i18n keys.
 */
export function CsatPanel({ context, apiBase, onDismiss }: CsatPanelProps) {
  const { t } = useTranslation('webchat');
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<PanelState>('idle');

  async function handleSubmit() {
    if (rating < 1) return;
    setState('submitting');
    const trimmed = comment.trim();
    try {
      await captureCsatResponse({
        apiBase,
        body: {
          responseToken: context.responseToken,
          surveyId: context.surveyId,
          questionId: context.questionId,
          channel: context.channel,
          queueName: context.queueName,
          conversationId: context.conversationId,
          rating,
          comment: trimmed.length > 0 ? trimmed : null,
          capturedAt: new Date().toISOString(),
        },
      });
      setState('done');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div
        className="flex flex-col items-center gap-3 p-5 text-center"
        data-testid="webchat-csat-panel"
        data-csat-state="done"
      >
        <p className="text-sm font-medium text-gray-900" data-testid="webchat-csat-thankyou">
          {t('csat.thankYou')}
        </p>
        <Button
          type="button"
          onClick={onDismiss}
          data-testid="webchat-csat-close"
          className="rounded px-4 py-2 text-sm font-medium text-white"
          render={<button style={{ background: 'var(--vw-primary, #0d9488)' }} />}
        >
          {t('csat.dismiss')}
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-4 p-5"
      data-testid="webchat-csat-panel"
      data-csat-state={state}
    >
      <div>
        <h2 className="text-base font-semibold text-gray-900">{t('csat.title')}</h2>
        <p className="text-sm text-gray-600">{t('csat.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700">{t('csat.ratingLabel')}</span>
        <RadioGroup
          value={rating > 0 ? rating : null}
          onValueChange={(value) => setRating(typeof value === 'number' ? value : 0)}
          aria-label={t('csat.ratingLabel')}
          className="flex items-center gap-1"
          data-testid="webchat-csat-stars"
        >
          {STARS.map((star) => {
            const active = star <= rating;
            return (
              <Radio.Root
                key={star}
                value={star}
                aria-label={t('csat.starAriaLabel', { count: star })}
                data-testid={`webchat-csat-star-${star}`}
                data-rating={star}
                className="cursor-pointer rounded p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vw-primary,#0d9488)]"
                render={<button type="button" />}
              >
                <Star
                  className="h-7 w-7"
                  aria-hidden="true"
                  fill={active ? 'currentColor' : 'none'}
                  color={active ? 'var(--vw-primary, #0d9488)' : '#cbd5e1'}
                />
              </Radio.Root>
            );
          })}
        </RadioGroup>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="webchat-csat-comment" className="text-sm font-medium text-gray-700">
          {t('csat.commentLabel')}
        </label>
        <textarea
          id="webchat-csat-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder={t('csat.commentPlaceholder')}
          data-testid="webchat-csat-comment"
          className="w-full resize-none rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
      </div>

      {state === 'error' && (
        <p role="alert" className="text-xs text-red-600" data-testid="webchat-csat-error">
          {t('csat.error')}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          onClick={onDismiss}
          data-testid="webchat-csat-dismiss"
          className="text-sm font-medium text-gray-500 hover:text-gray-700"
          render={<button />}
        >
          {t('csat.dismiss')}
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={rating < 1 || state === 'submitting'}
          data-testid="webchat-csat-submit"
          className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          render={<button style={{ background: 'var(--vw-primary, #0d9488)' }} />}
        >
          {t('csat.submit')}
        </Button>
      </div>
    </div>
  );
}
