import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'react-router';
import { getEcho } from '@/lib/echo';

export const NOTIFICATION_EVENT_NAME = 'murih:notification';
export const MESSAGE_EVENT_NAME = 'murih:message';

/**
 * Subscribes to the user's private notification and message channels
 * and surfaces incoming events as sonner toasts and window events
 * so header badges and other UI can update live.
 */
export function RealtimeNotificationsHost() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!user?.id) return;

    let echo: ReturnType<typeof getEcho>;
    try {
      echo = getEcho();
    } catch {
      return;
    }

    const notificationChannel = echo.private(`App.Models.User.${user.id}`);
    const userChannel = echo.private(`user.${user.id}`);

    const onNotification = (e: Record<string, unknown>) => {
      const title = String(e.title ?? 'New notification');
      const message = String(e.message ?? e.body ?? 'You have a new update.');
      const actionUrl = e.action_url ? String(e.action_url) : undefined;
      toast(title, {
        description: message,
        duration: 5000,
        action: actionUrl
          ? {
              label: String(e.action_label ?? 'View'),
              onClick: () => {
                window.location.href = actionUrl;
              },
            }
          : undefined,
      });
      window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT_NAME, { detail: e }));
    };

    const onMessageSent = (e: {
      conversation_id?: number;
      user_id?: number;
      user?: { name?: string };
      content?: string;
      attachment_type?: string;
    }) => {
      window.dispatchEvent(new CustomEvent(MESSAGE_EVENT_NAME, { detail: e }));
      if (e.user_id === user.id) return;
      // The chat hub already surfaces toasts for messages outside the active
      // conversation, so skip the global toast while on the messages page.
      if (pathname.startsWith('/app/messages')) return;
      const sender = e.user?.name ?? 'New message';
      toast(sender, {
        description: e.content || (e.attachment_type ? 'Sent an attachment' : 'Sent a message'),
        duration: 4500,
        action: {
          label: 'Open',
          onClick: () => {
            window.location.href = '/app/messages';
          },
        },
      });
    };

    notificationChannel.listen('.notification', onNotification);
    userChannel.listen('.MessageSent', onMessageSent);

    return () => {
      notificationChannel.stopListening('.notification', onNotification);
      userChannel.stopListening('.MessageSent', onMessageSent);
      echo.leave(`App.Models.User.${user.id}`);
      echo.leave(`user.${user.id}`);
    };
  }, [user?.id, pathname]);

  return null;
}
