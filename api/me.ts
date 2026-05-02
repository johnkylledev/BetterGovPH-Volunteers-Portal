import { createClient } from '@supabase/supabase-js';
import { createClerkClient, verifyToken } from '@clerk/backend';
import crypto from 'crypto';

const getSupabaseConfig = () => {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE ||
    '';
  return { url, anonKey, serviceKey };
};

const getBearerToken = (authorizationHeader: unknown) => {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
};

const getBody = (req: any) => {
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

const uuidV5 = (name: string, namespace: string) => {
  const ns = namespace.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(ns)) throw new Error('Invalid namespace uuid');
  const nsBytes = Buffer.from(ns, 'hex');
  const nameBytes = Buffer.from(name, 'utf8');
  const hash = crypto.createHash('sha1').update(nsBytes).update(nameBytes).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const mapUserRow = (row: any) => ({
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
});

const schemaMismatchResponse = (details: string) => ({
  error: 'Database schema mismatch',
  details,
  fixSql: [
    'alter table public.users drop constraint if exists users_uid_fkey;',
  ],
});

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey, serviceKey: serviceRoleKey } = getSupabaseConfig();

  if (!supabaseUrl || !serviceRoleKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    res.status(500).json({ error: 'Server not configured', missing });
    return;
  }

  const token = getBearerToken(req.headers?.authorization);
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization bearer token' });
    return;
  }

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    res.status(500).json({ error: 'Server not configured', missing: ['CLERK_SECRET_KEY'] });
    return;
  }

  const verified = await verifyToken(token, { secretKey: clerkSecretKey }).catch(() => null);
  const clerkUserId = typeof (verified as any)?.sub === 'string' ? String((verified as any).sub) : '';
  if (!clerkUserId) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  const uid = uuidV5(clerkUserId, 'a6d53c49-7ee9-4cd5-a5b1-6d33c0a8f5b1');

  const clerk = createClerkClient({ secretKey: clerkSecretKey } as any);
  const clerkEmail = await (async () => {
    try {
      const u = await (clerk as any).users.getUser(clerkUserId);
      const primary = u?.primaryEmailAddress?.emailAddress;
      if (typeof primary === 'string' && primary.trim()) return primary.trim();
      const list = Array.isArray(u?.emailAddresses) ? u.emailAddresses : [];
      const first = list.find((e: any) => typeof e?.emailAddress === 'string' && e.emailAddress.trim());
      return typeof first?.emailAddress === 'string' ? first.emailAddress.trim() : '';
    } catch {
      return '';
    }
  })();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
    if (error) {
      const message = typeof (error as any)?.message === 'string' ? String((error as any).message) : '';
      res.status(500).json({ error: 'Failed to load profile', details: message || undefined });
      return;
    }

    if (!data) {
      const now = new Date().toISOString();
      const insertRow = {
        uid,
        email: clerkEmail,
        full_name: '',
        specialization: '',
        role: 'Member',
        discord_username: '',
        status: 'Pending',
        member_id: null,
        year_joined: null,
        skills: [],
        experience_level: null,
        admin_notes: null,
        is_admin: false,
        auth_provider: 'clerk',
        created_at: now,
        updated_at: now,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .insert(insertRow)
        .select('*')
        .maybeSingle();

      if (insertError || !inserted) {
        const message = typeof (insertError as any)?.message === 'string' ? String((insertError as any).message) : '';
        if (message.includes('users_uid_fkey')) {
          res.status(500).json(
            schemaMismatchResponse(
              'public.users.uid has a foreign key to auth.users. Using Clerk IDs requires removing that FK (or creating matching auth.users rows).'
            )
          );
          return;
        }
        res.status(500).json({ error: 'Failed to create profile', details: message || undefined });
        return;
      }

      res.status(200).json({ user: mapUserRow(inserted) });
      return;
    }

    if ((!data.email || String(data.email).trim() === '') && clerkEmail) {
      const { data: updated, error: updateEmailError } = await supabase
        .from('users')
        .update({ email: clerkEmail, updated_at: new Date().toISOString() })
        .eq('uid', uid)
        .select('*')
        .maybeSingle();
      if (!updateEmailError && updated) {
        res.status(200).json({ user: mapUserRow(updated) });
        return;
      }
    }

    res.status(200).json({ user: mapUserRow(data) });
    return;
  }

  const body = getBody(req);
  const updates: any = {
    updated_at: new Date().toISOString(),
  };

  if (clerkEmail) updates.email = clerkEmail;
  if (typeof body.fullName === 'string') updates.full_name = body.fullName.trim();
  if (typeof body.specialization === 'string') updates.specialization = body.specialization.trim();
  if (typeof body.role === 'string') updates.role = body.role.trim();
  if (typeof body.discordUsername === 'string') updates.discord_username = body.discordUsername.trim();
  if (typeof body.yearJoined === 'number') updates.year_joined = body.yearJoined;
  if (Array.isArray(body.skills)) updates.skills = body.skills;
  if (typeof body.experienceLevel === 'string') updates.experience_level = body.experienceLevel;
  updates.auth_provider = 'clerk';

  const { data: updatedRows, error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('uid', uid)
    .select('*');

  if (updateError) {
    const message = typeof (updateError as any)?.message === 'string' ? String((updateError as any).message) : '';
    res.status(500).json({ error: 'Failed to update profile', details: message || undefined });
    return;
  }

  const updated = Array.isArray(updatedRows) ? updatedRows[0] : null;
  if (!updated) {
    const now = new Date().toISOString();
    const insertRow = {
      uid,
      email: clerkEmail,
      full_name: updates.full_name ?? '',
      specialization: updates.specialization ?? '',
      role: updates.role ?? 'Member',
      discord_username: updates.discord_username ?? '',
      status: 'Pending',
      member_id: null,
      year_joined: updates.year_joined ?? null,
      skills: updates.skills ?? [],
      experience_level: updates.experience_level ?? null,
      admin_notes: null,
      is_admin: false,
      auth_provider: 'clerk',
      created_at: now,
      updated_at: now,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('users')
      .insert(insertRow)
      .select('*')
      .maybeSingle();

    if (insertError || !inserted) {
      const message = typeof (insertError as any)?.message === 'string' ? String((insertError as any).message) : '';
      if (message.includes('users_uid_fkey')) {
        res.status(500).json(
          schemaMismatchResponse(
            'public.users.uid has a foreign key to auth.users. Using Clerk IDs requires removing that FK (or creating matching auth.users rows).'
          )
        );
        return;
      }
      res.status(500).json({ error: 'Failed to create profile', details: message || undefined });
      return;
    }

    res.status(200).json({ user: mapUserRow(inserted) });
    return;
  }

  res.status(200).json({ user: mapUserRow(updated) });
}
