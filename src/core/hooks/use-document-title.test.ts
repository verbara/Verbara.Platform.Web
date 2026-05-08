import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useDocumentTitle } from './use-document-title';

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
