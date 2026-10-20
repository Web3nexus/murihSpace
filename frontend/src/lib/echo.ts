import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { env } from '@/config/env';
import { createBroadcastAuthorizer } from '@/lib/broadcastAuth';

export type EchoInstance = Echo<'reverb'>;

let echoInstance: EchoInstance | null = null;

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

export function getEcho(): EchoInstance {
  if (echoInstance) return echoInstance;

  if (typeof window !== 'undefined') {
    window.Pusher = Pusher;
  }

  const host = env.VITE_REVERB_HOST;
  const rawScheme = env.VITE_REVERB_SCHEME;
  const isHttps = rawScheme === 'https' || (typeof window !== 'undefined' && window.location.protocol === 'https:');
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const port = isHttps && !isLocal && (env.VITE_REVERB_PORT === 8080 || !env.VITE_REVERB_PORT)
    ? 443
    : env.VITE_REVERB_PORT;
  const scheme = isHttps ? 'https' : rawScheme;

  echoInstance = new Echo<'reverb'>({
    broadcaster: 'reverb',
    key: env.VITE_REVERB_APP_KEY,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    scheme,
    forceTLS: isHttps,
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${env.VITE_API_BASE_URL.replace('/api/v1', '')}/broadcasting/auth`,
    // pusher-js ignores credentials on its own channel auth request, so private
    // channels are authorised by a fetch-based handler that sends the session cookie.
    channelAuthorization: {
      customHandler: createBroadcastAuthorizer(),
    },
    auth: {
      headers: {
        // The session cookie authorises channels. A bearer header is only sent during impersonation.
        Accept: 'application/json',
      },
    },
  });

  return echoInstance;
}

export function disconnectEcho(): void {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
  }
}
