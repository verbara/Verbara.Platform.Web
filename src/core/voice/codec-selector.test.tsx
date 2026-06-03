import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, d?: string) => d ?? k,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('@/core/api/hooks/use-voice-codecs', () => ({
  useVoiceCodecs: () => ({
    // gsm + ilbc are curated AND installed → visible by default.
    // speex is non-curated AND NOT installed → hidden by default, shown disabled under "show all".
    data: {
      source: 'asterisk',
      codecs: ['ulaw', 'alaw', 'g722', 'opus', 'g729', 'gsm', 'ilbc', 'vp8', 'h264'],
    },
  }),
}));

import { CodecSelector } from './codec-selector';

describe('CodecSelector', () => {
  beforeEach(() => vi.clearAllMocks());

  it('CodecSelector_ShouldRenderSelectedRows_FromValue', () => {
    render(<CodecSelector value="ulaw,alaw" onChange={() => {}} testId="cs" />);
    expect(screen.getByTestId('cs-selected-ulaw')).toBeInTheDocument();
    expect(screen.getByTestId('cs-selected-alaw')).toBeInTheDocument();
  });

  it('CodecSelector_ShouldAppendCodec_WhenAddClicked', () => {
    const onChange = vi.fn();
    render(<CodecSelector value="ulaw" onChange={onChange} testId="cs" />);
    fireEvent.click(screen.getByTestId('cs-add-alaw'));
    expect(onChange).toHaveBeenCalledWith('ulaw,alaw');
  });

  it('CodecSelector_ShouldRemoveCodec_WhenRemoveClicked', () => {
    const onChange = vi.fn();
    render(<CodecSelector value="ulaw,alaw" onChange={onChange} testId="cs" />);
    fireEvent.click(screen.getByTestId('cs-remove-0'));
    expect(onChange).toHaveBeenCalledWith('alaw');
  });

  it('CodecSelector_ShouldMoveCodecUp_WhenUpClicked', () => {
    const onChange = vi.fn();
    render(<CodecSelector value="ulaw,alaw" onChange={onChange} testId="cs" />);
    fireEvent.click(screen.getByTestId('cs-up-1'));
    expect(onChange).toHaveBeenCalledWith('alaw,ulaw');
  });

  it('CodecSelector_ShouldWarnMissingG711_WhenOnlyOpus', () => {
    render(<CodecSelector value="opus" onChange={() => {}} testId="cs" />);
    expect(screen.getByTestId('cs-guardrail-no-g711')).toBeInTheDocument();
  });

  it('CodecSelector_ShouldRenderUniqueDuplicateGuardrail_WhenTokenRepeatedThrice', () => {
    render(<CodecSelector value="opus,opus,opus" onChange={() => {}} testId="cs" />);
    expect(screen.getByTestId('cs-guardrail-duplicate-opus')).toBeInTheDocument();
  });

  it('CodecSelector_ShouldRevealNonCuratedCodecs_WhenShowAllClicked', () => {
    render(<CodecSelector value="ulaw" onChange={() => {}} testId="cs" />);
    expect(screen.queryByTestId('cs-add-gsm')).not.toBeNull(); // gsm is curated + installed → visible
    expect(screen.queryByTestId('cs-add-speex')).toBeNull(); // speex non-curated → hidden by default
    fireEvent.click(screen.getByTestId('cs-show-all'));
    // speex non-curated but NOT in installed list → shown disabled under showAll
    expect(screen.getByTestId('cs-add-speex')).toBeDisabled();
  });

  it('CodecSelector_ShouldAnnounceReorder_WhenMovedDown', () => {
    render(<CodecSelector value="ulaw,alaw" onChange={() => {}} testId="cs" />);
    expect(screen.getByTestId('cs-announcer')).toHaveTextContent('');
    fireEvent.click(screen.getByTestId('cs-down-0'));
    expect(screen.getByTestId('cs-announcer').textContent ?? '').not.toBe('');
  });
});
