import { createHmac, randomBytes } from 'node:crypto';
import type {
  APIRequestContext,
  Browser,
  BrowserContext,
  FrameLocator,
  Page,
  WebSocket,
} from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';
import { API_BASE } from '../../helpers/credentials';

/**
 * The widget's identity token in a real browser against a real Platform (change
 * `webchat-visitor-identity-two-levels-web`, task 7.3; requires Platform with #543 and level 1 on, as
 * `docker-compose.full.yml` sets it). The SDK is the one the web image serves, on a page whose only
 * job is to load it without auto-init: a site that signs tokens calls `init` from its own script.
 * Tokens are signed here with a secret this spec sets through the admin route and clears afterwards.
 *
 * Two tabs of one browser context share `localStorage` and each runs its own widget, so these cases
 * read what each tab shows and which sockets it holds, not only what is stored.
 *
 * Run with `E2E_FULL_STACK=true npm run e2e -- webchat/widget-identity.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

const TENANT = 'demo';
const CHANNEL_PATH = '/api/v1/admin/channels/webchat';
const SESSIONS_PATH = '/api/v1/webchat/sessions';
const HOST_PATH = '/e2e-widget-identity-host.html';
const HOST_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Identity host</title></head>
<body><script src="/webchat/v1/verbara-webchat.js"></script></body></html>`;
const IFRAME = 'iframe[data-verbara-webchat-iframe]';

/** A frame swap, a session create and a socket, over a cold embed bundle. */
const WIDGET_TIMEOUT = 20_000;

const b64u = (text: string) => Buffer.from(text).toString('base64url');

function signToken(secret: string, externalId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(
    JSON.stringify({ external_id: externalId, aud: TENANT, iat: now, exp: now + 1800 }),
  );
  const signature = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}

interface SessionCreate {
  visitorId: string | undefined;
  identityToken: string | undefined;
}

interface Tab {
  page: Page;
  sockets: WebSocket[];
}

/** One browser: the host page served at the gateway's origin, and every session create it makes. */
class Visitor {
  readonly creates: SessionCreate[] = [];

  private constructor(readonly context: BrowserContext) {}

  static async open(browser: Browser): Promise<Visitor> {
    const context = await browser.newContext({ baseURL: 'http://localhost' });
    await context.route(`**${HOST_PATH}`, (route) =>
      route.fulfill({ contentType: 'text/html', body: HOST_HTML }),
    );
    const visitor = new Visitor(context);
    context.on('request', (request) => {
      if (request.method() !== 'POST' || new URL(request.url()).pathname !== SESSIONS_PATH) return;
      const body = request.postDataJSON() as { visitorId?: string; identityToken?: string };
      visitor.creates.push({ visitorId: body.visitorId, identityToken: body.identityToken });
    });
    return visitor;
  }

  async tab(): Promise<Tab> {
    const page = await this.context.newPage();
    const sockets: WebSocket[] = [];
    page.on('websocket', (ws) => sockets.push(ws));
    await page.goto(HOST_PATH);
    return { page, sockets };
  }
}

async function initWidget(
  page: Page,
  config: { identityToken?: string; visitor?: { name: string; email: string } },
  { open = true }: { open?: boolean } = {},
): Promise<void> {
  await page.evaluate(
    ({ tenantId, config: extra, open: openIt }) => {
      const w = window as unknown as {
        VerbaraWebChat: {
          init: (c: object) => void;
          on: (e: string, h: (p: unknown) => void) => void;
          open: () => void;
        };
        __identity: unknown[];
      };
      w.__identity = [];
      w.VerbaraWebChat.init({ tenantId, locale: 'en-US', ...extra });
      w.VerbaraWebChat.on('identity', (p) => w.__identity.push(p));
      if (openIt) w.VerbaraWebChat.open();
    },
    { tenantId: TENANT, config, open },
  );
}

async function openWidget(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { VerbaraWebChat: { open: () => void } }).VerbaraWebChat.open();
  });
}

/** Signs a customer in with a name and an e-mail in one call, which is how a site's login usually reads. */
async function signIn(
  page: Page,
  update: { name: string; email: string; identityToken: string },
): Promise<void> {
  await page.evaluate((u) => {
    const w = window as unknown as { VerbaraWebChat: { setVisitor: (v: object) => void } };
    w.VerbaraWebChat.setVisitor(u);
  }, update);
}

