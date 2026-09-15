/**
 * api/_lib/http.ts
 * HTTP utilities: auth, CORS, JSON formatting, Supabase clients
 */

import { createClient } from '@supabase/supabase-js';
import { LIB_API_VERSION } from './config';

export const getBearerToken = (authorizationHeader: unknown): string | null => {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
};

export const getBody = (req: any) => {
  let body = req.body ?? {};
  const isBuffer = typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(body);
  if (isBuffer) {
    try {
      body = body.toString('utf-8');
    } catch {
      body = {};
    }
  }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body || {};
};

export const getStringParam = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
  return null;
};

export const getNumberParam = (value: unknown, fallback: number): number => {
  const s = getStringParam(value);
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const createAnonClient = (url: string, anonKey: string) =>
  createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

export const createServiceClient = (url: string, serviceKey: string) =>
  createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

export const errorToString = (err: unknown): string => {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    return String((err as any).message);
  }
  return 'Internal server error';
};

export const sendJson = (res: any, statusCode: number, body: Record<string, unknown>) => {
  try {
    if (!res) return;
    if (res.headersSent || res.writableEnded) return;
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-API-Version', LIB_API_VERSION);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');
    res.end(JSON.stringify(body));
  } catch {
    try {
      if (res && !res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Response write failed' }));
      } else if (res && !res.writableEnded) {
        res.end();
      }
    } catch {
      /* noop */
    }
  }
};

export const sendError = (res: any, statusCode: number, message: string) =>
  sendJson(res, statusCode, { error: message });

export const mapUserRow = (row: any) => ({
  id: row.uid,
  uid: row.uid,
  fullName: row.full_name ?? '',
  email: row.email ?? '',
  specialization: row.specialization ?? '',
  role: row.role ?? 'Member',
  discordUsername: row.discord_username ?? '',
  status: row.status ?? 'Pending',
  memberId: row.member_id ?? undefined,
  yearJoined: row.year_joined ?? undefined,
  skills: row.skills ?? [],
  experienceLevel: row.experience_level ?? undefined,
  adminNotes: row.admin_notes ?? undefined,
  isAdmin: !!row.is_admin,
  authProvider: row.auth_provider ?? 'traditional',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  discordId: row.discord_id ?? undefined,
  discordConnected: row.discord_connected ?? false,
  discordVerified: row.discord_verified ?? false,
  discordDisplayName: row.discord_display_name ?? undefined,
  discordAvatar: row.discord_avatar ?? undefined,
});
