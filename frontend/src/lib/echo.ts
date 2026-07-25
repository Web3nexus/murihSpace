import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { env } from '@/config/env';

type EchoInstance = Echo<'reverb'>;

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
  const port = env.VITE_REVERB_PORT;  
  const scheme = env.VITE_REVERB_SCHEME;

  const token = localStorage.getItem('murihspace-token');

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
  }
}