/** `__identity` keeps every event of the page, so a check of the next session has to start it over. */
async function forgetIdentityEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __identity: unknown[] }).__identity = [];
  });
}

async function setToken(page: Page, identityToken: string | null): Promise<void> {
  await page.evaluate((token) => {
    const w = window as unknown as {
      VerbaraWebChat: { setVisitor: (u: { identityToken: string | null }) => void };
    };
    w.VerbaraWebChat.setVisitor({ identityToken: token });
  }, identityToken);
}

/** The widget's frame once it is the only one: a frame still forgetting leaves when it is done. */
async function widget(page: Page): Promise<FrameLocator> {
  await expect(page.locator(IFRAME)).toHaveCount(1, { timeout: WIDGET_TIMEOUT });
  return page.frameLocator(IFRAME);
}

async function waitComposer(page: Page): Promise<FrameLocator> {
  const frame = await widget(page);
  await expect(frame.locator('textarea')).toBeEnabled({ timeout: WIDGET_TIMEOUT });
  return frame;
}

async function say(page: Page, text: string): Promise<void> {
  const frame = await waitComposer(page);
  await frame.locator('textarea').fill(text);
  await frame.locator('textarea').press('Enter');
  await expect(frame.getByText(text)).toBeVisible();
}

function identityEvents(page: Page): Promise<{ identityLevel: string }[]> {
  return page.evaluate(
    () => (window as unknown as { __identity: { identityLevel: string }[] }).__identity,
  );
}

async function expectLastIdentity(page: Page, level: string): Promise<void> {
  await expect
    .poll(async () => (await identityEvents(page)).at(-1)?.identityLevel, {
      message: 'the identity event',
      timeout: WIDGET_TIMEOUT,
    })
    .toBe(level);
}

function storedVisitorId(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), `verbara-webchat-visitor:${TENANT}`);
}

/** What the embed origin (here the page's own) still keeps of a visitor. */
function keptOf(page: Page, visitorId: string): Promise<string[]> {
  return page.evaluate(
    ({ tenant, id }) => {
      const kept: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        const held =
          key === `verbara-webchat-messages:${tenant}:${id}` ||
          key === `verbara-webchat-queue:${tenant}:${id}` ||
          (key === `verbara-webchat-session:${tenant}` &&
            (localStorage.getItem(key) ?? '').includes(id));
        if (held) kept.push(key);
      }
      return kept;
    },
    { tenant: TENANT, id: visitorId },
  );
}

const openSockets = (tab: Tab) => tab.sockets.filter((ws) => !ws.isClosed()).length;

/** Tab is showing a widget that started after A, and nothing of A is left in it. */
async function expectDiscarded(
  tab: Tab,
  frame: FrameLocator,
  marks: readonly string[],
  socketsOfA: readonly WebSocket[],
): Promise<void> {
  for (const mark of marks) await expect(frame.getByText(mark)).toHaveCount(0);
  await expect
    .poll(() => socketsOfA.filter((ws) => !ws.isClosed()).length, {
      message: "the sockets of A's session",
      timeout: WIDGET_TIMEOUT,
    })
    .toBe(0);
  expect(openSockets(tab), 'at most the socket of the widget now running').toBeLessThanOrEqual(1);
}

/** A tab the site has not told: it asks for a new visitor, with no token left and nothing of A. */
async function expectUntoldTabDiscarded(
  tab: Tab,
  marks: readonly string[],
  socketsOfA: readonly WebSocket[],
): Promise<void> {
  const frame = await widget(tab.page);
  await expect(frame.locator('#webchat-name'), 'the form of a new visitor').toBeVisible({
    timeout: WIDGET_TIMEOUT,
  });
  await expectDiscarded(tab, frame, marks, socketsOfA);
}

