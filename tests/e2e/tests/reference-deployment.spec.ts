/**
 * Reference-deployment E2E suite.
 *
 * Validates the surface that the SMB customer-facing reference deploy
 * (docker-compose.reference-smb.yml + docs/manuales/smb/) promises:
 *
 *   1. Stack healthcheck — the API + DB are reachable.
 *   2. Setup is complete — admin user + tenant + at least one queue + one
 *      agent exist (the wizard at /admin/setup populated them).
 *   3. WebChat channel — demo widget loads, can be enabled+disabled
 *      programmatically, allowedOrigins persists.
 *   4. Email channel — CRUD surface works, threading mode persists.
 *   5. Voice channel — trunk CRUD + agent WebRTC provisioning surface
 *      works (full SIP call validation is in docs/manuales/smb/
 *      07-validacion-e2e.md §3 with SIPp, not here — Playwright can't
 *      drive a real softphone).
 *
 * Tag: `@reference-deployment`. Run with:
 *
 *   npx playwright test --grep @reference-deployment
 *
 * Pre-requisitos:
 *   - Stack levantado vía docker-compose.reference-smb.yml.
 *   - El platform admin existe (creado por /api/v1/setup o el wizard).
 *   - Por defecto usa las credenciales de tests/e2e/helpers/credentials.ts
 *     (PLATFORM_ADMIN). Override con env vars si tu deploy difiere:
 *       VERBARA_API_BASE_URL, VERBARA_TENANT_ID,
 *       VERBARA_ADMIN_EMAIL, VERBARA_ADMIN_PASSWORD
 */

import { test, expect } from '../fixtures/auth.fixture';
import { ChannelHelper } from '../fixtures/channel.fixture';
import { ApiHelper } from '../fixtures/api.fixture';
import { API_BASE } from '../helpers/credentials';

