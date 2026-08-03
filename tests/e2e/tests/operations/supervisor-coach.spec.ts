import { test as base, expect } from '@playwright/test';
import { authenticatedPage as authenticate } from '../../helpers/auth-session';
import { DEMO_SUPERVISOR, DEMO_AGENT } from '../../helpers/credentials';

/**
 * Plan 32C Sprint 6 · T38 — Supervisor coaching loop
 *
 * Supervisor starts a supervision session on an agent's active conversation
 * (IPlatformHubClient.OnSupervisionStarted pushes to the agent); agent sees
 * the SupervisionBanner at the top of their layout; supervisor sends a
 * whisper (IPlatformHubClient.OnWhisperReceived); supervisor stops and the
 * banner disappears.
 *
 * Requires full stack — run with `E2E_FULL_STACK=true`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

base.describe('Supervisor coaching loop (SignalR hub)', () => {
  base.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform + Pro SignalR + demo seed + at least one live conversation)',
  );

  base(
    'supervisor starts, whispers, and stops supervision — agent sees banner',
    async ({ browser }) => {
      const supervisorPage = await authenticate(browser, DEMO_SUPERVISOR);
      const agentPage = await authenticate(browser, DEMO_AGENT);

      try {
        await supervisorPage.goto('/operations/monitor');
        await agentPage.goto('/agent');

        // Pick the first live session from the supervisor monitor and open its detail.
        const firstSession = supervisorPage.getByTestId('session-card').first();
        await expect(firstSession).toBeVisible({ timeout: 10_000 });
        await firstSession.click();

        // Start supervision from the detail pane.
        await supervisorPage.getByRole('button', { name: /supervise/i }).click();

        // Agent-facing banner should appear via OnSupervisionStarted.
        await expect(agentPage.getByTestId('supervision-banner')).toBeVisible({ timeout: 3_000 });

        // Whisper delivery.
        await supervisorPage
          .getByPlaceholder(/whisper/i)
          .fill('Try asking about their account status');
        await supervisorPage.getByRole('button', { name: /send/i }).click();
        await expect(supervisorPage.getByText(/whisper sent/i)).toBeVisible({ timeout: 3_000 });

        // Stop supervision — banner clears on agent side.
        await supervisorPage.getByRole('button', { name: /stop/i }).click();
        await expect(agentPage.getByTestId('supervision-banner')).toBeHidden({ timeout: 5_000 });
      } finally {
        await supervisorPage.context().close();
        await agentPage.context().close();
      }
    },
  );
});

export { expect };
