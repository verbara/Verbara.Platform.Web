import { expect, type Page } from '@playwright/test';

/**
 * Skips the first-run agent tour the way an agent does: with its "Skip tour" control.
 *
 * `AgentTour` covers the whole viewport (`fixed inset-0 z-50`) for a user whose role is `agent` until
 * it is dismissed, and the dismissal is persisted per browser (`verbara-ui` → `tourDismissed`). A spec
 * that signs a freshly created agent into a new context therefore meets it on its first `/agent` page,
 * and every click behind it lands on the overlay instead (LAB-W1, 2026-10-08: the new-conversation
 * button never received its click and the test ran out its budget).
 *
 * Call it once the agent shell is mounted (`waitForAppReady`): the tour renders on the frame after
 * mount, so the click waits for the control rather than for a clock.
 */
export async function skipAgentTour(page: Page): Promise<void> {
  await page.getByTestId('agent-tour-skip').click();
  await expect(page.getByTestId('agent-tour')).toHaveCount(0);
}
