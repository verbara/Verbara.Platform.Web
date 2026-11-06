import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore, type ImpersonationState } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';

/**
 * The recording player fetches the bytes through the authenticated client and hands WaveSurfer only
 * the blob (change `cdr-list-reads-its-envelope` B.7, design W5, spec `recording-playback`; host
 * `call-records-are-written-once` B.8d, D19). The request client and the auth store are the real
 * ones; only `fetch` (the Platform) and WaveSurfer are faked.
 */

interface FakeWaveSurfer {
  on: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  playPause: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  getDuration: ReturnType<typeof vi.fn>;
  setPlaybackRate: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
  getMediaElement: ReturnType<typeof vi.fn>;
  loadBlob: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
}

const created: { options: Record<string, unknown>; ws: FakeWaveSurfer }[] = [];
let loadBlobImpl: () => Promise<void> = () => Promise.resolve();

vi.mock('wavesurfer.js', () => ({
  default: {
    create: vi.fn((options: Record<string, unknown>) => {
      const ws: FakeWaveSurfer = {
        on: vi.fn(),
        destroy: vi.fn(),
        play: vi.fn(() => Promise.resolve()),
        playPause: vi.fn(() => Promise.resolve()),
        pause: vi.fn(),
        getDuration: vi.fn(() => 82.422),
        setPlaybackRate: vi.fn(),
        seekTo: vi.fn(),
        getMediaElement: vi.fn(() => document.createElement('audio')),
        loadBlob: vi.fn(() => loadBlobImpl()),
        load: vi.fn(() => Promise.resolve()),
      };
      created.push({ options, ws });
      return ws;
    }),
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

const SESSION_ID = 'c7a1f0e25b6d4c3e9a8f1e2d3c4b5a69';
const STREAM_PATH = `/api/v1/recordings/${SESSION_ID}/stream`;
const DURATION_MS = 82422;
const USER = { id: 'u1', email: 'sup@example.com', displayName: 'Sup', role: 'Supervisor' };

interface Seen {
  url: URL;
  headers: Record<string, string>;
}

let seen: Seen[];

function streamRequests(): Seen[] {
  return seen.filter((r) => r.url.pathname === STREAM_PATH);
}

function refreshRequests(): Seen[] {
  return seen.filter((r) => r.url.pathname === '/api/v1/auth/refresh');
}

/** A Platform answering the stream path with `stream(n)` (n = 1 for the first stream request). */
function platform(stream: (n: number) => Response) {
  seen = [];
  let streams = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, 'http://localhost');
      seen.push({ url, headers: { ...((init?.headers ?? {}) as Record<string, string>) } });
      if (url.pathname === '/api/v1/auth/refresh') {
        return new Response(
          JSON.stringify({
            accessToken: 'minted-token',
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      streams += 1;
      return stream(streams);
    }),
  );
}

function audio(type: string): Response {
  return new Response(new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0]), {
    status: 200,
    headers: { 'Content-Type': type },
  });
}

function unauthorized(): Response {
  return new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } });
}

function renderPlayer(seekRef?: React.RefObject<((time: number) => void) | null>) {
  return render(
    <StereoWaveformPlayer
      src={STREAM_PATH}
      durationMs={DURATION_MS}
      sessionId={SESSION_ID}
      recordingName={`${SESSION_ID}.wav`}
      seekRef={seekRef}
    />,
  );
}

function pressPlay() {
  fireEvent.click(screen.getByLabelText('play-pause'));
}

/** No media element in the document plays the stream URL, and no element carries `referrerpolicy`. */
function expectNoMediaElementOnTheStreamUrl() {
  for (const el of Array.from(document.querySelectorAll('audio, video, source'))) {
    expect(el.getAttribute('src') ?? '').not.toContain('/api/v1/recordings/');
  }
  expect(document.querySelector('[referrerpolicy]')).toBeNull();
}

function expectBothHeaders(request: Seen, tenant: string) {
  expect(request.headers.Authorization).toBe('Bearer token-1');
  expect(request.headers['X-Tenant-Id']).toBe(tenant);
}

