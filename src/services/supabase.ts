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
    photoURL: dbUser.photo_url || '',
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
    photo_url: user.photoURL,
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
  const { data, error } = await supabase
    .from('users')
    .select('member_id')
    .not('member_id', 'is', null);

  if (error) throw error;

  let maxSequence = 0;
  data.forEach((u: any) => {
    // Matches both YYYY-NNN and BGPH-YYYY-NNN
    const parts = u.member_id.split('-');
    const seqStr = parts[parts.length - 1];
    const seq = parseInt(seqStr, 10);
    if (!isNaN(seq) && seq > maxSequence) {
      maxSequence = seq;
    }
  });

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
  const cleanId = id.startsWith('BGPH-') ? id.replace('BGPH-', '') : id;
  const prefixedId = id.startsWith('BGPH-') ? id : `BGPH-${id}`;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or(`uid.eq.${id},member_id.eq.${id},member_id.eq.${cleanId},member_id.eq.${prefixedId}`)
    .maybeSingle();

  if (error) throw error;
  return mapToAppUser(data);
};

export const getAllUsers = async () => {
  const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(mapToAppUser);
};

export const getNonAdminUsers = async () => {
  const { data, error } = await supabase.from('users').select('*').eq('is_admin', false).order('created_at', { ascending: false });
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
