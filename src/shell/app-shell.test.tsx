import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { useRealtimeStore } from '@/core/stores/realtime-store';
import { AppShell } from './app-shell';

// The shell's children are irrelevant to the attribute under test; stub the ones with side effects.
vi.mock('@/core/hooks/use-sse', () => ({ useSSE: vi.fn() }));
vi.mock('@/core/session/session-manager', () => ({ SessionManager: () => null }));
vi.mock('@/core/auth/impersonation-banner', () => ({ ImpersonationBanner: () => null }));
vi.mock('./rail', () => ({ Rail: () => null }));
vi.mock('./command-palette', () => ({ CommandPalette: () => null }));

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<div data-testid="page" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    useRealtimeStore.getState().reset();
  });

  it('AppShell_ShouldExposeTheRealtimeState_OnItsRootElement', () => {
    renderShell();

    const shell = screen.getByTestId('app-shell');
    expect(shell).toHaveAttribute('data-realtime-state', 'disconnected');
    expect(shell).toContainElement(screen.getByTestId('page'));
  });

  it('AppShell_ShouldFollowTheStore_ThroughConnectedAndEnded', () => {
    renderShell();
    const shell = screen.getByTestId('app-shell');

    act(() => useRealtimeStore.getState().setConnectionState('connecting'));
    expect(shell).toHaveAttribute('data-realtime-state', 'connecting');

    act(() => useRealtimeStore.getState().setConnectionState('connected'));
    expect(shell).toHaveAttribute('data-realtime-state', 'connected');

    act(() => useRealtimeStore.getState().setConnectionState('ended'));
    expect(shell).toHaveAttribute('data-realtime-state', 'ended');

    act(() => useRealtimeStore.getState().reset());
    expect(shell).toHaveAttribute('data-realtime-state', 'disconnected');
  });
});
