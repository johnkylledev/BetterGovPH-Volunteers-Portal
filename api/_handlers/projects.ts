/**
 * api/_handlers/projects.ts
 * GET /projects — Public approved projects list (local + optional remote merge)
 */

import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig, BGPH_REMOTE_URL, BGPH_FETCH_HEADERS } from '../_lib/config';
import { sendJson, sendError, getStringParam } from '../_lib/http';
import { getCache, setCache } from '../_lib/redis';
import type { H } from '../_lib/types';

const normalizeUrl = (value: unknown) =>
  typeof value === 'string' ? value.replace(/`/g, '').trim() : '';

const mapProjectRow = (row: any) => ({
  id: row.id,
  title: row.project_name ?? row.title ?? '',
  description: row.description ?? '',
  url: normalizeUrl(row.project_url ?? row.url ?? ''),
  projType: row.proj_type ?? row.tech_stack ?? undefined,
  createdAt: row.created_at ?? undefined,
});

const normalizeRemoteUrl = (u: unknown): string => {
  if (!u || typeof u !== 'string') return '';
  const s = normalizeUrl(u).replace(/^\/+/, '');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return 'https://' + s;
};

const pickRemoteString = (obj: any, keys: string[], fallback = ''): string => {
  for (const k of keys) {
    if (!obj || typeof obj !== 'object') continue;
    if (k.includes('.')) {
      const parts = k.split('.');
      let v: any = obj;
      for (const p of parts) {
        if (v && typeof v === 'object' && p in v) v = v[p];
        else {
          v = undefined;
          break;
        }
      }
      if (typeof v === 'string' && v.trim()) return v.trim();
    } else {
      if (typeof obj[k] === 'string' && obj[k].trim()) return obj[k].trim();
    }
  }
  return fallback;
};

const coerceRemoteProject = (row: any) => {
  const title = pickRemoteString(row, ['title', 'project_name', 'projectName', 'name', 'headline']);
  const url = normalizeRemoteUrl(
    pickRemoteString(row, ['url', 'project_url', 'projectUrl', 'link', 'href', 'website', 'repo', 'repository']),
  );
  const description = pickRemoteString(row, ['description', 'summary', 'body', 'content', 'projectDescription', 'excerpt']);
  const projType = pickRemoteString(row, ['proj_type', 'projType', 'project_type', 'type', 'tech_stack', 'category', 'tag']);
  if (!title || !url || !description) return null;
  return {
    id: `remote-${Buffer.from(url).toString('base64url').slice(0, 20)}`,
    title,
    description,
    url,
    projType,
    createdAt: pickRemoteString(row, ['createdAt', 'created_at', 'publishedAt', 'date']) || new Date().toISOString(),
    source: 'bettergov.ph',
  };
};

const extractRemoteProjects = (node: any): any[] => {
  const out: any[] = [];
  const seen = new Set<string>();
  const visit = (x: any) => {
    if (Array.isArray(x)) {
      x.forEach(visit);
      return;
    }
    if (!x || typeof x !== 'object') return;
    const hit = coerceRemoteProject(x);
    if (hit && !seen.has(hit.url)) {
      seen.add(hit.url);
      out.push(hit);
    }
    for (const k of Object.keys(x)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      visit(x[k]);
    }
  };
  visit(node);
  return out;
};

const fetchRemoteProjects = async (): Promise<any[]> => {
  const cacheKey = 'cache:projects:remote';
  try {
    const cached = await getCache<any[]>(cacheKey);
    if (cached && Array.isArray(cached)) return cached;
  } catch {
    /* noop */
  }
  try {
    const r = await fetch(BGPH_REMOTE_URL, { headers: BGPH_FETCH_HEADERS as any });
    if (!r.ok) return [];
    const text = await r.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return [];
    }
    const list = extractRemoteProjects(parsed).slice(0, 100);
    try {
      await setCache(cacheKey, list, 300);
    } catch {
      /* noop */
    }
    return list;
  } catch {
    return [];
  }
};

const dedupeMergedProjects = (local: any[], remote: any[]): any[] => {
  const map = new Map<string, any>();
  for (const p of local) {
    if (p?.url) map.set(String(p.url), { ...p, source: p.source || 'local' });
  }
  for (const r of remote) {
    if (r?.url && !map.has(String(r.url))) map.set(String(r.url), r);
  }
  return Array.from(map.values());
};

export const handler_projects: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  if (req.method !== 'GET') {
    sendError(res, 405, 'Method not allowed');
    return;
  }
  const sourceParam = typeof req.query?.source === 'string' ? req.query.source.toLowerCase() : '';
  const sourceHeader = typeof req.headers?.['x-bettergov-source'] === 'string' ? req.headers['x-bettergov-source'] : '';
  const mergeRemote =
    sourceParam === 'merged' ||
    sourceParam === 'remote' ||
    sourceHeader === 'merged' ||
    sourceHeader === 'remote' ||
    sourceParam === '1' ||
    sourceParam === 'true';
  const cacheKey = mergeRemote ? 'cache:projects:approved:merged' : 'cache:projects:approved';
  try {
    const cached = await getCache<any[]>(cacheKey);
    if (cached && Array.isArray(cached)) {
      sendJson(res, 200, { projects: cached, source: mergeRemote ? 'merged' : 'local' });
      return;
    }
  } catch {
    /* noop */
  }
  const { url: supabaseUrl, anonKey, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl) {
    sendError(res, 500, 'Server not configured');
    return;
  }
  const makeClient = (key: string) =>
    createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const runQuery = async (client: any) => {
    let result = await client
      .from('project_submissions')
      .select('*')
      .in('status', ['approved', 'Approved', 'APPROVED'])
      .order('created_at', { ascending: false })
      .limit(100);
    if (
      result.error &&
      typeof (result.error as any)?.message === 'string' &&
      String((result.error as any).message).toLowerCase().includes('created_at')
    ) {
      result = await client
        .from('project_submissions')
        .select('*')
        .in('status', ['approved', 'Approved', 'APPROVED'])
        .order('id', { ascending: false })
        .limit(100);
    }
    return result;
  };
  let primaryKey = serviceKey || anonKey;
  let fallbackKey = anonKey && serviceKey && anonKey !== serviceKey ? anonKey : '';
  if (!primaryKey) {
    sendError(res, 500, 'Server not configured');
    return;
  }
  let supabase = makeClient(primaryKey);
  let result = await runQuery(supabase);
  if ((result.error || (result.data && result.data.length === 0)) && fallbackKey) {
    supabase = makeClient(fallbackKey);
    result = await runQuery(supabase);
  }
  if (result.error) {
    sendError(res, 500, 'Failed to load projects');
    return;
  }
  const local = (result.data ?? []).map((r: any) => ({ ...mapProjectRow(r), source: 'local' }));
  if (!mergeRemote) {
    try {
      await setCache(cacheKey, local, 300);
    } catch {
      /* noop */
    }
    sendJson(res, 200, { projects: local, source: 'local' });
    return;
  }
  const remote = await fetchRemoteProjects();
  const merged = dedupeMergedProjects(local, remote);
  try {
    await setCache(cacheKey, merged, 300);
  } catch {
    /* noop */
  }
  sendJson(res, 200, {
    projects: merged,
    source: 'merged',
    remoteCount: remote.length,
    localCount: local.length,
  });
};
