import { useLocation } from "react-router";
import { useMemo } from "react";
import { sanitiseReturnTo } from "@/lib/deepLinks";

interface PostAuthRedirectOptions {
  /** Where to land when no valid `next` / `from` destination was supplied. */
  fallback?: string;
}

/**
 * Resolves where to send the user after a successful sign-in or sign-up.
 *
 * Two sources, in priority order:
 *
 *  1. `?next=` on the query string. Explicit and survives a full page reload,
 *     so this is what deep links use. An OAuth round-trip cannot carry it —
 *     see `stashSocialReturn` for where social logins keep theirs.
 *  2. `location.state.from`, set by `ProtectedRoute` when it bounces an
 *     authenticated-only page.
 *
 * Both are run through `sanitiseReturnTo`, so only known in-app destinations
 * are honoured. A hostile `?next=https://evil.example` degrades to the
 * fallback instead of becoming an open redirect.
 *
 * This replaces the previous behaviour, which honoured `/live/*` and silently
 * dropped every other shared link (meetings, events, products, chats) on the
 * floor after login.
 */
export function usePostAuthRedirect(options: PostAuthRedirectOptions = {}): string {
  const { fallback = "/app" } = options;
  const location = useLocation();

  return useMemo(() => {
    const fromQuery = new URLSearchParams(location.search).get("next");
    if (fromQuery) {
      const safe = sanitiseReturnTo(fromQuery);
      if (safe) return safe;
    }

    const fromState = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
    if (fromState?.pathname) {
      const candidate = `${fromState.pathname}${fromState.search ?? ""}`;
      const safe = sanitiseReturnTo(candidate);
      if (safe) return safe;
    }

    return fallback;
  }, [location.search, location.state, fallback]);
}
const SOCIAL_RETURN_KEY = "murihspace-social-return";

/**
 * Remembers where to land after an OAuth round-trip.
 *
 * `next` cannot be threaded through Google or Apple: it would have to sit on
 * the *provider's* authorize URL, and the provider decides which of its own
 * parameters come back on the callback. Putting it there silently lost the
 * destination, so the shared link a visitor opened was dropped on the floor
 * after signing in. The tab's sessionStorage survives the round-trip and is
 * scoped to it, so a value is never picked up by a different login attempt.
 */
export function stashSocialReturn(path: string): void {
  try {
    if (path && path !== "/app") {
      sessionStorage.setItem(SOCIAL_RETURN_KEY, path);
    } else {
      sessionStorage.removeItem(SOCIAL_RETURN_KEY);
    }
  } catch {
    // Storage can be disabled; losing the destination is not worth failing over.
  }
}

/** Reads and clears the destination stashed by `stashSocialReturn`. */
export function takeSocialReturn(): string | null {
  try {
    const value = sessionStorage.getItem(SOCIAL_RETURN_KEY);
    sessionStorage.removeItem(SOCIAL_RETURN_KEY);
    return value;
  } catch {
    return null;
  }
}
