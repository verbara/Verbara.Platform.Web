import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock('@/core/api/hooks/use-trunks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/hooks/use-trunks')>();
  return {
    ...actual,
    useCreateTrunk: () => ({ mutate: createMutate }),
    useUpdateTrunk: () => ({ mutate: updateMutate }),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('@/core/api/hooks/use-voice-codecs', () => ({
  useVoiceCodecs: () => ({
    data: { source: 'asterisk', codecs: ['ulaw', 'alaw', 'g722', 'opus'] },
  }),
}));

import { TrunkForm } from './trunk-form';
import type { TrunkSummary } from '@/core/api/hooks/use-trunks';

const existingTrunk: TrunkSummary = {
  id: 7,
  name: 'carrier-trunk',
  displayName: 'Carrier Trunk',
  type: 'PJSIP',
  isActive: true,
  maxChannels: 30,
  matchHost: '203.0.113.10',
  authUsername: 'carrier-user',
  registrationUri: 'sip:reg@carrier.example.com',
  clientUri: 'sip:client@carrier.example.com',
  codecs: 'ulaw,alaw',
  transport: 'transport-udp',
  context: 'from-trunk',
};

describe('TrunkForm fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TrunkForm_ShouldRenderBasicCarrierFields_WhenCreating', () => {
    render(<TrunkForm open mode="create" onOpenChange={() => {}} />);

    // Original stub fields
    expect(screen.getByTestId('trunk-form-name')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-form-displayName')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-form-type')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-form-maxChannels')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-form-isActive')).toBeInTheDocument();

    // New always-visible carrier auth/registration fields
    expect(screen.getByTestId('trunk-form-matchHost')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-form-authUsername')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-form-authPassword')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-form-registrationUri')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-form-clientUri')).toBeInTheDocument();
  });

  it('TrunkForm_ShouldHideAdvancedSection_ByDefault', () => {
    render(<TrunkForm open mode="create" onOpenChange={() => {}} />);

    expect(screen.getByTestId('trunk-form-advanced-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('trunk-form-advanced-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trunk-form-codecs')).not.toBeInTheDocument();
  });

  it('TrunkForm_ShouldRevealAdvancedFields_WhenToggleClicked', () => {
    render(<TrunkForm open mode="create" onOpenChange={() => {}} />);

    fireEvent.click(screen.getByTestId('trunk-form-advanced-toggle'));

    expect(screen.getByTestId('trunk-form-advanced-section')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-form-codecs')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-form-transport')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-form-context')).toBeInTheDocument();
  });

  it('TrunkForm_ShouldSubmitCarrierFields_WhenCreating', async () => {
    render(<TrunkForm open mode="create" onOpenChange={() => {}} />);

    fireEvent.change(screen.getByTestId('trunk-form-name'), { target: { value: 'new-trunk' } });
    fireEvent.change(screen.getByTestId('trunk-form-displayName'), {
      target: { value: 'New Trunk' },
    });
    fireEvent.change(screen.getByTestId('trunk-form-matchHost'), {
      target: { value: '198.51.100.0/24' },
    });
    fireEvent.change(screen.getByTestId('trunk-form-authUsername'), {
      target: { value: 'sip-user' },
    });
    fireEvent.change(screen.getByTestId('trunk-form-authPassword'), {
      target: { value: 's3cr3t-pass' },
    });
    fireEvent.change(screen.getByTestId('trunk-form-registrationUri'), {
      target: { value: 'sip:reg@carrier.test' },
    });
    fireEvent.change(screen.getByTestId('trunk-form-clientUri'), {
      target: { value: 'sip:client@carrier.test' },
    });

    // Advanced
    fireEvent.click(screen.getByTestId('trunk-form-advanced-toggle'));
    fireEvent.click(screen.getByTestId('trunk-form-codecs-add-ulaw'));
    fireEvent.click(screen.getByTestId('trunk-form-codecs-add-alaw'));
    fireEvent.change(screen.getByTestId('trunk-form-context'), {
      target: { value: 'from-carrier' },
    });

    fireEvent.submit(screen.getByTestId('trunk-form-submit').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const arg = createMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.matchHost).toBe('198.51.100.0/24');
    expect(arg.authUsername).toBe('sip-user');
    expect(arg.authPassword).toBe('s3cr3t-pass');
    expect(arg.registrationUri).toBe('sip:reg@carrier.test');
    expect(arg.clientUri).toBe('sip:client@carrier.test');
    expect(typeof arg.codecs).toBe('string');
    expect(arg.context).toBe('from-carrier');
  });

  it('TrunkForm_ShouldBlockSubmit_WhenMatchHostInvalid', async () => {
    render(<TrunkForm open mode="create" onOpenChange={() => {}} />);

    fireEvent.change(screen.getByTestId('trunk-form-name'), { target: { value: 'bad-trunk' } });
    fireEvent.change(screen.getByTestId('trunk-form-displayName'), {
      target: { value: 'Bad Trunk' },
    });
    fireEvent.change(screen.getByTestId('trunk-form-matchHost'), {
      target: { value: 'not-an-ip' },
    });

    fireEvent.submit(screen.getByTestId('trunk-form-submit').closest('form')!);

    await waitFor(() =>
      expect(screen.getByText('admin:trunks.validation.matchHostInvalid')).toBeInTheDocument(),
    );
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('TrunkForm_ShouldNotPrefillAuthPassword_WhenEditing', () => {
    render(<TrunkForm open mode="edit" onOpenChange={() => {}} trunk={existingTrunk} />);

    // Round-tripped fields are prefilled...
    expect((screen.getByTestId('trunk-form-matchHost') as HTMLInputElement).value).toBe(
      '203.0.113.10',
    );
    expect((screen.getByTestId('trunk-form-authUsername') as HTMLInputElement).value).toBe(
      'carrier-user',
    );
    // ...but the write-only secret is ALWAYS blank.
    expect((screen.getByTestId('trunk-form-authPassword') as HTMLInputElement).value).toBe('');
  });

  it('TrunkForm_ShouldOmitAuthPassword_WhenEditingAndLeftBlank', async () => {
    render(<TrunkForm open mode="edit" onOpenChange={() => {}} trunk={existingTrunk} />);

    fireEvent.change(screen.getByTestId('trunk-form-displayName'), {
      target: { value: 'Renamed Trunk' },
    });
    fireEvent.submit(screen.getByTestId('trunk-form-submit').closest('form')!);

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const arg = updateMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.id).toBe(7);
    expect(arg.displayName).toBe('Renamed Trunk');
    expect('authPassword' in arg).toBe(false);
    // Existing fields still round-trip through the payload.
    expect(arg.matchHost).toBe('203.0.113.10');
    expect(arg.authUsername).toBe('carrier-user');
  });

  it('TrunkForm_ShouldSendNewAuthPassword_WhenEditingAndProvided', async () => {
    render(<TrunkForm open mode="edit" onOpenChange={() => {}} trunk={existingTrunk} />);

    fireEvent.change(screen.getByTestId('trunk-form-authPassword'), {
      target: { value: 'rotated-secret' },
    });
    fireEvent.submit(screen.getByTestId('trunk-form-submit').closest('form')!);

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const arg = updateMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.authPassword).toBe('rotated-secret');
  });

  it('TrunkForm_ShouldSubmitCodecs_WhenCreating', async () => {
    render(<TrunkForm open mode="create" onOpenChange={() => {}} />);
    fireEvent.change(screen.getByTestId('trunk-form-name'), { target: { value: 'codec-trunk' } });
    fireEvent.change(screen.getByTestId('trunk-form-displayName'), {
      target: { value: 'Codec Trunk' },
    });
    fireEvent.click(screen.getByTestId('trunk-form-advanced-toggle'));
    fireEvent.click(screen.getByTestId('trunk-form-codecs-add-alaw'));
    fireEvent.submit(screen.getByTestId('trunk-form-submit').closest('form')!);
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const arg = createMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof arg.codecs).toBe('string');
  });

  it('TrunkForm_ShouldPrefillCodecs_WhenEditing', () => {
    render(<TrunkForm open mode="edit" onOpenChange={() => {}} trunk={existingTrunk} />);
    fireEvent.click(screen.getByTestId('trunk-form-advanced-toggle'));
    expect(screen.getByTestId('trunk-form-codecs-selected-ulaw')).toBeInTheDocument();
    expect(screen.getByTestId('trunk-form-codecs-selected-alaw')).toBeInTheDocument();
  });
});
