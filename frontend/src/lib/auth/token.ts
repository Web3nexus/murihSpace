const IMPERSONATION_TOKEN_KEY = "impersonation_token";
const IMPERSONATED_USER_KEY = "impersonated_user";
const IS_IMPERSONATING_KEY = "is_impersonating";
const ADMIN_ORIGINAL_TOKEN_KEY = "admin_original_token";
const IMPERSONATION_LAST_ACTIVITY_KEY = "impersonation_last_activity";
const MURIHSPACE_TOKEN_KEY = "murihspace-token";
const AUTH_TOKEN_KEY = "auth_token";

// 15-minute inactivity idle timeout
export const IMPERSONATION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export function updateImpersonationActivity(): void {
  if (isImpersonating()) {
    const now = Date.now().toString();
    sessionStorage.setItem(IMPERSONATION_LAST_ACTIVITY_KEY, now);
    localStorage.setItem(IMPERSONATION_LAST_ACTIVITY_KEY, now);
  }
}

export function checkImpersonationTimeout(): boolean {
  if (!isImpersonating()) return false;

  const lastActivityStr =
    sessionStorage.getItem(IMPERSONATION_LAST_ACTIVITY_KEY) ||
    localStorage.getItem(IMPERSONATION_LAST_ACTIVITY_KEY);

  if (!lastActivityStr) {
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
  checkImpersonationTimeout();

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
}

export async function stopImpersonatingSession(redirectUrl: string = "/app/securegate/users"): Promise<void> {
  const token =
    sessionStorage.getItem(IMPERSONATION_TOKEN_KEY) ||
    localStorage.getItem(IMPERSONATION_TOKEN_KEY);

  if (token) {
    try {
      // Notify backend to invalidate token immediately and log audit trail
      await fetch("/api/v1/auth/stop-impersonate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
    } catch {
      // Continue client cleanup even if network fails
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

// Attach user activity listeners to automatically track activity while impersonating
if (typeof window !== "undefined") {
  let throttleTimer: number | null = null;
  const onActivity = () => {
    if (!throttleTimer) {
      updateImpersonationActivity();
      throttleTimer = window.setTimeout(() => {
        throttleTimer = null;
      }, 5000); // throttle updates to at most once per 5 seconds
    }
  };

  window.addEventListener("pointerdown", onActivity, { passive: true });
  window.addEventListener("keydown", onActivity, { passive: true });
  window.addEventListener("scroll", onActivity, { passive: true });
}
