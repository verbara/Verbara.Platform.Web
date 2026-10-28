/**
 * The signed-in console's brand (design D4, D5 of `licensee-branding-in-the-console`): `AppShell`'s
 * `BrandingSync` looks up the requests' tenant, and the rail mark, the favicon, the brand colour and
 * the title follow the store. Every branding request goes through the branding seam
 * (`brandingFetchMock`), never a `fetch` stub or MSW.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { useAuthStore, type ImpersonationState } from '@/core/auth/auth-store';
import { BRAND_CSS_PROPERTIES, setBrandingFetch, useBrandingStore } from '@/core/branding';
import { useDocumentTitle } from '@/core/hooks/use-document-title';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { AppShell } from './app-shell';

// Stub the shell's children with side effects or their own queries; the rail itself is real.
vi.mock('@/core/hooks/use-sse', () => ({ useSSE: vi.fn() }));
vi.mock('@/core/session/session-manager', () => ({ SessionManager: () => null }));
vi.mock('@/core/auth/impersonation-banner', () => ({ ImpersonationBanner: () => null }));
vi.mock('@/core/auth/recovery-codes-banner', () => ({ RecoveryCodesBanner: () => null }));
vi.mock('@/core/ui/tenant-badge', () => ({ TenantBadge: () => null }));
vi.mock('./notification-bell', () => ({ NotificationBell: () => null }));
vi.mock('./user-menu', () => ({ UserMenu: () => null }));
vi.mock('./command-palette', () => ({ CommandPalette: () => null }));

const DEFAULT_ICON = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />';

/** The branding body each tenant id answers; an id not listed answers 404. */
let bodies: Record<string, unknown> = {};

const brandingFetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(
  async (input) => {
    const id = decodeURIComponent(input.slice('/api/v1/branding/'.length));
    return id in bodies
      ? new Response(JSON.stringify(bodies[id]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      : new Response(null, { status: 404 });
  },
);

function TitledPage() {
  useDocumentTitle('Admin');
  return <div data-testid="page" />;
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<TitledPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function requestedTenants(): string[] {
  return brandingFetchMock.mock.calls.map(([input]) => input);
}

const mark = () => screen.getByTestId('rail-brand-mark');
const icon = () => document.head.querySelector('link[rel="icon"]')!;
const rootStyle = () => document.documentElement.style;

function expectDefaultIcon(): void {
  expect(icon().getAttribute('href')).toBe('/favicon.svg');
  expect(icon().getAttribute('type')).toBe('image/svg+xml');
}

function expectNoBrandProperties(): void {
  for (const property of BRAND_CSS_PROPERTIES)
    expect(rootStyle().getPropertyValue(property)).toBe('');
}

const IMPERSONATING_C: ImpersonationState = {
  active: true,
  targetTenantId: 'c',
  targetTenantName: 'Customer C',
  originalToken: 'operator-token',
  originalTokenExpiry: null,
  originalTenantId: 'h',
  expiresAt: Date.now() + 600_000,
  readOnly: false,
};

beforeEach(() => {
  document.head.innerHTML = DEFAULT_ICON;
  bodies = {};
  brandingFetchMock.mockClear();
  setBrandingFetch(brandingFetchMock);
});

afterEach(() => {
  useAuthStore.setState({ tenantId: null, impersonation: null });
  useTenantStore.setState({ activeTenantId: null });
  useBrandingStore.getState().reset();
  document.head.innerHTML = '';
  document.title = '';
});

describe('BrandingSync in the signed-in console', () => {
  it('Console_ShouldPaintNameLogoFaviconAndColour_WhenTheTenantHasAFullBrand', async () => {
    bodies = {
      acme: {
        displayName: 'Acme',
        logoUrl: 'https://cdn.example/acme.png',
        faviconUrl: 'https://cdn.example/acme.ico',
        primaryColor: '#336699',
      },
    };
    useAuthStore.setState({ tenantId: 'acme' });

    renderShell();

    await waitFor(() => expect(mark()).toHaveAttribute('aria-label', 'Acme'));
    expect(mark().querySelector('img')).toHaveAttribute('src', 'https://cdn.example/acme.png');
    expect(icon().getAttribute('href')).toBe('https://cdn.example/acme.ico');
    expect(rootStyle().getPropertyValue('--color-brand')).toBe('#336699');
    expect(document.title).toBe('Admin · Acme · Verbara');
    expect(requestedTenants()).toEqual(['/api/v1/branding/acme']);
  });

  it('Console_ShouldKeepTheMarkIconAndTitleDefaults_WhenTheBrandSetsOnlyAPrimaryColour', async () => {
    bodies = { acme: { primaryColor: '#336699' } };
    useAuthStore.setState({ tenantId: 'acme' });

    renderShell();

    await waitFor(() => expect(rootStyle().getPropertyValue('--color-brand')).toBe('#336699'));
    expect(mark()).not.toHaveAttribute('aria-label');
    expect(mark().querySelector('img')).toBeNull();
    expect(mark().querySelector('svg')).not.toBeNull();
    expectDefaultIcon();
    expect(document.title).toBe('Admin · Verbara');
  });

  it('Console_ShouldShowTheImpersonatedTenantsBrand_WhenAnImpersonationStartsAndEnds', async () => {
    bodies = { h: { displayName: 'Holding' }, c: { displayName: 'Customer' } };
    useAuthStore.setState({ tenantId: 'h' });
    renderShell();
    await waitFor(() => expect(mark()).toHaveAttribute('aria-label', 'Holding'));

    act(() => useAuthStore.setState({ tenantId: 'c', impersonation: IMPERSONATING_C }));
    await waitFor(() => expect(mark()).toHaveAttribute('aria-label', 'Customer'));
    expect(document.title).toBe('Admin · Customer · Verbara');

    act(() => useAuthStore.setState({ tenantId: 'h', impersonation: null }));
    await waitFor(() => expect(mark()).toHaveAttribute('aria-label', 'Holding'));
    expect(requestedTenants()).toEqual([
      '/api/v1/branding/h',
      '/api/v1/branding/c',
      '/api/v1/branding/h',
    ]);
  });

  it('Console_ShouldFollowTheActiveTenant_WhenTheTenantStoreChanges', async () => {
    bodies = { acme: { displayName: 'Acme' }, globex: { displayName: 'Globex' } };
    useAuthStore.setState({ tenantId: 'acme' });
    renderShell();
    await waitFor(() => expect(mark()).toHaveAttribute('aria-label', 'Acme'));

    act(() => useTenantStore.setState({ activeTenantId: 'globex' }));

    await waitFor(() => expect(mark()).toHaveAttribute('aria-label', 'Globex'));
    expect(requestedTenants()).toEqual(['/api/v1/branding/acme', '/api/v1/branding/globex']);
  });

  it('Console_ShouldNotRefetch_WhenTheSignInPageAlreadyHoldsTheSameTenantsBrand', async () => {
    bodies = { acme: { displayName: 'Acme' } };
    await useBrandingStore.getState().lookupTenant('acme');
    expect(useBrandingStore.getState()).toMatchObject({ source: 'tenant', key: 'acme' });
    brandingFetchMock.mockClear();
    useAuthStore.setState({ tenantId: 'acme' });

    renderShell();

    expect(mark()).toHaveAttribute('aria-label', 'Acme');
    await act(async () => {});
    expect(brandingFetchMock).not.toHaveBeenCalled();
  });

  it('Console_ShouldRefetch_WhenTheSignInPageHoldsTheHostsBrandForTheSameLabel', async () => {
    bodies = { 'by-subdomain/acme': { displayName: 'Acme' }, acme: { displayName: 'Acme Corp' } };
    await useBrandingStore.getState().lookupHost('acme');
    expect(useBrandingStore.getState()).toMatchObject({ source: 'host', key: 'acme' });
    brandingFetchMock.mockClear();
    useAuthStore.setState({ tenantId: 'acme' });

    renderShell();

    await waitFor(() => expect(mark()).toHaveAttribute('aria-label', 'Acme Corp'));
    expect(requestedTenants()).toEqual(['/api/v1/branding/acme']);
  });

  it('Console_ShouldRefetch_WhenTheSignInPageHoldsAnotherTenantsBrand', async () => {
    bodies = { acme: { displayName: 'Acme' }, globex: { displayName: 'Globex' } };
    await useBrandingStore.getState().lookupTenant('globex');
    brandingFetchMock.mockClear();
    useAuthStore.setState({ tenantId: 'acme' });

    renderShell();

    await waitFor(() => expect(mark()).toHaveAttribute('aria-label', 'Acme'));
    expect(requestedTenants()).toEqual(['/api/v1/branding/acme']);
  });

  it('Console_ShouldRestoreTheDefaults_WhenTheUserSignsOut', async () => {
    bodies = {
      acme: {
        displayName: 'Acme',
        logoUrl: 'https://cdn.example/acme.png',
        faviconUrl: 'https://cdn.example/acme.ico',
        primaryColor: '#336699',
      },
    };
    useAuthStore.setState({ tenantId: 'acme' });
    renderShell();
    await waitFor(() => expect(document.title).toBe('Admin · Acme · Verbara'));

    act(() => useAuthStore.getState().logout());

    expectDefaultIcon();
    expectNoBrandProperties();
    expect(document.title).toBe('Admin · Verbara');
    expect(useBrandingStore.getState()).toMatchObject({
      brand: null,
      source: 'default',
      key: null,
    });
    expect(mark()).not.toHaveAttribute('aria-label');
    expect(mark().querySelector('svg')).not.toBeNull();
  });

  it('Console_ShouldFallBackToTheInitial_WhenTheLogoFailsToLoad', async () => {
    bodies = { acme: { displayName: 'acme', logoUrl: 'https://cdn.example/broken.png' } };
    useAuthStore.setState({ tenantId: 'acme' });
    renderShell();
    await waitFor(() => expect(mark().querySelector('img')).not.toBeNull());

    fireEvent.error(mark().querySelector('img')!);

    expect(mark().querySelector('img')).toBeNull();
    expect(mark()).toHaveTextContent(/^A$/);
  });
});

describe('BrandingSync render-level safety', () => {
  it('Console_ShouldRenderTheDisplayNameAsLiteralText_WhenItHoldsMarkup', async () => {
    bodies = { acme: { displayName: '<b>Acme</b>' } };
    useAuthStore.setState({ tenantId: 'acme' });

    renderShell();

    await waitFor(() => expect(mark()).toHaveAttribute('aria-label', '<b>Acme</b>'));
    expect(mark()).toHaveTextContent(/^<$/);
    expect(mark().querySelector('b')).toBeNull();
    expect(screen.getByTestId('app-shell').querySelector('b')).toBeNull();
    expect(document.title).toBe('Admin · <b>Acme</b> · Verbara');
    expect(document.head.querySelector('title b')).toBeNull();
  });

  it.each([
    ['a javascript: logo', 'javascript:alert(1)'],
    ['an off-origin http: logo', 'http://evil.example/acme.png'],
  ])('Console_ShouldShowTheInitialAndNoImage_WhenTheBrandHas%s', async (_case, logoUrl) => {
    bodies = { acme: { displayName: 'Acme', logoUrl } };
    useAuthStore.setState({ tenantId: 'acme' });

    renderShell();

    await waitFor(() => expect(mark()).toHaveAttribute('aria-label', 'Acme'));
    expect(mark().querySelector('img')).toBeNull();
    expect(mark()).toHaveTextContent(/^A$/);
  });

  it.each([
    ['blank', ''],
    ['whitespace only', '   '],
    ['javascript:', 'javascript:alert(1)'],
    ['off-origin http:', 'http://evil.example/acme.ico'],
  ])('Console_ShouldLeaveTheDefaultFavicon_WhenTheFaviconIs%s', async (_case, faviconUrl) => {
    bodies = { acme: { displayName: 'Acme', faviconUrl } };
    useAuthStore.setState({ tenantId: 'acme' });

    renderShell();

    await waitFor(() => expect(mark()).toHaveAttribute('aria-label', 'Acme'));
    expectDefaultIcon();
  });

  it.each([
    ['a style injection', 'red;}body{display:none'],
    ['a function colour', 'rgb(0,0,0)'],
    ['a two-digit hex', '#12'],
    ['blank', ''],
    ['whitespace only', ' '],
  ])(
    'Console_ShouldLeaveTheBrandPropertiesUnset_WhenThePrimaryColourIs%s',
    async (_case, primaryColor) => {
      bodies = { acme: { displayName: 'Acme', primaryColor } };
      useAuthStore.setState({ tenantId: 'acme' });

      renderShell();

      await waitFor(() => expect(mark()).toHaveAttribute('aria-label', 'Acme'));
      expectNoBrandProperties();
    },
  );
});
