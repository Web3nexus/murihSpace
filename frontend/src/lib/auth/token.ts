const IMPERSONATION_TOKEN_KEY = "impersonation_token";
const IMPERSONATED_USER_KEY = "impersonated_user";
const IS_IMPERSONATING_KEY = "is_impersonating";
const ADMIN_ORIGINAL_TOKEN_KEY = "admin_original_token";
const IMPERSONATION_LAST_ACTIVITY_KEY = "impersonation_last_activity";
const MURIHSPACE_TOKEN_KEY = "murihspace-token";
const AUTH_TOKEN_KEY = "auth_token";

// 15-minute inactivity idle timeout
export const IMPERSONATION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

// ── Activity listener management (lazy attach / detach) ───────────────────────
let activityListenersAttached = false;
let throttleTimer: number | null = null;

function onActivity() {
  if (!throttleTimer) {
    updateImpersonationActivity();
    throttleTimer = window.setTimeout(() => {
      throttleTimer = null;
    }, 5000); // throttle updates to at most once per 5 seconds
  }
}

function attachActivityListeners() {
  if (activityListenersAttached || typeof window === "undefined") return;
  window.addEventListener("pointerdown", onActivity, { passive: true });
  window.addEventListener("keydown", onActivity, { passive: true });
  window.addEventListener("scroll", onActivity, { passive: true });
  activityListenersAttached = true;
}

