/**
 * api/_lib/redis.ts
 * Redis REST API (Upstash) with in-memory fallback caching
 */

import { getRedisConfig } from './config';
import type { MemoryCacheEntry } from './types';

const memoryCache = new Map<string, MemoryCacheEntry>();
let gcScheduled = false;

const scheduleGc = () => {
  if (gcScheduled || typeof setInterval === 'undefined') return;
  gcScheduled = true;
  try {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of memoryCache.entries()) {
        if (now > entry.expiresAt) memoryCache.delete(key);
      }
    }, 60_000);
  } catch {
    gcScheduled = false;
  }
};

async function upstashCommand<T = any>(command: any[]): Promise<T | null> {
  const { url, token } = getRedisConfig();
  if (!url || !token) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.result ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function getCache<T = any>(key: string): Promise<T | null> {
  const { url, token } = getRedisConfig();
  if (url && token) {
    const result = await upstashCommand(['GET', key]);
    if (result !== null && result !== undefined) {
      try {
        return typeof result === 'string' ? JSON.parse(result) : (result as T);
      } catch {
        return result as unknown as T;
      }
    }
  }
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function setCache(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  const stringified = JSON.stringify(value);
  const { url, token } = getRedisConfig();
  scheduleGc();
  if (url && token) await upstashCommand(['SET', key, stringified, 'EX', ttlSeconds]);
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function invalidateCache(keyOrPrefix: string): Promise<void> {
  const { url, token } = getRedisConfig();
  if (url && token) {
    if (keyOrPrefix.endsWith('*')) {
      const keys = await upstashCommand<string[]>(['KEYS', keyOrPrefix]);
      if (Array.isArray(keys) && keys.length > 0) await upstashCommand(['DEL', ...keys]);
    } else {
      await upstashCommand(['DEL', keyOrPrefix]);
    }
  }
  if (keyOrPrefix.endsWith('*')) {
    const prefix = keyOrPrefix.slice(0, -1);
    for (const key of memoryCache.keys()) if (key.startsWith(prefix)) memoryCache.delete(key);
  } else {
    memoryCache.delete(keyOrPrefix);
  }
}
