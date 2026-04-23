import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── mock i18n so useTranslation returns the key or defaultValue ─────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// ─── mock next-themes so we can control resolved theme ───────────────────────
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', theme: 'light' }),
}));

// ─── mock sonner toast used by CopyButton ────────────────────────────────────
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { CodeBlock } from '@/core/ui/code-block';

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe('CodeBlock', () => {
  it('Render_ShouldEmitHighlightedTokenSpans_WhenLanguageIsJson', () => {
    const { container } = render(
      <CodeBlock code={'{"foo": 42}'} language="json" copyable={false} />
    );
    // prism-react-renderer wraps each token in a <span className="token ..."> —
    // we assert the presence of highlighted spans without binding to exact class
    // names (which are library-internal).
    const tokenSpans = container.querySelectorAll('span.token');
    expect(tokenSpans.length).toBeGreaterThan(0);
    // the raw code text should still be reachable via the rendered content
    expect(container.textContent).toContain('foo');
    expect(container.textContent).toContain('42');
  });

  it('Copy_ShouldShowButton_WhenCopyableTrue_AndHide_WhenCopyableFalse', () => {
    const { rerender } = render(<CodeBlock code="hello" />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();

    rerender(<CodeBlock code="hello" copyable={false} />);
    expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
  });

  it('Collapsible_ShouldToggleExpandedState_WhenToggleButtonClicked', () => {
    render(<CodeBlock code={'a\nb\nc'} collapsible copyable={false} />);
    // initial state: collapsed — "Show more" label is visible
    const toggle = screen.getByRole('button', { name: /show more/i });
    expect(toggle).toBeInTheDocument();

    // click expands → "Show less"
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();

    // click again collapses → "Show more"
    fireEvent.click(screen.getByRole('button', { name: /show less/i }));
    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
  });

  it('WrapLines_ShouldApplyPreWrap_WhenTrue_AndOverflowX_WhenFalse', () => {
    const { container: wrapped } = render(
      <CodeBlock code={'long line'} wrapLines copyable={false} />
    );
    const wrappedPre = wrapped.querySelector('pre');
    expect(wrappedPre).not.toBeNull();
    expect(wrappedPre!.className).toMatch(/whitespace-pre-wrap/);

    const { container: scroll } = render(
      <CodeBlock code={'long line'} copyable={false} />
    );
    const scrollPre = scroll.querySelector('pre');
    expect(scrollPre).not.toBeNull();
    expect(scrollPre!.className).toMatch(/overflow-x-auto/);
    expect(scrollPre!.className).not.toMatch(/whitespace-pre-wrap/);
  });
});
