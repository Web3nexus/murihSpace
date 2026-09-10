const IMPERSONATION_TOKEN_KEY = "impersonation_token";
const IMPERSONATED_USER_KEY = "impersonated_user";
const IS_IMPERSONATING_KEY = "is_impersonating";
const ADMIN_ORIGINAL_TOKEN_KEY = "admin_original_token";
const MURIHSPACE_TOKEN_KEY = "murihspace-token";
const AUTH_TOKEN_KEY = "auth_token";

export function getAuthToken(): string | null {
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

  sessionStorage.setItem(IMPERSONATION_TOKEN_KEY, token);
  sessionStorage.setItem(IS_IMPERSONATING_KEY, "true");
  localStorage.setItem(IMPERSONATION_TOKEN_KEY, token);
  localStorage.setItem(IS_IMPERSONATING_KEY, "true");

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
  sessionStorage.removeItem(ADMIN_ORIGINAL_TOKEN_KEY);

  localStorage.removeItem(IMPERSONATION_TOKEN_KEY);
  localStorage.removeItem(IS_IMPERSONATING_KEY);
  localStorage.removeItem(IMPERSONATED_USER_KEY);

  const adminOriginal = localStorage.getItem(ADMIN_ORIGINAL_TOKEN_KEY);
  if (adminOriginal) {
    localStorage.setItem(MURIHSPACE_TOKEN_KEY, adminOriginal);
    localStorage.removeItem(ADMIN_ORIGINAL_TOKEN_KEY);
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

