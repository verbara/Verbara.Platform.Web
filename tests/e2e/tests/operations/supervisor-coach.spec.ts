import { test as base, expect, type Page } from '@playwright/test';
import { authenticatedPage as authenticate } from '../../helpers/auth-session';
import { DEMO_SUPERVISOR, DEMO_AGENT } from '../../helpers/credentials';

/**
 * A silent listen leaves no trace on the agent's console, and the text whisper still works
 * (Platform change `supervisor-silent-listen`, spec `supervisor-listen-console`, "A listen SHALL
 * leave no trace on the agent's console"; design D10 here).
 *
 * The supervisor starts a listen on a live voice call from the monitor, and the agent's
 * `supervision-banner` stays hidden the whole time (polled with `expect`); the supervisor's text
 * whisper still shows its "whisper sent" toast; the supervisor stops and the control returns to
 * idle. When the browser destination is available ([B] part), the listen goes to the browser and
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

      try {
        await supervisorPage.goto('/operations/monitor');
        await agentPage.goto('/agent');

        // Pick the first live session whose call is tracked as a conversation.
        const firstSession = supervisorPage.getByTestId('session-card').first();
        await expect(firstSession).toBeVisible({ timeout: 10_000 });
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

        // The text whisper still works over the hub.
        await supervisorPage
          .getByTestId('monitor-whisper-input')
          .fill('Try asking about their account status');
        await supervisorPage.getByTestId('monitor-whisper-send').click();
        await expect(supervisorPage.locator('[data-toast="whisper-sent"]')).toBeVisible();

        // Stop: the control returns to idle and the agent still saw nothing.
        await control.getByTestId('listen-stop').click();
        await expect(control).toHaveAttribute('data-listen-state', 'idle');
        await expect(agentPage.getByTestId('supervision-banner')).toBeHidden();
      } finally {
        await supervisorPage.context().close();
        await agentPage.context().close();
      }
    },
  );
});

export { expect };
