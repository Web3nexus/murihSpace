type Json = unknown;

export function extractList<T = unknown>(json: Json, fallback: T[] = []): T[] {
  if (!json) return fallback;
  const env = json as { success?: boolean; data?: unknown };
  const data: unknown = Array.isArray(json) ? json : env.success ? env.data : env.data ?? json;
  if (Array.isArray(data)) return data as T[];
  const inner = data as { data?: unknown } | undefined;
  if (inner?.data && Array.isArray(inner.data)) return inner.data as T[];
  return fallback;
}

export function extractItem<T>(json: Json, fallback: T | null = null): T | null {
  if (!json) return fallback;
  const env = json as { success?: boolean; data?: unknown };
  const data: unknown = Array.isArray(json) ? json : env.success ? env.data : env.data ?? json;
  const inner = data as { data?: unknown } | undefined;
  if (inner?.data && typeof inner.data === 'object' && !Array.isArray(inner.data)) return inner.data as T;
  if (data && typeof data === 'object' && !Array.isArray(data)) return data as T;
  return fallback;
}
