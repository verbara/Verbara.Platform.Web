import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { SessionWarningDialog } from './session-warning-dialog';

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      defaultNS: 'common',
      ns: ['common'],
      interpolation: { escapeValue: false },
      resources: {
        'en-US': {
          common: {
            session: {
              warning: {
                title: 'Still there?',
                description: 'Your session is about to expire due to inactivity.',
                countdown: 'Signing out in {{seconds}}s',
                stayConnected: 'Stay connected',
                signOutNow: 'Sign out now',
                srCountdown: 'Session expires in {{seconds}} seconds',
              },
            },
          },
        },
      },
    });
  }
});

function wrap(ui: ReactNode) {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

describe('SessionWarningDialog', () => {
  it('SessionWarningDialog_ShouldRenderAlertdialogWithAccessibleNameAndDescription_WhenOpen', () => {
    render(
      wrap(
        <SessionWarningDialog
          open
          secondsLeft={60}
          onStayConnected={vi.fn()}
          onSignOut={vi.fn()}
        />,
      ),
    );

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName('Still there?');
    expect(dialog).toHaveAccessibleDescription(
      'Your session is about to expire due to inactivity.',
    );
  });

  it('SessionWarningDialog_ShouldShowCountdownSeconds_WhenOpen', () => {
    const { rerender } = render(
      wrap(
        <SessionWarningDialog
          open
          secondsLeft={45}
          onStayConnected={vi.fn()}
          onSignOut={vi.fn()}
        />,
      ),
    );

    expect(screen.getByText('Signing out in 45s')).toBeInTheDocument();

    rerender(
      wrap(
        <SessionWarningDialog
          open
          secondsLeft={44}
          onStayConnected={vi.fn()}
          onSignOut={vi.fn()}
        />,
      ),
    );

    expect(screen.getByText('Signing out in 44s')).toBeInTheDocument();
    expect(screen.queryByText('Signing out in 45s')).toBeNull();
  });

  it('SessionWarningDialog_ShouldCallOnStayConnected_WhenStayConnectedClicked', () => {
    const onStayConnected = vi.fn();
    render(
      wrap(
        <SessionWarningDialog
          open
          secondsLeft={30}
          onStayConnected={onStayConnected}
          onSignOut={vi.fn()}
        />,
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stay connected' }));
    expect(onStayConnected).toHaveBeenCalledTimes(1);
  });

  it('SessionWarningDialog_ShouldCallOnSignOut_WhenSignOutNowClicked', () => {
    const onSignOut = vi.fn();
    render(
      wrap(
        <SessionWarningDialog
          open
          secondsLeft={30}
          onStayConnected={vi.fn()}
          onSignOut={onSignOut}
        />,
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign out now' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('SessionWarningDialog_ShouldExposeAssertiveLiveRegionWithSeconds_WhenOpen', () => {
    render(
      wrap(
        <SessionWarningDialog
          open
          secondsLeft={15}
          onStayConnected={vi.fn()}
          onSignOut={vi.fn()}
        />,
      ),
    );

    const liveRegion = screen.getByRole('alert');
    expect(liveRegion).toHaveAttribute('aria-live', 'assertive');
    expect(liveRegion).toHaveTextContent('Session expires in 15 seconds');
  });

  it('SessionWarningDialog_ShouldNotRenderDialog_WhenClosed', () => {
    render(
      wrap(
        <SessionWarningDialog
          open={false}
          secondsLeft={60}
          onStayConnected={vi.fn()}
          onSignOut={vi.fn()}
        />,
      ),
    );

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByText('Still there?')).toBeNull();
  });
});
