import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page, Request, Route } from '@playwright/test';
import { test, expect, grantPermissions, waitForAppReady } from '../../fixtures/auth.fixture';

/**
 * Silent listen from the operations console, mocked (Platform change `supervisor-silent-listen`;
 * design D10 here). Every listen route is answered by `page.route` with the host's fixture bodies
 * verbatim (`tests/fixtures/contracts/`), so the console's behaviour is pinned to the wire contract
 * without a PBX:
 *  - start → `dialing` → `listening` → stop drives `data-listen-state`;
 *  - the start request body is exactly `{"destination":"phone"}` (the browser destination needs a
 *    registered listen user agent, so the listen-endpoint route answers 409 here and `endpoint` is
 *    covered by the unit tests and the full-stack spec);
 *  - each start refusal of `supervisor-listen-refusals.json` shows its `data-error-code` and leaves
 *    the control idle;
 *  - no hub `StartSupervisionAsync` frame is ever sent;
 *  - the admin listen phone saves, clears, and keeps its editor open on `listen-phone-invalid`.
 *
 * Needs the dev stack for the sign-in only (the session is real; the listen routes are not).
 * Selectors are `data-*` only; waits are `expect` polling or `waitForResponse`.
 */

type Entry = { status: number; body: Record<string, unknown>; routes?: string[] };

const readFixture = <T>(name: string): T =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8')) as T;

const sessions = readFixture<{ body: Record<string, unknown>[] }>('active-session.v1.json');
const startFx = readFixture<{ start: Entry; current: Entry }>('supervisor-listen-start.v1.json');
const stopFx = readFixture<Entry>('supervisor-listen-stop.v1.json');
const phoneFx = readFixture<{ get: Entry; set: Entry; invalid: Entry }>(
  'supervisor-listen-phone.v1.json',
);
const refusals = readFixture<Record<string, Entry>>('supervisor-listen-refusals.json');

const CONV = String(startFx.start.body.conversationId);
const SESSION = String(sessions.body[0]!.sessionId);
const MONITOR = 'contacts:conversation:monitor';
const HUB_SUPERVISION = /StartSupervisionAsync|StopSupervisingAsync/;

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const isPost = (request: Request, path: string) =>
  request.method() === 'POST' && new URL(request.url()).pathname === path;

/** The listen the fake Platform holds, served by the current route (404 when none). */
interface FakeListen {
  held: Record<string, unknown> | null;
}

