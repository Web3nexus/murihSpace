import { env } from "@/config/env";

/**
 * CSRF support for the cookie session.
 *
 * The API authenticates web requests with an httpOnly session cookie. Unsafe
 * methods must also echo the XSRF-TOKEN cookie back in the X-XSRF-TOKEN header,
 * and that cookie is issued by GET {API_ORIGIN}/sanctum/csrf-cookie.
 */

const XSRF_COOKIE = "XSRF-TOKEN";
const XSRF_HEADER = "X-XSRF-TOKEN";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let inflightRefresh: Promise<void> | null = null;

export function isUnsafeMethod(method: string | undefined): boolean {
  return UNSAFE_METHODS.has((method ?? "GET").toUpperCase());
}

export { XSRF_HEADER };

/** The XSRF-TOKEN cookie value, URL-decoded, or null when it is not set. */
export function readXsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${XSRF_COOKIE}=`)) continue;
    const raw = trimmed.slice(XSRF_COOKIE.length + 1);
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/** Requests a fresh CSRF cookie. Concurrent callers share one request. */
export function refreshCsrfCookie(): Promise<void> {
  if (!inflightRefresh) {
    inflightRefresh = fetch(`${env.API_ORIGIN}/sanctum/csrf-cookie`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(() => undefined)
      // A network failure here surfaces on the real request that follows.
      .catch(() => undefined)
      .finally(() => {
        inflightRefresh = null;
      });
  }
  return inflightRefresh;
}

/** Fetches the CSRF cookie only when it is missing, then returns the token. */
export async function ensureCsrfCookie(): Promise<string | null> {
  if (!readXsrfToken()) {
    await refreshCsrfCookie();
  }
  return readXsrfToken();
}
