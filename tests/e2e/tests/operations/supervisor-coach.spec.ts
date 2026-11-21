import { test as base, expect, type Page, type Response } from '@playwright/test';
import { authenticatedPage as authenticate } from '../../helpers/auth-session';
import { DEMO_SUPERVISOR, DEMO_AGENT } from '../../helpers/credentials';

/**
 * A silent listen leaves no trace on the agent's console, and the text whisper reaches the agent
 * (Platform change `supervisor-silent-listen`, spec `supervisor-listen-console`, "A listen SHALL
 * leave no trace on the agent's console"; design D10 there; change
 * `supervisor-whisper-reaches-the-agent`, design D6).
 *
 * The supervisor starts a listen on a live voice call from the monitor, and the agent's
 * `supervision-banner` stays hidden the whole time (polled with `expect`); the supervisor's text
 * whisper shows its "whisper sent" toast and then appears on the agent's suggestion banner as a
 * `Supervisor` item with `Critical` priority and exactly the sent text, sent through the REST route
 * (no hub supervision or whisper frame); the supervisor stops and the control returns to idle. When the browser destination is available ([B] part), the listen goes to the browser and
 * its leg is answered with no microphone prompt: the page is given no microphone permission, and
 * the listen reaches `listening`, so the receive-only answer (`a=recvonly`, lab delta d) was
 * accepted by the browser.
 *
 * Requires full stack on Platform v2.29.0 or later with the `[supervisor-listen]` dialplan context,
 * at least one live voice call with a tracked conversation, and a listen phone or a WSS URL for the
 * supervisor — run with `E2E_FULL_STACK=true`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';
const BANNER_WATCH_MS = 5_000;

const BANNER_SAMPLE_MS = 250;

/** The hub methods a whisper or a listen must never invoke from the console. */
const HUB_SUPERVISION = /WhisperToAgentAsync|StartSupervisionAsync|StopSupervisingAsync/;

/** Records every hub frame the page sends (pattern of `supervisor-silent-listen.spec.ts`). */
function recordHubFrames(page: Page): string[] {
  const frames: string[] = [];
  page.on('websocket', (ws) => {
    ws.on('framesent', (frame) => {
      if (typeof frame.payload === 'string') frames.push(frame.payload);
    });
  });
  return frames;
}

const isActiveSessions = (response: Response) =>
  response.url().endsWith('/api/v1/supervisor/sessions/active') &&
  response.request().method() === 'GET' &&
  response.ok();

/**
 * The agent's banner must never show: sample it for the whole window with `expect.poll` (no fixed
 * sleep), then assert that no sample saw it.
 */
async function expectBannerNeverShown(agentPage: Page) {
  const banner = agentPage.getByTestId('supervision-banner');
  const seen: boolean[] = [];
  await expect
    .poll(
      async () => {
        seen.push(await banner.isVisible());
        return seen.length;
      },
      { timeout: BANNER_WATCH_MS * 2, intervals: [BANNER_SAMPLE_MS] },
    )
    .toBeGreaterThanOrEqual(BANNER_WATCH_MS / BANNER_SAMPLE_MS);
  expect(seen).not.toContain(true);
}

base.describe('Supervisor silent listen and whisper (full stack)', () => {
  base.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform >= v2.29.0 with the [supervisor-listen] context + demo seed + a live voice call)',
  );

  base(
    'a listen raises no banner on the agent, and the whisper still works',
    async ({ browser }) => {
      const supervisorPage = await authenticate(browser, DEMO_SUPERVISOR);
      const agentPage = await authenticate(browser, DEMO_AGENT);

      const hubFrames = recordHubFrames(supervisorPage);

      try {
        const activeSessions = supervisorPage.waitForResponse(isActiveSessions);
        await supervisorPage.goto('/operations/monitor');
        const rows = (await (await activeSessions).json()) as {
          sessionId: string;
          conversationId: string | null;
        }[];

        // Pick the first live session whose call is tracked as a conversation.
        const firstSession = supervisorPage.getByTestId('session-card').first();
        await expect(firstSession).toBeVisible({ timeout: 10_000 });
        const sessionId = await firstSession.getAttribute('data-session-id');
        const conversationId = rows.find((row) => row.sessionId === sessionId)?.conversationId;
        expect(conversationId, 'the selected row names its conversation').toBeTruthy();
        // The agent has the call's conversation open: the banner is per conversation.
        await agentPage.goto(`/agent/conversation/${conversationId}`);
        await firstSession.click();
        const control = supervisorPage.getByTestId('listen-control');
        await expect(control).toBeVisible();
        await expect(supervisorPage.getByTestId('listen-start')).toBeEnabled();

        // Start the listen: the browser when the listen user agent is registered, else the phone.
        const destination = await control.getAttribute('data-listen-default-destination');
        await supervisorPage.getByTestId('listen-start').click();
        await supervisorPage.getByTestId(`listen-destination-${destination}`).click();
        await expect(control).toHaveAttribute('data-listen-state', /dialing|listening/);

        if (destination === 'endpoint') {
          // [B] The browser leg is answered receive-only, without a microphone prompt.
          await expect(control).toHaveAttribute('data-listen-state', 'listening', {
            timeout: 10_000,
          });
          await expect(supervisorPage.getByTestId('listen-remote-audio')).toHaveCount(1);
        }

        // The agent sees nothing.
        await expectBannerNeverShown(agentPage);

        // The text whisper goes through the REST route and reaches the agent's banner.
        const sent = `Try asking about their account status (${Date.now()})`;
        await supervisorPage.getByTestId('monitor-whisper-input').fill(sent);
        await supervisorPage.getByTestId('monitor-whisper-send').click();
        await expect(supervisorPage.locator('[data-toast="whisper-sent"]')).toBeVisible();

        const whisperItem = agentPage.locator(
          '[data-testid="suggestion-item"][data-suggestion-source="Supervisor"]',
        );
        await expect(whisperItem).toBeVisible({ timeout: 10_000 });
        await expect(whisperItem).toHaveAttribute('data-suggestion-priority', 'Critical');
        await expect(whisperItem.getByTestId('suggestion-source-label')).toBeVisible();
        // Exactly the sent string, on the message alone (the item also holds badge and label).
        await expect(whisperItem.getByTestId('suggestion-text')).toHaveText(sent);
        expect(hubFrames.filter((frame) => HUB_SUPERVISION.test(frame))).toEqual([]);

        // Stop: the control returns to idle and the agent still saw nothing.
        await control.getByTestId('listen-stop').click();
        await expect(control).toHaveAttribute('data-listen-state', 'idle');
        await expect(agentPage.getByTestId('supervision-banner')).toBeHidden();
        expect(hubFrames.filter((frame) => HUB_SUPERVISION.test(frame))).toEqual([]);
      } finally {
        await supervisorPage.context().close();
        await agentPage.context().close();
      }
    },
  );
});

export { expect };
