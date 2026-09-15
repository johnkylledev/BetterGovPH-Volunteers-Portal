/**
 * api/_lib/config.ts
 * API versioning and environment variable helpers
 */

export const LIB_API_VERSION = '1.0.0';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceKey: string;
}

export const getSupabaseConfig = (): SupabaseConfig => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
  return { url, anonKey, serviceKey };
};

export interface RedisConfig {
  url: string;
  token: string;
}

export const getRedisConfig = (): RedisConfig => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_URL || process.env.VITE_UPSTASH_REDIS_REST_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_TOKEN || process.env.VITE_UPSTASH_REDIS_REST_TOKEN || '';
  return { url, token };
};

export const BGPH_REMOTE_URL = process.env.BGPH_REMOTE_PROJECTS_URL || 'https://bettergov.ph/api/projects.json';

export const BGPH_FETCH_HEADERS = {
  accept: '*/*',
  'accept-language': 'en-US,en;q=0.7',
  referer: 'https://bettergov.ph/projects',
  priority: 'u=1, i',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
};
