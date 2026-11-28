/**
 * The voice Monitor card renders every row of `active-session.v2.json` (spec
 * `voice-monitor-session-list`, requirements 2-4; design D2): a null `agentName` shows a localized
 * fallback title, never a blank title or the raw `agentId`; a null or unparsable `connectedAt`
 * shows a placeholder and schedules no interval; null `queueName`, `callerIdNum` and `sentiment`
 * render nothing.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18next, { type i18n as I18n } from 'i18next';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { components } from '@/core/api/generated/openapi';
import enOperations from '../../../public/locales/en-US/operations.json';
import { SessionCard } from './session-card';
import { defined } from '@/test/defined';

type Row = components['schemas']['ActiveSessionDto'];

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts/active-session.v2.json'), 'utf-8'),
) as { body: Row[] };
const resolvedRow = defined(fixture.body[0], 'the resolved row');
const unresolvedRow = defined(fixture.body[1], 'the unresolved row');
const AGENT_ID = '0651f84b6f284a1c9b8d658330fa8310';

let i18n: I18n;

beforeEach(async () => {
  i18n = i18next.createInstance();
  await i18n.init({
    lng: 'en-US',
    fallbackLng: false,
    resources: { 'en-US': { operations: enOperations } },
    ns: ['operations'],
    defaultNS: 'operations',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  vi.useFakeTimers({
    toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'],
  });
  vi.setSystemTime(new Date('2026-10-12T15:02:05Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

function card(session: Row) {
  return (
    <I18nextProvider i18n={i18n}>
      <SessionCard session={session} isSelected={false} onClick={() => {}} />
    </I18nextProvider>
  );
}

describe('SessionCard — active-session.v2.json rows', () => {
  it('SessionCard_ShouldShowNameSentimentAndDuration_WhenTheRowIsResolved', () => {
    render(card(resolvedRow));
    const title = screen.getByTestId('session-card-title');
    expect(title).toHaveTextContent('Ana Gómez');
    expect(title).not.toHaveAttribute('data-agent-name');
    expect(screen.getByTitle('Frustrated')).toBeInTheDocument();
    const duration = screen.getByTestId('session-card-duration');
    expect(duration).toHaveTextContent('01:05');
    expect(duration).not.toHaveAttribute('data-duration');
  });

  it('SessionCard_ShouldShowTheFallbackTitleAndPlaceholder_WhenEveryMemberIsNull', () => {
    const { container } = render(card(unresolvedRow));
    const title = screen.getByTestId('session-card-title');
    expect(title).toHaveAttribute('data-agent-name', 'unknown');
    expect(title).toHaveTextContent(enOperations.monitor.unknown_agent);
    const duration = screen.getByTestId('session-card-duration');
    expect(duration).toHaveAttribute('data-duration', 'unknown');
    expect(duration).toHaveAttribute('aria-label', enOperations.monitor.duration_unknown);
    expect(screen.queryByTestId('session-card-sentiment')).toBeNull();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/null|undefined/);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('session-card-duration')).toHaveAttribute('data-duration', 'unknown');
    expect(container.textContent).not.toMatch(/\d\d:\d\d/);
  });

  it('SessionCard_ShouldShowTheFallbackNotTheId_WhenAgentIdIsSetAndAgentNameIsNull', () => {
    const { container } = render(card({ ...unresolvedRow, agentId: AGENT_ID }));
    const title = screen.getByTestId('session-card-title');
    expect(title).toHaveAttribute('data-agent-name', 'unknown');
    expect(title).toHaveTextContent(enOperations.monitor.unknown_agent);
    expect(container.textContent).not.toContain(AGENT_ID);
  });
});

describe('SessionCard — live duration timer', () => {
  it('SessionCard_ShouldScheduleNoInterval_WhenConnectedAtIsNull', () => {
    render(card(unresolvedRow));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('SessionCard_ShouldScheduleNoInterval_WhenConnectedAtIsUnparsable', () => {
    render(card({ ...resolvedRow, connectedAt: 'not-a-date' }));
    expect(screen.getByTestId('session-card-duration')).toHaveAttribute('data-duration', 'unknown');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('SessionCard_ShouldClearTheInterval_WhenConnectedAtBecomesNull', () => {
    const { rerender } = render(card(resolvedRow));
    expect(vi.getTimerCount()).toBe(1);
    rerender(card({ ...resolvedRow, connectedAt: null }));
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.getByTestId('session-card-duration')).toHaveAttribute('data-duration', 'unknown');
  });

  it('SessionCard_ShouldAdvanceOneSecondPerTick_WhenConnectedAtIsValid', () => {
    render(card(resolvedRow));
    expect(screen.getByTestId('session-card-duration')).toHaveTextContent('01:05');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('session-card-duration')).toHaveTextContent('01:06');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('session-card-duration')).toHaveTextContent('01:07');
  });
});
