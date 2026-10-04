import { useEffect, useState, useSyncExternalStore } from "react";
import { liveSessionStore, type LiveSessionRecord } from "@/lib/session/liveSessionStore";

/**
 * Subscribes to the persistent session registry.
 *
 * The snapshot array identity only changes when a session actually changes, so
 * consumers re-render on real transitions rather than on every animation frame.
 */
export function useLiveSessions(): LiveSessionRecord[] {
  return useSyncExternalStore(
    (listener) => liveSessionStore.subscribe(listener),
    () => liveSessionStore.getSnapshot(),
    () => liveSessionStore.getSnapshot(),
  );
}

export function useLiveSession(id: string | null): LiveSessionRecord | undefined {
  const sessions = useLiveSessions();

  if (!id) return undefined;

  return sessions.find((session) => session.id === id);
}

/**
 * Elapsed whole minutes since `startedAt`, refreshed on an interval.
 *
 * Kept out of render bodies deliberately: `Date.now()` during render makes the
 * output non-deterministic, which React flags as an impure call.
 */
export function useElapsedMinutes(startedAt: number): number {
  const [minutes, setMinutes] = useState(() => Math.floor((Date.now() - startedAt) / 60000));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMinutes(Math.floor((Date.now() - startedAt) / 60000));
    }, 30000);

    return () => window.clearInterval(timer);
  }, [startedAt]);

  return Math.max(0, minutes);
}