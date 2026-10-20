/**
 * Browser side of "Continue with MurihSpace".
 *
 * 1. Login generates a random state, keeps it in sessionStorage, and sends the
 *    browser to the main app's authorize page with ?state=... (see
 *    SSO_AUTHORIZE_PATH). The main app is the only party that can issue a code.
 * 2. The main app returns the browser to SSO_CALLBACK_PATH with ?code=...&state=...
 * 3. The callback checks the state, then posts only the code to ads-backend,
 *    which exchanges it server-to-server. No secret or token reaches this bundle
 *    except the ads-backend session token it receives back.
 */

export const SSO_AUTHORIZE_PATH = "/ads/sso/authorize";
export const SSO_STATE_KEY = "ads_sso_state";

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the state check will fail closed */
  }
}

export function createSsoState(): string {
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  const state = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  writeSession(SSO_STATE_KEY, state);
  return state;
}

/** Returns the expected state once, then forgets it. */
export function takeExpectedSsoState(): string | null {
  const state = readSession(SSO_STATE_KEY);
  writeSession(SSO_STATE_KEY, null);
  return state;
}