async function routeListen(page: Page, fake: FakeListen, startAnswer: () => Entry) {
  await page.route('**/api/v1/supervisor/listen-endpoint', (route) =>
    json(route, 409, { ...refusals.noSupervisorEndpoint!.body, conversationId: null }),
  );
  await page.route('**/api/v1/supervisor/sessions/active', (route) =>
    json(
      route,
      200,
      sessions.body.map((s) => ({ ...s, agentName: `Agent ${String(s.sessionId)}` })),
    ),
  );
  await page.route('**/api/v1/supervisor/sessions/*/listen', (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.route('**/api/v1/supervisor/listen', (route) =>
    fake.held ? json(route, 200, fake.held) : json(route, 404, refusals.listenNotFound!.body),
  );
  await page.route(`**/api/v1/supervisor/conversations/${CONV}/listen`, (route) => {
    const answer = startAnswer();
    if (answer.status === 200) fake.held = answer.body;
    return json(route, answer.status, answer.body);
  });
  await page.route(`**/api/v1/supervisor/conversations/${CONV}/listen/stop`, (route) => {
    fake.held = null;
    return json(route, 200, stopFx.body);
  });
}

/** Records every hub frame the page sends, to prove no supervision method is invoked. */
function recordHubFrames(page: Page): string[] {
  const frames: string[] = [];
  page.on('websocket', (ws) => {
    ws.on('framesent', (frame) => {
      if (typeof frame.payload === 'string') frames.push(frame.payload);
    });
  });
  return frames;
}

async function openSession(page: Page) {
  await page.goto('/operations/monitor');
  await waitForAppReady(page);
  const card = page.locator(`[data-testid="session-card"][data-session-id="${SESSION}"]`);
  await expect(card).toBeVisible();
  await card.click();
  const control = page.getByTestId('listen-control');
  await expect(control).toBeVisible();
  return control;
}

async function choosePhone(page: Page) {
  await page.getByTestId('listen-start').click();
  await page.getByTestId('listen-destination-phone').click();
}

test.describe('Supervisor silent listen (mocked listen routes)', () => {
  test('start on the phone → dialing → listening → stop drives data-listen-state', async ({
    demoAdminPage: page,
  }) => {
    await grantPermissions(page, [MONITOR]);
    const frames = recordHubFrames(page);
    const fake: FakeListen = { held: null };
    await routeListen(page, fake, () => ({
      status: 200,
      body: { ...startFx.start.body, destination: 'phone' },
    }));

    const control = await openSession(page);
    await expect(control).toHaveAttribute('data-listen-state', 'idle');
    await expect(control).toHaveAttribute('data-listen-default-destination', 'phone');
    await page.getByTestId('listen-start').click();
    await expect(page.getByTestId('listen-endpoint-unavailable')).toHaveAttribute(
      'data-reason',
      'no-supervisor-endpoint',
    );

    const start = page.waitForRequest((r) =>
      isPost(r, `/api/v1/supervisor/conversations/${CONV}/listen`),
    );
    await page.getByTestId('listen-destination-phone').click();
    expect((await start).postData()).toBe('{"destination":"phone"}');
    await expect(control).toHaveAttribute('data-listen-state', 'dialing');
    await expect(control).toHaveAttribute('data-listen-destination', 'phone');
    await expect(page.getByTestId('listen-answer-phone')).toBeVisible();

    // The phone was answered and 1 pressed: the current route now says listening.
    fake.held = { ...startFx.current.body, conversationId: CONV };
    await expect(control).toHaveAttribute('data-listen-state', 'listening');

    const stop = page.waitForRequest((r) =>
      isPost(r, `/api/v1/supervisor/conversations/${CONV}/listen/stop`),
    );
    await control.getByTestId('listen-stop').click();
    expect((await stop).postData() ?? '').toBe('');
    await expect(control).toHaveAttribute('data-listen-state', 'idle');

    expect(frames.filter((f) => HUB_SUPERVISION.test(f))).toEqual([]);
  });

  for (const [name, entry] of Object.entries(refusals).filter(
    ([key, e]) => key !== '_comment' && e.routes?.includes('start'),
  )) {
    test(`a start refused ${String(entry.body.error)} shows its code and stays idle (${name})`, async ({
      demoAdminPage: page,
    }) => {
      await grantPermissions(page, [MONITOR]);
      const fake: FakeListen = { held: null };
      await routeListen(page, fake, () => entry);

      const control = await openSession(page);
      const answered = page.waitForResponse((r) =>
        isPost(r.request(), `/api/v1/supervisor/conversations/${CONV}/listen`),
      );
      await choosePhone(page);
      expect((await answered).status()).toBe(entry.status);
      await expect(
        page.locator(`[data-error-code="${String(entry.body.error)}"]`).first(),
      ).toBeVisible();
      await expect(control).toHaveAttribute('data-listen-state', 'idle');
    });
  }
});

test.describe('Admin listen phone (mocked listen-phone routes)', () => {
  const USER = String(phoneFx.get.body.userId);
  const USER_PATH = `/api/v1/admin/users/${USER}`;

  test('save, clear and listen-phone-invalid', async ({ demoAdminPage: page }) => {
    let stored: string | null = String(phoneFx.get.body.phoneNumber);
    let refuseNext = false;
    const puts: string[] = [];

    await page.route(`**${USER_PATH}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { ETag: '"v1"' },
        body: JSON.stringify({
          id: USER,
          email: 'ana@demo.local',
          displayName: 'Ana Supervisor',
          role: 'supervisor',
          status: 'active',
          createdAt: '2026-10-01T00:00:00Z',
        }),
      }),
    );
    await page.route(`**${USER_PATH}/roles`, (route) => json(route, 200, []));
    await page.route(`**${USER_PATH}/listen-phone`, (route) => {
      const request = route.request();
      if (request.method() === 'GET')
        return json(route, 200, { userId: USER, phoneNumber: stored });
      puts.push(request.postData() ?? '');
      if (refuseNext) {
        refuseNext = false;
        return json(route, phoneFx.invalid.status, phoneFx.invalid.body);
      }
      stored = (JSON.parse(request.postData() ?? '{}') as { phoneNumber: string | null })
        .phoneNumber;
      return json(route, 200, { userId: USER, phoneNumber: stored });
    });

    await page.goto(`/admin/users/${USER}`);
    await waitForAppReady(page);
    const value = page.getByTestId('user-listen-phone-value');
    await expect(value).toHaveAttribute('data-empty', 'false');

    // listen-phone-invalid keeps the editor open with its code; nothing is saved.
    refuseNext = true;
    await page.getByTestId('user-listen-phone-edit').click();
    await page.getByTestId('user-listen-phone-input').fill('300 123 4567');
    await page.getByTestId('user-listen-phone-save').click();
    await expect(page.getByTestId('user-listen-phone-error')).toHaveAttribute(
      'data-error-code',
      'listen-phone-invalid',
    );
    await expect(page.getByTestId('user-listen-phone-input')).toBeVisible();
    expect(puts.at(-1)).toBe('{"phoneNumber":"300 123 4567"}');

    // A valid number saves as typed, trimmed.
    await page.getByTestId('user-listen-phone-input').fill('  +573001234567 ');
    await page.getByTestId('user-listen-phone-save').click();
    await expect(page.getByTestId('user-listen-phone-input')).toHaveCount(0);
    expect(puts.at(-1)).toBe('{"phoneNumber":"+573001234567"}');
    await expect(value).toHaveAttribute('data-empty', 'false');

    // Clear sends null.
    await page.getByTestId('user-listen-phone-clear').click();
    await expect(value).toHaveAttribute('data-empty', 'true');
    expect(puts.at(-1)).toBe('{"phoneNumber":null}');
  });
});
