import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A fetched list (or object) that survives tab switches.
 *
 * The pattern every list in this app needs: show what we already have **immediately**, refresh it
 * quietly in the background, and only show a skeleton the very first time. Switching to a tab whose
 * data is already loaded must not clear the screen and re-fetch it, which is what made the dashboard
 * and admin tables flash.
 *
 * - cached by `key` across unmounts, so leaving and returning to a tab is instant
 * - stale-while-revalidate: `data` stays put while a refresh runs (`refreshing` is true)
 * - `loadingFirst` is true only when there is genuinely nothing to show
 * - revalidates when the window regains focus, and optionally on an interval
 * - a sequence guard per key, so a slow reply can never overwrite a newer one
 * - `patch` applies a local change (an approval, say) without a round trip
 */

interface Entry<T> { data: T; at: number }
const cache = new Map<string, Entry<unknown>>();
const inflight = new Map<string, number>();

/** Drop cached data, e.g. after signing out. */
export const clearResourceCache = (prefix?: string) => {
  if (!prefix) { cache.clear(); return; }
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
};

export function useCachedResource<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  opts: { freshMs?: number; pollMs?: number } = {},
) {
  const { freshMs = 20_000, pollMs } = opts;
  const [, render] = useState(0);
  const bump = useCallback(() => render((n) => n + 1), []);
  const [phase, setPhase] = useState<'idle' | 'first' | 'refresh'>('idle');
  const [error, setError] = useState('');
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const entry = key ? (cache.get(key) as Entry<T> | undefined) : undefined;

  const run = useCallback(async (k: string, mode: 'first' | 'refresh') => {
    const mine = (inflight.get(k) ?? 0) + 1;
    inflight.set(k, mine);
    setPhase(mode);
    try {
      const data = await fetcherRef.current();
      if (inflight.get(k) !== mine) return; // a newer request owns this key now
      cache.set(k, { data, at: Date.now() });
      setError('');
      bump();
    } catch (err) {
      if (inflight.get(k) === mine) setError(err instanceof Error ? err.message : 'Couldn’t load that');
    } finally {
      if (inflight.get(k) === mine) setPhase('idle');
    }
  }, [bump]);

  // Cold → load with a skeleton. Warm but stale → refresh underneath what's on screen.
  useEffect(() => {
    if (!key) return;
    const cached = cache.get(key);
    if (!cached) run(key, 'first');
    else if (Date.now() - cached.at > freshMs) run(key, 'refresh');
  }, [key, freshMs, run]);

  // Catch up when the window comes back, and optionally on a timer.
  useEffect(() => {
    if (!key) return;
    const tick = () => { if (document.visibilityState === 'visible') run(key, 'refresh'); };
    window.addEventListener('focus', tick);
    const t = pollMs ? window.setInterval(tick, pollMs) : 0;
    return () => { window.removeEventListener('focus', tick); if (t) window.clearInterval(t); };
  }, [key, pollMs, run]);

  const patch = useCallback((update: (prev: T) => T) => {
    if (!key) return;
    const cached = cache.get(key) as Entry<T> | undefined;
    if (!cached) return;
    cache.set(key, { data: update(cached.data), at: cached.at });
    bump();
  }, [key, bump]);

  return {
    data: entry?.data,
    /** Nothing to show yet — the only time a skeleton is right. */
    loadingFirst: phase === 'first' && !entry,
    /** Refreshing underneath data that is already on screen. */
    refreshing: phase === 'refresh',
    error,
    refresh: useCallback(() => { if (key) run(key, cache.has(key) ? 'refresh' : 'first'); }, [key, run]),
    patch,
  };
}
