import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock i18n so useTranslation returns the default/key as-is.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { DrawerDetail } from '@/core/ui/drawer-detail';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DrawerDetail', () => {
  it('Render_ShouldRenderTitleAndSubtitle_WhenProvided', () => {
    render(
      <DrawerDetail
        open
        onOpenChange={vi.fn()}
        title="Node n1"
        subtitle="Healthy — v1.15.0"
      />
    );
    expect(screen.getByText('Node n1')).toBeInTheDocument();
    expect(screen.getByText('Healthy — v1.15.0')).toBeInTheDocument();
  });

  it('Render_ShouldRenderTabsAndSwitchOnClick_WhenUncontrolled', () => {
    render(
      <DrawerDetail
        open
        onOpenChange={vi.fn()}
        title="Detail"
        tabs={[
          { key: 'overview', label: 'Overview', content: <div>Overview panel</div> },
          { key: 'events', label: 'Events', content: <div>Events panel</div> },
        ]}
      />
    );
    // First tab is active by default — content visible.
    expect(screen.getByText('Overview panel')).toBeInTheDocument();
    // Second tab trigger exists.
    const eventsTab = screen.getByRole('tab', { name: /events/i });
    fireEvent.click(eventsTab);
    // After click, the events panel content is rendered.
    expect(screen.getByText('Events panel')).toBeInTheDocument();
  });

  it('Render_ShouldRenderChildren_WhenTabsEmpty', () => {
    render(
      <DrawerDetail open onOpenChange={vi.fn()} title="Single pane">
        <div>Single-pane body</div>
      </DrawerDetail>
    );
    expect(screen.getByText('Single-pane body')).toBeInTheDocument();
    // Tablist should not be rendered in single-pane mode.
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('Actions_ShouldCallOnAction_AndShowLoadingStateWhenPending', async () => {
    const onActionMock = vi.fn().mockResolvedValue(undefined);
    // We'll toggle loading via rerender to simulate the consumer-controlled pattern.
    const { rerender } = render(
      <DrawerDetail
        open
        onOpenChange={vi.fn()}
        title="Detail"
        actions={[
          {
            key: 'save',
            label: 'Save',
            onAction: onActionMock,
            loading: false,
          },
        ]}
      />
    );
    const btn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(btn);
    await waitFor(() => expect(onActionMock).toHaveBeenCalledTimes(1));

    // Flip loading prop — primitive now shows spinner + disables the button.
    rerender(
      <DrawerDetail
        open
        onOpenChange={vi.fn()}
        title="Detail"
        actions={[
          {
            key: 'save',
            label: 'Save',
            onAction: onActionMock,
            loading: true,
          },
        ]}
      />
    );
    const loadingBtn = screen.getByRole('button', { name: /save/i });
    expect(loadingBtn).toBeDisabled();
    // Spinner is rendered — lucide-react Loader2 gets the animate-spin class.
    expect(loadingBtn.querySelector('.animate-spin')).not.toBeNull();
  });

  it('Close_ShouldCallOnOpenChangeFalse_WhenEscapePressed', async () => {
    const onOpenChange = vi.fn();
    render(
      <DrawerDetail open onOpenChange={onOpenChange} title="Closable">
        <div>body</div>
      </DrawerDetail>
    );
    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });
  });
});
