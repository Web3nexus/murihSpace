/**
 * Browser storage keys that earlier builds used for bearer tokens and for
 * impersonation. The web app authenticates with the httpOnly session cookie and
 * impersonation is a server-side switch of that cookie, so nothing here is
 * written any more. These keys are only ever removed.
 */
const LEGACY_LOCAL_KEYS = ["murihspace-token", "auth_token", "admin_original_token"] as const;
const LEGACY_SESSION_KEYS = [
  "impersonation_token",
  "impersonated_user",
  "is_impersonating",
  "admin_original_token",
  "impersonation_last_activity",
] as const;

/** Removes bearer tokens and impersonation state persisted by older builds. Safe to call on every load. */
export function purgeLegacyTokenStorage(): void {
  try {
    for (const key of LEGACY_LOCAL_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable: nothing to purge */
  }
  try {
    for (const key of LEGACY_SESSION_KEYS) {
      sessionStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable: nothing to purge */
  }
}
