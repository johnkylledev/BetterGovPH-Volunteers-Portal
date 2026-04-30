import { createClient } from '@supabase/supabase-js';
import { User } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const getAccessToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
};

const apiRequest = async <T = any>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, init);
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string')
        ? (payload as any).error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return payload as T;
};

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
    skills: dbUser.skills || [],
    experienceLevel: dbUser.experience_level,
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
    skills: user.skills,
    experience_level: user.experienceLevel,
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
  const token = await getAccessToken();
  if (!token) return null;
  const response = await apiRequest<{ user: User | null }>('/api/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const user = response?.user ?? null;
  if (!user) return null;
  if (uid && user.uid !== uid && user.id !== uid) return null;
  if (email && user.email && user.email !== email) return null;
  return user;
};

export const generateUniqueMemberId = async (selectedYear: number) => {
  throw new Error('Member ID generation must be performed server-side.');
};

export const ensureUserHasMemberId = async (uid: string) => {
  throw new Error('Member ID generation must be performed server-side.');
};

export const createOrUpdateUserRecord = async (user: any) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  await apiRequest<{ user: User }>('/api/me', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fullName: user.fullName,
      specialization: user.specialization,
      role: user.role,
      discordUsername: user.discordUsername,
      yearJoined: user.yearJoined,
      skills: user.skills,
      experienceLevel: user.experienceLevel,
      authProvider: user.authProvider,
    }),
  });
};

export const updateUserData = async (uid: string, data: any) => {
  await createOrUpdateUserRecord({ uid, ...data });
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
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      await supabase.auth.signInWithPassword({ email: userData.email, password: userData.password });
    }
    await createOrUpdateUserRecord({
      uid: data.user.id,
      ...userData,
      authProvider: 'traditional',
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
  const token = await getAccessToken();
  if (!token) return null;
  const response = await apiRequest<{ user: User | null }>('/api/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const user = response?.user ?? null;
  if (!user) return null;
  return user.email === email ? user : null;
};

export const getUserByMemberIdOrId = async (id: string) => {
  if (!id) return null;
  try {
    const data = await apiRequest<any>(`/api/verify?id=${encodeURIComponent(id)}`, { method: 'GET' });
    return data;
  } catch {
    return null;
  }
};

export const isDiscordUsernameTaken = async (discordUsername: string): Promise<boolean> => {
  try {
    const data = await apiRequest<{ taken: boolean }>(
      `/api/discord-username-taken?username=${encodeURIComponent(discordUsername)}`,
      { method: 'GET' }
    );
    return !!data?.taken;
  } catch {
    return false;
  }
};

export const getAllUsers = async (page = 0, pageSize = 20, filters?: { status?: string, role?: string, search?: string }) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (filters?.status) params.set('status', filters.status);
  if (filters?.role) params.set('role', filters.role);
  if (filters?.search) params.set('search', filters.search);

  const response = await apiRequest<{ users: User[]; totalCount: number }>(`/api/admin/users?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response;
};

export const getAdminStats = async () => {
  try {
    const token = await getAccessToken();
    if (!token) return { total: 0, pending: 0, approved: 0 };
    const response = await apiRequest<{ total: number; pending: number; approved: number }>('/api/admin/stats', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response;
  } catch {
    return { total: 0, pending: 0, approved: 0 };
  }
};

export const updateUserStatus = async (uid: string, status: string, adminNotes?: string) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await apiRequest<{ memberId: string | null }>('/api/admin/update-user-status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uid, status, adminNotes }),
  });
  return response?.memberId ?? undefined;
};

export const onAuthStateChange = (callback: (user: any) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? { uid: session.user.id, email: session.user.email, ...session.user } : null);
  });
  return () => subscription.unsubscribe();
};
