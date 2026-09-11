import { createClient } from '@supabase/supabase-js';

export const getSupabaseConfig = () => {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    '';
  return { url, anonKey, serviceKey };
};

export const getBearerToken = (authorizationHeader: unknown) => {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
};

export const getBody = (req: any) => {
  const body = req.body ?? {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
};

export const getStringParam = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
  return null;
};

export const getNumberParam = (value: unknown, fallback: number) => {
  const s = getStringParam(value);
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const createAnonClient = (url: string, anonKey: string) =>
  createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const createServiceClient = (url: string, serviceKey: string) =>
  createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const verifyAuth = async (supabase: any, token: string) => {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    const uid = data?.user?.id ? String(data.user.id) : '';
    const email = data?.user?.email ? String(data.user.email) : '';
    if (error || !uid) return null;
    return { uid, email };
  } catch {
    return null;
  }
};

export const isAdmin = async (supabase: any, uid: string) => {
  try {
    const { data } = await supabase
      .from('users')
      .select('is_admin')
      .eq('uid', uid)
      .maybeSingle();
    return !!data?.is_admin;
  } catch {
    return false;
  }
};

export const API_VERSION = '1.0.0';

export const respond = (res: any, statusCode: number, data: Record<string, unknown>) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-API-Version', API_VERSION);
  res.end(JSON.stringify(data));
};

export const sanitizeErrorMessage = (err: unknown, fallback = 'Internal server error'): string => {
  if (typeof err === 'string') {
    if (err.toLowerCase().includes('database') || err.toLowerCase().includes('select') || err.toLowerCase().includes('postgres')) {
      return fallback;
    }
    return err;
  }
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    const msg = String((err as any).message);
    if (msg.toLowerCase().includes('database') || msg.toLowerCase().includes('select') || msg.toLowerCase().includes('postgres') || msg.toLowerCase().includes('column')) {
      return fallback;
    }
    return msg;
  }
  return fallback;
};

export const respondError = (res: any, statusCode: number, message: string) => {
  respond(res, statusCode, { error: message });
};

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
