const IMPERSONATION_TOKEN_KEY = "impersonation_token";
const MURIHSPACE_TOKEN_KEY = "murihspace-token";
const AUTH_TOKEN_KEY = "auth_token";

export function getAuthToken(): string | null {
  return (
    sessionStorage.getItem(IMPERSONATION_TOKEN_KEY) ||
    localStorage.getItem(MURIHSPACE_TOKEN_KEY) ||
    localStorage.getItem(AUTH_TOKEN_KEY)
  );
}

export function setImpersonationToken(token: string): void {
  sessionStorage.setItem(IMPERSONATION_TOKEN_KEY, token);
}

export function clearImpersonationToken(): void {
  sessionStorage.removeItem(IMPERSONATION_TOKEN_KEY);
}

export function clearAuthTokens(): void {
  sessionStorage.removeItem(IMPERSONATION_TOKEN_KEY);
  sessionStorage.removeItem("is_impersonating");
  sessionStorage.removeItem("impersonated_user");
  localStorage.removeItem(MURIHSPACE_TOKEN_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
}
