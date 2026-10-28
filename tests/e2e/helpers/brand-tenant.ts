import { expect, type APIRequestContext } from '@playwright/test';
import { ApiHelper } from '../fixtures/api.fixture';
import { apiContextFor } from '../fixtures/auth.fixture';
import { API_BASE, PLATFORM_ADMIN } from './credentials';

/**
 * A disposable branded tenant for the branding end-to-end specs (OpenSpec change
 * `licensee-branding-in-the-console`, task 3.1). No case writes branding to the shared `demo` or
 * `platform` tenants: each spec file creates one of these in `beforeAll` and removes it in `afterAll`.
 */
export interface BrandTenant {
  readonly tenantId: string;
  readonly displayName: string;
  /** Same-origin and distinct from the default `/favicon.svg`, so the safety rules keep it. */
  readonly logoUrl: string;
  readonly faviconUrl: string;
  readonly user: { readonly id: string; readonly email: string; readonly password: string };
  /** What `GET /api/v1/branding/demo` answered before the spec ran, to prove it is untouched after. */
  readonly demoBefore: { readonly status: number; readonly body: string };
  readonly ctx: APIRequestContext;
  readonly login: APIRequestContext;
}

type PlaywrightLike = Parameters<typeof apiContextFor>[0];

const BRANDING = `${API_BASE}/api/v1/branding`;

/**
 * Lab precondition (P3): the lab builds the console with `VITE_DEFAULT_TENANT_ID=platform`, so on
 * `localhost` every sign-in page load asks for `/branding/platform`. A branded `platform` would make
 * the default-brand assertions meaningless, so the spec refuses to run against it.
 */
async function assertPlatformUnbranded(ctx: APIRequestContext): Promise<void> {
  const response = await ctx.get(`${BRANDING}/platform`);
  if (response.status() !== 404) {
    throw new Error(
      `lab precondition: tenant "platform" must have no branding row (docker-compose.full.yml builds the console with VITE_DEFAULT_TENANT_ID=platform); GET /api/v1/branding/platform answered ${response.status()}`,
    );
  }
}

export async function createBrandTenant(playwright: PlaywrightLike): Promise<BrandTenant> {
  const { ctx, login } = await apiContextFor(playwright, PLATFORM_ADMIN);
  await assertPlatformUnbranded(ctx);
  const demo = await ctx.get(`${BRANDING}/demo`);
  const demoBefore = { status: demo.status(), body: await demo.text() };

  const ts = Date.now();
  const tenantId = `e2e-brand-${ts}`;
  const displayName = `E2E Brand ${tenantId}`;
  const api = new ApiHelper(ctx);

  // The tenant is born on the Pro plan. Without a plan it inherits the host's (Enterprise on the
  // seeded lab), whose provisioned auth config requires MFA for Supervisor, and the lab then refuses
  // the user's password sign-in with `mfaEnrollmentRequired`.
  const created = await api.createTenant({
    tenantId,
    name: displayName,
    metadata: { Plan: 'Pro' },
  });
  expect(created.status(), await created.text()).toBe(201);

  // Only the branding section: no `subdomain`, whose column carries a unique index.
  const seeded = await ctx.put(`${API_BASE}/api/v1/management/tenants/${tenantId}/settings`, {
    data: { branding: { displayName, logoUrl: '/icons.svg', faviconUrl: '/icons.svg' } },
  });
  expect(seeded.status(), await seeded.text()).toBe(200);

  const branding = await ctx.get(`${BRANDING}/${tenantId}`);
  expect(branding.status()).toBe(200);
  expect(((await branding.json()) as { displayName?: string }).displayName).toBe(displayName);

  const email = `e2e-brand-${ts}@test.local`;
  const password = 'TestPassword123!';
  const userResponse = await ctx.post(`${API_BASE}/api/v1/admin/users`, {
    headers: { 'X-Tenant-Id': tenantId },
    data: { email, displayName: `E2E Brand User ${ts}`, role: 'supervisor', password },
  });
  expect(userResponse.status(), await userResponse.text()).toBe(201);
  const userId = ((await userResponse.json()) as { id: string }).id;

  return {
    tenantId,
    displayName,
    logoUrl: '/icons.svg',
    faviconUrl: '/icons.svg',
    user: { id: userId, email, password },
    demoBefore,
    ctx,
    login,
  };
}

/** Removes the user and soft-deletes the tenant, then proves the shared tenants' branding is unchanged. */
export async function removeBrandTenant(tenant: BrandTenant | undefined): Promise<void> {
  if (!tenant) return;
  const { ctx, login, tenantId } = tenant;
  try {
    const userDeleted = await ctx.delete(`${API_BASE}/api/v1/admin/users/${tenant.user.id}`, {
      headers: { 'X-Tenant-Id': tenantId },
    });
    expect(userDeleted.ok(), `DELETE user answered ${userDeleted.status()}`).toBe(true);

    const deleted = await new ApiHelper(ctx).deleteTenant(tenantId);
    expect(deleted.status()).toBe(204);

    const after = await ctx.get(`${API_BASE}/api/v1/management/tenants/${tenantId}`);
    expect(after.status()).toBe(200);
    expect(((await after.json()) as { status?: string }).status).toBe('Deleted');

    expect((await ctx.get(`${BRANDING}/platform`)).status()).toBe(404);
    const demo = await ctx.get(`${BRANDING}/demo`);
    expect(demo.status()).toBe(tenant.demoBefore.status);
    expect(await demo.text()).toBe(tenant.demoBefore.body);
  } finally {
    await ctx.dispose();
    await login.dispose();
  }
}
