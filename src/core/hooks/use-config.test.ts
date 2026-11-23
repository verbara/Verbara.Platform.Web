import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// use-config keeps the loaded config in module state, so every test imports a fresh copy.
async function freshModule() {
  vi.resetModules();
  return import('./use-config');
}

describe('bootApp', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('BootApp_ShouldLoadTheRuntimeConfigBeforeRendering_WhenConfigJsonIsServed', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          apiBaseUrl: '/api/v1',
          version: '1.0.0',
          defaultLocale: 'es-419',
          asteriskWssUrl: 'wss://pbx.example.com:8089/ws',
        }),
        { status: 200 },
      ),
    );
    const { bootApp, getConfig } = await freshModule();
    let seenAtRender: string | undefined;

    await bootApp(() => {
      seenAtRender = getConfig().asteriskWssUrl;
    });

    expect(fetch).toHaveBeenCalledWith('/config.json');
    expect(seenAtRender).toBe('wss://pbx.example.com:8089/ws');
  });

  it('BootApp_ShouldStillRender_WhenConfigJsonCannotBeFetched', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('network down'));
    const { bootApp, getConfig } = await freshModule();
    const render = vi.fn();

    await bootApp(render);

    expect(render).toHaveBeenCalledTimes(1);
    expect(() => getConfig()).toThrow();
  });

  it('BootApp_ShouldStillRenderWithoutAConfig_WhenConfigJsonAnswersAnError', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not found', { status: 404 }));
    const { bootApp, getConfig } = await freshModule();
    const render = vi.fn();

    await bootApp(render);

    expect(render).toHaveBeenCalledTimes(1);
    expect(() => getConfig()).toThrow();
  });
});
