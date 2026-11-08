import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppNotification, CallInterest, CertificateData, HoursEntry, ProjectUpdate, CallType, ImportProjectRow, ReportItem, ReportReason, MyTeam, Project, ProjectStage, ProjectSubmission, RepoStats, TeamInfo, User, VolunteerCall } from '../types';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const CANONICAL_API_ORIGIN = 'https://volunteers.bettergov.ph';

const resolveApiUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === 'undefined') return path;
  const here = window.location.hostname.toLowerCase();
  if (here === 'localhost' || here === '127.0.0.1' || here === '') return path;
  const want = CANONICAL_API_ORIGIN;
  if (window.location.origin === want) return path;
  return want.replace(/\/$/, '') + path;
};

let _supabase: SupabaseClient | null = null;

export function resetSupabaseClient() {
  _supabase = null;
}

const supabaseStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  },
};

function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase;
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials not found. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
  }
  
  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: supabaseStorage,
    }
  });
  return _supabase;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseClient();
    const value = client[prop as keyof SupabaseClient];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

const getAccessToken = async () => {
  const now = Date.now();
  if (cachedToken && tokenExpiry > now + 5000) {
    return cachedToken;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    return null;
  }
  cachedToken = data.session.access_token;
  tokenExpiry = (data.session.expires_at || 0) * 1000;
  return cachedToken;
};

const apiRequest = async <T = any>(path: string, init?: RequestInit): Promise<T> => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutMs = 30000;
  const t = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let res: Response;
  try {
    res = await fetch(resolveApiUrl(path), { ...(init || {}), signal: controller?.signal });
  } catch (e: any) {
    if (t) clearTimeout(t);
    const isAbort =
      e?.name === 'AbortError' ||
      (typeof e?.message === 'string' && e.message.toLowerCase().includes('aborted'));
    if (isAbort) throw new Error('Request timed out');
    throw e;
  }
  if (t) clearTimeout(t);
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
    const upstream =
      payload && typeof payload === 'object' && 'upstream_message' in payload && typeof (payload as any).upstream_message === 'string'
        ? String((payload as any).upstream_message)
        : '';
    const concat = [payloadDetails, payloadMissing, upstream].filter(Boolean).join(' | ');
    const message = payloadError
      ? concat ? `${payloadError} (${concat})` : payloadError
      : upstream || `Request failed (${res.status})`;
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
  projType: row?.projType ?? row?.proj_type ?? row?.tech_stack ?? undefined,
  createdAt: row?.createdAt ?? row?.created_at ?? undefined,
  repoUrl: row?.repoUrl ?? row?.repo_url ?? undefined,
  stage: row?.stage ?? undefined,
  ownerName: row?.ownerName ?? undefined,
  repo: row?.repo ?? row?.repo_stats ?? undefined,
  source: row?.source ?? undefined,
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
    authProvider: (dbUser.auth_provider as 'traditional' | 'google' | 'github') || 'traditional',
    yearJoined: dbUser.year_joined,
    skills: dbUser.skills || [],
    experienceLevel: dbUser.experience_level,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
    discordId: dbUser.discord_id ?? undefined,
    discordConnected: dbUser.discord_connected ?? false,
    discordVerified: dbUser.discord_verified ?? false,
    discordDisplayName: dbUser.discord_display_name ?? undefined,
    discordAvatar: dbUser.discord_avatar ?? undefined,
    links: dbUser.links && typeof dbUser.links === 'object' && !Array.isArray(dbUser.links) ? dbUser.links : {},
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
  cachedToken = null;
  tokenExpiry = 0;
  await supabase.auth.signOut();
};

let providersPromise: Promise<Record<string, boolean>> | null = null;
/**
 * Which OAuth providers are switched on in Supabase (public GoTrue settings, anon key only).
 * Sign-in buttons render from this, so a provider shows up the moment it's enabled in the dashboard
 * and never appears as a button that fails. Fails closed: on any error only Google is assumed.
 */
export const getSignInProviders = (): Promise<Record<string, boolean>> => {
  if (!providersPromise) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    providersPromise = (url && key
      ? fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then((s: { external?: Record<string, boolean> }) => s.external ?? { google: true })
      : Promise.resolve({ google: true })
    ).catch(() => {
      providersPromise = null; // try again next time
      return { google: true };
    });
  }
  return providersPromise;
};

export const signInWithGoogle = async (redirectTo: string) => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw error;
};

export const signInWithGithub = async (redirectTo: string) => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo, scopes: 'read:user user:email' },
  });
  if (error) throw error;
};

