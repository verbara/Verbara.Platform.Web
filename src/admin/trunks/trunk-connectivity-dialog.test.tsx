import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { TrunkConnectivityDialog } from './trunk-connectivity-dialog';
import type { TrunkConnectivityResult } from '@/core/api/hooks/use-trunks';

function baseResult(overrides: Partial<TrunkConnectivityResult> = {}): TrunkConnectivityResult {
  return {
    trunkId: 7,
    endpointId: 't-7',
    endpointFound: true,
    authMode: 'register',
    registered: true,
    identifyPresent: null,
    reachable: true,
    ok: true,
    messages: ['Registrado contra el carrier'],
    ...overrides,
  };
}

describe('TrunkConnectivityDialog', () => {
  it('TrunkConnectivityDialog_ShouldRenderGreenVerdict_WhenOk', () => {
    render(
      <TrunkConnectivityDialog
        trunkName="carrier-trunk"
        result={baseResult({ ok: true })}
        isPending={false}
        onOpenChange={() => {}}
      />,
    );

    const wrapper = screen.getByTestId('trunk-connectivity-dialog');
    // The ok flag is reflected on the result body for locale-proof assertions.
    expect(wrapper.querySelector('[data-connectivity-ok="true"]')).not.toBeNull();
    expect(screen.getByTestId('trunk-connectivity-verdict')).toBeInTheDocument();
    expect(screen.getByText('trunks.connectivity.verdictOk')).toBeInTheDocument();
  });

  it('TrunkConnectivityDialog_ShouldRenderRedVerdict_WhenNotOk', () => {
    render(
      <TrunkConnectivityDialog
        trunkName="carrier-trunk"
        result={baseResult({ ok: false, registered: false })}
        isPending={false}
        onOpenChange={() => {}}
      />,
    );

    const wrapper = screen.getByTestId('trunk-connectivity-dialog');
    expect(wrapper.querySelector('[data-connectivity-ok="false"]')).not.toBeNull();
    expect(screen.getByText('trunks.connectivity.verdictFail')).toBeInTheDocument();
  });

  it('TrunkConnectivityDialog_ShouldShowRegisterRow_WhenAuthModeRegister', () => {
    render(
      <TrunkConnectivityDialog
        trunkName="carrier-trunk"
        result={baseResult({ authMode: 'register', registered: true })}
        isPending={false}
        onOpenChange={() => {}}
      />,
    );

    const row = screen.getByTestId('trunk-connectivity-check-registered');
    expect(row).toBeInTheDocument();
    expect(row).toHaveAttribute('data-check-value', 'true');
    // The ip-acl identify row must NOT appear for a register trunk.
    expect(screen.queryByTestId('trunk-connectivity-check-identify')).not.toBeInTheDocument();
  });

  it('TrunkConnectivityDialog_ShouldShowIdentifyRow_WhenAuthModeIpAcl', () => {
    render(
      <TrunkConnectivityDialog
        trunkName="carrier-trunk"
        result={baseResult({
          authMode: 'ip-acl',
          registered: null,
          identifyPresent: true,
        })}
        isPending={false}
        onOpenChange={() => {}}
      />,
    );

    const row = screen.getByTestId('trunk-connectivity-check-identify');
    expect(row).toBeInTheDocument();
    expect(row).toHaveAttribute('data-check-value', 'true');
    expect(screen.queryByTestId('trunk-connectivity-check-registered')).not.toBeInTheDocument();
  });

  it('TrunkConnectivityDialog_ShouldRenderMessagesVerbatim', () => {
    render(
      <TrunkConnectivityDialog
        trunkName="carrier-trunk"
        result={baseResult({
          messages: ['Registrado contra el carrier', 'AMI no disponible…'],
        })}
        isPending={false}
        onOpenChange={() => {}}
      />,
    );

    const list = screen.getByTestId('trunk-connectivity-messages');
    expect(list).toBeInTheDocument();
    // Server diagnostics are rendered as-is (NOT i18n keys).
    expect(screen.getByText('Registrado contra el carrier')).toBeInTheDocument();
    expect(screen.getByText('AMI no disponible…')).toBeInTheDocument();
  });

  it('TrunkConnectivityDialog_ShouldShowNotApplicable_WhenCheckIsNull', () => {
    render(
      <TrunkConnectivityDialog
        trunkName="carrier-trunk"
        result={baseResult({
          authMode: 'register',
          registered: null,
          reachable: null,
        })}
        isPending={false}
        onOpenChange={() => {}}
      />,
    );

    const registered = screen.getByTestId('trunk-connectivity-check-registered');
    expect(registered).toHaveAttribute('data-check-value', 'null');
    const reachable = screen.getByTestId('trunk-connectivity-check-reachable');
    expect(reachable).toHaveAttribute('data-check-value', 'null');
    // The "no aplica" label appears for the null checks.
    expect(screen.getAllByText('trunks.connectivity.notApplicable').length).toBeGreaterThan(0);
  });

  it('TrunkConnectivityDialog_ShouldShowLoading_WhilePending', () => {
    render(
      <TrunkConnectivityDialog
        trunkName="carrier-trunk"
        result={null}
        isPending
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByTestId('trunk-connectivity-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('trunk-connectivity-verdict')).not.toBeInTheDocument();
  });

  it('TrunkConnectivityDialog_ShouldShowEmptyMessages_WhenNoneReturned', () => {
    render(
      <TrunkConnectivityDialog
        trunkName="carrier-trunk"
        result={baseResult({ messages: [] })}
        isPending={false}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByTestId('trunk-connectivity-messages-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('trunk-connectivity-messages')).not.toBeInTheDocument();
  });
});
