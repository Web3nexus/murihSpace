import { apiClient } from "@/lib/api/client";

type Listener = () => void;

let unreadCount = 0;
let initialized = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((l) => l());
}

/**
 * Authoritative total unread-message count across all conversations,
 * backed by GET /messages/unread-count (the accurate message-sum endpoint).
 * Centralised so the site header, app sidebar and chat layout all read the
 * same live value instead of each polling a different stale snapshot.
 */
export async function refreshUnreadCount(): Promise<void> {
  if (inflight) return inflight;
  // Normalise: the unread-count endpoint is served under /api/v1, our
  // client already prefixes it via its baseURL.
  inflight = (async () => {
    try {
      const res = await apiClient.get("/messages/unread-count");
      const data = (res.data as Record<string, unknown> | undefined)?.data;
      const next = Number((data as Record<string, unknown> | undefined)?.unread_count ?? 0);
      if (Number.isFinite(next) && next !== unreadCount) {
        unreadCount = next;
        notify();
      }
    } catch {
      /* keep last known value */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Optimistic bump so the badge updates instantly as messages arrive. */
export function setUnreadCount(next: number): void {
  const clamped = Math.max(0, Math.round(next));
  if (clamped !== unreadCount) {
    unreadCount = clamped;
    notify();
  }
}

export function getUnreadCount(): number {
  return unreadCount;
}

export function subscribeUnreadCount(listener: Listener): () => void {
  listeners.add(listener);
  if (!initialized) {
    initialized = true;
    void refreshUnreadCount();
  }
  return () => listeners.delete(listener);
}
