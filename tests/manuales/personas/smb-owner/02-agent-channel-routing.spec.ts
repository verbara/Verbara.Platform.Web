// 02-agent-channel-routing — Fase 1 follow-up (ADR-0026 Phase A.6 editor).
//
// Persona: SMB Owner que ya completó el Día 1 (manual 01) y ahora decide que
//   el primer agente — María González — sólo debe atender WebChat. La queue
//   Atención General fue creada con `allowed_channels=NULL` (= todos los
//   canales), incluyendo voz, así que sin esta restricción Asterisk recibiría
//   la membership en `queue_members` y la enrutaría llamadas. Este journey
//   muestra cómo restringir la membership al canal WebChat únicamente.
//
// Journey: login admin → /admin/agents → fila María González → "Manage queues"
//   → quitar "All channels" → activar chip WebChat → Save → badge cambia a
//   "Digital only" → verificar via GET /admin/agents/{id}/queue-memberships.
//
// Pre-requisito CRÍTICO: el spec 01-day1-setup-and-webchat.spec.ts debe haber
// corrido contra el mismo stack en este orden:
//   1. 01-day1-setup-and-webchat.spec.ts  (crea queue + agente + admin)
//   2. 02-agent-channel-routing.spec.ts   (este archivo)
//
// Si querés correrlo aislado, levantá el stack en fresco y corré el 01 primero:
//   npx playwright test -c tests/manuales/playwright.docs.config.ts \
//     tests/manuales/personas/smb-owner/01-day1-setup-and-webchat.spec.ts
//   npx playwright test -c tests/manuales/playwright.docs.config.ts \
//     tests/manuales/personas/smb-owner/02-agent-channel-routing.spec.ts
//
// Render manual after:
//   npx tsx tests/manuales/manual-renderer/render.ts --journey 02-agent-channel-routing

import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const PERSONA = 'smb-owner';
const JOURNEY = '02-agent-channel-routing';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const screenshotsDir = path.resolve(__dirname, '../../test-results/screenshots', PERSONA, JOURNEY);
fs.mkdirSync(screenshotsDir, { recursive: true });

// Mirrors the Day 1 seed identities so the journey reads as a real
// continuation of the same install.
const ADMIN = {
  email: 'admin@verbara.local',
  password: 'DocumentationDemo2026!',
};
const FIRST_AGENT = {
  displayName: 'María González',
};
const FIRST_QUEUE = 'Atención General';

async function captureStep(page: import('@playwright/test').Page, stepId: string): Promise<void> {
  const target = path.join(screenshotsDir, `step-${stepId}.png`);
  await page.screenshot({ path: target, fullPage: true });
}

// Idempotent helper: log in via API to get a JWT, then PATCH every membership
// for the named agent so AllowedChannels is reset to NULL (= all channels).
// This keeps the journey deterministic when the spec is re-run against a
// stack where a prior run already restricted the membership. The "before"
// state shown in step 5 must read "Voice → Asterisk" — that only holds if
// AllowedChannels is null.
async function resetMembershipsToAllChannels(
  request: import('@playwright/test').APIRequestContext,
): Promise<void> {
  const baseUrl = process.env.MANUAL_BASE_URL ?? 'http://localhost';
  const loginResp = await request.post(`${baseUrl}/api/v1/auth/login`, {
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'platform' },
    data: { email: ADMIN.email, password: ADMIN.password },
  });
  if (loginResp.status() !== 200) return; // pre-condition unmet — Day 1 wasn't run
  const { accessToken } = (await loginResp.json()) as { accessToken: string };
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'X-Tenant-Id': 'platform',
  };

  const agentsResp = await request.get(`${baseUrl}/api/v1/admin/agents?page=1&pageSize=100`, {
    headers: authHeaders,
  });
  if (agentsResp.status() !== 200) return;
  const agentsPage = (await agentsResp.json()) as {
    items: Array<{ agentId: string; displayName: string }>;
  };
  const target = agentsPage.items.find((a) => a.displayName === FIRST_AGENT.displayName);
  if (!target) return;

  const membershipsResp = await request.get(
    `${baseUrl}/api/v1/admin/agents/${target.agentId}/queue-memberships`,
    { headers: authHeaders },
  );
  if (membershipsResp.status() !== 200) return;
  const memberships = (await membershipsResp.json()) as Array<{
    queueId: string;
    allowedChannels: string[] | null;
  }>;
  for (const m of memberships) {
    if (m.allowedChannels == null) continue;
    await request.patch(`${baseUrl}/api/v1/queues/${m.queueId}/members/${target.agentId}`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: { clearAllowedChannels: true },
    });
  }
}

