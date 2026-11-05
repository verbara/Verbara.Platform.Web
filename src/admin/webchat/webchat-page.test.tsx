import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import type { ChannelConfig } from '@/core/api/hooks/use-channels';
import enAdmin from '../../../public/locales/en-US/admin.json';
import esAdmin from '../../../public/locales/es-419/admin.json';
import ptAdmin from '../../../public/locales/pt-BR/admin.json';
import guide from '../../webchat/README.md?raw';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

let channel: { data: ChannelConfig | undefined; isLoading: boolean; isError: boolean };
const useChannel = vi.fn((_id: string | undefined) => channel);

vi.mock('@/core/api/hooks/use-channels', () => ({
  useChannel: (id: string | undefined) => useChannel(id),
  useUpdateChannel: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false }),
}));

vi.mock('@/core/tenant/tenant-store', () => ({
  useTenantStore: (select: (s: { activeTenantId: string | null }) => unknown) =>
    select({ activeTenantId: 'ten-acme' }),
}));

import WebChatPage from './webchat-page';

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

function webchat(isActive: boolean, isConfigured = true): ChannelConfig {
  return { channel: 'WebChat', isActive, isConfigured, credentials: [] };
}

const warning = () => document.querySelector<HTMLElement>('[data-webchat-channel-warning]');

describe('WebChatPage', () => {
  beforeEach(() => {
    useChannel.mockClear();
    channel = { data: webchat(true), isLoading: false, isError: false };
  });

  it('render_ShouldSayAnySiteWithTheSnippetCanStartChats_UnderTheSnippet', () => {
    render(<WebChatPage />, { wrapper });

    expect(screen.getByTestId('webchat-snippet').textContent).toContain(
      'data-tenant-id="ten-acme"',
    );
    expect(screen.getByText('webchat.snippet_scope')).toBeInTheDocument();
  });

  it('render_ShouldPointToTheIdentityGuide_InACommentLineOfTheSnippet', () => {
    render(<WebChatPage />, { wrapper });

    expect(screen.getByTestId('webchat-snippet').textContent?.split('\n')).toContain(
      '<!-- webchat.snippet_identity_guide -->',
    );
  });

  it('snippetIdentityGuide_ShouldNameASectionOfTheGuide_AndStayOneHtmlComment_InEveryLocale', () => {
    const lines = [enAdmin, esAdmin, ptAdmin].map((l) => l.webchat.snippet_identity_guide);

    expect(new Set(lines).size).toBe(3);
    for (const line of lines) {
      expect(line).toContain('"Identify signed-in visitors"');
      expect(line).not.toMatch(/--|>|\n/);
    }
    expect(guide).toContain('\n## Identify signed-in visitors\n');
  });

  it('render_ShouldReadTheTenantWebChatChannel', () => {
    render(<WebChatPage />, { wrapper });

    expect(useChannel).toHaveBeenCalledWith('webchat');
  });

  it('render_ShouldShowNoWarning_WhenTheWebChatChannelIsActive', () => {
    render(<WebChatPage />, { wrapper });

    expect(warning()).toBeNull();
  });

  it('render_ShouldWarnAndPointToChannels_WhenTheWebChatChannelIsOff', () => {
    channel = { data: webchat(false), isLoading: false, isError: false };
    render(<WebChatPage />, { wrapper });

    expect(warning()).not.toBeNull();
    expect(warning()!.textContent).toContain('webchat.channel_inactive');
    expect(screen.getByRole('link', { name: 'webchat.open_channels' })).toHaveAttribute(
      'href',
      '/admin/channels',
    );
  });

  it('render_ShouldWarn_WhenTheWebChatChannelIsNotConfigured', () => {
    channel = { data: webchat(false, false), isLoading: false, isError: false };
    render(<WebChatPage />, { wrapper });

    expect(warning()).not.toBeNull();
  });

  // No answer yet, or no answer at all: the page cannot tell, so it does not claim the channel is off.
  it('render_ShouldShowNoWarning_WhileTheChannelIsLoadingOrUnreadable', () => {
    channel = { data: undefined, isLoading: true, isError: false };
    const { unmount } = render(<WebChatPage />, { wrapper });
    expect(warning()).toBeNull();
    unmount();

    channel = { data: undefined, isLoading: false, isError: true };
    render(<WebChatPage />, { wrapper });
    expect(warning()).toBeNull();
  });
});
