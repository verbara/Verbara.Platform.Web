import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useBrandingStore, type PublicBrandingDto } from '@/core/branding';
import { useDocumentTitle } from './use-document-title';

/** A brand that sets only what the case names; every other field is unset. */
function brand(fields: Partial<PublicBrandingDto>): PublicBrandingDto {
  return {
    displayName: null,
    logoUrl: null,
    faviconUrl: null,
    primaryColor: null,
    secondaryColor: null,
    accentColor: null,
    locale: null,
    timezone: null,
    ...fields,
  };
}

/** Paints a tenant brand straight into the store, as a resolved signed-in lookup would. */
function paintBrand(fields: Partial<PublicBrandingDto>) {
  act(() => {
    useBrandingStore.setState({ brand: brand(fields), source: 'tenant', key: 'acme' });
  });
}

describe('useDocumentTitle', () => {
  let originalTitle: string;

  beforeEach(() => {
    originalTitle = document.title;
  });

  afterEach(() => {
    document.title = originalTitle;
  });

  it('Sets_DocumentTitle_OnMount', () => {
    renderHook(() => useDocumentTitle('Users'));
    expect(document.title).toBe('Users · Verbara');
  });

  it('Updates_DocumentTitle_WhenTitleChanges', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Users' },
    });
    expect(document.title).toBe('Users · Verbara');
    rerender({ title: 'Queues' });
    expect(document.title).toBe('Queues · Verbara');
  });

  it('Restores_PreviousTitle_OnUnmount', () => {
    document.title = 'Initial';
    const { unmount } = renderHook(() => useDocumentTitle('Temp'));
    expect(document.title).toBe('Temp · Verbara');
    unmount();
    expect(document.title).toBe('Initial');
  });
});

// Spec `console-verbara-attribution`: every console title ends in ` · Verbara`, a brand's display
// name sits between the page and the suffix, and no brand value removes the suffix (design D5).
describe('useDocumentTitle with a tenant brand', () => {
  let originalTitle: string;

  beforeEach(() => {
    originalTitle = document.title;
    useBrandingStore.getState().reset();
  });

  afterEach(() => {
    useBrandingStore.getState().reset();
    document.title = originalTitle;
  });

  it('Title_ShouldPutTheDisplayNameBeforeTheSuffix_WhenTheTenantIsBranded', () => {
    paintBrand({ displayName: 'Acme' });
    renderHook(() => useDocumentTitle('Admin'));
    expect(document.title).toBe('Admin · Acme · Verbara');
  });

  it('Title_ShouldNameOnlyThePage_WhenTheTenantHasNoDisplayName', () => {
    paintBrand({ primaryColor: '#336699' });
    renderHook(() => useDocumentTitle('Admin'));
    expect(document.title).toBe('Admin · Verbara');
  });

  it('Title_ShouldNameOnlyThePage_WhenNoBrandIsResolved', () => {
    renderHook(() => useDocumentTitle('Admin'));
    expect(document.title).toBe('Admin · Verbara');
  });

  it('Title_ShouldKeepTheSuffixLast_WhenTheDisplayNameIsNamedAfterTheAttribution', () => {
    paintBrand({ displayName: 'Verbara Partner', primaryColor: '#336699' });
    renderHook(() => useDocumentTitle('Admin'));
    expect(document.title).toBe('Admin · Verbara Partner · Verbara');
    expect(document.title.endsWith(' · Verbara')).toBe(true);
  });

  it.each(['Verbara', 'VERBARA', ' verbara '])(
    'Title_ShouldNotRepeatTheAttribution_WhenTheDisplayNameIs %j',
    (displayName) => {
      paintBrand({ displayName });
      renderHook(() => useDocumentTitle('Admin'));
      expect(document.title).toBe('Admin · Verbara');
    },
  );

  it('Title_ShouldFollowTheBrand_WhenItIsPaintedAfterThePageMounts', () => {
    document.title = 'Initial';
    const { unmount } = renderHook(() => useDocumentTitle('Admin'));
    expect(document.title).toBe('Admin · Verbara');
    paintBrand({ displayName: 'Acme' });
    expect(document.title).toBe('Admin · Acme · Verbara');
    act(() => useBrandingStore.getState().reset());
    expect(document.title).toBe('Admin · Verbara');
    unmount();
    expect(document.title).toBe('Initial');
  });
});

// Spec `console-verbara-attribution`, "The built entry document": the tab reads `Verbara` before
// any script runs and on a page that sets no title.
describe('The console entry document', () => {
  // Resolved from the repo root (vitest's cwd), as the fixture-reading tests do.
  const root = process.cwd();

  it('EntryDocument_ShouldBeTitledVerbara_WhenTheSourceIndexIsRead', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    expect(html).toContain('<title>Verbara</title>');
  });

  // The CI test job does not build, so this case runs where a build has produced `dist/` (task 3.2).
  it.skipIf(!existsSync(resolve(root, 'dist/index.html')))(
    'EntryDocument_ShouldBeTitledVerbara_WhenTheBuiltIndexIsRead',
    () => {
      const html = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
      expect(html).toContain('<title>Verbara</title>');
    },
  );
});
