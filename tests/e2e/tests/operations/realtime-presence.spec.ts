import { test as base, expect } from '@playwright/test';
import { authenticatedPage as authenticate } from '../../helpers/auth-session';
import { DEMO_SUPERVISOR, DEMO_AGENT } from '../../helpers/credentials';

/**
 * Plan 32C Sprint 6 · T37 — Realtime presence
 *
 * Two browser contexts: a supervisor watching the agent-states page and an
 * agent driving state transitions from their own workspace. The supervisor's
 * table row should repaint within ~3s of every agent state change — driven by
 * SignalR `OnPresenceUpdated` broadcasts fanned out by PresenceFanoutService
 * (Pro 1.7.2-pro).
 *
 * These tests require the full stack (Platform API + demo seed + SignalR).
 * Run with `E2E_FULL_STACK=true npx playwright test`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

base.describe('Realtime presence (SignalR fanout)', () => {
  base.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform + Pro SignalR + demo seed)',
  );

  base('supervisor sees agent presence transition within 3s', async ({ browser }) => {
    const supervisorPage = await authenticate(browser, DEMO_SUPERVISOR);
    const agentPage = await authenticate(browser, DEMO_AGENT);

    try {
      await supervisorPage.goto('/operations/agents');
      await expect(supervisorPage.getByTestId('agent-states-table')).toBeVisible();

      const agentRow = supervisorPage
        .getByTestId('agent-states-table')
        .getByRole('row')
        .filter({ hasText: /demo agent/i });

      await expect(agentRow).toBeVisible();

      await agentPage.goto('/agent');

      // Agent toggles presence to Away via the in-app state selector.
      await agentPage.getByRole('button', { name: /available/i }).click();
      await agentPage.getByRole('menuitem', { name: /away/i }).click();

      // Supervisor should see the transition without refresh, via hub broadcast.
      await expect(agentRow.getByText(/away/i)).toBeVisible({ timeout: 3_000 });

      // Round trip: back to Available
      await agentPage.getByRole('button', { name: /away/i }).click();
      await agentPage.getByRole('menuitem', { name: /available/i }).click();

      await expect(agentRow.getByText(/available/i)).toBeVisible({ timeout: 3_000 });
    } finally {
      await supervisorPage.context().close();
      await agentPage.context().close();
    }
  });

  base('supervisor table clears presence when agent logs out', async ({ browser }) => {
    const supervisorPage = await authenticate(browser, DEMO_SUPERVISOR);
    const agentPage = await authenticate(browser, DEMO_AGENT);

    try {
      await supervisorPage.goto('/operations/agents');
      await agentPage.goto('/agent');

      const agentRow = supervisorPage
        .getByTestId('agent-states-table')
        .getByRole('row')
        .filter({ hasText: /demo agent/i });

      await expect(agentRow.getByText(/available/i)).toBeVisible({ timeout: 3_000 });

      // Close agent context — SignalR OnDisconnectedAsync fires the offline delta.
      await agentPage.context().close();

      await expect(agentRow.getByText(/offline/i)).toBeVisible({ timeout: 5_000 });
    } finally {
      await supervisorPage.context().close();
    }
  });
});

export { expect };