function lastWaveSurfer(): FakeWaveSurfer {
  const last = created.at(-1);
  if (!last) throw new Error('WaveSurfer.create was not called');
  return last.ws;
}

describe('StereoWaveformPlayer', () => {
  beforeEach(() => {
    created.length = 0;
    loadBlobImpl = () => Promise.resolve();
    useAuthStore.getState().setAuth('token-1', Date.now() + 600_000, USER, 'tenant-1', [], {});
    useTenantStore.setState({ activeTenantId: null });
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockImplementation((type: string) =>
      type === 'audio/wav' ? 'probably' : '',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    useAuthStore.setState({ impersonation: null });
    useAuthStore.getState().logout();
    useTenantStore.setState({ activeTenantId: null });
  });

  it('should_RenderPlayButtonAndChannelSelector_WhenMounted', () => {
    platform(() => audio('audio/wav'));
    renderPlayer();
    expect(screen.getByLabelText('play-pause')).toBeInTheDocument();
    expect(screen.getByTestId('channel-selector')).toBeInTheDocument();
  });

  it('should_RenderAllChannelButtons_WhenMounted', () => {
    platform(() => audio('audio/wav'));
    renderPlayer();
    expect(screen.getByTestId('channel-agent')).toHaveTextContent('Agent');
    expect(screen.getByTestId('channel-both')).toHaveTextContent('Both');
    expect(screen.getByTestId('channel-customer')).toHaveTextContent('Customer');
  });

  it('should_HaveActiveStyleOnBoth_WhenDefaultChannel', () => {
    platform(() => audio('audio/wav'));
    renderPlayer();
    expect(screen.getByTestId('channel-both')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('channel-agent')).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('channel-customer')).toHaveAttribute('data-active', 'false');
  });

  it('should_ChangeActiveState_WhenAgentButtonClicked', () => {
    platform(() => audio('audio/wav'));
    renderPlayer();
    const agentBtn = screen.getByTestId('channel-agent');
    fireEvent.click(agentBtn);
    expect(agentBtn).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('channel-both')).toHaveAttribute('data-active', 'false');
  });

  it('CreatesWaveSurferWithNeitherUrlNorFetchParams_AndRequestsNothing_WhenMounted', () => {
    platform(() => audio('audio/wav'));
    renderPlayer();

    expect(created).toHaveLength(1);
    expect(created[0]?.options).not.toHaveProperty('url');
    expect(created[0]?.options).not.toHaveProperty('fetchParams');
    expect(streamRequests()).toHaveLength(0);
    expectNoMediaElementOnTheStreamUrl();
  });

  it('FetchesTheStreamOnceWithBothHeaders_AndHandsLoadBlobTheBlobAndTheDuration_WhenPlayIsPressed', async () => {
    platform(() => audio('audio/wav'));
    renderPlayer();
    pressPlay();

    const ws = lastWaveSurfer();
    await waitFor(() => expect(ws.loadBlob).toHaveBeenCalledTimes(1));
    const [blob, channelData, duration] = ws.loadBlob.mock.calls[0] as [Blob, unknown, number];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(8);
    expect(channelData).toBeUndefined();
    expect(duration).toBe(DURATION_MS / 1000);
    expect(ws.load).not.toHaveBeenCalled();

    expect(streamRequests()).toHaveLength(1);
    expectBothHeaders(streamRequests()[0]!, 'tenant-1');
    expect(streamRequests()[0]!.url.search).toBe('');
    for (const r of seen) {
      expect(r.url.toString()).not.toMatch(/token|access_token/i);
    }
    expect(created.every((c) => !('url' in c.options) && !('fetchParams' in c.options))).toBe(true);
    expectNoMediaElementOnTheStreamUrl();
  });

  it('SeeksLocally_WithNoFurtherStreamRequest_AfterTheRecordingLoaded', async () => {
    platform(() => audio('audio/wav'));
    const seekRef: React.RefObject<((time: number) => void) | null> = { current: null };
    renderPlayer(seekRef);
    pressPlay();
    const ws = lastWaveSurfer();
    await waitFor(() => expect(ws.loadBlob).toHaveBeenCalledTimes(1));

    seekRef.current?.(10);
    expect(ws.seekTo).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
    expect(streamRequests()).toHaveLength(1);
  });

  it('ShowsTheUnsupportedStateAndTheDownload_WithoutLoadBlob_WhenTheBrowserCannotPlayAGsmBlob', async () => {
    platform(() => audio('audio/x-gsm'));
    renderPlayer();
    pressPlay();

    expect(await screen.findByTestId('recording-unsupported-state')).toBeInTheDocument();
    expect(screen.getByTestId('recording-download')).toBeInTheDocument();
    expect(lastWaveSurfer().loadBlob).not.toHaveBeenCalled();
    expect(streamRequests()).toHaveLength(1);
    expectBothHeaders(streamRequests()[0]!, 'tenant-1');
    expect(streamRequests()[0]!.url.search).toBe('');
    expectNoMediaElementOnTheStreamUrl();
  });

  it('SavesTheAlreadyFetchedBlob_WithNoSecondRequest_WhenTheUnsupportedStateDownloadIsPressed', async () => {
    platform(() => audio('audio/x-gsm'));
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:local-1');
    const revokeObjectURL = vi.fn();
    // jsdom has no object URLs; the test-only shim records what the download hands them.
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clicked: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.getAttribute('href') ?? '', download: this.download });
    });
    renderPlayer();
    pressPlay();

    fireEvent.click(await screen.findByTestId('recording-download'));

    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0]).toEqual({ href: 'blob:local-1', download: `${SESSION_ID}.wav` });
    expect(createObjectURL.mock.calls[0]?.[0]?.type).toBe('audio/x-gsm');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-1');
    expect(streamRequests()).toHaveLength(1);
  });

  it('ShowsTheUnsupportedState_WithNoRetry_WhenLoadBlobRejects', async () => {
    platform(() => audio('audio/wav'));
    loadBlobImpl = () => Promise.reject(new Error('decode failed'));
    renderPlayer();
    pressPlay();

    expect(await screen.findByTestId('recording-unsupported-state')).toBeInTheDocument();
    expect(screen.getByTestId('recording-download')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 0));
    expect(lastWaveSurfer().loadBlob).toHaveBeenCalledTimes(1);
    expect(streamRequests()).toHaveLength(1);
    expectNoMediaElementOnTheStreamUrl();
  });

  it('ShowsTheErrorState_WithNoFurtherRequest_WhenTheRetryAfterTheForcedRefreshAnswers401Again', async () => {
    platform(() => unauthorized());
    renderPlayer();
    pressPlay();

    expect(await screen.findByTestId('recording-player-error')).toBeInTheDocument();
    expect(screen.queryByTestId('recording-unsupported-state')).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 0));
    expect(streamRequests()).toHaveLength(2);
    expect(refreshRequests()).toHaveLength(1);
    expect(lastWaveSurfer().loadBlob).not.toHaveBeenCalled();
  });

  it('SendsTheSelectedTenant_WhenItDiffersFromTheTokens', async () => {
    platform(() => audio('audio/wav'));
    useTenantStore.setState({ activeTenantId: 'tenant-2' });
    renderPlayer();
    pressPlay();

    await waitFor(() => expect(streamRequests()).toHaveLength(1));
    expectBothHeaders(streamRequests()[0]!, 'tenant-2');
  });

  it('SendsTheImpersonatedTenant_WhenAnImpersonationIsActive', async () => {
    platform(() => audio('audio/wav'));
    const impersonation: ImpersonationState = {
      active: true,
      targetTenantId: 'tenant-9',
      targetTenantName: 'ACME',
      originalToken: 'operator-token',
      originalTokenExpiry: null,
      originalTenantId: 'tenant-1',
      expiresAt: Date.now() + 600_000,
      readOnly: false,
    };
    useAuthStore.setState({ impersonation });
    useTenantStore.setState({ activeTenantId: 'tenant-2' });
    renderPlayer();
    pressPlay();

    await waitFor(() => expect(streamRequests()).toHaveLength(1));
    expectBothHeaders(streamRequests()[0]!, 'tenant-9');
  });
});
