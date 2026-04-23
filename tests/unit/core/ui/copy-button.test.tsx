import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';

// ─── mock i18n so useTranslation returns the key as-is ───────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// ─── mock sonner toast so we can assert success fires ─────────────────────────
const toastSuccessMock = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: vi.fn(),
  },
}));

import { CopyButton } from '@/core/ui/copy-button';

// ─── clipboard polyfill (jsdom doesn't ship navigator.clipboard) ─────────────
const writeTextMock = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: writeTextMock },
  });
  writeTextMock.mockClear();
  toastSuccessMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CopyButton', () => {
  it('should_RenderDefaultLabel_WhenNoLabelProvided', () => {
    render(<CopyButton value="hello" />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('should_CallClipboardWriteText_WhenClicked', async () => {
    render(<CopyButton value="secret-token-42" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(writeTextMock).toHaveBeenCalledTimes(1));
    expect(writeTextMock).toHaveBeenCalledWith('secret-token-42');
  });

  it('should_ShowSuccessStateAfterClick_ThenRevertAfter2Seconds', async () => {
    vi.useFakeTimers();
    render(<CopyButton value="payload" />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    // resolve the writeText promise microtask + flush state update
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Copied')).toBeInTheDocument();
    expect(toastSuccessMock).toHaveBeenCalledTimes(1);
    // advance past the 2s revert window
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText('Copied')).not.toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('should_RenderIconOnlyWithTooltip_WhenIconOnlyIsTrue', () => {
    render(<CopyButton value="x" iconOnly label="Copy value" />);
    const btn = screen.getByRole('button');
    // button has an accessible name coming from the label (sr-only or aria-label)
    expect(btn).toHaveAccessibleName(/copy value/i);
    // visible text should NOT be present in icon-only mode
    expect(screen.queryByText('Copy value', { selector: 'span:not(.sr-only)' })).not.toBeInTheDocument();
  });
});
