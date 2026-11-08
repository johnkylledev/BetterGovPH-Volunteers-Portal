import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '../types';
import { getAdminMembers } from '../services/supabase';

/**
 * The admin member list, built to never flash or lose its place.
 *
 * - **One cache per list** (tab + filters + search). Switching Applications ⇄ Members shows that
 *   list's own rows at once, instead of the other tab's rows or an empty table.
 * - **Stale while revalidating.** Cached rows stay on screen during a refresh; the skeleton is only
 *   for a list that has never loaded.
 * - **Append, never replace.** "Load more" uses a keyset cursor, so rows arriving meanwhile can't
 *   shift the window and make rows repeat or vanish (what OFFSET paging does).
 * - **Delta sync.** A poll asks only for rows changed since the last watermark and merges them in
 *   place: an approval updates that one row, a new application appears at the top, nothing else
 *   re-renders. (Supabase realtime is off by design here — the browser has no table access.)
 * - **Last write wins by sequence**, so a slow reply can never overwrite newer rows.
 */

export interface MemberListFilters {
  status?: string;
  role?: string;
  search?: string;
}

interface ListState {
  rows: User[];
  total: number;
  cursor: string | null;
  watermark: string | null;
  loadedAt: number;
}

const PAGE_SIZE = 20;
const POLL_MS = 25_000;
const FRESH_MS = 15_000;

const keyOf = (f: MemberListFilters) => `${f.status ?? 'All'}|${f.role ?? 'All'}|${(f.search ?? '').trim().toLowerCase()}`;
const sortRows = (rows: User[]) =>
  [...rows].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')) || String(b.uid).localeCompare(String(a.uid)));

