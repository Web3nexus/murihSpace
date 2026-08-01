import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { env } from '@/config/env';
import { getAuthToken } from '@/lib/auth/token';

type EchoInstance = Echo<'reverb'>;

let echoInstance: EchoInstance | null = null;
let echoToken: string | null = null;

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

export function getEcho(): EchoInstance {
  const token = getAuthToken();

  // Recreate the connection when the auth token changes
  // (login, logout, token refresh) so channel auth uses fresh credentials.
  if (echoInstance && token !== echoToken) {
    echoInstance.disconnect();
    echoInstance = null;
  }

  if (echoInstance) return echoInstance;

  if (typeof window !== 'undefined') {
    window.Pusher = Pusher;
  }

  const host = env.VITE_REVERB_HOST;
  const port = env.VITE_REVERB_PORT;  
  const scheme = env.VITE_REVERB_SCHEME;

  echoToken = token;

  echoInstance = new Echo<'reverb'>({
    broadcaster: 'reverb',
    key: env.VITE_REVERB_APP_KEY,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    scheme,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${env.VITE_API_BASE_URL.replace('/api/v1', '')}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
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
    echoToken = null;
  }
}
