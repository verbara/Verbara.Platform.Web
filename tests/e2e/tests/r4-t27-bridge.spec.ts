import { test as base, expect } from '@playwright/test';
import { DEMO_SUPERVISOR } from '../helpers/credentials';
import { authenticatedPage as authenticate } from '../helpers/auth-session';

/**
 * R5.3 Phase C · S4.7 — R4 T27 bridge end-to-end.
 *
 * Closes the R4 acceptance criterion by validating that the Pro.Push.SignalR
 * T27 event bridges fire all the way through the stack:
 *
 *   Pro.Push.SignalR (ConversationStatePushBridge)
 *     → IPushEventBus
 *     → Platform PushToHubRelay (typed IPlatformHubClient)
 *     → Web SignalR client (`onHubEvent('OnConversationStateChanged')`)
 *     → TanStack Query invalidation of `['call-analytics']`
 *
 * Trigger: forced supervisor close on a seeded conversation. Assert: the
 * `/analytics/speech` page issues a `/api/v1/call-analytics/...` refetch
 * within 500ms of the bridge event.
 *
 * Requires the full stack (Platform API + Pro.Push.SignalR + demo seed).
 * Run with `E2E_FULL_STACK=true npx playwright test`. SKIPPED otherwise.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

base.describe('R4 T27 bridge (conversation close → call-analytics invalidation)', () => {
  base.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform + Pro SignalR + demo seed)',
  );

  base(
    'conversation close invalidates ["call-analytics"] within 500ms',
    async ({ browser, request }) => {
      const { page, token } = await authenticate(browser, DEMO_SUPERVISOR);

      try {
        await page.goto('/analytics/speech');
        await expect(page.getByTestId('speech-analytics-page')).toBeVisible();
        await page.waitForLoadState('networkidle');

        // Resolve a fixture conversation id. The demo seed exposes an active
        // session list under the supervisor-scoped sessions endpoint; we pick
        // the first one to force-close. If the seed is empty, the spec fails
        // loudly instead of silently passing.
        const sessionsRes = await request.get(`${API_BASE}/api/v1/supervisor/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!sessionsRes.ok()) {
          throw new Error(
            `Could not list supervisor sessions: ${sessionsRes.status()} (full stack required)`,
          );
        }
        const sessionsBody: { items?: Array<{ id: string }> } = await sessionsRes.json();
        const sessionId = sessionsBody.items?.[0]?.id;
        if (!sessionId) {
          throw new Error('No active conversation in demo seed; cannot exercise T27 bridge');
        }

        // Race the refetch promise BEFORE issuing the close so we never miss
        // the event. The page subscribes to OnConversationStateChanged and on
        // newState === "ended" invalidates ["call-analytics"], which causes
        // the active topics/sentiment/compliance hooks to refetch.
        const refetchPromise = page.waitForRequest(
          (req) => req.url().includes('/api/v1/call-analytics/') && req.method() === 'GET',
          { timeout: 500 },
        );

        const closeRes = await request.post(`${API_BASE}/api/v1/conversations/${sessionId}/close`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(closeRes.ok()).toBeTruthy();

        // Bridge round-trip: Pro publishes → Platform relays → Web invalidates.
        await refetchPromise;
      } finally {
        await page.context().close();
      }
    },
  );
});

export { expect };