export function useAdminMembers(filters: MemberListFilters, enabled: boolean) {
  const key = keyOf(filters);
  // Caches survive tab switches for the life of the page.
  const cache = useRef(new Map<string, ListState>()).current;
  const [, forceRender] = useState(0);
  const bump = useCallback(() => forceRender((n) => n + 1), []);

  const [busy, setBusy] = useState<'idle' | 'first' | 'refresh' | 'more'>('idle');
  const [error, setError] = useState('');
  const seq = useRef(0);
  const inflight = useRef<string | null>(null);

  const state = cache.get(key);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const write = useCallback((k: string, next: ListState) => { cache.set(k, next); bump(); }, [cache, bump]);

  /** First page for a list we have nothing for, or an explicit refresh. */
  const load = useCallback(async (k: string, mode: 'first' | 'refresh') => {
    const mine = ++seq.current;
    inflight.current = k;
    setBusy(mode);
    try {
      const f = filtersRef.current;
      const res = await getAdminMembers({ ...f, pageSize: PAGE_SIZE, withCount: true });
      if (mine !== seq.current) return; // a newer request already answered
      write(k, {
        rows: sortRows(res.users ?? []),
        total: res.totalCount ?? (res.users?.length ?? 0),
        cursor: res.nextCursor ?? null,
        watermark: res.serverTime ?? null,
        loadedAt: Date.now(),
      });
      setError('');
    } catch (err) {
      if (mine === seq.current) setError(err instanceof Error ? err.message : 'Couldn’t load members');
    } finally {
      if (mine === seq.current) { setBusy('idle'); inflight.current = null; }
    }
  }, [write]);

  /** Next slice, appended. Existing rows are left exactly as they are. */
  const loadMore = useCallback(async () => {
    const k = key;
    const current = cache.get(k);
    if (!current?.cursor || busy === 'more') return;
    const mine = ++seq.current;
    setBusy('more');
    try {
      const res = await getAdminMembers({ ...filtersRef.current, pageSize: PAGE_SIZE, cursor: current.cursor });
      if (mine !== seq.current) return;
      const seen = new Set(current.rows.map((r) => r.uid));
      const added = (res.users ?? []).filter((u) => !seen.has(u.uid));
      write(k, {
        ...current,
        rows: [...current.rows, ...added],
        cursor: res.nextCursor ?? null,
        loadedAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t load more');
    } finally {
      if (mine === seq.current) setBusy('idle');
    }
  }, [key, cache, busy, write]);

  /** Merge only what changed. Never clears the table, never shows a spinner. */
  const sync = useCallback(async () => {
    const k = key;
    const current = cache.get(k);
    if (!current?.watermark || inflight.current) return;
    try {
      const res = await getAdminMembers({ ...filtersRef.current, since: current.watermark, pageSize: PAGE_SIZE });
      const latest = cache.get(k);
      if (!latest) return;
      const changed = res.users ?? [];
      // Rows the server says no longer belong in this list (an application that was just approved).
      const gone = new Set(res.removed ?? []);
      // Too much changed to merge safely, or rows vanished entirely: reload this list quietly.
      if (res.truncated) { load(k, 'refresh'); return; }
      if (changed.length === 0 && gone.size === 0) {
        if (typeof res.totalCount === 'number' && res.totalCount < latest.total) { load(k, 'refresh'); return; }
        write(k, { ...latest, total: res.totalCount ?? latest.total, watermark: res.serverTime ?? latest.watermark });
        return;
      }
      const byId = new Map(latest.rows.filter((r) => !gone.has(r.uid)).map((r) => [r.uid, r]));
      let appeared = false;
      for (const u of changed) {
        if (byId.has(u.uid)) byId.set(u.uid, { ...byId.get(u.uid)!, ...u });
        else { byId.set(u.uid, u); appeared = true; }
      }
      const merged = Array.from(byId.values());
      write(k, {
        ...latest,
        // Only re-sort when something new arrived, so rows never jump under the pointer.
        rows: appeared ? sortRows(merged) : latest.rows.map((r) => byId.get(r.uid) ?? r),
        total: res.totalCount ?? latest.total,
        watermark: res.serverTime ?? latest.watermark,
      });
    } catch { /* a failed poll is not worth telling anyone about; the next one retries */ }
  }, [key, cache, write, load]);

  // Load on arrival only when this list is cold or stale; otherwise show the cache instantly.
  useEffect(() => {
    if (!enabled) return;
    const current = cache.get(key);
    if (!current) { load(key, 'first'); return; }
    if (Date.now() - current.loadedAt > FRESH_MS) sync();
  }, [enabled, key, cache, load, sync]);

  // Keep it live: poll while the tab is visible, and catch up the moment it regains focus.
  useEffect(() => {
    if (!enabled) return;
    const tick = () => { if (document.visibilityState === 'visible') sync(); };
    const t = window.setInterval(tick, POLL_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled, sync]);

  /** Apply a change to one row everywhere it is cached, with no request at all. */
  const patchRow = useCallback((uid: string, patch: Partial<User>) => {
    let touched = false;
    cache.forEach((list, k) => {
      if (!list.rows.some((r) => r.uid === uid)) return;
      cache.set(k, { ...list, rows: list.rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)) });
      touched = true;
    });
    if (touched) bump();
  }, [cache, bump]);

  /**
   * A decided row moves: it leaves the lists it no longer belongs to (an approved application
   * leaves Applications) and joins the ones it now matches (it appears in Members), straight away
   * rather than on the next sync.
   */
  const applyRowChange = useCallback((row: User) => {
    const text = `${row.fullName ?? ''} ${row.email ?? ''} ${row.discordUsername ?? ''} ${row.memberId ?? ''}`.toLowerCase();
    cache.forEach((list, k) => {
      const [status, role, search] = k.split('|');
      const matches =
        (status === 'All' || String(row.status ?? '').toLowerCase() === status.toLowerCase()) &&
        (role === 'All' || String(row.specialization ?? '') === role) &&
        (!search || text.includes(search));
      const has = list.rows.some((r) => r.uid === row.uid);
      if (matches && has) cache.set(k, { ...list, rows: list.rows.map((r) => (r.uid === row.uid ? { ...r, ...row } : r)) });
      else if (matches && !has) cache.set(k, { ...list, rows: sortRows([row, ...list.rows]), total: list.total + 1 });
      else if (!matches && has) cache.set(k, { ...list, rows: list.rows.filter((r) => r.uid !== row.uid), total: Math.max(0, list.total - 1) });
    });
    bump();
  }, [cache, bump]);

  /** Drop a row (an erased account) from every cached list. */
  const removeRow = useCallback((uid: string) => {
    cache.forEach((list, k) => {
      if (!list.rows.some((r) => r.uid === uid)) return;
      cache.set(k, { ...list, rows: list.rows.filter((r) => r.uid !== uid), total: Math.max(0, list.total - 1) });
    });
    bump();
  }, [cache, bump]);

  return useMemo(() => ({
    rows: state?.rows ?? [],
    total: state?.total ?? 0,
    hasMore: !!state?.cursor,
    /** True only for a list that has never loaded — the one case a skeleton is right. */
    loadingFirst: busy === 'first' && !state,
    loadingMore: busy === 'more',
    /** A quiet background refresh; the table stays on screen. */
    refreshing: busy === 'refresh',
    error,
    loadMore,
    refresh: () => load(key, state ? 'refresh' : 'first'),
    sync,
    patchRow,
    applyRowChange,
    removeRow,
  }), [state, busy, error, loadMore, load, key, sync, patchRow, applyRowChange, removeRow]);
}
