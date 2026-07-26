export function extractList(json: any, fallback: any[] = []): any[] {
  if (!json) return fallback;
  const data = json.success ? json.data : json;
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return fallback;
}

export function extractItem<T>(json: any, fallback: T | null = null): T | null {
  if (!json) return fallback;
  const data = json.success ? json.data : json;
  if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) return data.data as T;
  if (data && typeof data === 'object' && !Array.isArray(data)) return data as T;
  return fallback;
}
