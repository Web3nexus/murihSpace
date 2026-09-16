import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'react-router';
import { getEcho } from '@/lib/echo';
import { playMessageReceivedSound, playNotificationSound } from '@/lib/sound';
import { getUnreadCount, setUnreadCount, refreshUnreadCount } from '@/lib/chatUnread';
import { showWebInAppNotification } from '@/components/notifications/WebInAppNotification';

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
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

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

function parseNotificationContent(content: unknown, fallback = 'You have a new update.'): string {
  if (!content) return fallback;
  if (typeof content === 'object') {
    const obj = content as Record<string, any>;
    if (obj.call_id !== undefined || obj.status !== undefined) {
      const type = obj.call_type === 'video' ? 'Video' : 'Audio';
      if (obj.status === 'missed') return `Missed ${type} Call`;
      if (obj.status === 'declined') return `${type} Call Declined`;
      if (obj.status === 'ended') {
        const dur = Number(obj.duration) || 0;
        if (dur > 0) {
          const mins = Math.floor(dur / 60);
          const secs = dur % 60;
          const formatted = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
          return `${type} Call Ended • ${formatted}`;
        }
        return `${type} Call Ended`;
      }
      return `${type} Call`;
    }
    return String(obj.message || obj.body || obj.text || fallback);
  }

  const str = String(content).trim();
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const parsed = JSON.parse(str);
      return parseNotificationContent(parsed, fallback);
    } catch {
      return str;
    }
  }
  return str;
}

    const onNotification = (e: Record<string, unknown>) => {
      playNotificationSound();
      const rawData = (e.data && typeof e.data === 'object' ? e.data : {}) as Record<string, any>;
      const title = String(e.title ?? rawData.title ?? 'New notification');
      const rawMessage = e.message ?? e.body ?? rawData.message ?? rawData.body ?? rawData.content;
      const message = parseNotificationContent(rawMessage, 'You have a new update.');
      const actionUrl = e.action_url ? String(e.action_url) : (rawData.action_url ? String(rawData.action_url) : undefined);
      const senderName = e.sender_name ? String(e.sender_name) : (rawData.sender_name ? String(rawData.sender_name) : undefined);
      const senderAvatar = e.sender_avatar ? String(e.sender_avatar) : (e.avatar ? String(e.avatar) : (rawData.sender_avatar ? String(rawData.sender_avatar) : undefined));
      const type = e.type ? String(e.type) : (rawData.type ? String(rawData.type) : undefined);
      const isOfficial = Boolean(e.is_official ?? rawData.is_official ?? false);
      const isVerified = Boolean(e.is_verified ?? rawData.is_verified ?? isOfficial);

      showWebInAppNotification({
        title,
        message,
        actionUrl,
        actionLabel: e.action_label ? String(e.action_label) : (rawData.action_label ? String(rawData.action_label) : 'View'),
        senderName,
        senderAvatar,
        type,
        isOfficial,
        isVerified,
      });

      window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT_NAME, { detail: e }));
    };

    const onMessageSent = (e: {
      conversation_id?: number;
      user_id?: number;
      user?: { name?: string; avatar?: string; avatar_url?: string };
      content?: string;
      attachment_type?: string;
      type?: string;
    }) => {
      window.dispatchEvent(new CustomEvent(MESSAGE_EVENT_NAME, { detail: e }));
      if (e.user_id === user.id) return;

      // Bump the global unread badge immediately so the header icon updates
      // before the next server poll, but only if not currently viewing messages.
      const currentPath = pathnameRef.current;
      if (!currentPath.startsWith('/app/messages')) {
        setUnreadCount(getUnreadCount() + 1);
      }

      playMessageReceivedSound();

      // The chat hub already surfaces toasts for messages outside the active
      // conversation, so skip the global toast while on the messages page.
      if (currentPath.startsWith('/app/messages')) return;

      const sender = e.user?.name ?? 'New message';
      const senderAvatar = e.user?.avatar_url || e.user?.avatar;

      let notifType = e.type || (e.attachment_type === 'call' ? 'call' : 'message');
      const cleanMessage = parseNotificationContent(
        e.content,
        e.attachment_type ? 'Sent an attachment' : 'Sent a message'
      );
      if (cleanMessage.includes('Call')) {
        notifType = 'call';
      }

      showWebInAppNotification({
        title: sender,
        message: cleanMessage,
        actionUrl: '/app/messages',
        actionLabel: 'Open',
        senderName: sender,
        senderAvatar,
        type: notifType,
      });
    };

    // When any participant reads a conversation, server-sync the badge so
    // the header count stays accurate across tabs and page navigations.
    const onMessageRead = (e: { conversation_id?: number; reader_id?: number }) => {
      if (e.reader_id !== user.id) {
        // Someone else read a message — no badge change needed for us.
        return;
      }
      // We read the messages (from another tab/device), re-sync badge.
      refreshUnreadCount().catch(() => {});
    };

    notificationChannel.listen('.notification', onNotification);
    userChannel.listen('.MessageSent', onMessageSent);
    userChannel.listen('.MessageRead', onMessageRead);

    return () => {
      notificationChannel.stopListening('.notification', onNotification);
      userChannel.stopListening('.MessageSent', onMessageSent);
      userChannel.stopListening('.MessageRead', onMessageRead);
    };
  }, [user?.id]);

  return null;
}
