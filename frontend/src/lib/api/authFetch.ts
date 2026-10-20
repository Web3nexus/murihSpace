import { env } from "@/config/env";
import { getLiveSessionId, isLiveRequest } from "@/lib/live/liveSession";
import { ensureCsrfCookie, isUnsafeMethod, refreshCsrfCookie, XSRF_HEADER } from "@/lib/api/csrf";

const API_BASE = env.VITE_API_BASE_URL;

export function getAuthHeaders() {
  // Requests authenticate with the httpOnly session cookie sent by credentials: 'include'.
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client-Platform': 'web',
  };
}

/**
 * A wrapper around native fetch that targets the API and sends the session cookie.
 *
 * - Always sends credentials, so the httpOnly session cookie reaches the API cross-origin.
 * - Unsafe methods (POST, PUT, PATCH, DELETE) carry the X-XSRF-TOKEN header, and a
 *   419 response refreshes the CSRF cookie and retries the request once.
 *
 * @param path The API path, e.g. `/users` (without /api/v1 prefix), or an absolute URL
 * @param options Standard RequestInit options
 */
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const method = options.method ?? "GET";

  const send = async (): Promise<Response> => {
    const headers = new Headers(options.headers || {});

    // Inject default headers if not explicitly set
    // Do NOT set Content-Type for FormData, the browser will set it with the boundary
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    // Inject all requests with the client platform so the backend can enforce
    // "app-only" purchase toggles (web dashboards are tagged `web`, native apps `app`).
    if (!headers.has('X-Client-Platform')) {
      headers.set('X-Client-Platform', 'web');
    }

    if (isLiveRequest(path) && !headers.has('X-Live-Session-ID')) {
      const liveSessionId = getLiveSessionId();
      if (liveSessionId) {
        headers.set('X-Live-Session-ID', liveSessionId);
      }
    }

    if (isUnsafeMethod(method)) {
      const xsrf = await ensureCsrfCookie();
      if (xsrf) {
        headers.set(XSRF_HEADER, xsrf);
      }
    }

    return fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });
  };

  let response = await send();
  if (response.status === 419 && isUnsafeMethod(method)) {
    // The CSRF cookie expired. Refresh it and resend the request once.
    await refreshCsrfCookie();
    response = await send();
  }
  return response;
}