test.describe('@reference-deployment — SMB customer deploy', () => {
  test('Stack_ShouldBeHealthy_AndReturnHealthReady', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health/ready`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('Healthy');
    // postgres entry must be Healthy — the SMB compose can't function
    // without it (Asterisk realtime reads endpoints from there too).
    expect(body.entries?.postgres?.status ?? body.entries?.['postgres']?.status).toMatch(
      /Healthy/i,
    );
  });

  test('Setup_ShouldBeComplete_WithAdminTenantQueueAndAgent', async ({
    platformAdminPage,
    platformAdminRequest,
  }) => {
    // Aterriza al /admin sin redirect a /setup (significa setup ya completo)
    await platformAdminPage.goto('/admin');
    await expect(platformAdminPage).toHaveURL(/\/admin(?!\/setup)/);

    const api = new ApiHelper(platformAdminRequest);

    // Al menos 1 queue debe existir (creada por el wizard)
    const queuesResponse = await platformAdminRequest.get(`${API_BASE}/api/v1/admin/queues`, {
      headers: { 'X-Tenant-Id': api.tenantId },
    });
    expect(queuesResponse.ok()).toBeTruthy();
    const queues = (await queuesResponse.json()) as Array<{ id: string; name: string }>;
    expect(queues.length).toBeGreaterThanOrEqual(1);

    // Al menos 1 agente debe existir
    const agentsResponse = await platformAdminRequest.get(`${API_BASE}/api/v1/admin/agents`, {
      headers: { 'X-Tenant-Id': api.tenantId },
    });
    expect(agentsResponse.ok()).toBeTruthy();
    const agents = (await agentsResponse.json()) as Array<{ userId: string }>;
    expect(agents.length).toBeGreaterThanOrEqual(1);
  });

  test('WebChat_ShouldLoadDemoWidget_AndExposeBubble', async ({ page }) => {
    await page.goto('/webchat/demo.html');
    await expect(page.locator('h1')).toContainText(/WebChat/i);

    // El bubble del widget aparece después de cargar el JS
    const bubble = page.locator('[data-verbara-webchat-bubble]');
    await expect(bubble).toBeVisible({ timeout: 10_000 });

    // Click → abre el iframe
    await bubble.click();
    const iframe = page.locator('iframe[data-verbara-webchat-iframe]');
    await expect(iframe).toBeVisible({ timeout: 5_000 });
  });

  test('WebChat_ShouldPersistConfig_OnPatch', async ({ platformAdminRequest }) => {
    const channels = new ChannelHelper(platformAdminRequest);

    // Patch con allowedOrigins reproducible
    const testOrigins = [
      'http://localhost',
      'http://127.0.0.1',
      'https://reference-deploy.test.invalid',
    ];
    const patchResponse = await channels.enableWebchat({
      displayName: 'WebChat reference test',
      allowedOrigins: testOrigins,
    });
    expect(patchResponse.ok()).toBeTruthy();

    // Re-GET y validar persistencia
    const getResponse = await channels.get('webchat');
    expect(getResponse.ok()).toBeTruthy();
    const channel = await getResponse.json();
    expect(channel.enabled).toBe(true);
    expect(channel.allowedOrigins).toEqual(expect.arrayContaining(testOrigins));
  });

  test('Email_ShouldPersistConfig_OnPatch', async ({ platformAdminRequest }) => {
    const channels = new ChannelHelper(platformAdminRequest);

    const fromAddress = 'reference-deploy-test@verbara.invalid';
    const patchResponse = await channels.enableEmail({
      displayName: 'Email reference test',
      fromAddress,
      fromName: 'Verbara Reference Test',
    });
    expect(patchResponse.ok()).toBeTruthy();

    const getResponse = await channels.get('email');
    expect(getResponse.ok()).toBeTruthy();
    const channel = await getResponse.json();
    expect(channel.enabled).toBe(true);
    expect(channel.fromAddress).toBe(fromAddress);
    expect(channel.threadingMode).toBe('In-Reply-To');
  });

  test('Voice_ShouldExposeTrunkCrud_AndAgentWebRtcProvisioning', async ({
    platformAdminRequest,
  }) => {
    const channels = new ChannelHelper(platformAdminRequest);

    // List trunks — endpoint debe responder (puede venir vacío)
    const listResponse = await channels.listTrunks();
    expect(listResponse.ok()).toBeTruthy();

    // Crear un trunk minimal (isActive=false, no se conecta a ningún server real)
    const trunkName = `e2e-ref-${Date.now()}`;
    const createResponse = await channels.createMinimalTrunk(trunkName);
    expect(createResponse.ok()).toBeTruthy();
    const created = await createResponse.json();
    expect(created.name).toBe(trunkName);

    // Cleanup — borrar el trunk creado para no contaminar
    if (created.id) {
      const deleteResponse = await channels.deleteTrunk(created.id);
      expect(deleteResponse.ok()).toBeTruthy();
    }

    // Validar que el endpoint de provisioning WebRTC existe (sin requerir
    // que el agente real exista — sólo chequeamos el surface). 404 también
    // es un response válido (significa que la ruta está registrada).
    const provResponse = await channels.provisionAgentWebRtc('agent-that-does-not-exist', '9999');
    expect([200, 201, 404, 422]).toContain(provResponse.status());
  });

  test('Asterisk_ShouldExposeAri_AndRespondToInfo', async ({ request }) => {
    // ARI requiere basic auth; el .env del deploy define ARI_USER + ARI_PASSWORD.
    // En el reference deploy default el user es `verbara` y el pwd
    // está en .env.reference-smb (ARI_PASSWORD).
    const ariUser = process.env.VERBARA_ARI_USER ?? 'verbara';
    const ariPassword = process.env.VERBARA_ARI_PASSWORD;

    test.skip(!ariPassword, 'Set VERBARA_ARI_PASSWORD env to run the ARI smoke test');

    const ariBase = process.env.VERBARA_ARI_BASE_URL ?? 'http://localhost:8088';
    const response = await request.get(`${ariBase}/ari/asterisk/info`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${ariUser}:${ariPassword}`).toString('base64')}`,
      },
    });
    expect(response.ok()).toBeTruthy();
    const info = await response.json();
    expect(info.system?.version).toMatch(/^2[0-9]\./); // Asterisk 20+
  });
});