// Database Functions
export const getUserData = async (uid: string, email?: string) => {
  const token = await getAccessToken();
  if (!token) return null;
  let response: { user: User | null } | null = null;
  try {
    response = await apiRequest<{ user: User | null }>('/api/v1/me', {
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
  const res = await apiRequest<{ user: User }>('/api/v1/me', {
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
      ...(user.links ? { links: user.links } : {}),
      ...(typeof user.secondarySpecialization === 'string' ? { secondarySpecialization: user.secondarySpecialization } : {}),
      ...(typeof user.showInDirectory === 'boolean' ? { showInDirectory: user.showInDirectory } : {}),
      ...(typeof user.showFullName === 'boolean' ? { showFullName: user.showFullName } : {}),
      ...(user.consent ? { consent: user.consent } : {}),
      ...(typeof user.requestDeletion === 'boolean' ? { requestDeletion: user.requestDeletion } : {}),
      ...(typeof user.displayName === 'string' ? { displayName: user.displayName } : {}),
      ...(user.acceptCoc === true ? { acceptCoc: true } : {}),
      ...(Array.isArray(user.availability) ? { availability: user.availability } : {}),
      ...(typeof user.hoursPerWeek === 'string' ? { hoursPerWeek: user.hoursPerWeek } : {}),
      ...(typeof user.region === 'string' ? { region: user.region } : {}),
      ...(Array.isArray(user.languages) ? { languages: user.languages } : {}),
    }),
  });
  return res.user;
};

export const updateUserData = async (uid: string, data: any) => {
  await createOrUpdateUserRecord({ uid, ...data });
};

export const getUserByEmail = async (email: string) => {
  const token = await getAccessToken();
  if (!token) return null;
  const response = await apiRequest<{ user: User | null }>('/api/v1/me', {
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
  const cleanId = id.trim();
  try {
    const data = await apiRequest<any>(`/api/v1/verify?id=${encodeURIComponent(cleanId)}`, { method: 'GET' });
    if (data && (data.fullName || data.memberId)) return data;
  } catch {
    /* not found or network error */
  }
  // No direct-database fallback: the API is the only place that applies public-name redaction.
  return null;
};

export const isDiscordUsernameTaken = async (discordUsername: string): Promise<boolean> => {
  try {
    const data = await apiRequest<{ taken: boolean }>(
      `/api/v1/discord-username-taken?username=${encodeURIComponent(discordUsername)}`,
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

  const response = await apiRequest<{ users: User[]; totalCount: number }>(`/api/v1/admin?resource=users&${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response;
};

/**
 * The admin member list. Three modes, all on one endpoint:
 *   plain          first slice (pass withCount for the total)
 *   cursor=…       next slice, appended by the caller (keyset, stable while rows arrive)
 *   since=<iso>    only rows changed since that watermark, for merging in place
 */
export const getAdminMembers = async (opts: {
  status?: string; role?: string; search?: string; pageSize?: number;
  cursor?: string; since?: string; withCount?: boolean;
}) => {
  const params = new URLSearchParams({ pageSize: String(opts.pageSize ?? 20) });
  if (opts.status && opts.status !== 'All') params.set('status', opts.status);
  if (opts.role && opts.role !== 'All') params.set('role', opts.role);
  if (opts.search?.trim()) params.set('search', opts.search.trim());
  if (opts.cursor) params.set('cursor', opts.cursor);
  if (opts.since) params.set('since', opts.since);
  if (opts.withCount) params.set('withCount', '1');
  return apiRequest<{
    users: User[]; removed?: string[]; totalCount?: number; nextCursor?: string | null;
    serverTime?: string; delta?: boolean; truncated?: boolean;
  }>(`/api/v1/admin?resource=users&${params.toString()}`, { headers: await authHeaders() });
};

export const getAdminStats = async () => {
  try {
    const token = await getAccessToken();
    if (!token) return { total: 0, pending: 0, approved: 0 };
    const response = await apiRequest<{ total: number; pending: number; approved: number }>('/api/v1/admin?resource=stats', {
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
  const response = await apiRequest<{ memberId: string | null }>('/api/v1/admin?resource=user-status', {
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
  repoUrl?: string;
  stage?: ProjectStage;
  ownerType?: 'member' | 'org';
  ownerName?: string;
  chatUrl?: string;
}) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await apiRequest<{ message: string; submissionId: string }>('/api/v1/submit-project', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectName: input.projectName,
      project_name: input.projectName,
      projectUrl: input.projectUrl,
      project_url: input.projectUrl,
      title: input.projectName,
      url: input.projectUrl,
      description: input.description,
      proj_type: input.projType,
      projType: input.projType,
      repoUrl: input.repoUrl || undefined,
      stage: input.stage,
      ownerType: input.ownerType,
      ownerName: input.ownerName,
      chatUrl: input.chatUrl || undefined,
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
    `/api/v1/my-project-submissions?${params.toString()}`,
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
    `/api/v1/admin?resource=submissions&${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response;
};

export const updateProjectSubmission = async (id: string, action: 'approve' | 'reject', note?: string) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await apiRequest<{ message: string }>('/api/v1/admin?resource=submissions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, action, note }),
  });
  return response;
};

export const editProjectSubmission = async (
  id: string,
  fields: { project_name?: string; project_url?: string; description?: string; proj_type?: string; status?: string }
) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await apiRequest<{ message: string }>('/api/v1/admin?resource=submissions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, action: 'update', ...fields }),
  });
  return response;
};

export const deleteProjectSubmission = async (id: string, options?: { deleteUser?: boolean }) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await apiRequest<{ message: string }>('/api/v1/admin?resource=submissions', {
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
  callType?: CallType;
  location?: string;
  neededBy?: string;
  commitment?: string;
  workMode?: string;
  goodFirst?: boolean;
  chatUrl?: string;
}) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await apiRequest<{ message: string; id: string }>('/api/v1/volunteer-calls', {
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
      call_type: input.callType,
      location: input.location,
      needed_by: input.neededBy,
      commitment: input.commitment,
      work_mode: input.workMode,
      good_first: input.goodFirst,
      chat_url: input.chatUrl,
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
    `/api/v1/volunteer-calls?${params.toString()}`,
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
    `/api/v1/volunteer-calls?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response;
};

export const updateVolunteerCall = async (
  id: string,
  fields: { title?: string; projectUrl?: string; description?: string; rolesNeeded?: string; contact?: string; status?: 'open' | 'closed'; callType?: CallType; location?: string; neededBy?: string; commitment?: string; workMode?: string; goodFirst?: boolean; chatUrl?: string }
) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const payload = {
    id,
    action: 'update',
    title: fields.title,
    project_url: fields.projectUrl,
    projectUrl: fields.projectUrl,
    description: fields.description,
    roles_needed: fields.rolesNeeded,
    rolesNeeded: fields.rolesNeeded,
    contact: fields.contact,
    status: fields.status,
    call_type: fields.callType,
    location: fields.location,
    needed_by: fields.neededBy,
    commitment: fields.commitment,
    work_mode: fields.workMode,
    good_first: fields.goodFirst,
    chat_url: fields.chatUrl,
  };

  try {
    return await apiRequest<{ message: string }>('/api/v1/volunteer-calls', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    return await apiRequest<{ message: string }>('/api/v1/volunteer-calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }
};

export const deleteVolunteerCall = async (id: string, options?: { deleteUser?: boolean }) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await apiRequest<{ message: string }>('/api/v1/volunteer-calls', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, deleteUser: !!options?.deleteUser }),
  });
  return response;
};

export const getApprovedProjects = async (opts?: { merged?: boolean }) => {
  const token = await getAccessToken();
  const query = opts?.merged ? '?source=merged' : '';
  const response = await apiRequest<any>(`/api/v1/projects${query}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (response && typeof response === 'object' && Array.isArray((response as any).projects)) {
    return ((response as any).projects as any[]).map(mapProjectRow);
  }
  return [];
};

export const connectDiscord = async (): Promise<{ url: string }> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  return apiRequest<{ url: string }>('/api/v1/discord?action=login', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const syncDiscord = async (
  discordId?: string,
  discordUsername?: string,
  discordDisplayName?: string,
  discordAvatar?: string,
  proof?: { ts?: string; sig?: string },
): Promise<any> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  return apiRequest<any>('/api/v1/discord', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      discord_id: discordId,
      discord_username: discordUsername,
      discord_display_name: discordDisplayName,
      discord_avatar: discordAvatar,
      ts: proof?.ts,
      sig: proof?.sig,
    }),
  });
};

export const getDiscordStatus = async (): Promise<any> => {
  const token = await getAccessToken();
  if (!token) return { connected: false };
  return apiRequest<any>('/api/v1/discord', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const onAuthStateChange = (callback: (user: any) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? { uid: session.user.id, email: session.user.email, ...session.user } : null);
  });
  return () => subscription.unsubscribe();
};


