import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * createOrUpdateUserRecord sends an explicit allow-list of fields, so a new setting that isn't
 * added to it is silently dropped: the switch flips back and the toast still says "saved".
 * That is exactly what happened to "Show my profile picture publicly", so the privacy switches
 * are pinned here — if a switch is added to the UI but not to the payload, this fails.
 */
const bodyOf = (fetchMock: ReturnType<typeof vi.fn>) => JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body ?? '{}'));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ user: { uid: 'u1' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const load = async () => {
  const mod = await import('../../src/services/supabase');
  // A session, so the call gets past the auth check.
  (mod.supabase as unknown as { auth: Record<string, unknown> }).auth.getSession = async () => ({
    data: { session: { access_token: 'test-token', expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null,
  });
  return mod;
};

describe('the profile save payload', () => {
  it('carries every privacy switch, including the profile picture one', async () => {
    const { createOrUpdateUserRecord } = await load();
    await createOrUpdateUserRecord({ showPhoto: true });
    expect(bodyOf(fetchMock).showPhoto).toBe(true);

    await createOrUpdateUserRecord({ showPhoto: false });
    expect(bodyOf(fetchMock).showPhoto).toBe(false);

    await createOrUpdateUserRecord({ showInDirectory: false });
    expect(bodyOf(fetchMock).showInDirectory).toBe(false);

    await createOrUpdateUserRecord({ showFullName: true });
    expect(bodyOf(fetchMock).showFullName).toBe(true);
  });

  it('leaves out switches that were not being changed', async () => {
    const { createOrUpdateUserRecord } = await load();
    await createOrUpdateUserRecord({ showPhoto: true });
    const body = bodyOf(fetchMock);
    expect('showInDirectory' in body).toBe(false);
    expect('showFullName' in body).toBe(false);
  });
});
