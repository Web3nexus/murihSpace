import type { ChannelAuthorizationHandler } from "pusher-js";
import { env } from "@/config/env";
import { ensureCsrfCookie, XSRF_HEADER } from "@/lib/api/csrf";

/**
 * Private-channel authorizer for Reverb.
 *
 * pusher-js 8 performs its own channel auth XHR without withCredentials, so a
 * cross-origin API never receives the httpOnly session cookie. This handler uses
 * fetch with credentials: 'include' instead, and echoes the XSRF-TOKEN cookie.
 */
export function createBroadcastAuthorizer(): ChannelAuthorizationHandler {
  return async ({ socketId, channelName }, callback) => {
    let authData;
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      };

      const xsrf = await ensureCsrfCookie();
      if (xsrf) {
        headers[XSRF_HEADER] = xsrf;
      }

      const response = await fetch(`${env.API_ORIGIN}/broadcasting/auth`, {
        method: "POST",
        credentials: "include",
        headers,
        body: new URLSearchParams({ socket_id: socketId, channel_name: channelName }),
      });
      if (!response.ok) {
        throw new Error(`Broadcast channel authorization failed with status ${response.status}`);
      }
      authData = await response.json();
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)), null);
      return;
    }
    callback(null, authData);
  };
}