// ---------------------------------------------------------------------------
// Repo tracker, teams, privacy
// ---------------------------------------------------------------------------
const authHeaders = async (required = true): Promise<Record<string, string>> => {
  const token = await getAccessToken();
  if (!token && required) throw new Error('Not authenticated');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Live check of a GitHub repo while filling the submit form. */
export const checkRepo = async (url: string) => {
  const res = await apiRequest<{ repo: RepoStats }>(`/api/v1/repo-tracker?url=${encodeURIComponent(url)}`, { headers: await authHeaders() });
  return res.repo;
};

/** Stored (and lazily refreshed) repo stats for approved projects. */
export const getRepoStats = async (ids: string[]) => {
  if (!ids.length) return {} as Record<string, RepoStats | null>;
  const res = await apiRequest<{ repos: Record<string, RepoStats | null> }>(
    `/api/v1/repo-tracker?ids=${encodeURIComponent(ids.slice(0, 60).join(','))}`,
  );
  return res.repos ?? {};
};

export const getTeam = async (projectId: string) =>
  apiRequest<TeamInfo>(`/api/v1/teams?project=${encodeURIComponent(projectId)}`, { headers: await authHeaders(false) });

export const getMyTeams = async () =>
  apiRequest<{ available: boolean; pendingForMe: number; teams: MyTeam[] }>('/api/v1/teams?mine=1', { headers: await authHeaders() });

export type TeamAction =
  | { action: 'join'; message?: string; teamRole?: string }
  | { action: 'cancel' } | { action: 'leave' }
  | { action: 'decide'; requestId: string; decision: 'approve' | 'decline' }
  | { action: 'remove'; userId: string }
  | { action: 'transfer-head'; userId: string }
  | { action: 'set-owner'; ownerType: 'member'; ownerUserId: string }
  | { action: 'set-owner'; ownerType: 'org'; ownerName: string }
  | { action: 'set-chat'; chatUrl: string }
  | { action: 'set-stage'; stage: ProjectStage };

export const teamAction = async (projectId: string, body: TeamAction) =>
  apiRequest<Record<string, unknown>>('/api/v1/teams', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, ...body }),
  });

