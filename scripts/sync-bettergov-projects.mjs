#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const DEFAULT_JSON_ENDPOINT = 'https://bettergov.ph/api/projects.json';
const FALLBACK_HTML_URL = 'https://bettergov.ph/projects';
const SOURCE_URL = process.env.BGPH_SYNC_SOURCE || DEFAULT_JSON_ENDPOINT;
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
const IMPORTER_UID =
  process.env.BGPH_IMPORTER_UID || '00000000-0000-0000-0000-000000000001';
const AUTO_APPROVE = /1|true|yes|on/i.test(String(process.env.BGPH_AUTO_APPROVE ?? '1'));
const DRY_RUN = /1|true|yes|on/i.test(String(process.env.DRY_RUN ?? process.env.BGPH_DRY_RUN ?? '0'));
const DEDUPE_ON = (process.env.BGPH_DEDUPE_ON || 'project_url').trim() || 'project_url';
const CURL_HEADERS = {
  accept: '*/*',
  'accept-language': 'en-US,en;q=0.7',
  referer: 'https://bettergov.ph/projects',
  priority: 'u=1, i',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
};

const log = (label, ...rest) => console.log(`[sync-projects][${label}]`, ...rest);
const err = (label, ...rest) => console.error(`[sync-projects][${label}]`, ...rest);

function normalizeUrl(u) {
  if (!u || typeof u !== 'string') return '';
  const s = u.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return 'https://' + s.replace(/^\/+/, '');
}

function pickString(obj, keys, fallback = '') {
  for (const k of keys) {
    if (k.includes('.')) {
      const parts = k.split('.');
      let v = obj;
      for (const p of parts) {
        if (v && typeof v === 'object' && p in v) v = v[p];
        else { v = undefined; break; }
      }
      if (typeof v === 'string' && v.trim()) return v.trim();
    } else {
      if (obj && typeof obj === 'object' && typeof obj[k] === 'string' && obj[k].trim()) return obj[k].trim();
    }
  }
  return fallback;
}

function coerceProject(raw) {
  const title = pickString(raw, ['title', 'project_name', 'projectName', 'name', 'headline']);
  const url = normalizeUrl(pickString(raw, ['url', 'project_url', 'projectUrl', 'link', 'href', 'website', 'repo', 'repository']));
  const description = pickString(raw, ['description', 'summary', 'body', 'content', 'projectDescription', 'excerpt']);
  const projType = pickString(raw, ['proj_type', 'projType', 'project_type', 'type', 'tech_stack', 'category', 'tag', 'tags.0']);
  if (!title || !url || !description) return null;
  return { title, url, description, projType };
}

function extractProjects(node) {
  const out = [];
  const visit = (x) => {
    if (Array.isArray(x)) { x.forEach(visit); return; }
    if (!x || typeof x !== 'object') return;
    const hit = coerceProject(x);
    if (hit) out.push(hit);
    for (const k of Object.keys(x)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      visit(x[k]);
    }
  };
  visit(node);
  const seen = new Set();
  return out.filter((p) => {
    const k = p.url;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function fetchJson(url) {
  log('fetch', url);
  const res = await fetch(url, { headers: { ...CURL_HEADERS } });
  if (!res.ok) {
    err('http-fail', `${res.status} ${res.statusText} from ${url}`);
    return null;
  }
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) {
    err('json-parse-fail', String(e && e.message || e).slice(0, 220));
    return text;
  }
}

async function fetchProjects() {
  const jsonPayload = await fetchJson(SOURCE_URL);
  if (jsonPayload && typeof jsonPayload === 'object') {
    const list = extractProjects(jsonPayload);
    if (list.length) { log('source', `JSON endpoint returned ${list.length} project(s)`); return list; }
  }
  const htmlPayload = await fetchJson(FALLBACK_HTML_URL);
  if (typeof htmlPayload !== 'string') return [];
  const embedded = [
    ...htmlPayload.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    ...htmlPayload.matchAll(/<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi),
    ...htmlPayload.matchAll(/window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\});/gi),
  ];
  for (const m of embedded) {
    try {
      const data = JSON.parse(m[1].trim());
      const list = extractProjects(data);
      if (list.length) { log('source', `Embedded JSON yielded ${list.length} project(s)`); return list; }
    } catch { /* try next */ }
  }
  const rows = [...htmlPayload.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => {
    const [, href, inner] = m;
    const hostFree = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const title = hostFree.slice(0, 80);
    const description = hostFree.slice(0, 240);
    return { title, url: href, description, projType: '' };
  }).map(coerceProject).filter(Boolean);
  if (rows.length) { log('source', `HTML anchor scrape yielded ${rows.length} project(s)`); return rows; }
  return [];
}

function supabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureImporterUser(sb) {
  const { data, error } = await sb
    .from('users')
    .select('uid, full_name, email')
    .eq('uid', IMPORTER_UID)
    .maybeSingle();
  if (error) {
    err('importer-check', error.message || error);
    throw new Error('Could not check importer user');
  }
  if (data) return IMPORTER_UID;
  const { error: insErr } = await sb.from('users').insert({
    uid: IMPORTER_UID,
    full_name: 'BetterGovPH Sync Bot',
    email: 'sync-bot@bettergov.ph',
    status: 'Approved',
    role: 'Member',
    specialization: 'Data Sync',
    year_joined: new Date().getFullYear(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (insErr) err('importer-insert', insErr.message || insErr);
  return IMPORTER_UID;
}

async function upsertOne(sb, uid, p) {
  const base = {
    user_id: uid,
    project_name: p.title,
    project_url: p.url,
    title: p.title,
    url: p.url,
    description: p.description,
    proj_type: p.projType || null,
    tech_stack: p.projType || null,
    status: AUTO_APPROVE ? 'approved' : 'pending',
  };
  if (DEDUPE_ON === 'project_url') {
    const { data: exists } = await sb.from('project_submissions')
      .select('id, project_url, status')
      .eq('project_url', p.url)
      .maybeSingle();
    if (exists) {
      const patch = { ...base };
      delete patch.project_url;
      if (['rejected', 'approved', 'Rejected', 'Approved', 'APPROVED', 'REJECTED'].includes(exists.status)) {
        delete patch.status;
      }
      const { error } = await sb.from('project_submissions').update(patch).eq('id', exists.id);
      if (error) return { ok: false, error, action: 'update' };
      return { ok: true, action: patch.status || exists.status === base.status ? 'noop' : 'update', id: exists.id };
    }
  }
  const id = `${crypto.createHash('sha1').update(p.url).digest('hex').slice(0, 16)}`;
  const payload = { id, ...base };
  const { error } = await sb.from('project_submissions').insert(payload);
  if (error) {
    const { error: err2 } = await sb.from('project_submissions').insert({
      ...payload, id: undefined,
    });
    if (err2) return { ok: false, error: err2 };
    return { ok: true, action: 'insert-genid' };
  }
  return { ok: true, action: 'insert', id };
}

async function main() {
  const startedAt = new Date();
  const projects = await fetchProjects();
  log('parsed', `${projects.length} project(s)`);
  if (!projects.length) {
    err('empty', 'No projects found. Cloudflare challenge or source may have changed.');
    process.exitCode = 2;
    return;
  }
  const previewN = DRY_RUN ? Math.min(5, projects.length) : Math.min(3, projects.length);
  for (const p of projects.slice(0, previewN)) {
    console.log(`  • ${p.title}  —  ${p.url}  (${p.projType || 'no type'})`);
  }
  if (DRY_RUN) { log('dry-run', 'Skipping POST. Unset DRY_RUN to write.'); return; }
  const sb = supabase();
  const uid = await ensureImporterUser(sb);
  log('db', `Importer user=${uid}, auto_approve=${AUTO_APPROVE}`);
  let inserted = 0, updated = 0, noop = 0, failed = 0;
  for (const p of projects) {
    const r = await upsertOne(sb, uid, p);
    if (!r.ok) { failed++; err('upsert-fail', p.url, r.error?.message || r.error); continue; }
    if (r.action?.startsWith('insert')) inserted++;
    else if (r.action === 'update') updated++;
    else noop++;
  }
  log('done', `inserted=${inserted} updated=${updated} noop=${noop} failed=${failed} in ${(Date.now() - startedAt.getTime())}ms`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  err('fatal', e && e.stack ? e.stack : e);
  process.exitCode = 1;
});
