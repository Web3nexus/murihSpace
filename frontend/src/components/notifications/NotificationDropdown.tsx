import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import {
  Bell,
  CheckCheck,
  ExternalLink,
  MessageSquare,
  UserPlus,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { AppNotification } from '@/types/notification';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        const rawList = json.data?.data ?? json.data ?? [];
        setNotifications(Array.isArray(rawList) ? rawList : []);
        setUnreadCount(json.unread ?? 0);
      }
    } catch {
      // Ignore network errors silently for header popover
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // Fail quietly
    }
  };

  const handleMarkRead = async (id: string) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Fail quietly
    }
  };

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case 'new_reaction':
        return <Zap className="h-3.5 w-3.5 text-amber-500" />;
      case 'new_comment':
      case 'new_post':
        return <MessageSquare className="h-3.5 w-3.5 text-secondary" />;
      case 'new_member':
      case 'join_request':
      case 'join_approved':
        return <UserPlus className="h-3.5 w-3.5 text-emerald-500" />;
      case 'moderation_action':
        return <ShieldAlert className="h-3.5 w-3.5 text-destructive" />;
      default:
        return <Bell className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all duration-150 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-secondary/50"
        title="Notifications"
      >
        <Bell className="h-4 w-4 text-foreground/80" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground flex items-center justify-center shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop overlay for outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden text-card-foreground animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="p-3 px-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-secondary/20 text-secondary border border-secondary/30">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-secondary hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
              {notifications.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-semibold text-muted-foreground">No notifications yet</p>
                  <p className="text-[11px] text-muted-foreground/70">
                    We’ll notify you when members react, comment, or join your communities.
                  </p>
                </div>
              ) : (
                notifications.map((n) => {
                  const isUnread = !n.read_at;
                  const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });

                  return (
                    <div
                      key={n.id}
                      onClick={() => isUnread && handleMarkRead(n.id)}
                      className={`p-3 transition-colors flex items-start gap-3 cursor-pointer ${
                        isUnread ? 'bg-secondary/5 hover:bg-secondary/10 font-medium' : 'hover:bg-muted/40'
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-muted shrink-0 mt-0.5">
                        {getNotificationIcon(n.data?.type)}
                      </div>
                      <div className="flex-1 space-y-0.5 text-xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-foreground line-clamp-1">
                            {n.data?.title ?? 'Notification'}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
                        </div>
                        <p className="text-muted-foreground text-[11px] line-clamp-2 leading-relaxed">
                          {n.data?.message ?? 'You have a new update.'}
                        </p>
                        {n.data?.action_url && (
                          <Link
                            to={n.data.action_url}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-secondary hover:underline pt-1"
                          >
                            <span>View</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        )}
                      </div>
                      {isUnread && (
                        <span className="h-2 w-2 rounded-full bg-secondary shrink-0 mt-2" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 border-t border-border bg-muted/20 text-center">
              <Link
                to="/app/settings/notifications"
                onClick={() => setIsOpen(false)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Notification Preferences & Settings →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