function detachActivityListeners() {
  if (!activityListenersAttached || typeof window === "undefined") return;
  window.removeEventListener("pointerdown", onActivity);
  window.removeEventListener("keydown", onActivity);
  window.removeEventListener("scroll", onActivity);
  activityListenersAttached = false;
  if (throttleTimer) {
    window.clearTimeout(throttleTimer);
    throttleTimer = null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function updateImpersonationActivity(): void {
  if (isImpersonating()) {
    const now = Date.now().toString();
    sessionStorage.setItem(IMPERSONATION_LAST_ACTIVITY_KEY, now);
    localStorage.setItem(IMPERSONATION_LAST_ACTIVITY_KEY, now);
  }
}

/**
 * Checks if the impersonation session has gone idle beyond the 15-min limit.
 * Returns true if timed out and cleared. Should be called on a timer or on
 * explicit user action — NOT inside getAuthToken() to avoid side-effects.
 */
export function checkImpersonationTimeout(): boolean {
  if (!isImpersonating()) return false;

  const lastActivityStr =
    sessionStorage.getItem(IMPERSONATION_LAST_ACTIVITY_KEY) ||
    localStorage.getItem(IMPERSONATION_LAST_ACTIVITY_KEY);

  if (!lastActivityStr) {
    // Session just started — seed the timestamp
    updateImpersonationActivity();
    return false;
  }

  const lastActivity = parseInt(lastActivityStr, 10);
  if (isNaN(lastActivity) || Date.now() - lastActivity > IMPERSONATION_IDLE_TIMEOUT_MS) {
    console.warn("[Auth] Impersonation session idle timed out (15m limit). Resetting impersonation.");
    clearImpersonationToken();
    return true;
  }

  return false;
}

export function getAuthToken(): string | null {
  // Pure getter — no side-effects. Timeout is checked by the idle interval
  // (set up in setImpersonationToken) and by activity listeners.
  return (
    sessionStorage.getItem(IMPERSONATION_TOKEN_KEY) ||
    localStorage.getItem(IMPERSONATION_TOKEN_KEY) ||
    localStorage.getItem(MURIHSPACE_TOKEN_KEY) ||
    localStorage.getItem(AUTH_TOKEN_KEY)
  );
}

export function getAdminToken(): string | null {
  return (
    localStorage.getItem(ADMIN_ORIGINAL_TOKEN_KEY) ||
    sessionStorage.getItem(ADMIN_ORIGINAL_TOKEN_KEY) ||
    localStorage.getItem(MURIHSPACE_TOKEN_KEY) ||
    localStorage.getItem(AUTH_TOKEN_KEY)
  );
}

export function setImpersonationToken(token: string, user?: unknown): void {
  const currentToken =
    localStorage.getItem(MURIHSPACE_TOKEN_KEY) ||
    localStorage.getItem(AUTH_TOKEN_KEY);

  if (currentToken && !localStorage.getItem(ADMIN_ORIGINAL_TOKEN_KEY)) {
    localStorage.setItem(ADMIN_ORIGINAL_TOKEN_KEY, currentToken);
  }

  const now = Date.now().toString();
  sessionStorage.setItem(IMPERSONATION_TOKEN_KEY, token);
  sessionStorage.setItem(IS_IMPERSONATING_KEY, "true");
  sessionStorage.setItem(IMPERSONATION_LAST_ACTIVITY_KEY, now);

  localStorage.setItem(IMPERSONATION_TOKEN_KEY, token);
  localStorage.setItem(IS_IMPERSONATING_KEY, "true");
  localStorage.setItem(IMPERSONATION_LAST_ACTIVITY_KEY, now);

  if (user) {
    const userStr = typeof user === "string" ? user : JSON.stringify(user);
    sessionStorage.setItem(IMPERSONATED_USER_KEY, userStr);
    localStorage.setItem(IMPERSONATED_USER_KEY, userStr);
  }

  // Lazily attach activity listeners now that we're impersonating
  attachActivityListeners();
}

export function clearImpersonationToken(): void {
  sessionStorage.removeItem(IMPERSONATION_TOKEN_KEY);
  sessionStorage.removeItem(IS_IMPERSONATING_KEY);
  sessionStorage.removeItem(IMPERSONATED_USER_KEY);
  sessionStorage.removeItem(IMPERSONATION_LAST_ACTIVITY_KEY);
  sessionStorage.removeItem(ADMIN_ORIGINAL_TOKEN_KEY);

  localStorage.removeItem(IMPERSONATION_TOKEN_KEY);
  localStorage.removeItem(IS_IMPERSONATING_KEY);
  localStorage.removeItem(IMPERSONATED_USER_KEY);
  localStorage.removeItem(IMPERSONATION_LAST_ACTIVITY_KEY);

  const adminOriginal = localStorage.getItem(ADMIN_ORIGINAL_TOKEN_KEY);
  if (adminOriginal) {
    localStorage.setItem(MURIHSPACE_TOKEN_KEY, adminOriginal);
    localStorage.removeItem(ADMIN_ORIGINAL_TOKEN_KEY);
  }

  // Detach listeners — no longer impersonating
  detachActivityListeners();
}

export async function stopImpersonatingSession(redirectUrl: string = "/app/securegate/users"): Promise<void> {
  const token =
    sessionStorage.getItem(IMPERSONATION_TOKEN_KEY) ||
    localStorage.getItem(IMPERSONATION_TOKEN_KEY);

  if (token) {
    // Use env-based API base URL (avoids hardcoded /api/v1 path)
    const apiBase = ((import.meta.env.VITE_API_BASE_URL as string) ?? "").replace(/\/$/, "");
    const url = `${apiBase}/auth/stop-impersonate`;

    // Abort after 3 seconds so the user is never left hanging
    const controller = new AbortController();
    const tid = window.setTimeout(() => controller.abort(), 3000);
    try {
      await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
    } catch {
      // Continue client-side cleanup even if network fails or times out
    } finally {
      window.clearTimeout(tid);
    }
  }

  clearImpersonationToken();
  if (redirectUrl && typeof window !== "undefined") {
    window.location.assign(redirectUrl);
  }
}

export function isImpersonating(): boolean {
  return (
    sessionStorage.getItem(IS_IMPERSONATING_KEY) === "true" ||
    localStorage.getItem(IS_IMPERSONATING_KEY) === "true"
  );
}

export function getImpersonatedUser(): any | null {
  const data =
    sessionStorage.getItem(IMPERSONATED_USER_KEY) ||
    localStorage.getItem(IMPERSONATED_USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function clearAuthTokens(): void {
  clearImpersonationToken();
  localStorage.removeItem(MURIHSPACE_TOKEN_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

// ── Idle timeout interval ─────────────────────────────────────────────────────
// Runs every 30s to detect idle timeout even when no events fire (e.g. tab is backgrounded).
if (typeof window !== "undefined") {
  window.setInterval(() => {
    if (isImpersonating()) {
      checkImpersonationTimeout();
    }
  }, 30_000);
}
