/**
 * Remembers, as a plain flag and never as a credential, that this browser has
 * signed in. The app asks the API for the current user on load only when the
 * flag is set, so guests do not make a request that is bound to fail. The
 * session itself is the httpOnly cookie.
 */
const SESSION_HINT_KEY = "murihspace-session-hint";

export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSessionHint(active: boolean): void {
  try {
    if (active) {
      localStorage.setItem(SESSION_HINT_KEY, "1");
    } else {
      localStorage.removeItem(SESSION_HINT_KEY);
    }
  } catch {
    /* storage unavailable: the app then treats the visitor as a guest */
  }
}
