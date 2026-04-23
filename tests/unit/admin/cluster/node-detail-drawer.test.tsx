import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Mock i18n ───────────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// ─── Mock the audit hook used by AuditTrailMini (inside History tab) ─────────
vi.mock('@/core/api/hooks/use-audit-events', () => ({
  useAuditEvents: () => ({ data: [], isLoading: false }),
}));

import { NodeDetailDrawer } from '@/admin/cluster/node-detail-drawer';
import type { ClusterNode, DrainStatus } from '@/core/api/hooks/use-cluster';

const baseNode: ClusterNode = {
  nodeId: 'asterisk-01',
  state: 'Healthy',
  weight: 100,
  priorityTier: 1,
  maxCapacity: 50,
  asteriskVersion: '22.3.0',
  startupTime: '2026-04-20T08:00:00Z',
  amiHostname: '10.0.0.5',
  amiPort: 5038,
};

const drainingNode: ClusterNode = { ...baseNode, state: 'Draining' };

const drainSnapshot: DrainStatus = {
  nodeId: 'asterisk-01',
  state: 'Draining',
  startedAt: '2026-04-20T09:00:00Z',
  deadline: '2026-04-20T10:00:00Z',
  initialCallCount: 10,
  remainingCallCount: 4,
  naturallyCompleted: 5,
  forceDisconnected: 1,
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('NodeDetailDrawer', () => {
  it('Tabs_ShouldSwitchToDrainAndHistory_WhenClicked', () => {
    render(
      <NodeDetailDrawer
        node={baseNode}
        activeDrain={undefined}
        open
        onOpenChange={vi.fn()}
      />
    );

    // Overview tab renders by default.
    expect(screen.getByTestId('cluster-node-detail-overview')).toBeInTheDocument();

    // Switch to Drain tab — non-draining node shows empty state.
    fireEvent.click(screen.getByRole('tab', { name: /drain status/i }));
    expect(screen.getByTestId('cluster-node-detail-drain-empty')).toBeInTheDocument();

    // Switch to History tab — AuditTrailMini mounts (empty state from mock).
    fireEvent.click(screen.getByRole('tab', { name: /history/i }));
    expect(screen.getByTestId('audit-trail-mini-empty')).toBeInTheDocument();
  });

  it('DrainTab_ShouldRenderProgressBar_WhenNodeIsDraining', () => {
    render(
      <NodeDetailDrawer
        node={drainingNode}
        activeDrain={drainSnapshot}
        open
        onOpenChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: /drain status/i }));

    // Full drain tab rendered with progress bar.
    expect(screen.getByTestId('cluster-node-detail-drain')).toBeInTheDocument();
    const bar = screen.getByTestId('cluster-node-detail-drain-bar');
    // 6/10 completed = 60%.
    expect(bar.getAttribute('style')).toMatch(/width:\s*60%/);
  });

  describe('Grafana deeplink', () => {
    beforeEach(() => {
      // Reset mock before each sub-case.
      vi.unstubAllEnvs();
    });

    it('Link_ShouldNotRender_WhenEnvVarUnset', () => {
      vi.stubEnv('VITE_GRAFANA_URL', '');
      render(
        <NodeDetailDrawer
          node={baseNode}
          activeDrain={undefined}
          open
          onOpenChange={vi.fn()}
        />
      );
      expect(screen.queryByTestId('cluster-node-grafana-link')).toBeNull();
    });

    it('Link_ShouldRenderWithNodeFilter_WhenEnvVarSet', () => {
      vi.stubEnv('VITE_GRAFANA_URL', 'https://grafana.example.com/d/cluster');
      render(
        <NodeDetailDrawer
          node={baseNode}
          activeDrain={undefined}
          open
          onOpenChange={vi.fn()}
        />
      );
      const link = screen.getByTestId('cluster-node-grafana-link') as HTMLAnchorElement;
      expect(link).toBeInTheDocument();
      expect(link.href).toContain('https://grafana.example.com/d/cluster');
      expect(link.href).toContain('var-node=asterisk-01');
      // New tab + safe rel.
      expect(link.target).toBe('_blank');
      expect(link.rel).toMatch(/noopener/);
      expect(link.rel).toMatch(/noreferrer/);
    });
  });
});
