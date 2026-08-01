import { useEffect, useRef } from 'react';
import { getEcho } from '@/lib/echo';

interface NotificationPayload {
  type: string;
  [key: string]: unknown;
}

export function useRealtimeNotifications(
  userId: number | undefined,
  onNotification: (payload: NotificationPayload) => void,
) {
  const callbackRef = useRef(onNotification);
  useEffect(() => { callbackRef.current = onNotification; }, [onNotification]);

  useEffect(() => {
    if (!userId) return;

    let echo: ReturnType<typeof getEcho>;
    try {
      echo = getEcho();
    } catch {
      return;
    }

    const channel = echo.private(`App.Models.User.${userId}`);

    channel.listen('.notification', (e: NotificationPayload) => {
      callbackRef.current(e);
    });

    return () => {
      channel.stopListening('.notification');
      echo.leave(`App.Models.User.${userId}`);
    };
  }, [userId]);
}
