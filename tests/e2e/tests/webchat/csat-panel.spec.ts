import { test, expect } from '@playwright/test';

/**
 * WebChat embed CSAT rating-panel submit flow (csat-runner Phase C, task 3.3).
 *
 * SERVING CONTRACT
 * ----------------
 * The embed iframe app (`src/webchat/embed`) is served at `/webchat/embed/index.html`
 * (built by `npm run build:webchat-embed` into `public/webchat/embed/`, shipped as
 * a static asset). It boots into a "Loading…" state and renders real UI only once
 * it receives an `init-config` postMessage envelope from its host
 * (`{ source: 'verbara-webchat-host', type: 'init-config', payload }`) whose origin
 * equals the embed's own origin (see `src/webchat/embed/app.tsx` +
 * `src/webchat/sdk/postmessage-bridge.ts`). At top level `window.parent === window`,
 * so we can drive that handshake directly from the test with a same-origin
 * `window.postMessage`, supplying the server-issued `csat` context that the panel
 * needs. This makes the test self-contained w.r.t. the backend: the ONLY network
 * call it makes — the capture POST — is `page.route`-mocked below, and we assert on
 * it via `page.waitForResponse` (never `waitForTimeout`; retries:1 workers:1 come
 * from playwright.config.ts). All selectors are `data-testid` / `data-*`, so the
 * test is locale-proof (it never asserts on translated copy).
 *
 * LOCAL-EXECUTION NOTE (honest): in the sandboxed dev container this spec could not
 * be *executed* — the running server (nginx static mirror) does not serve a freshly
 * built embed entry (`/webchat/embed/index.html` → 500) and there is no backend on
 * :5000. It is authored to run in the opt-in Playwright CI job (`.github/workflows/
 * playwright.yml`, which runs `npm run build` against a provisioned stack). No pass
 * was faked locally.
 */

interface CsatEmbedContext {
  responseToken: string;
  surveyId: string;
  questionId: string;
  channel: string;
  queueName: string;
  conversationId: string;
}

const CSAT_CONTEXT: CsatEmbedContext = {
  responseToken: 'v1.e2e-token.hmac-sha256-7d-ttl',
  surveyId: 'srv-csat-v1',
  questionId: 'csat-rating-v1',
  channel: 'webchat',
  queueName: 'support-tier1',
  conversationId: 'conv-e2e-8f2a1c4e',
};

/** The nine golden wire keys the capture body must carry (verbatim-fixture-citation). */
const GOLDEN_KEYS = [
  'responseToken',
  'surveyId',
  'questionId',
  'channel',
  'queueName',
  'rating',
  'comment',
  'capturedAt',
  'conversationId',
].sort();

const EMBED_URL = '/webchat/embed/index.html';
// The embed posts to `${apiBase}/csat/responses/webchat`; apiBase defaults to /api/v1.
const CAPTURE_URL_GLOB = '**/csat/responses/webchat';

test.describe('WebChat embed — CSAT rating panel submit flow', () => {
  test('SelectStar_Submit_ShowsThankYou_AndPostsCaptureBody', async ({ page }) => {
    let capturedBody: Record<string, unknown> | null = null;

    // Mock the capture endpoint — record the exact JSON body, ack 200.
    await page.route(CAPTURE_URL_GLOB, async (route) => {
      if (route.request().method() === 'POST') {
        capturedBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.continue();
    });

    await page.goto(EMBED_URL);

    // The embed shows a "Loading…" shell until it receives init-config. Wait for the
    // app root to mount, then hand it a config that enables the CSAT panel.
    await page.waitForSelector('#root', { state: 'attached' });
    await page.evaluate((csat) => {
      window.postMessage(
        {
          source: 'verbara-webchat-host',
          type: 'init-config',
          payload: {
            tenantId: 'demo-tenant',
            apiBase: '/api/v1',
            visitorId: 'visitor-e2e',
            visitor: { name: 'Jane', email: 'jane@example.com' },
            pageContext: { url: 'https://example.com', title: 'Demo', referrer: '' },
            csat,
          },
        },
        window.location.origin,
      );
    }, CSAT_CONTEXT);

    // Panel renders in its idle state (data-* only — locale-proof).
    const panel = page.getByTestId('webchat-csat-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-csat-state', 'idle');

    // Submit is disabled until a rating is chosen.
    const submit = page.getByTestId('webchat-csat-submit');
    await expect(submit).toBeDisabled();

    // Select 5 stars, optionally comment, submit — and await the capture POST.
    await page.getByTestId('webchat-csat-star-5').click();
    await page.getByTestId('webchat-csat-comment').fill('Fast and friendly, thanks!');
    await expect(submit).toBeEnabled();

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/csat/responses/webchat') && r.request().method() === 'POST',
      ),
      submit.click(),
    ]);
    expect(response.ok()).toBe(true);

    // Panel transitions to the thank-you (done) state — asserted via data-* only.
    await expect(panel).toHaveAttribute('data-csat-state', 'done');
    await expect(page.getByTestId('webchat-csat-thankyou')).toBeVisible();

    // The captured body carries EXACTLY the golden wire keys (verbatim-fixture guard),
    // with the panel-owned rating/comment/capturedAt populated correctly.
    expect(capturedBody).not.toBeNull();
    const body = capturedBody as unknown as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(GOLDEN_KEYS);
    expect(body.rating).toBe(5);
    expect(body.channel).toBe('webchat');
    expect(body.responseToken).toBe(CSAT_CONTEXT.responseToken);
    expect(body.comment).toBe('Fast and friendly, thanks!');
    expect(String(body.capturedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
