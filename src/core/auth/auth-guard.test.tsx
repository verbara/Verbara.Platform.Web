import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { useAuthStore } from './auth-store';
import { AuthGuard } from './auth-guard';
import { resetSessionRestore } from '@/core/session/session-restore';

const refreshAccessToken = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
vi.mock('@/core/api/client', () => ({ refreshAccessToken }));

const A_USER = { id: '1', email: 'a@b.com', displayName: 'Test', role: 'admin' } as const;

function renderGuarded(children: React.ReactNode = <div>protected</div>) {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AuthGuard>{children}</AuthGuard>} />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The shape a reload leaves behind: session identity persisted, credentials gone. */
function rehydratedWithoutToken(): void {
  useAuthStore.setState({
    user: A_USER,
    tenantId: 'tenant-1',
    permissions: [],
    features: {},
    accessToken: null,
    tokenExpiry: null,
  });
}

describe('AuthGuard', () => {
  beforeEach(() => {
    resetSessionRestore();
    refreshAccessToken.mockReset();
    useAuthStore.getState().logout();
  });

  it('should_RenderChildren_WhenTokenUsable', () => {
    useAuthStore
      .getState()
      .setAuth('live-token', Date.now() + 3600_000, A_USER, 'tenant-1', [], {});

    renderGuarded();

    expect(screen.getByText('protected')).toBeInTheDocument();
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('should_RedirectToLogin_WhenNoPersistedSession', () => {
    renderGuarded();

    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('should_ShowSkeletonThenChildren_WhenRestoreSucceeds', async () => {
    rehydratedWithoutToken();
    // Held open deliberately: an immediately-resolved mock would settle inside render()'s act()
    // flush, so the restoring phase would never be observable even though it renders in a browser.
    let completeRefresh!: () => void;
    refreshAccessToken.mockReturnValue(
      new Promise<boolean>((resolve) => {
        completeRefresh = () => {
          useAuthStore
            .getState()
            .setAuth('minted-token', Date.now() + 3600_000, A_USER, 'tenant-1', [], {});
          resolve(true);
        };
      }),
    );

    renderGuarded();

    // Restoring: a skeleton, not the login page.
    expect(document.querySelector('[data-session-restoring="true"]')).not.toBeNull();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();

    completeRefresh();

    await waitFor(() => expect(screen.getByText('protected')).toBeInTheDocument());
    expect(document.querySelector('[data-session-restoring="true"]')).toBeNull();
  });

  it('should_RedirectToLogin_WhenRestoreFails', async () => {
    rehydratedWithoutToken();
    refreshAccessToken.mockResolvedValue(false);

    renderGuarded();

    expect(document.querySelector('[data-session-restoring="true"]')).not.toBeNull();
    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument());
  });

  it('should_IssueSingleRefresh_WhenSeveralGuardsMount', async () => {
    rehydratedWithoutToken();
    refreshAccessToken.mockImplementation(async () => {
      useAuthStore
        .getState()
        .setAuth('minted-token', Date.now() + 3600_000, A_USER, 'tenant-1', [], {});
      return true;
    });

    // A nested tree, as the layout shells produce.
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AuthGuard>
                <AuthGuard>
                  <div>protected</div>
                </AuthGuard>
              </AuthGuard>
            }
          />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('protected')).toBeInTheDocument());
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('should_RestoreWhenTokenPresentButExpired', async () => {
    useAuthStore.setState({
      user: A_USER,
      tenantId: 'tenant-1',
      accessToken: 'stale-token',
      tokenExpiry: Date.now() - 1000,
    });
    refreshAccessToken.mockImplementation(async () => {
      useAuthStore
        .getState()
        .setAuth('minted-token', Date.now() + 3600_000, A_USER, 'tenant-1', [], {});
      return true;
    });

    renderGuarded();

    await waitFor(() => expect(screen.getByText('protected')).toBeInTheDocument());
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });
});
