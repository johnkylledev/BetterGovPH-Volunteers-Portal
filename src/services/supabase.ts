import { createClient } from '@supabase/supabase-js';
import { User } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const mapToAppUser = (dbUser: any): User | null => {
  if (!dbUser) return null;
  return {
    id: dbUser.uid || dbUser.id,
    uid: dbUser.uid || dbUser.id,
    fullName: dbUser.full_name || '',
    email: dbUser.email || '',
    specialization: dbUser.specialization || '',
    role: dbUser.role || 'Member',
    discordUsername: dbUser.discord_username || '',
    status: dbUser.status || 'Pending',
    memberId: dbUser.member_id ? (dbUser.member_id.startsWith('BGPH-') ? dbUser.member_id : `BGPH-${dbUser.member_id}`) : undefined,
    adminNotes: dbUser.admin_notes,
    isAdmin: !!dbUser.is_admin,
    authProvider: (dbUser.auth_provider as 'traditional' | 'google') || 'traditional',
    yearJoined: dbUser.year_joined,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
  };
};

const mapToDbUser = (user: any) => {
  return {
    uid: user.uid || user.id,
    email: user.email,
    full_name: user.fullName,
    specialization: user.specialization,
    role: user.role,
    discord_username: user.discordUsername,
    status: user.status,
    member_id: user.memberId,
    year_joined: user.yearJoined,
    admin_notes: user.adminNotes,
    is_admin: user.isAdmin,
    auth_provider: user.authProvider,
    updated_at: new Date().toISOString(),
  };
};

// Auth Providers
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Database Functions
export const getUserData = async (uid: string, email?: string) => {
  try {
    let { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .maybeSingle();

    if (error) throw error;

    if (!data && email) {
      const { data: emailData, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (emailError) throw emailError;
      return mapToAppUser(emailData);
    }

    return mapToAppUser(data);
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
};

export const generateUniqueMemberId = async (selectedYear: number) => {
  // Query only the last generated member_id for the given year to avoid fetching all users
  const { data, error } = await supabase
    .from('users')
    .select('member_id')
    .ilike('member_id', `%-${selectedYear}-%`)
    .order('member_id', { ascending: false })
    .limit(50); // Fetch a small batch to find the highest sequence

  if (error) throw error;

  let maxSequence = 0;
  if (data && data.length > 0) {
    data.forEach((u: any) => {
      const parts = u.member_id.split('-');
      const seqStr = parts[parts.length - 1];
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSequence) {
        maxSequence = seq;
      }
    });
  }

  const nextSequence = maxSequence + 1;
  return `BGPH-${selectedYear}-${String(nextSequence).padStart(3, '0')}`;
};

export const ensureUserHasMemberId = async (uid: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('member_id, year_joined')
    .eq('uid', uid)
    .single();

  if (error) throw error;
  if (data?.member_id) return data.member_id;

  const yearJoined = data?.year_joined || new Date().getFullYear();
  const memberId = await generateUniqueMemberId(yearJoined);
  await supabase
    .from('users')
    .update({ member_id: memberId, updated_at: new Date().toISOString() })
    .eq('uid', uid);

  return memberId;
};

export const createOrUpdateUserRecord = async (user: any) => {
  try {
    const uid = user.uid || user.id;
    const { data: existingData } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .maybeSingle();

    const isAdmin = existingData?.is_admin ?? user.isAdmin ?? false;
    const dbValues = mapToDbUser({
      ...user,
      isAdmin,
      role: existingData?.role ?? user.role ?? 'Member',
      status: isAdmin ? 'Approved' : (existingData?.status ?? user.status ?? 'Pending'),
      authProvider: existingData?.auth_provider ?? user.authProvider ?? 'traditional',
    });

    if (!existingData) {
      // @ts-ignore
      dbValues.created_at = new Date().toISOString();
    }

    if (isAdmin && !existingData?.member_id) {
      const yearJoined = user.yearJoined || new Date().getFullYear();
      const memberId = await generateUniqueMemberId(yearJoined);
      // @ts-ignore
      dbValues.member_id = memberId;
    }

    const { error } = await supabase.from('users').upsert(dbValues);
    if (error) throw error;
  } catch (error) {
    console.error('Error creating/updating user record:', error);
    throw error;
  }
};

export const updateUserData = async (uid: string, data: any) => {
  try {
    const { error } = await supabase
      .from('users')
      .update(mapToDbUser(data))
      .eq('uid', uid);
    if (error) throw error;
  } catch (error) {
    console.error('Error updating user data:', error);
    throw error;
  }
};

export const registerWithEmailPassword = async (userData: any) => {
  const { data, error } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password,
    options: {
      data: {
        full_name: userData.fullName,
      }
    }
  });

  if (error) throw error;
  if (data.user) {
    await createOrUpdateUserRecord({
      uid: data.user.id,
      ...userData,
      authProvider: 'traditional'
    });
  }
  return { uid: data.user?.id };
};

