import { env } from "@/config/env";
import { getAuthToken, getAdminToken } from "@/lib/auth/token";
import { getLiveSessionId, isLiveRequest } from "@/lib/live/liveSession";

const API_BASE = env.VITE_API_BASE_URL;

export function getAuthHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client-Platform': 'web',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * A wrapper around native fetch that automatically injects API_BASE and Authorization headers.
 * @param path The API path, e.g. `/users` (without /api/v1 prefix)
 * @param options Standard RequestInit options
 */
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  
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

  // Inject Auth Token (prefer admin token for securegate admin routes)
  const isAdminEndpoint = path.includes('/securegate') || path.startsWith('securegate');
  const adminToken = getAdminToken();
  if (isAdminEndpoint && adminToken) {
    // For admin endpoints, always enforce the admin session token even if a
    // caller mistakenly passed a regular user token via manual headers
    headers.set('Authorization', `Bearer ${adminToken}`);
  } else if (!headers.has('Authorization')) {
    const token = isAdminEndpoint ? (adminToken || getAuthToken()) : getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}
