import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ─── Mock i18n ───────────────────────────────────────────────────────────────
// Serves the few keys this dialog reads with their English values so test
// assertions remain string-readable (`'Delete'`, `/Wait/`) rather than coupled
// to internal key names.
vi.mock('react-i18next', () => {
  const TABLE: Record<string, string> = {
    'confirm_delete_dialog.title': 'Delete {{entityType}}?',
    'confirm_delete_dialog.description_prefix': 'Are you sure you want to delete ',
    'confirm_delete_dialog.description_suffix': '? This action cannot be undone.',
    'confirm_delete_dialog.type_to_confirm_prefix': 'Type ',
    'confirm_delete_dialog.type_to_confirm_suffix': ' to confirm.',
    'confirm_delete_dialog.cancel': 'Cancel',
    'confirm_delete_dialog.delete': 'Delete',
    'confirm_delete_dialog.deleting': 'Deleting...',
    'confirm_delete_dialog.wait_seconds': 'Wait {{seconds}}s...',
  };
  return {
    useTranslation: () => ({
      t: (key: string, opts?: unknown) => {
        const tpl = TABLE[key] ?? key;
        if (opts && typeof opts === 'object') {
          return Object.entries(opts as Record<string, unknown>).reduce(
            (s, [k, v]) => s.replace(`{{${k}}}`, String(v)),
            tpl,
          );
        }
        return tpl;
      },
      i18n: { changeLanguage: vi.fn() },
    }),
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
  };
});

import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';

describe('ConfirmDeleteDialog — confirmationWord prop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Default_ShouldRequireCountdown_WhenConfirmationWordNotSet', () => {
    // Baseline path — consumers that don't pass `confirmationWord` continue
    // to see the existing 3s countdown gate (no input, button shows "Wait Ns...").
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        entityName="my-entity"
        entityType="thing"
      />
    );
    const btn = screen.getByTestId('confirm-delete-btn');
    expect(btn).toBeDisabled();
    expect(btn.textContent).toMatch(/Wait/);

    // Input is NOT rendered in default mode.
    expect(screen.queryByTestId('confirm-delete-word-input')).toBeNull();

    // Click while locked → onConfirm never called (guards the button even
    // against direct click-through).
    fireEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Word_ShouldEnableButtonOnlyWhenExactWordTyped_WhenConfirmationWordSet', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        entityName="asterisk-01"
        entityType="force drain on node"
        confirmationWord="FORCE"
      />
    );

    const btn = screen.getByTestId('confirm-delete-btn');
    const input = screen.getByTestId('confirm-delete-word-input');

    // Starts disabled, no countdown text (button shows plain "Delete" label).
    expect(btn).toBeDisabled();
    expect(btn.textContent).toBe('Delete');

    // Typing a prefix does not enable the button.
    fireEvent.change(input, { target: { value: 'FORC' } });
    expect(btn).toBeDisabled();

    // Exact word enables and lets onConfirm fire.
    fireEvent.change(input, { target: { value: 'FORCE' } });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // Case-sensitivity: wrong case does NOT match (regression guard).
    fireEvent.change(input, { target: { value: 'force' } });
    expect(screen.getByTestId('confirm-delete-btn')).toBeDisabled();
  });

  it('Word_ShouldResetTypedValue_WhenDialogReopens', () => {
    // Closing + reopening the dialog must clear the typed word so the next
    // invocation starts fresh (otherwise a stale "FORCE" value would
    // bypass the gate on the next target).
    const { rerender } = render(
      <ConfirmDeleteDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        entityName="a"
        entityType="thing"
        confirmationWord="FORCE"
      />
    );
    const input = screen.getByTestId('confirm-delete-word-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'FORCE' } });
    expect(input.value).toBe('FORCE');

    // Close.
    rerender(
      <ConfirmDeleteDialog
        open={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        entityName="a"
        entityType="thing"
        confirmationWord="FORCE"
      />
    );

    // Reopen — input must be empty + button disabled.
    rerender(
      <ConfirmDeleteDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        entityName="a"
        entityType="thing"
        confirmationWord="FORCE"
      />
    );
    const freshInput = screen.getByTestId('confirm-delete-word-input') as HTMLInputElement;
    expect(freshInput.value).toBe('');
    expect(screen.getByTestId('confirm-delete-btn')).toBeDisabled();
  });
});
