/**
 * Thin client for the Ads API. Every call is scoped to the signed-in advertiser
 * (X-Advertiser-ID) and authenticated with the Sanctum token stored at SSO login.
 * Admin calls (paths under /admin/) use the staff token from hub sign-in, which
 * is stored under the same key. A 401 or 403 on an admin call sends the user
 * back to staff sign-in.
 */

import { readAdsToken, sendToStaffSignIn } from "./staff-session";

export class AdsApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AdsApiError";
    this.status = status;
  }
}

/** Existing env files set the host only; accept a value that already ends in /api too. */
export function adsApiRoot(): string {
  const base = String(import.meta.env.VITE_ADS_API_URL ?? "").replace(/\/+$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

/** Origin of the MurihSpace main app (set per environment; no fallback domain). */
export function mainAppUrl(): string {
  return String(import.meta.env.VITE_MAIN_APP_URL ?? "").replace(/\/+$/, "");
}

function readStorage(key: string): string {
  try {
    return typeof window === "undefined" ? "" : window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

/** Admin endpoints live under /admin/ on the ads API. */
export function isAdminPath(path: string): boolean {
  return path.startsWith("/admin/");
}

export function getAdsAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Advertiser-ID": readStorage("advertiser_id"),
  };
  const token = readAdsToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function adsRequest<T>(
  path: string,
  options: {
    method?: string;
    params?: Record<string, string | number | undefined>;
    body?: unknown;
    signal?: AbortSignal;
    /** Defaults to true for /admin/ paths. */
    admin?: boolean;
  } = {}
): Promise<T> {
  const admin = options.admin ?? isAdminPath(path);

  // Without a staff token an admin call cannot succeed, so do not send it.
  if (admin && !readAdsToken()) {
    sendToStaffSignIn();
    throw new AdsApiError("Staff sign-in required.", 401);
  }

  const url = new URL(`${adsApiRoot()}${path}`, window.location.origin);
  Object.entries(options.params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });

  const headers: Record<string, string> = { ...getAdsAuthHeaders() };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!res.ok) {
    if (admin && (res.status === 401 || res.status === 403)) {
      sendToStaffSignIn();
    }
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
      else if (data?.error) message = data.error;
    } catch {
      /* body was not JSON */
    }
    throw new AdsApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
