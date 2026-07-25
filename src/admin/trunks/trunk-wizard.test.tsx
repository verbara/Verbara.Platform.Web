import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';

// ── Mutation mocks ──────────────────────────────────────────────────────────
// `mutateAsync` so we can assert the Finish ordering: trunk → route → DID.
const createTrunkAsync = vi.fn();
const createRouteAsync = vi.fn();
const createDidAsync = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/core/api/hooks/use-trunks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/hooks/use-trunks')>();
  return {
    ...actual,
    useCreateTrunk: () => ({ mutateAsync: createTrunkAsync, isPending: false }),
  };
});

vi.mock('@/core/api/hooks/use-routes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/hooks/use-routes')>();
  return {
    ...actual,
    useCreateRoute: () => ({ mutateAsync: createRouteAsync, isPending: false }),
    useRoutes: () => ({
      data: [{ id: 1, pattern: '+', patternType: 'prefix', trunkId: 1, priority: 10 }],
    }),
  };
});

vi.mock('@/core/api/hooks/use-did-routes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/hooks/use-did-routes')>();
  return {
    ...actual,
    useCreateDidRoute: () => ({ mutateAsync: createDidAsync, isPending: false }),
  };
});

vi.mock('@/core/api/hooks/use-queues', () => ({
  useQueues: () => ({
    data: [
      { id: 'queue-support', name: 'Support', isActive: true, requiredSkills: [], createdAt: '' },
      { id: 'queue-sales', name: 'Sales', isActive: true, requiredSkills: [], createdAt: '' },
      { id: 'queue-old', name: 'Retired', isActive: false, requiredSkills: [], createdAt: '' },
    ],
  }),
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('@/core/api/hooks/use-voice-codecs', () => ({
  useVoiceCodecs: () => ({
    data: { source: 'asterisk', codecs: ['ulaw', 'alaw', 'g722', 'opus', 'vp8', 'h264'] },
  }),
}));

import TrunkWizard from './trunk-wizard';

function renderWizard() {
  return render(
    <MemoryRouter>
      <TrunkWizard />
    </MemoryRouter>,
  );
}

// Drive the wizard from the provider step through to the review step with valid
// data. Returns once the review step is rendered.
async function advanceToReview(
  opts: { addOutbound?: boolean; addDid?: boolean; didQueue?: boolean } = {},
) {
  const { addOutbound = true, addDid = true, didQueue = true } = opts;

  // Step 1 — provider
  fireEvent.click(screen.getByTestId('trunk-wizard-provider-twilio'));
  fireEvent.click(screen.getByTestId('trunk-wizard-next'));

  // Step 2 — connection (twilio = ip-acl)
  await screen.findByTestId('trunk-wizard-connection-step');
  fireEvent.change(screen.getByTestId('trunk-wizard-name'), { target: { value: 'twilio-trunk' } });
  fireEvent.change(screen.getByTestId('trunk-wizard-matchHost'), {
    target: { value: '54.172.60.0/30' },
  });
  fireEvent.click(screen.getByTestId('trunk-wizard-next'));

  // Step 3 — media
  await screen.findByTestId('trunk-wizard-media-step');
  fireEvent.click(screen.getByTestId('trunk-wizard-next'));

  // Step 4 — outbound
  await screen.findByTestId('trunk-wizard-outbound-step');
  if (!addOutbound) {
    fireEvent.click(screen.getByTestId('trunk-wizard-addOutboundRoute'));
  }
  fireEvent.click(screen.getByTestId('trunk-wizard-next'));

  // Step 5 — inbound
  await screen.findByTestId('trunk-wizard-inbound-step');
  if (!addDid) {
    fireEvent.click(screen.getByTestId('trunk-wizard-addDid'));
  } else {
    fireEvent.change(screen.getByTestId('trunk-wizard-did'), { target: { value: '+13105551234' } });
    if (didQueue) {
      fireEvent.click(screen.getByTestId('trunk-wizard-didQueueId'));
      fireEvent.click(await screen.findByRole('option', { name: 'Support' }));
    }
  }
  fireEvent.click(screen.getByTestId('trunk-wizard-next'));

  // Step 6 — review
  await screen.findByTestId('trunk-wizard-review-step');
}

describe('TrunkWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTrunkAsync.mockResolvedValue({ id: 42 });
    createRouteAsync.mockResolvedValue({ id: 7 });
    createDidAsync.mockResolvedValue({ id: 'did-1' });
  });

  it('TrunkWizard_ShouldRenderProviderCards_OnFirstStep', () => {
    renderWizard();
    expect(screen.getByTestId('trunk-wizard-provider-step')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-wizard-provider-twilio')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-wizard-provider-telnyx')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-wizard-provider-flowroute')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-wizard-provider-voipms')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-wizard-provider-generic')).toBeInTheDocument();
  });

  it('TrunkWizard_ShouldBlockNext_WhenNoProviderSelected', async () => {
    renderWizard();
    fireEvent.click(screen.getByTestId('trunk-wizard-next'));
    await waitFor(() =>
      expect(screen.getByText('trunks.wizard.validation.providerRequired')).toBeInTheDocument(),
    );
    // Still on the provider step.
    expect(screen.getByTestId('trunk-wizard-provider-step')).toBeInTheDocument();
  });

  it('TrunkWizard_ShouldSeedIpAclAuthMode_WhenTwilioSelected', async () => {
    renderWizard();
    fireEvent.click(screen.getByTestId('trunk-wizard-provider-twilio'));
    fireEvent.click(screen.getByTestId('trunk-wizard-next'));

    await screen.findByTestId('trunk-wizard-connection-step');
    // ip-acl provider shows the matchHost field, NOT the register credentials.
    expect(screen.getByTestId('trunk-wizard-matchHost')).toBeInTheDocument();
    expect(screen.queryByTestId('trunk-wizard-registrationUri')).not.toBeInTheDocument();
  });

  it('TrunkWizard_ShouldSeedRegisterAuthMode_WhenVoipmsSelected', async () => {
    renderWizard();
    fireEvent.click(screen.getByTestId('trunk-wizard-provider-voipms'));
    fireEvent.click(screen.getByTestId('trunk-wizard-next'));

    await screen.findByTestId('trunk-wizard-connection-step');
    // register provider shows the credential fields, NOT matchHost.
    expect(screen.getByTestId('trunk-wizard-authUsername')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-wizard-registrationUri')).toBeInTheDocument();
    expect(screen.queryByTestId('trunk-wizard-matchHost')).not.toBeInTheDocument();
  });

  it('TrunkWizard_ShouldShowAuthModeToggle_WhenGenericSelected', async () => {
    renderWizard();
    fireEvent.click(screen.getByTestId('trunk-wizard-provider-generic'));
    fireEvent.click(screen.getByTestId('trunk-wizard-next'));

    await screen.findByTestId('trunk-wizard-connection-step');
    expect(screen.getByTestId('trunk-wizard-authMode')).toBeInTheDocument();
  });

  it('TrunkWizard_ShouldBlockNextOnInbound_WhenDidSetWithoutQueue', async () => {
    renderWizard();

    // Walk to the inbound step.
    fireEvent.click(screen.getByTestId('trunk-wizard-provider-twilio'));
    fireEvent.click(screen.getByTestId('trunk-wizard-next'));
    await screen.findByTestId('trunk-wizard-connection-step');
    fireEvent.change(screen.getByTestId('trunk-wizard-name'), {
      target: { value: 'twilio-trunk' },
    });
    fireEvent.change(screen.getByTestId('trunk-wizard-matchHost'), {
      target: { value: '54.172.60.0/30' },
    });
    fireEvent.click(screen.getByTestId('trunk-wizard-next'));
    await screen.findByTestId('trunk-wizard-media-step');
    fireEvent.click(screen.getByTestId('trunk-wizard-next'));
    await screen.findByTestId('trunk-wizard-outbound-step');
    fireEvent.click(screen.getByTestId('trunk-wizard-next'));
    await screen.findByTestId('trunk-wizard-inbound-step');

    // Set a DID but DON'T pick a queue — the #1 rule: never a DID without a queue.
    fireEvent.change(screen.getByTestId('trunk-wizard-did'), { target: { value: '+13105551234' } });
    fireEvent.click(screen.getByTestId('trunk-wizard-next'));

    await waitFor(() =>
      expect(screen.getByText('admin:didRoutes.validation.queueRequired')).toBeInTheDocument(),
    );
    // Still on the inbound step — never reached review/finish.
    expect(screen.getByTestId('trunk-wizard-inbound-step')).toBeInTheDocument();
    expect(screen.queryByTestId('trunk-wizard-review-step')).not.toBeInTheDocument();
    expect(createTrunkAsync).not.toHaveBeenCalled();
  });

  it('TrunkWizard_ShouldCreateTrunkThenRouteThenDid_OnFinish', async () => {
    renderWizard();
    await advanceToReview({ addOutbound: true, addDid: true, didQueue: true });

    fireEvent.click(screen.getByTestId('trunk-wizard-finish'));

    await waitFor(() => expect(createDidAsync).toHaveBeenCalled());

    // Trunk created first with the ip-acl matchHost.
    expect(createTrunkAsync).toHaveBeenCalledTimes(1);
    const trunkArg = createTrunkAsync.mock.calls[0][0] as Record<string, unknown>;
    expect(trunkArg.name).toBe('twilio-trunk');
    expect(trunkArg.matchHost).toBe('54.172.60.0/30');
    expect(trunkArg.type).toBe('PJSIP');

    // Route created with the returned trunk id + next priority (10+10=20).
    expect(createRouteAsync).toHaveBeenCalledTimes(1);
    const routeArg = createRouteAsync.mock.calls[0][0] as Record<string, unknown>;
    expect(routeArg.trunkId).toBe(42);
    expect(routeArg.priority).toBe(20);

    // DID created with the selected queue.
    const didArg = createDidAsync.mock.calls[0][0] as Record<string, unknown>;
    expect(didArg.did).toBe('+13105551234');
    expect(didArg.queueId).toBe('queue-support');

    // Ordering: trunk before route before DID.
    expect(createTrunkAsync.mock.invocationCallOrder[0]).toBeLessThan(
      createRouteAsync.mock.invocationCallOrder[0],
    );
    expect(createRouteAsync.mock.invocationCallOrder[0]).toBeLessThan(
      createDidAsync.mock.invocationCallOrder[0],
    );

    expect(navigateMock).toHaveBeenCalledWith('/admin/trunks');
  });

  it('TrunkWizard_ShouldSkipRouteAndDid_WhenBothToggledOff', async () => {
    renderWizard();
    await advanceToReview({ addOutbound: false, addDid: false });

    fireEvent.click(screen.getByTestId('trunk-wizard-finish'));

    await waitFor(() => expect(createTrunkAsync).toHaveBeenCalled());
    expect(createRouteAsync).not.toHaveBeenCalled();
    expect(createDidAsync).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/admin/trunks');
  });

  it('TrunkWizard_ShouldStopAfterTrunk_WhenRouteCreateFails', async () => {
    createRouteAsync.mockRejectedValueOnce(new Error('boom'));
    renderWizard();
    await advanceToReview({ addOutbound: true, addDid: true, didQueue: true });

    fireEvent.click(screen.getByTestId('trunk-wizard-finish'));

    await waitFor(() => expect(createRouteAsync).toHaveBeenCalled());
    // Trunk succeeded, route failed → DID is NOT attempted.
    expect(createTrunkAsync).toHaveBeenCalledTimes(1);
    expect(createDidAsync).not.toHaveBeenCalled();
  });
});
