import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock('@/core/api/hooks/use-endpoint-profiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/hooks/use-endpoint-profiles')>();
  return {
    ...actual,
    useCreateEndpointProfile: () => ({ mutate: createMutate }),
    useUpdateEndpointProfile: () => ({ mutate: updateMutate }),
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
    data: { source: 'asterisk', codecs: ['ulaw', 'alaw', 'g722', 'opus', 'vp8', 'h264'] },
  }),
}));

import { ProfileForm } from './profile-form';
import type { EndpointProfile } from '@/core/api/hooks/use-endpoint-profiles';

const existingProfile: EndpointProfile = {
  id: 42,
  name: 'test-profile',
  type: 'agent',
  isDefault: false,
  transport: 'transport-udp',
  codecs: 'ulaw,alaw',
  maxContacts: 2,
  webrtc: false,
  directMedia: false,
  context: 'from-internal',
  qualifyFrequency: 30,
};

describe('ProfileForm fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ProfileForm_ShouldRenderCodecSelector_WhenCreating', () => {
    render(<ProfileForm open mode="create" onOpenChange={() => {}} />);
    expect(screen.getByTestId('profile-codecs')).toBeInTheDocument();
  });

  it('ProfileForm_ShouldRenderCodecSelector_WhenEditing', () => {
    render(<ProfileForm open mode="edit" onOpenChange={() => {}} profile={existingProfile} />);
    expect(screen.getByTestId('profile-codecs')).toBeInTheDocument();
  });

  it('ProfileForm_ShouldPrefillCodecs_WhenEditing', () => {
    render(<ProfileForm open mode="edit" onOpenChange={() => {}} profile={existingProfile} />);
    expect(screen.getByTestId('profile-codecs-selected-ulaw')).toBeInTheDocument();
    expect(screen.getByTestId('profile-codecs-selected-alaw')).toBeInTheDocument();
  });

  it('ProfileForm_ShouldSubmitDefaultCodecs_WhenCreating', async () => {
    render(<ProfileForm open mode="create" onOpenChange={() => {}} />);

    // Default values pre-select ulaw,alaw,g722 — verify they appear as selected rows.
    expect(screen.getByTestId('profile-codecs-selected-ulaw')).toBeInTheDocument();
    expect(screen.getByTestId('profile-codecs-selected-alaw')).toBeInTheDocument();
    expect(screen.getByTestId('profile-codecs-selected-g722')).toBeInTheDocument();

    // Fill the name field (required) so the form passes validation.
    // The Sheet renders into a portal, so we query document rather than container.
    const nameInput = document.querySelector<HTMLInputElement>('#profile-name');
    if (nameInput === null) throw new Error('#profile-name not found');
    fireEvent.change(nameInput, { target: { value: 'my-profile' } });

    const form = nameInput.closest('form');
    if (form === null) throw new Error('form not found');
    fireEvent.submit(form);

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const arg = createMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.codecs).toBe('ulaw,alaw,g722');
  });
});
