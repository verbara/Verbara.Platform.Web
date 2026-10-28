import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { resetBrandTheme, setBrandingFetch, useBrandingStore } from '@/core/branding';

if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = {
    ...globalThis.crypto,
    randomUUID: () => Math.random().toString(36).slice(2),
  } as Crypto;
}

// Branding requests go through their own seam (`licensee-branding-in-the-console`, design D8): by
// default every one answers 404, so each harness renders "unbranded" and no branding request ever
// reaches its `fetch` stub or MSW handlers. A test that needs a brand installs its own stub.
beforeEach(() => {
  setBrandingFetch(() => Promise.resolve(new Response(null, { status: 404 })));
});

afterEach(() => {
  useBrandingStore.getState().reset();
  if (typeof document !== 'undefined') resetBrandTheme();
});
