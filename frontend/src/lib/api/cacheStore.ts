import { useState, useEffect, useCallback, useRef } from "react";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

type Envelope = { data?: unknown; items?: unknown; products?: unknown; communities?: unknown };

export function safeArray<T>(val: T[]): T[];
export function safeArray<T = unknown>(val: unknown): T[];
export function safeArray<T = unknown>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  const env = (val && typeof val === "object" ? val : {}) as Envelope;
  if (Array.isArray(env.data)) return env.data as T[];
  const inner = (env.data && typeof env.data === "object" ? env.data : {}) as Envelope;
  if (Array.isArray(inner.data)) return inner.data as T[];
  if (Array.isArray(env.items)) return env.items as T[];
  if (Array.isArray(env.products)) return env.products as T[];
  if (Array.isArray(env.communities)) return env.communities as T[];
  return [];
}

export function getCachedData<T>(key: string, ttlMs = 300000): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCachedData<T>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      memoryCache.delete(key);
    }
  }
}

export function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttlMs?: number; initialData?: T } = {}
) {
  const { ttlMs = 300000, initialData } = options;
  const cached = getCachedData<T>(key, ttlMs);
  const [data, setData] = useState<T | null>(cached ?? initialData ?? null);
  const [loading, setLoading] = useState<boolean>(!cached && !initialData);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // Apply a cached value in the render that changes the key, rather than inside the fetch effect.
  const [prevCacheKey, setPrevCacheKey] = useState({ key, ttlMs });
  if (prevCacheKey.key !== key || prevCacheKey.ttlMs !== ttlMs) {
    setPrevCacheKey({ key, ttlMs });
    const existing = getCachedData<T>(key, ttlMs);
    if (existing) {
      setData(existing);
      setLoading(false);
    }
  }

  const refresh = useCallback(async (isSilent = false) => {
    if (!isSilent && !getCachedData<T>(key, ttlMs)) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await fetcherRef.current();
      setCachedData(key, result);
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [key, ttlMs]);

  useEffect(() => {
    const existing = getCachedData<T>(key, ttlMs);
    (async () => {
      if (existing) {
        // Silent revalidate in background
        await refresh(true);
      } else {
        await refresh(false);
      }
    })();
  }, [key, refresh, ttlMs]);

  const mutate = useCallback((updater: T | ((prev: T | null) => T), shouldRevalidate = false) => {
    setData((prev) => {
      const next = typeof updater === "function" ? (updater as (p: T | null) => T)(prev) : updater;
      setCachedData(key, next);
      return next;
    });
    if (shouldRevalidate) {
      refresh(true);
    }
  }, [key, refresh]);

  return { data, loading, error, refresh, mutate };
}
