/**
 * Staff session storage. A staff member signs in with a short-lived token from
 * the marketing hub; ads-backend exchanges it for an ads admin token. That token
 * lives in the same localStorage key as every other ads session, so the shared
 * request helper in ads-api.ts sends it without any extra wiring.
 */

export const ADS_TOKEN_KEY = "ads_token";
export const STAFF_SIGN_IN_PATH = "/secureads/login";
export const STAFF_HOME_PATH = "/secureads/advertisers/verification";

/** Advertiser session keys. Cleared before a staff token is stored. */
const ADVERTISER_KEYS = ["ads_token", "ads_user", "advertiser_id", "ads_advertiser"] as const;

export function readAdsToken(): string {
  try {
    return typeof window === "undefined" ? "" : window.localStorage.getItem(ADS_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * Stores a staff token. Advertiser keys are dropped first, so an advertiser id
 * from an earlier session cannot travel with the staff token.
 */
export function storeStaffToken(token: string): void {
  for (const key of ADVERTISER_KEYS) window.localStorage.removeItem(key);
  window.localStorage.setItem(ADS_TOKEN_KEY, token);
}

export function clearAdsSession(): void {
  try {
    for (const key of ADVERTISER_KEYS) window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable: nothing stored to clear */
  }
}

/** Clears the session and sends the browser to the staff sign-in page. */
export function sendToStaffSignIn(): void {
  clearAdsSession();
  window.location.replace(STAFF_SIGN_IN_PATH);
}
