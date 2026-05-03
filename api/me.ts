import { createClient } from '@supabase/supabase-js';

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

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();

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

  const supabaseAuth = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
  const uid = authData?.user?.id ? String(authData.user.id) : '';
  const email = authData?.user?.email ? String(authData.user.email) : '';
  if (authError || !uid) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

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
      const { data: emailCheck } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (emailCheck) {
        res.status(200).json({ user: mapUserRow(emailCheck) });
        return;
      }

      const now = new Date().toISOString();
      const insertRow = {
        uid,
        email,
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
        auth_provider: 'google',
        created_at: now,
        updated_at: now,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .insert(insertRow)
        .select('*')
        .maybeSingle();

      if (insertError) {
        if (insertError.message?.includes('duplicate key') || insertError.code === '23505') {
          const { data: retryByUid } = await supabase
            .from('users')
            .select('*')
            .eq('uid', uid)
            .maybeSingle();
          
          if (retryByUid) {
            res.status(200).json({ user: mapUserRow(retryByUid) });
            return;
          }

          const { data: retryByEmail } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();
          
          if (retryByEmail) {
            res.status(200).json({ user: mapUserRow(retryByEmail) });
            return;
          }
        }
        const message = typeof (insertError as any)?.message === 'string' ? String((insertError as any).message) : '';
        res.status(500).json({ error: 'Failed to create profile', details: message || undefined });
        return;
      }

      if (!inserted) {
        res.status(500).json({ error: 'Failed to create profile' });
        return;
      }

      res.status(200).json({ user: mapUserRow(inserted) });
      return;
    }

    if ((!data.email || String(data.email).trim() === '') && email) {
      const { data: updated, error: updateEmailError } = await supabase
        .from('users')
        .update({ email, updated_at: new Date().toISOString() })
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

  if (email) updates.email = email;
  if (typeof body.fullName === 'string') updates.full_name = body.fullName.trim();
  if (typeof body.specialization === 'string') updates.specialization = body.specialization.trim();
  if (typeof body.role === 'string') updates.role = body.role.trim();
  if (typeof body.discordUsername === 'string') updates.discord_username = body.discordUsername.trim();
  if (typeof body.yearJoined === 'number') updates.year_joined = body.yearJoined;
  if (Array.isArray(body.skills)) updates.skills = body.skills;
  if (typeof body.experienceLevel === 'string') updates.experience_level = body.experienceLevel;
  updates.auth_provider = 'google';

  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('uid', uid)
    .maybeSingle();

  if (existingUser) {
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
    if (updated) {
      res.status(200).json({ user: mapUserRow(updated) });
      return;
    }
  }

  const now = new Date().toISOString();
  const insertRow = {
    uid,
    email,
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
    auth_provider: 'google',
    created_at: now,
    updated_at: now,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('users')
    .insert(insertRow)
    .select('*')
    .maybeSingle();

  if (insertError) {
    if (insertError.message?.includes('duplicate key') || insertError.code === '23505') {
      const { data: retryFetch } = await supabase
        .from('users')
        .select('*')
        .eq('uid', uid)
        .maybeSingle();
      
      if (retryFetch) {
        res.status(200).json({ user: mapUserRow(retryFetch) });
        return;
      }
    }
    const message = typeof (insertError as any)?.message === 'string' ? String((insertError as any).message) : '';
    res.status(500).json({ error: 'Failed to create profile', details: message || undefined });
    return;
  }

  if (!inserted) {
    res.status(500).json({ error: 'Failed to create profile' });
    return;
  }

  res.status(200).json({ user: mapUserRow(inserted) });
}
