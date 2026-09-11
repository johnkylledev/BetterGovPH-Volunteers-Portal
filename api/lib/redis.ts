interface MemoryCacheEntry {
  value: any;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();

// Clean up expired in-memory keys every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
      if (now > entry.expiresAt) {
        memoryCache.delete(key);
      }
    }
  }, 60_000);
}

const getRedisConfig = () => {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_REST_URL ||
    process.env.VITE_UPSTASH_REDIS_REST_URL ||
    '';
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.REDIS_REST_TOKEN ||
    process.env.VITE_UPSTASH_REDIS_REST_TOKEN ||
    '';
  return { url, token };
};

/**
 * Execute a command against Upstash Redis REST API if credentials are provided.
 */
async function upstashCommand<T = any>(command: any[]): Promise<T | null> {
  const { url, token } = getRedisConfig();
  if (!url || !token) return null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!res.ok) {
      console.warn(`[Redis] Upstash HTTP error (${res.status}): ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    return data.result ?? null;
  } catch (err) {
    console.warn('[Redis] Upstash connection warning:', err);
    return null;
  }
}

/**
 * Retrieve a cached value by key.
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  const { url, token } = getRedisConfig();

  // Try Upstash Redis if configured
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

  // Fall back to in-memory cache
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

/**
 * Store a value in cache with optional TTL in seconds (default: 300s / 5 mins).
 */
export async function setCache(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  const stringified = JSON.stringify(value);
  const { url, token } = getRedisConfig();

  // Store in Upstash Redis if configured
  if (url && token) {
    await upstashCommand(['SET', key, stringified, 'EX', ttlSeconds]);
  }

  // Always update in-memory cache as well
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Invalidate a specific cache key or keys matching a prefix.
 */
export async function invalidateCache(keyOrPrefix: string): Promise<void> {
  const { url, token } = getRedisConfig();

  if (url && token) {
    if (keyOrPrefix.endsWith('*')) {
      const pattern = keyOrPrefix;
      const keys = await upstashCommand<string[]>(['KEYS', pattern]);
      if (Array.isArray(keys) && keys.length > 0) {
        await upstashCommand(['DEL', ...keys]);
      }
    } else {
      await upstashCommand(['DEL', keyOrPrefix]);
    }
  }

  // Invalidate in-memory cache
  if (keyOrPrefix.endsWith('*')) {
    const prefix = keyOrPrefix.slice(0, -1);
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
  } else {
    memoryCache.delete(keyOrPrefix);
  }
}

/**
 * Flush all memory cache entries.
 */
export async function flushMemoryCache(): Promise<void> {
  memoryCache.clear();
}
