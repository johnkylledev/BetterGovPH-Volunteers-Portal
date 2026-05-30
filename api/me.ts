import { 
  getSupabaseConfig,
  createServiceClient, 
  getBearerToken, 
  getBody, 
  respond, 
  respondError, 
  mapUserRow 
} from './lib/supabase';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    respondError(res, 405, 'Method not allowed');
    return;
  }

  const { url: supabaseUrl, serviceKey: serviceRoleKey } = getSupabaseConfig();

  if (!supabaseUrl || !serviceRoleKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    respondError(res, 500, `Server not configured: ${missing.join(', ')}`);
    return;
  }

  const token = getBearerToken(req.headers?.authorization);
  if (!token) {
    respondError(res, 401, 'Missing Authorization bearer token');
    return;
  }

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const uid = authData?.user?.id ? String(authData.user.id) : '';
  const email = authData?.user?.email ? String(authData.user.email) : '';
  if (authError || !uid) {
    respondError(res, 401, 'Invalid token');
    return;
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
    if (error) {
      respondError(res, 500, 'Failed to load profile');
      return;
    }

    if (!data) {
      const { data: emailCheck } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (emailCheck) {
        if (emailCheck.uid !== uid) {
          await supabase
            .from('users')
            .update({ uid, updated_at: new Date().toISOString() })
            .eq('email', email);
        }
        respond(res, 200, { user: mapUserRow(emailCheck) });
        return;
      }

      respond(res, 200, { user: null });
      return;
    }

    if ((!data.full_name || String(data.full_name).trim() === '') && email) {
      const { data: completeRecord } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .not('uid', 'eq', uid)
        .not('full_name', 'eq', '')
        .maybeSingle();

      if (completeRecord) {
        await supabase
          .from('users')
          .update({ uid, updated_at: new Date().toISOString() })
          .eq('uid', completeRecord.uid);
        await supabase
          .from('users')
          .delete()
          .eq('uid', uid)
          .neq('uid', completeRecord.uid);
        respond(res, 200, { user: mapUserRow(completeRecord) });
        return;
      }
    }

    if ((!data.email || String(data.email).trim() === '') && email) {
      const { data: updated } = await supabase
        .from('users')
        .update({ email, updated_at: new Date().toISOString() })
        .eq('uid', uid)
        .select('*')
        .maybeSingle();
      if (updated) {
        respond(res, 200, { user: mapUserRow(updated) });
        return;
      }
    }

    respond(res, 200, { user: mapUserRow(data) });
    return;
  }

  const body = getBody(req);
  const updates: any = {
    updated_at: new Date().toISOString(),
  };

  if (email) updates.email = email;
  if (typeof body.fullName === 'string') updates.full_name = body.fullName.trim().slice(0, 200);
  if (typeof body.specialization === 'string') updates.specialization = body.specialization.trim().slice(0, 100);
  if (typeof body.role === 'string') updates.role = body.role.trim().slice(0, 50);
  if (typeof body.discordUsername === 'string') updates.discord_username = body.discordUsername.trim().slice(0, 64);
  if (typeof body.yearJoined === 'number' && body.yearJoined >= 2020 && body.yearJoined <= 2100) updates.year_joined = body.yearJoined;
  if (Array.isArray(body.skills) && body.skills.length <= 100) updates.skills = body.skills;
  if (typeof body.experienceLevel === 'string') updates.experience_level = body.experienceLevel.trim().slice(0, 50);
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
      respondError(res, 500, 'Failed to update profile');
      return;
    }

    const updated = Array.isArray(updatedRows) ? updatedRows[0] : null;
    if (updated) {
      respond(res, 200, { user: mapUserRow(updated) });
      return;
    }
  }

  if (!existingUser && email) {
    const { data: userByEmail } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (userByEmail) {
      const { data: updatedRows } = await supabase
        .from('users')
        .update({ ...updates, uid, updated_at: new Date().toISOString() })
        .eq('email', email)
        .select('*');

      if (updatedRows && updatedRows[0]) {
        respond(res, 200, { user: mapUserRow(updatedRows[0]) });
        return;
      }
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
    is_admin: false,
    member_id: null,
    created_at: now,
    updated_at: now,
    skills: updates.skills ?? [],
    experience_level: updates.experience_level ?? null,
    year_joined: updates.year_joined ?? null,
    auth_provider: 'google',
  };

  const { data: insertResult, error: insertError } = await supabase
    .from('users')
    .insert(insertRow)
    .select('*')
    .maybeSingle();

  if (insertError || !insertResult) {
    respondError(res, 500, 'Failed to create profile');
    return;
  }

  respond(res, 200, { user: mapUserRow(insertResult) });
}