export const signInWithEmailPassword = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.user;
};

export const getUserByEmailAndPassword = async (email: string, _password?: string) => {
  // This is now primarily a lookup function for user metadata
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return mapToAppUser(data);
};

export const getUserByMemberIdOrId = async (id: string) => {
  if (!id) return null;
  const trimmedId = id.trim();

  try {
    // 1. Try matching against member_id first (case-insensitive)
    // We check the ID as-is, without the prefix, and with the prefix
    const upperId = trimmedId.toUpperCase();
    const cleanId = upperId.startsWith('BGPH-') ? upperId.replace('BGPH-', '') : upperId;
    const prefixedId = upperId.startsWith('BGPH-') ? upperId : `BGPH-${upperId}`;

    const { data: memberData, error: memberError } = await supabase
      .from('users')
      .select('*')
      .or(`member_id.ilike."${upperId}",member_id.ilike."${cleanId}",member_id.ilike."${prefixedId}"`)
      .maybeSingle();

    if (memberError) {
      console.error('Member ID lookup error:', memberError);
    } else if (memberData) {
      return mapToAppUser(memberData);
    }

    // 2. If not found by member_id, try by uid only if it looks like a valid UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId);
    if (isUuid) {
      const { data: uidData, error: uidError } = await supabase
        .from('users')
        .select('*')
        .eq('uid', trimmedId)
        .maybeSingle();

      if (uidError) {
        console.error('UID lookup error:', uidError);
      } else if (uidData) {
        return mapToAppUser(uidData);
      }
    }
  } catch (error) {
    console.error('getUserByMemberIdOrId unexpected error:', error);
  }

  return null;
};

export const getAllUsers = async (page = 0, pageSize = 1000) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw error;
  return data.map(mapToAppUser);
};

export const getNonAdminUsers = async (page = 0, pageSize = 1000) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('is_admin', false)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw error;
  return data.map(mapToAppUser);
};

export const updateUserStatus = async (uid: string, status: string, adminNotes?: string) => {
  const updates: any = {
    status,
    updated_at: new Date().toISOString()
  };

  if (adminNotes !== undefined) {
    updates.admin_notes = adminNotes;
  }

  let memberId: string | undefined;

  if (status === 'Approved') {
    memberId = await ensureUserHasMemberId(uid);
    updates.member_id = memberId;
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('uid', uid)
    .select();

  if (error) {
    console.error('Supabase Status Update Failure:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // If the record exists but update fails with 0 rows, it's almost certainly RLS
    throw new Error(`The record was found in the list but the update was rejected by Supabase. \n\nThis typically means Row Level Security (RLS) is enabled and you are missing an 'UPDATE' policy for administrators. \n\nPlease run the SQL policy for Admins in your Supabase dashboard.`);
  }

  return memberId;
};

export const onAuthStateChange = (callback: (user: any) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? { uid: session.user.id, email: session.user.email, ...session.user } : null);
  });
  return () => subscription.unsubscribe();
};
