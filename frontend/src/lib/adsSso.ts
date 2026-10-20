import { authFetch } from "@/lib/api/authFetch";

/** Path of the sign-in hand-off page, as the Ads Manager links to it. */
export const ADS_SSO_AUTHORIZE_PATH = "/ads/sso/authorize";

/** Where a user goes to upgrade when their account lacks Ads access. */
export const ADS_UPGRADE_PATH = "/app/settings/upgrade";

const STATE_MIN_LENGTH = 16;
const STATE_MAX_LENGTH = 128;

/** The `state` value must be present and a reasonable length. */
export function isValidSsoState(state: string | null): state is string {
  return state !== null && state.length >= STATE_MIN_LENGTH && state.length <= STATE_MAX_LENGTH;
}

/**
 * Returns the parsed redirect target only when it sits on the Ads Manager
 * origin configured in VITE_ADS_MANAGER_URL. Anything else, including an empty
 * configuration, yields null.
 */
export function parseAllowedAdsRedirect(redirectUri: unknown, adsManagerUrl: string): URL | null {
  if (typeof redirectUri !== "string" || !redirectUri.trim()) return null;
  const configured = adsManagerUrl.trim();
  if (!configured) return null;

  let target: URL;
  let allowed: URL;
  try {
    target = new URL(redirectUri.trim());
    allowed = new URL(configured);
  } catch {
    return null;
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") return null;
  return target.origin === allowed.origin ? target : null;
}

/** Builds the callback URL with exactly two query parameters: code and state. */
export function buildAdsCallbackUrl(target: URL, code: string, state: string): string {
  const url = new URL(target.toString());
  url.search = new URLSearchParams({ code, state }).toString();
  url.hash = "";
  return url.toString();
}

export interface AdsSsoCodeGrant {
  code: string;
  redirect_uri: string;
  expires_in: number;
}

export type AdsSsoCodeResult =
  | { kind: "ok"; grant: AdsSsoCodeGrant }
  | { kind: "upgrade_required" }
  | { kind: "error"; message: string };

/** Reads an error code from either the top level or under `errors`. */
export function readErrorCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { code?: unknown; errors?: unknown };
  if (typeof record.code === "string") return record.code;
  const errors = record.errors;
  if (errors && typeof errors === "object") {
    const nested = (errors as { code?: unknown }).code;
    if (typeof nested === "string") return nested;
    if (Array.isArray(nested) && typeof nested[0] === "string") return nested[0];
  }
  return null;
}

function isGrant(value: unknown): value is AdsSsoCodeGrant {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === "string" && typeof v.redirect_uri === "string" && typeof v.expires_in === "number";
}

/** Asks the API for a one-time Ads sign-in code, sending the session and CSRF header. */
export async function requestAdsSsoCode(): Promise<AdsSsoCodeResult> {
  try {
    const response = await authFetch("/ads/sso/code", { method: "POST" });
    const body: unknown = await response.json().catch(() => null);

    if (response.status === 403 && readErrorCode(body) === "ads_upgrade_required") {
      return { kind: "upgrade_required" };
    }
    if (!response.ok) {
      return { kind: "error", message: "We could not start the Ads sign-in. Please try again." };
    }
    const data = (body as { data?: unknown } | null)?.data;
    if (!isGrant(data)) {
      return { kind: "error", message: "The Ads sign-in response was incomplete. Please try again." };
    }
    return { kind: "ok", grant: data };
  } catch {
    return { kind: "error", message: "Network error. Check your connection and try again." };
  }
}
