import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('wavesurfer.js', () => ({
  default: {
    create: vi.fn(() => ({
      on: vi.fn(),
      destroy: vi.fn(),
      playPause: vi.fn(),
      getDuration: vi.fn(() => 120),
      setPlaybackRate: vi.fn(),
      seekTo: vi.fn(),
      getMediaElement: vi.fn(() => ({ captureStream: vi.fn() })),
    })),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'recording.player.channelSelector': 'Channel',
        'recording.player.channelBoth': 'Both',
        'recording.player.channelAgent': 'Agent',
        'recording.player.channelCustomer': 'Customer',
        'recording.player.stereoTooltip': 'Toggle audio channel',
      };
      return map[key] ?? key;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import StereoWaveformPlayer from './stereo-waveform-player';

describe('StereoWaveformPlayer', () => {
  it('should_RenderPlayButtonAndChannelSelector_WhenMounted', () => {
    render(<StereoWaveformPlayer src="/test.wav" />);
    expect(screen.getByLabelText('play-pause')).toBeInTheDocument();
    expect(screen.getByTestId('channel-selector')).toBeInTheDocument();
  });

  it('should_RenderAllChannelButtons_WhenMounted', () => {
    render(<StereoWaveformPlayer src="/test.wav" />);
    expect(screen.getByTestId('channel-agent')).toHaveTextContent('Agent');
    expect(screen.getByTestId('channel-both')).toHaveTextContent('Both');
    expect(screen.getByTestId('channel-customer')).toHaveTextContent('Customer');
  });

  it('should_HaveActiveStyleOnBoth_WhenDefaultChannel', () => {
    render(<StereoWaveformPlayer src="/test.wav" />);
    expect(screen.getByTestId('channel-both')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('channel-agent')).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('channel-customer')).toHaveAttribute('data-active', 'false');
  });

  it('should_ChangeActiveState_WhenAgentButtonClicked', () => {
    render(<StereoWaveformPlayer src="/test.wav" />);
    const agentBtn = screen.getByTestId('channel-agent');
    fireEvent.click(agentBtn);
    expect(agentBtn).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('channel-both')).toHaveAttribute('data-active', 'false');
  });
});
