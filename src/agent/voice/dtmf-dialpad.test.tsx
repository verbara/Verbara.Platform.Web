import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { sendDtmfMock } = vi.hoisted(() => ({ sendDtmfMock: vi.fn() }));

vi.mock('@/core/voice/softphone-manager', () => ({ sendDtmf: sendDtmfMock }));

import { DtmfDialpad } from './dtmf-dialpad';

describe('DtmfDialpad', () => {
  afterEach(() => sendDtmfMock.mockClear());

  it('DtmfDialpad_ShouldRenderTwelveKeys', () => {
    render(<DtmfDialpad />);
    for (const tone of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']) {
      expect(screen.getByTestId(`voice-dtmf-${tone}`)).toBeInTheDocument();
    }
  });

  it('DtmfDialpad_ShouldSendTone_WhenKeyClicked', () => {
    render(<DtmfDialpad />);
    fireEvent.click(screen.getByTestId('voice-dtmf-7'));
    expect(sendDtmfMock).toHaveBeenCalledWith('7');
    fireEvent.click(screen.getByTestId('voice-dtmf-#'));
    expect(sendDtmfMock).toHaveBeenCalledWith('#');
  });
});