/** Two tabs chatting as customer A, each on a live socket and showing what it sent. */
async function twoTabsAsA(visitor: Visitor, token: string, stamp: string) {
  const profile = { name: 'Customer A', email: 'a@e2e.local' };
  const one = await visitor.tab();
  await initWidget(one.page, { identityToken: token, visitor: profile });
  const markOne = `tab one of A ${stamp}`;
  await say(one.page, markOne);
  const two = await visitor.tab();
  await initWidget(two.page, { identityToken: token, visitor: profile });
  const markTwo = `tab two of A ${stamp}`;
  await say(two.page, markTwo);
  await expect.poll(() => openSockets(one), { timeout: WIDGET_TIMEOUT }).toBeGreaterThan(0);
  await expect.poll(() => openSockets(two), { timeout: WIDGET_TIMEOUT }).toBeGreaterThan(0);
  const visitorOfA = await storedVisitorId(one.page);
  expect(visitorOfA, 'A has a visitor id').toBeTruthy();
  expect(await keptOf(one.page, visitorOfA!), 'the frame keeps A').not.toEqual([]);
  expect(
    visitor.creates.every((c) => c.identityToken === token),
    'every session so far is A',
  ).toBe(true);
  return {
    one,
    two,
    visitorOfA: visitorOfA!,
    marks: [markOne, markTwo],
    socketsOfOne: [...one.sockets],
    socketsOfTwo: [...two.sockets],
    createsBefore: visitor.creates.length,
  };
}

