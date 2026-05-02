import { createClient } from '@supabase/supabase-js';
import { Project, ProjectSubmission, User, VolunteerCall } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const getAccessToken = async () => {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const clerk = w?.Clerk;
  if (!clerk?.session) return null;
  try {
    const token = await clerk.session.getToken();
    return typeof token === 'string' && token.trim() ? token : null;
  } catch {
    return null;
  }
};

const apiRequest = async <T = any>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, init);
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const payloadError =
      payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string'
        ? String((payload as any).error)
        : '';
    const payloadDetails =
      payload && typeof payload === 'object' && 'details' in payload && typeof (payload as any).details === 'string'
        ? String((payload as any).details)
        : '';
    const payloadMissing =
      payload && typeof payload === 'object' && 'missing' in payload && Array.isArray((payload as any).missing)
        ? (payload as any).missing.filter((x: any) => typeof x === 'string').join(', ')
        : '';
    const message = payloadError
      ? [payloadError, payloadDetails || payloadMissing ? `(${[payloadDetails, payloadMissing].filter(Boolean).join(' | ')})` : '']
          .filter(Boolean)
          .join(' ')
      : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return payload as T;
};

const normalizeUrl = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.replace(/`/g, '').trim();
};

const mapProjectRow = (row: any): Project => ({
  id: row?.id ?? '',
  title: row?.project_name ?? row?.title ?? '',
  description: row?.description ?? '',
  url: normalizeUrl(row?.project_url ?? row?.url ?? ''),
  projType: row?.proj_type ?? row?.tech_stack ?? undefined,
  createdAt: row?.created_at ?? undefined,
});

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
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const clerk = w?.Clerk;
  if (clerk?.signOut) {
    await clerk.signOut();
    return;
  }
};

// Database Functions
export const getUserData = async (uid: string, email?: string) => {
  const token = await getAccessToken();
  if (!token) return null;
  let response: { user: User | null } | null = null;
  try {
    response = await apiRequest<{ user: User | null }>('/api/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : typeof err?.message === 'string' ? err.message : '';
    if (message === 'Invalid token') {
      await supabase.auth.signOut().catch(() => null);
      return null;
    }
    throw err;
  }

  const user = response?.user ?? null;
  if (!user) return null;
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

export const submitProjectSubmission = async (input: {
  projectName: string;
  projectUrl: string;
  description: string;
  projType?: string;
}) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await apiRequest<{ message: string; submissionId: string }>('/api/submit-project', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project_name: input.projectName,
      project_url: input.projectUrl,
      description: input.description,
      proj_type: input.projType,
    }),
  });
  return response;
};

export const getMyProjectSubmissions = async (page = 0, pageSize = 20) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  const response = await apiRequest<{ submissions: ProjectSubmission[]; totalCount: number }>(
    `/api/my-project-submissions?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response;
};

export const getProjectSubmissions = async (
  page = 0,
  pageSize = 20,
  filters?: { status?: string }
) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (filters?.status) params.set('status', filters.status);

  const response = await apiRequest<{ submissions: ProjectSubmission[]; totalCount: number }>(
    `/api/admin/project-submissions?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response;
};

export const updateProjectSubmission = async (id: string, action: 'approve' | 'reject') => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await apiRequest<{ message: string }>('/api/admin/project-submissions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, action }),
  });
  return response;
};

export const deleteProjectSubmission = async (id: string, options?: { deleteUser?: boolean }) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await apiRequest<{ message: string }>('/api/admin/project-submissions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, action: 'delete', deleteUser: !!options?.deleteUser }),
  });
  return response;
};

export const createVolunteerCall = async (input: {
  title: string;
  projectUrl: string;
  description: string;
  rolesNeeded?: string;
  contact?: string;
}) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await apiRequest<{ message: string; id: string }>('/api/volunteer-calls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: input.title,
      project_url: input.projectUrl,
      description: input.description,
      roles_needed: input.rolesNeeded,
      contact: input.contact,
    }),
  });
  return response;
};

export const getVolunteerCalls = async (options?: { mine?: boolean }) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const params = new URLSearchParams();
  if (options?.mine) params.set('mine', '1');
  const response = await apiRequest<{ calls: VolunteerCall[]; totalCount: number }>(
    `/api/volunteer-calls?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response;
};

export const getAdminVolunteerCalls = async (filters?: { status?: 'open' | 'closed' | 'All' }) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const params = new URLSearchParams();
  params.set('admin', '1');
  if (filters?.status) params.set('status', filters.status);
  const response = await apiRequest<{ calls: VolunteerCall[]; totalCount: number }>(
    `/api/volunteer-calls?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response;
};

export const deleteVolunteerCall = async (id: string, options?: { deleteUser?: boolean }) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await apiRequest<{ message: string }>('/api/volunteer-calls', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, deleteUser: !!options?.deleteUser }),
  });
  return response;
};

export const getApprovedProjects = async () => {
  const token = await getAccessToken();
  try {
    const response = await apiRequest<any>('/api/projects', {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (response && typeof response === 'object' && Array.isArray((response as any).projects)) {
      return ((response as any).projects as any[]).map(mapProjectRow);
    }
  } catch {
  }

  const runQuery = async () => {
    let result = await supabase
      .from('project_submissions')
      .select('*')
      .in('status', ['approved', 'Approved', 'APPROVED'])
      .order('created_at', { ascending: false })
      .limit(100);
    if (
      result.error &&
      typeof (result.error as any)?.message === 'string' &&
      String((result.error as any).message).toLowerCase().includes('created_at')
    ) {
      result = await supabase
        .from('project_submissions')
        .select('*')
        .in('status', ['approved', 'Approved', 'APPROVED'])
        .order('id', { ascending: false })
        .limit(100);
    }
    return result;
  };

  const result = await runQuery();
  if (result.error) {
    const message =
      typeof (result.error as any)?.message === 'string'
        ? String((result.error as any).message)
        : 'Failed to load projects';
    throw new Error(message);
  }

  return (result.data ?? []).map(mapProjectRow);
};

export const onAuthStateChange = (callback: (user: any) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? { uid: session.user.id, email: session.user.email, ...session.user } : null);
  });
  return () => subscription.unsubscribe();
};
