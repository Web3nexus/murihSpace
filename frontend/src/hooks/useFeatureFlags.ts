import { useState, useEffect } from "react";
import { getAuthToken } from "@/lib/auth/token";

interface FeatureFlag {
  id: number;
  key: string;
  label: string;
  description?: string;
  enabled: boolean;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

let cachedFlags: Record<string, boolean> = {};
const listeners = new Set<() => void>();

async function fetchFlags(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/feature-flags`, { headers: authHeaders() });
    if (!res.ok) return;
    const j = await res.json();
    const list = j?.data?.data ?? j?.data ?? j ?? [];
    if (Array.isArray(list)) {
      const next: Record<string, boolean> = {};
      list.forEach((f: FeatureFlag) => { next[f.key] = f.enabled; });
      cachedFlags = next;
    }
  } catch {
    // keep the last-known flags on failure so the UI does not blink
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export async function refreshFeatureFlags(): Promise<void> {
  await fetchFlags();
  emit();
}

export function useFeatureFlags(): Record<string, boolean> {
  const [flags, setFlags] = useState<Record<string, boolean>>({ ...cachedFlags });

  useEffect(() => {
    if (Object.keys(cachedFlags).length === 0) {
      fetchFlags().then(emit);
    }
    const listener = () => setFlags({ ...cachedFlags });
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  return flags;
}
