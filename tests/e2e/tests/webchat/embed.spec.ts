import { test, expect } from '../../fixtures/auth.fixture';

test.describe('WebChat widget — demo page', () => {
  test('Loads_Demo_AndOpensIframe_OnBubbleClick', async ({ page }) => {
    await page.goto('/webchat/demo.html');
    await expect(page.locator('h1')).toContainText('WebChat');

    const bubbleHost = page.locator('[data-verbara-webchat-bubble]');
    await expect(bubbleHost).toBeVisible({ timeout: 5_000 });

    await bubbleHost.click();

    const iframe = page.locator('iframe[data-verbara-webchat-iframe]');
    await expect(iframe).toBeVisible({ timeout: 5_000 });
  });
});

/**
 * "The line stays inside the widget's viewport" (spec `console-verbara-attribution`, design D7). The
 * widget is framed in a 360x160 iframe, shorter than the pre-chat form, the conversation and the
 * survey, so a layout that let the content push the line out would put it below the frame's bottom.
 * 160, not the 200 first planned: at 200 the conversation (header, status banner, the list's minimum
 * and the composer, 169 px) fits the 175 px the footer leaves, so its overflow guard could not hold.
 * jsdom does no layout, so only this browser measurement proves it.
 */
const HOST_PAGE = '/e2e-widget-host.html';
const FRAME_WIDTH = 360;
const FRAME_HEIGHT = 160;
const HOST_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Widget host</title>
<style>html,body{margin:0;padding:0}iframe{display:block;border:0;margin:40px}</style></head>
<body><iframe src="/webchat/embed/index.html" width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" title="Widget"></iframe></body></html>`;

const VISITOR = { name: 'Jane', email: 'jane@example.com' };
const BASE_PAYLOAD = {
  tenantId: 'demo-tenant',
  apiBase: '/api/v1',
  visitorId: 'visitor-e2e-frame',
  pageContext: { url: 'https://example.com', title: 'Demo', referrer: '' },
};

interface WidgetState {
  readonly name: string;
  /** `null`: post nothing, the widget stays loading. */
  readonly payload: Record<string, unknown> | null;
  /** The element that proves the state rendered. */
  readonly marker: string;
  /** The loading spinner cannot overflow, so only the other states check the guard. */
  readonly overflows: boolean;
}

const STATES: readonly WidgetState[] = [
  { name: 'loading', payload: null, marker: 'webchat-embed-loading', overflows: false },
  { name: 'pre-chat', payload: BASE_PAYLOAD, marker: 'webchat-pre-chat-form', overflows: true },
  {
    name: 'conversation',
    payload: { ...BASE_PAYLOAD, visitor: VISITOR },
    marker: 'webchat-sound-toggle',
    overflows: true,
  },
  {
    name: 'survey',
    payload: {
      ...BASE_PAYLOAD,
      visitor: VISITOR,
      csat: {
        responseToken: 'v1.e2e-token.hmac-sha256-7d-ttl',
        surveyId: 'srv-csat-v1',
        questionId: 'csat-rating-v1',
        channel: 'webchat',
        queueName: 'support-tier1',
        conversationId: 'conv-e2e-8f2a1c4e',
      },
    },
    marker: 'webchat-csat-panel',
    overflows: true,
  },
];

test.describe('WebChat widget — Powered by Verbara line in a short frame', () => {
  for (const state of STATES) {
    test(`PoweredBy_ShouldStayInsideTheFrame_WhenTheWidgetIs_${state.name}`, async ({ page }) => {
      await page.route(`**${HOST_PAGE}`, (route) =>
        route.fulfill({ status: 200, contentType: 'text/html', body: HOST_HTML }),
      );
      await page.goto(HOST_PAGE);

      const frame = page.frameLocator('iframe');
      // The bridge is listening once the loading shell exists; postMessage does not buffer.
      await expect(frame.getByTestId('webchat-embed-loading')).toBeVisible();
      if (state.payload !== null) {
        await page.evaluate((payload) => {
          const iframe = document.querySelector('iframe');
          iframe?.contentWindow?.postMessage(
            { source: 'verbara-webchat-host', type: 'init-config', payload },
            window.location.origin,
          );
        }, state.payload);
      }
      await expect(frame.getByTestId(state.marker)).toBeVisible();

      const line = frame.getByTestId('webchat-powered-by');
      await expect(line).toBeVisible();

      if (state.overflows) {
        // The frame is shorter than its content: what the widget renders is taller than the
        // viewport height the footer leaves it. Measured on the content element (the footer's
        // previous sibling) but against the viewport, not against the element's own clientHeight,
        // so a broken layout that grows the element instead of scrolling it still passes this guard
        // and is caught by the containment check below.
        const sizes = await line.evaluate((el) => {
          const footer = el.parentElement;
          const content = footer?.previousElementSibling as HTMLElement | null;
          return {
            contentScrollHeight: content?.scrollHeight ?? 0,
            // Rounded up: scrollHeight is an integer, the footer's height is not.
            available: Math.ceil(
              window.innerHeight - (footer?.getBoundingClientRect().height ?? 0),
            ),
          };
        });
        expect(
          sizes.contentScrollHeight,
          `content ${sizes.contentScrollHeight}px must overflow the ${sizes.available}px left in a ${FRAME_HEIGHT}px frame`,
        ).toBeGreaterThan(sizes.available);
      }

      const lineBox = await line.boundingBox();
      const frameBox = await page.locator('iframe').boundingBox();
      if (!lineBox || !frameBox) throw new Error('missing bounding box');
      expect(lineBox.y).toBeGreaterThanOrEqual(frameBox.y);
      expect(lineBox.y + lineBox.height).toBeLessThanOrEqual(frameBox.y + frameBox.height);
      expect(lineBox.x).toBeGreaterThanOrEqual(frameBox.x);
      expect(lineBox.x + lineBox.width).toBeLessThanOrEqual(frameBox.x + frameBox.width);
    });
  }
});