test.describe('SMB Owner — Día 2: Restringir agente a canal WebChat', () => {
  test.setTimeout(120_000);

  test.beforeAll(async ({ request }) => {
    await resetMembershipsToAllChannels(request);
  });

  test('restricts María to WebChat-only and verifies digital-only badge', async ({ page }) => {
    await test.step('Iniciar sesión con el admin del Día 1', async () => {
      await page.goto('/login');
      // Same data-dependent tenant input behavior as the Day 1 spec.
      const tenantInput = page.getByTestId('login-tenant');
      try {
        await tenantInput.waitFor({ state: 'visible', timeout: 2_000 });
      } catch {
        await page.getByTestId('login-tenant-toggle').click();
        await tenantInput.waitFor({ state: 'visible', timeout: 5_000 });
      }
      await tenantInput.fill('platform');
      await page.getByTestId('login-email').fill(ADMIN.email);
      await page.getByTestId('login-password').fill(ADMIN.password);
      await captureStep(page, '01-login-form');
      await page.getByTestId('login-submit').click();
      await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    });

    await test.step('Abrir el listado de agentes', async () => {
      await page.goto('/admin/agents');
      await expect(page.getByTestId('agents-page')).toBeVisible({ timeout: 10_000 });
      await captureStep(page, '02-admin-agents-list');
    });

    await test.step('Abrir el detalle del agente María González', async () => {
      // The agents DataTable renders agents as rows. Day 1 created exactly one
      // agent — clicking the row navigates to /admin/agents/{agentId}.
      await page.getByText(FIRST_AGENT.displayName, { exact: true }).first().click();
      await expect(page.getByTestId('agent-detail-manage-queues')).toBeVisible({
        timeout: 10_000,
      });
      await captureStep(page, '03-agent-detail-with-cta');
    });

    await test.step('Abrir el editor de membership channel-aware', async () => {
      await page.getByTestId('agent-detail-manage-queues').click();
      await expect(page).toHaveURL(/\/admin\/agents\/[^/]+\/queues$/, { timeout: 10_000 });
      await captureStep(page, '04-agent-queues-editor');
    });

    // Capture the queueId from the membership card so chip scoping is
    // robust even if the test later targets multiple memberships.
    let queueId = '';
    await test.step('Inspeccionar la membership existente', async () => {
      // Day 1 wizard saved AllowedChannels=null → badge reads "Voice → Asterisk".
      const membershipCard = page
        .locator('[data-testid^="membership-card-"]')
        .filter({ hasText: FIRST_QUEUE })
        .first();
      await expect(membershipCard).toBeVisible({ timeout: 10_000 });
      const testid = await membershipCard.getAttribute('data-testid');
      if (!testid) throw new Error('membership card missing data-testid');
      queueId = testid.replace('membership-card-', '');
      const voiceBadge = membershipCard.getByTestId('agent-queues-voice-sync');
      await expect(voiceBadge).toHaveText(/Voice|Asterisk|→/, { timeout: 5_000 });
      await captureStep(page, '05-membership-card-before');
    });

    await test.step('Desactivar "All channels" y activar el chip WebChat', async () => {
      const allCheckbox = page.getByTestId(`channels-all-${queueId}`);
      // The checkbox starts checked because AllowedChannels=null = "All".
      // Uncheck it so the chip grid becomes interactive.
      await allCheckbox.uncheck();
      const membershipCard = page.getByTestId(`membership-card-${queueId}`);
      await membershipCard.getByTestId('channel-chip-webchat').click();
      // Voice should NOT be selected — verify the badge already reads
      // "Digital only" BEFORE the user saves (live preview).
      const voiceBadge = membershipCard.getByTestId('agent-queues-voice-sync');
      await expect(voiceBadge).toHaveText(/Digital|only/, { timeout: 5_000 });
      await captureStep(page, '06-restricted-to-webchat');
    });

    await test.step('Guardar la restricción', async () => {
      const membershipCard = page.getByTestId(`membership-card-${queueId}`);
      await membershipCard.getByTestId('agent-queues-save-btn').click();
      // The mutation invalidates the cache; the card re-renders with the
      // persisted state. After save, "All channels" stays off and the
      // WebChat chip stays active.
      await expect(page.getByText(/queue.*member.*updated|miembro.*actualiz/i)).toBeVisible({
        timeout: 5_000,
      });
      await captureStep(page, '07-saved-with-toast');
    });

    await test.step('Verificar via API que la membership es channel-aware', async () => {
      // Resolve the agent ID from the URL.
      const url = page.url();
      const match = /\/admin\/agents\/([^/]+)\/queues$/.exec(url);
      if (!match) throw new Error(`Expected URL to match /admin/agents/{id}/queues, got: ${url}`);
      const agentId = match[1];

      // The SPA stores the JWT in localStorage (Zustand auth-store persisted
      // with the `verbara-auth` key). page.request runs in a separate context
      // without access to the page's localStorage, so authenticate the API
      // call by re-logging in via the auth endpoint and using the bearer
      // token directly.
      const baseUrl = process.env.MANUAL_BASE_URL ?? 'http://localhost';
      const loginResp = await page.request.post(`${baseUrl}/api/v1/auth/login`, {
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'platform' },
        data: { email: ADMIN.email, password: ADMIN.password },
      });
      expect(loginResp.status()).toBe(200);
      const { accessToken } = (await loginResp.json()) as { accessToken: string };

      const response = await page.request.get(
        `${baseUrl}/api/v1/admin/agents/${agentId}/queue-memberships`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Tenant-Id': 'platform',
          },
        },
      );
      expect(response.status()).toBe(200);
      const memberships = (await response.json()) as Array<{
        queueId: string;
        queueName: string;
        allowedChannels: string[] | null;
      }>;
      const target = memberships.find((m) => m.queueId === queueId);
      if (!target) throw new Error(`Expected to find membership for queueId=${queueId}`);
      expect(target.allowedChannels).toEqual(['WebChat']);
    });
  });
});