test.describe('WebChat widget identity (full stack)', () => {
  test.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform #543)',
  );

  const secret = randomBytes(32).toString('base64url');
  let stamp = '';
  let visitor: Visitor;

  async function putSecret(api: APIRequestContext, value: string | null) {
    const put = await api.put(`${API_BASE}${CHANNEL_PATH}`, {
      data: {
        isActive: true,
        credentials: { identityTokenSecret: value, identityTokenSecretPrevious: null },
      },
    });
    expect(put.status(), 'the identity secret').toBe(200);
  }

  test.beforeEach(async ({ browser, demoApiContext }) => {
    await putSecret(demoApiContext, secret);
    stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    visitor = await Visitor.open(browser);
  });

  test.afterEach(async ({ demoApiContext }) => {
    await visitor.context.close();
    await putSecret(demoApiContext, null);
  });

  test('init with a token reports Verified, and another customer gets a new visitor id', async () => {
    const { page } = await visitor.tab();
    const tokenA = signToken(secret, `cust-a-${stamp}`);
    await initWidget(page, {
      identityToken: tokenA,
      visitor: { name: 'Customer A', email: 'a@e2e.local' },
    });
    await waitComposer(page);
    await expectLastIdentity(page, 'Verified');
    expect(visitor.creates).toHaveLength(1);
    expect(visitor.creates[0]?.identityToken).toBe(tokenA);
    const visitorOfA = visitor.creates[0]?.visitorId;
    expect(visitorOfA).toBeTruthy();

    // The next page load of the site, signed in as someone else.
    await page.reload();
    const tokenB = signToken(secret, `cust-b-${stamp}`);
    await initWidget(page, {
      identityToken: tokenB,
      visitor: { name: 'Customer B', email: 'b@e2e.local' },
    });
    await waitComposer(page);
    await expectLastIdentity(page, 'Verified');
    expect(visitor.creates).toHaveLength(2);
    expect(visitor.creates[1]?.identityToken).toBe(tokenB);
    expect(visitor.creates[1]?.visitorId).toBeTruthy();
    expect(visitor.creates[1]?.visitorId).not.toBe(visitorOfA);

    // A second init on the same page, for a third customer.
    const tokenC = signToken(secret, `cust-c-${stamp}`);
    await initWidget(page, {
      identityToken: tokenC,
      visitor: { name: 'Customer C', email: 'c@e2e.local' },
    });
    await waitComposer(page);
    await expectLastIdentity(page, 'Verified');
    expect(visitor.creates).toHaveLength(3);
    expect(visitor.creates[2]?.identityToken).toBe(tokenC);
    expect([visitorOfA, visitor.creates[1]?.visitorId]).not.toContain(
      visitor.creates[2]?.visitorId,
    );
  });

  test('a visitor chatting anonymously who signs in starts over at once, with the token', async () => {
    const { page } = await visitor.tab();
    await initWidget(page, {});
    const form = await widget(page);
    await form.locator('#webchat-name').fill('Anonymous');
    await form.locator('#webchat-email').fill('anon@e2e.local');
    await form.locator('button[type="submit"]').click();
    const mark = `said anonymously ${stamp}`;
    await say(page, mark);
    await expectLastIdentity(page, 'Unverified');
    expect(visitor.creates).toHaveLength(1);
    expect(visitor.creates[0]?.identityToken).toBeUndefined();
    const anonymous = visitor.creates[0]!.visitorId!;

    const token = signToken(secret, `cust-${stamp}`);
    await setToken(page, token);

    await expect
      .poll(() => visitor.creates.length, { message: 'a session create', timeout: WIDGET_TIMEOUT })
      .toBe(2);
    expect(visitor.creates[1]?.identityToken).toBe(token);
    expect(visitor.creates[1]?.visitorId).toBeTruthy();
    expect(visitor.creates[1]?.visitorId).not.toBe(anonymous);
    const frame = await waitComposer(page);
    await expect(frame.locator('#webchat-name'), 'no form: it starts at once').toHaveCount(0);
    await expect(frame.getByText(mark)).toHaveCount(0);
    await expectLastIdentity(page, 'Verified');
    await expect.poll(() => keptOf(page, anonymous)).toEqual([]);
  });

  test('two tabs of customer A both drop A when B signs in, one after the other', async () => {
    test.setTimeout(90_000);
    const A = await twoTabsAsA(visitor, signToken(secret, `cust-a-${stamp}`), stamp);
    const tokenB = signToken(secret, `cust-b-${stamp}`);

    await forgetIdentityEvents(A.one.page);
    await setToken(A.one.page, tokenB);
    const frameOne = await waitComposer(A.one.page);
    await expectDiscarded(A.one, frameOne, A.marks, A.socketsOfOne);
    await expectLastIdentity(A.one.page, 'Verified');

    // Before the site tells tab two: the other tab's forget has already ended A there.
    await expectUntoldTabDiscarded(A.two, A.marks, A.socketsOfTwo);

    await setToken(A.two.page, tokenB);
    const frameTwo = await waitComposer(A.two.page);
    await expect(frameTwo.locator('#webchat-name'), 'B starts at once').toHaveCount(0);
    await expectDiscarded(A.two, frameTwo, A.marks, A.socketsOfTwo);

    const after = visitor.creates.slice(A.createsBefore);
    expect(after.length, 'B has a session').toBeGreaterThan(0);
    expect(after.map((c) => c.visitorId)).not.toContain(A.visitorOfA);
    expect(after.every((c) => c.identityToken === tokenB)).toBe(true);
    await expect.poll(() => keptOf(A.one.page, A.visitorOfA)).toEqual([]);
    expect(await storedVisitorId(A.two.page)).not.toBe(A.visitorOfA);
  });

  test('a sign-in that carries a name and an e-mail makes the tab it did not reach create no session', async () => {
    test.setTimeout(90_000);
    const A = await twoTabsAsA(visitor, signToken(secret, `cust-a-${stamp}`), stamp);
    const tokenB = signToken(secret, `cust-b-${stamp}`);
    const profileB = { name: 'Customer B', email: 'b@e2e.local' };

    await forgetIdentityEvents(A.one.page);
    await signIn(A.one.page, { ...profileB, identityToken: tokenB });
    const frameOne = await waitComposer(A.one.page);
    await expectDiscarded(A.one, frameOne, A.marks, A.socketsOfOne);
    await expectLastIdentity(A.one.page, 'Verified');

    // The stored profile is B's now, and it is complete. Tab two still asks: the site has not told it.
    await expectUntoldTabDiscarded(A.two, A.marks, A.socketsOfTwo);
    const afterTabOne = visitor.creates.slice(A.createsBefore);
    expect(afterTabOne, 'only the session of the tab the site told').toHaveLength(1);
    expect(afterTabOne[0]?.identityToken).toBe(tokenB);

    await signIn(A.two.page, { ...profileB, identityToken: tokenB });
    const frameTwo = await waitComposer(A.two.page);
    await expect(frameTwo.locator('#webchat-name'), 'B starts at once').toHaveCount(0);

    // A later page of the site: init with the token and the profile.
    const three = await visitor.tab();
    await initWidget(three.page, { identityToken: tokenB, visitor: profileB });
    await waitComposer(three.page);

    const after = visitor.creates.slice(A.createsBefore);
    expect(after.every((c) => c.identityToken === tokenB)).toBe(true);
    expect(after.map((c) => c.visitorId)).not.toContain(A.visitorOfA);
  });

  test('a session the visitor started without the token is not the one a tab holding it resumes', async () => {
    test.setTimeout(90_000);
    const tokenA = signToken(secret, `cust-a-${stamp}`);
    const tokenB = signToken(secret, `cust-b-${stamp}`);
    const asked = await visitor.tab();
    await initWidget(asked.page, {
      identityToken: tokenA,
      visitor: { name: 'Customer A', email: 'a@e2e.local' },
    });
    const mark = `said as A ${stamp}`;
    await say(asked.page, mark);
    const socketsOfA = [...asked.sockets];
    const before = visitor.creates.length;

    // The site signs B in on a tab whose chat is closed, so that tab has created nothing yet.
    const closed = await visitor.tab();
    await initWidget(
      closed.page,
      { identityToken: tokenB, visitor: { name: 'Customer B', email: 'b@e2e.local' } },
      { open: false },
    );
    await expectUntoldTabDiscarded(asked, [mark], socketsOfA);

    // The visitor acts in the tab the site did not tell.
    const frame = await widget(asked.page);
    await frame.locator('#webchat-name').fill('Someone');
    await frame.locator('#webchat-email').fill('someone@e2e.local');
    await frame.locator('button[type="submit"]').click();
    await expect
      .poll(() => visitor.creates.length, { message: 'its session', timeout: WIDGET_TIMEOUT })
      .toBe(before + 1);
    const tokenless = visitor.creates[before]!;
    expect(tokenless.identityToken).toBeUndefined();

    await openWidget(closed.page);
    await waitComposer(closed.page);
    await expect
      .poll(() => visitor.creates.length, {
        message: "the token's session",
        timeout: WIDGET_TIMEOUT,
      })
      .toBe(before + 2);
    expect(visitor.creates[before + 1]?.identityToken).toBe(tokenB);
    expect(visitor.creates[before + 1]?.visitorId).toBe(tokenless.visitorId);
    await expectLastIdentity(closed.page, 'Verified');
  });

  test('two tabs of customer A both drop A when the site signs out, one after the other', async () => {
    test.setTimeout(90_000);
    const A = await twoTabsAsA(visitor, signToken(secret, `cust-a-${stamp}`), stamp);

    await setToken(A.one.page, null);
    const frameOne = await widget(A.one.page);
    await expect(frameOne.locator('#webchat-name'), 'the form of a new visitor').toBeVisible({
      timeout: WIDGET_TIMEOUT,
    });
    await expectDiscarded(A.one, frameOne, A.marks, A.socketsOfOne);

    // Before the site tells tab two: the other tab's forget has already ended A there.
    await expectUntoldTabDiscarded(A.two, A.marks, A.socketsOfTwo);

    await setToken(A.two.page, null);
    const frameTwo = await widget(A.two.page);
    await expect(frameTwo.locator('#webchat-name'), 'the form of a new visitor').toBeVisible({
      timeout: WIDGET_TIMEOUT,
    });
    await expectDiscarded(A.two, frameTwo, A.marks, A.socketsOfTwo);

    expect(visitor.creates.slice(A.createsBefore), 'no session after the sign-out').toEqual([]);
    await expect.poll(() => keptOf(A.one.page, A.visitorOfA)).toEqual([]);
    expect(await storedVisitorId(A.one.page)).not.toBe(A.visitorOfA);

    // The next visitor of this browser starts with a new id in both tabs.
    const frame = await widget(A.two.page);
    await frame.locator('#webchat-name').fill('Next visitor');
    await frame.locator('#webchat-email').fill('next@e2e.local');
    await frame.locator('button[type="submit"]').click();
    await waitComposer(A.two.page);
    await expect
      .poll(() => visitor.creates.slice(A.createsBefore).length, { timeout: WIDGET_TIMEOUT })
      .toBeGreaterThan(0);
    expect(visitor.creates.slice(A.createsBefore).map((c) => c.visitorId)).not.toContain(
      A.visitorOfA,
    );
    for (const mark of A.marks) await expect(frame.getByText(mark)).toHaveCount(0);
  });
});