/** Admin: consent records for the ROPA export. */
export const getConsentRecords = async () =>
  apiRequest<{ version: string; members: any[]; log: any[] }>('/api/v1/admin?resource=consent', { headers: await authHeaders() });

// ---------------------------------------------------------------------------
// MVP: public calls and "I'm interested"
// ---------------------------------------------------------------------------
/** Open calls for anyone; signed-in members also get contact, chat links and their own interest status. */
export const getOpenCalls = async (opts?: { id?: string }) => {
  const params = new URLSearchParams();
  if (opts?.id) params.set('id', opts.id);
  return apiRequest<{ calls: VolunteerCall[]; totalCount: number }>(`/api/v1/volunteer-calls?${params.toString()}`, {
    headers: await authHeaders(false),
  });
};

export const expressInterest = async (callId: string, input: { message?: string; contact?: string }) =>
  apiRequest<{ status: string }>('/api/v1/call-interests', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ callId, ...input }),
  });

export const withdrawInterest = async (callId: string) =>
  apiRequest<{ status: string }>('/api/v1/call-interests', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'withdraw', callId }),
  });

export const getCallInterests = async (callId: string) =>
  apiRequest<{ interests: CallInterest[] }>(`/api/v1/call-interests?call=${encodeURIComponent(callId)}`, { headers: await authHeaders() });

export const markInterest = async (interestId: string, status: 'new' | 'contacted') =>
  apiRequest<{ status: string }>('/api/v1/call-interests', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'mark', interestId, status }),
  });

/** Admin: bring existing (Discord) projects into the portal as approved listings. */
export const importProjects = async (projects: ImportProjectRow[]) =>
  apiRequest<{ imported: number; skipped: { name: string; reason: string }[] }>('/api/v1/admin?resource=import-projects', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects }),
  });

// ---------------------------------------------------------------------------
// Notifications and reports
// ---------------------------------------------------------------------------
/** Everything the portal holds about the signed-in member (right of access / portability). */
export const exportMyData = async () =>
  apiRequest<Record<string, unknown>>('/api/v1/me?export=1', { headers: await authHeaders() });

export const getNotifications = async () =>
  apiRequest<{ items: AppNotification[]; unread: number; available?: boolean }>('/api/v1/notifications', { headers: await authHeaders() });

export const markNotificationsRead = async (ids?: string[]) =>
  apiRequest<{ ok: boolean }>('/api/v1/notifications', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(ids?.length ? { ids } : {}),
  });

