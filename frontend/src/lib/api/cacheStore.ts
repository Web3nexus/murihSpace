import { useState, useEffect, useCallback, useRef } from "react";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

export function safeArray<T = any>(val: any): T[] {
  if (Array.isArray(val)) return val;
  if (Array.isArray(val?.data)) return val.data;
  if (Array.isArray(val?.data?.data)) return val.data.data;
  if (Array.isArray(val?.items)) return val.items;
  if (Array.isArray(val?.products)) return val.products;
  if (Array.isArray(val?.communities)) return val.communities;
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
  fetcherRef.current = fetcher;

  const refresh = useCallback(async (isSilent = false) => {
    if (!isSilent && !getCachedData<T>(key, ttlMs)) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await fetcherRef.current();
      setCachedData(key, result);
      setData(result);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [key, ttlMs]);

  useEffect(() => {
    const existing = getCachedData<T>(key, ttlMs);
    if (existing) {
      setData(existing);
      setLoading(false);
      // Silent revalidate in background
      refresh(true);
    } else {
      refresh(false);
    }
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
