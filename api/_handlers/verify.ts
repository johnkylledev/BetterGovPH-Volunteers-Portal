/**
 * api/_handlers/verify.ts
 * GET/POST /verify — Public member verification
 */

import { createServiceClient, createAnonClient } from '../_lib/http';
import { getSupabaseConfig } from '../_lib/config';
import { getBearerToken, getStringParam, sendJson, sendError, isUuid } from '../_lib/http';
import type { H } from '../_lib/types';

const isSafeMemberId = (value: string) => /^BGPH-\d{4}-\d{3,4}$/i.test(value);
const normalizeLookupId = (raw: string) => raw.trim().toUpperCase();

export const handler_verify: H = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed');
    return;
  }
  const { url: supabaseUrl, anonKey, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl) {
    sendError(res, 500, 'Server not configured');
    return;
  }
  const queryId = getStringParam(req.query?.id ?? req.query?.memberId);
  const bodyId = getStringParam(req.body?.id ?? req.body?.memberId);
  const lookupRaw = queryId ?? bodyId;
  if (!lookupRaw || !lookupRaw.trim()) {
    sendError(res, 400, 'Missing id (memberId)');
    return;
  }
  const lookup = normalizeLookupId(lookupRaw);

  const token = getBearerToken(req.headers?.authorization);
  let isAdminCaller = false;
  const dbClient = serviceKey ? createServiceClient(supabaseUrl, serviceKey) : createAnonClient(supabaseUrl, anonKey);

  if (token && serviceKey) {
    try {
      const { data: authData } = await dbClient.auth.getUser(token);
      if (authData?.user) {
        const callerUid = authData.user.id;
        const { data: callerRow } = await dbClient
          .from('users')
          .select('is_admin')
          .eq('uid', callerUid)
          .maybeSingle();
        isAdminCaller = !!callerRow?.is_admin;
      }
    } catch {
      isAdminCaller = false;
    }
  }

  const cleanLookup = lookupRaw.trim();
  const lookupUpper = cleanLookup.toUpperCase();
  const exactMemberId = lookupUpper.startsWith('BGPH-') ? lookupUpper : `BGPH-${lookupUpper}`;

  let row: any | null = null;

  const { data: memberData } = await dbClient
    .from('users')
    .select('uid, full_name, specialization, role, status, member_id, year_joined, discord_username, is_admin')
    .or(
      `member_id.eq.${exactMemberId},member_id.eq.${cleanLookup},member_id.ilike.%${cleanLookup}%`,
    )
    .maybeSingle();

  row = memberData ?? null;

  if (!row && isUuid(lookupRaw.trim())) {
    const { data: uidData } = await dbClient
      .from('users')
      .select('uid, full_name, specialization, role, status, member_id, year_joined, discord_username, is_admin')
      .eq('uid', lookupRaw.trim())
      .maybeSingle();
    row = uidData ?? null;
  }

  if (!row) {
    sendError(res, 404, 'Not found');
    return;
  }

  const rawStatus = String(row.status || 'Pending').trim();
  const statusNormalized = row.is_admin
    ? 'Approved'
    : rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

  const responsePayload: Record<string, any> = {
    memberId: row.member_id ?? null,
    fullName: row.full_name ?? '',
    specialization: row.specialization ?? '',
    role: row.role ?? 'Member',
    status: statusNormalized,
    yearJoined: row.year_joined ?? null,
  };

  if (row.discord_username && String(row.discord_username).trim()) {
    responsePayload.discordUsername = String(row.discord_username).trim();
  }

  sendJson(res, 200, responsePayload);
};
