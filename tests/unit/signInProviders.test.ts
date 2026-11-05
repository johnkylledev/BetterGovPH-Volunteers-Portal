import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The GitHub button renders from Supabase's public auth settings, so it only shows once the
// provider is enabled in the dashboard and never appears as a button that fails.
const load = async () => (await import('../../src/services/supabase')).getSignInProviders;

describe('getSignInProviders', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('reports GitHub once Supabase has it enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: true, github: true } }) });
    vi.stubGlobal('fetch', fetchMock);
    const providers = await (await load())();
    expect(providers.github).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://example.supabase.co/auth/v1/settings', { headers: { apikey: 'anon-test-key' } });
  });

  it('hides GitHub while the provider is off', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: true, github: false } }) }));
    expect((await (await load())()).github).toBe(false);
  });

  it('fails closed to Google only when the settings call fails, and retries next time', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ external: { github: true } }) });
    vi.stubGlobal('fetch', fetchMock);
    const get = await load();
    expect(await get()).toEqual({ google: true });
    expect((await get()).github).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks Supabase only once per page load', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: true } }) });
    vi.stubGlobal('fetch', fetchMock);
    const get = await load();
    await Promise.all([get(), get(), get()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