export const reportItem = async (input: { targetType: 'call' | 'project'; targetId: string; reason: ReportReason; details?: string }) =>
  apiRequest<{ status: 'received' | 'already_reported' }>('/api/v1/reports', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

export const getReports = async (status: 'open' | 'all' = 'open') =>
  apiRequest<{ reports: ReportItem[]; available?: boolean }>(`/api/v1/reports?status=${status}`, { headers: await authHeaders() });

export const resolveReport = async (id: string, status: 'dismissed' | 'actioned', opts?: { resolution?: string; hide?: boolean }) =>
  apiRequest<{ status: string }>('/api/v1/reports', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'resolve', id, status, ...opts }),
  });

// ---------------------------------------------------------------------------
// Admin overview and erasure
// ---------------------------------------------------------------------------
export const getAdminOverview = async () =>
  apiRequest<import('../types').AdminOverview>('/api/v1/admin?resource=overview', { headers: await authHeaders() });

// --- Admin roles (super admins only; the server refuses everyone else) ---
export interface AdminRoleRow {
  id: string; name: string; description: string; permissions: string[]; updatedAt: string;
  members: { uid: string; name: string; email: string; memberId: string | null }[];
}
export const getAdminRoles = async () =>
  apiRequest<{ roles: AdminRoleRow[]; permissions: string[] }>('/api/v1/admin?resource=roles', { headers: await authHeaders() });
export const saveAdminRole = async (role: { id?: string; name: string; description: string; permissions: string[] }) =>
  apiRequest<{ ok: boolean; id: string }>('/api/v1/admin?resource=roles', {
    method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save', ...role }),
  });
export const deleteAdminRole = async (id: string) =>
  apiRequest<{ ok: boolean }>('/api/v1/admin?resource=roles', {
    method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id }),
  });
export const assignAdminRole = async (uid: string, roleId: string | null) =>
  apiRequest<{ ok: boolean; roleName: string | null }>('/api/v1/admin?resource=assign-role', {
    method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, roleId }),
  });

/** Completes a deletion request. `confirm` must be the member's email. */
export const eraseUser = async (uid: string, confirm: string) =>
  apiRequest<{ erased: boolean; removed: string[] }>('/api/v1/admin?resource=erase-user', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, confirm }),
  });

/** Fix a project that was sent back (or is still in review) and put it back in the review queue. */
export const resubmitProject = async (id: string, fields: { projectName?: string; projectUrl?: string; description?: string; repoUrl?: string }) =>
  apiRequest<{ status: string }>('/api/v1/my-project-submissions', {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...fields }),
  });

// ---------------------------------------------------------------------------
// Hours, certificate, project updates
// ---------------------------------------------------------------------------
const jsonPost = async (path: string, body: unknown) =>
  apiRequest<any>(path, { method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const getMyHours = async () =>
  apiRequest<{ entries: HoursEntry[]; totals: { confirmed: number; pending: number }; available?: boolean }>('/api/v1/hours?mine=1', { headers: await authHeaders() });
export const getHoursToConfirm = async () =>
  apiRequest<{ entries: HoursEntry[] }>('/api/v1/hours?toConfirm=1', { headers: await authHeaders() });
export const logHours = (input: { projectId?: string; callId?: string; hours: number; activity: string; workedOn: string }) =>
  jsonPost('/api/v1/hours', input) as Promise<{ id: string; status: string }>;
export const decideHours = (id: string, decision: 'confirm' | 'decline') =>
  jsonPost('/api/v1/hours', { action: 'decide', id, decision }) as Promise<{ status: string }>;
export const deleteHours = (id: string) =>
  jsonPost('/api/v1/hours', { action: 'delete', id }) as Promise<{ deleted: boolean }>;
export const getCertificate = async () =>
  apiRequest<CertificateData>('/api/v1/certificate', { headers: await authHeaders() });
export const getProjectUpdates = async (projectId: string) =>
  apiRequest<{ updates: ProjectUpdate[]; available?: boolean }>(`/api/v1/project-updates?project=${encodeURIComponent(projectId)}`, { headers: await authHeaders(false) });
export const postProjectUpdate = (projectId: string, body: string) =>
  jsonPost('/api/v1/project-updates', { projectId, body }) as Promise<{ id: string }>;
export const deleteProjectUpdate = (id: string) =>
  jsonPost('/api/v1/project-updates', { action: 'delete', id }) as Promise<{ deleted: boolean }>;

/** Admin: recent admin actions (approvals, reviews, erasures, exports). */
export const getAdminAudit = async () =>
  apiRequest<{ entries: { id: string; action: string; targetType: string | null; targetId: string | null; details: Record<string, unknown>; at: string; actor: string }[] }>(
    '/api/v1/admin?resource=audit', { headers: await authHeaders() });
