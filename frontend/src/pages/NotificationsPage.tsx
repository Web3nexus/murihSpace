import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  ShieldAlert,
  MessageSquare,
  UserPlus,
  Zap,
  Sliders,
  Check,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router';
import type {
  AppNotification,
  NotificationPreferencesMap,
  NotificationType,
  NotificationChannel,
} from '@/types/notification';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

const TYPE_CONFIG: Record<
  NotificationType,
  { label: string; description: string; icon: React.ReactNode }
> = {
  new_post: {
    label: 'New Community Posts',
    description: 'Notifications when creators or members publish new posts in joined communities.',
    icon: <MessageSquare className="h-4 w-4 text-secondary" />,
  },
  new_comment: {
    label: 'Comments on Posts',
    description: 'Notifications when someone comments on your post or replies to your comment.',
    icon: <MessageSquare className="h-4 w-4 text-secondary" />,
  },
  new_reaction: {
    label: 'Post & Comment Reactions',
    description: 'Notifications when members react (like, love, fire, clap) to your content.',
    icon: <Zap className="h-4 w-4 text-amber-500" />,
  },
  new_member: {
    label: 'New Members Joined',
    description: 'Notifications when new members join your community.',
    icon: <UserPlus className="h-4 w-4 text-emerald-500" />,
  },
  join_request: {
    label: 'Community Join Requests',
    description: 'Notifications when a member requests access to your private community.',
    icon: <UserPlus className="h-4 w-4 text-amber-500" />,
  },
  join_approved: {
    label: 'Join Request Approved',
    description: 'Notifications when your request to join a private community is accepted.',
    icon: <Check className="h-4 w-4 text-emerald-500" />,
  },
  moderation_action: {
    label: 'Moderation & Safety Alerts',
    description: 'Notifications regarding content reports, warnings, or moderation actions.',
    icon: <ShieldAlert className="h-4 w-4 text-destructive" />,
  },
};

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'preferences'>('all');

  // Notification History state
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Preferences state
  const [preferences, setPreferences] = useState<Partial<NotificationPreferencesMap>>({});
  const [isPrefLoading, setIsPrefLoading] = useState(false);
  const [prefsLoadError, setPrefsLoadError] = useState(false);
  const [isSavingPref, setIsSavingPref] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchNotifications = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);

    const token = localStorage.getItem('murihspace-token') || localStorage.getItem('auth_token');
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const json = await res.json();
        const rawList = json.data?.data ?? json.data ?? [];
        setNotifications(Array.isArray(rawList) ? rawList : []);
        setUnreadCount(json.data?.unread ?? 0);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const fetchPreferences = useCallback(async () => {
    setIsPrefLoading(true);
    setPrefsLoadError(false);
    const token = localStorage.getItem('murihspace-token') || localStorage.getItem('auth_token');
    try {
      const res = await fetch(`${API_BASE}/notification-preferences`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const json = await res.json();
        setPreferences(json.data?.data ?? json.data ?? {});
      } else {
        setPrefsLoadError(true);
      }
    } catch {
      setPrefsLoadError(true);
    } finally {
      setIsPrefLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (activeTab === 'preferences') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchPreferences();
    }
  }, [activeTab, fetchPreferences]);

  const handleMarkAllRead = async () => {
    const token = localStorage.getItem('murihspace-token') || localStorage.getItem('auth_token');
    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (e) { console.error('Failed to mark all read', e); }
  };

  const handleTogglePref = (type: NotificationType, channel: NotificationChannel) => {
    setPreferences((prev) => {
      const currentVal = prev[type]?.[channel] ?? true;
      return {
        ...prev,
        [type]: {
          ...(prev[type] ?? { in_app: true, email: true, push: true }),
          [channel]: !currentVal,
        },
      };
    });
  };

  const handleSavePreferences = async () => {
    setIsSavingPref(true);
    setSaveSuccess(false);

    const token = localStorage.getItem('murihspace-token') || localStorage.getItem('auth_token');
    const payloadItems: { type: NotificationType; channel: NotificationChannel; enabled: boolean }[] = [];

    (Object.keys(TYPE_CONFIG) as NotificationType[]).forEach((type) => {
      (['in_app', 'email', 'push'] as NotificationChannel[]).forEach((channel) => {
        payloadItems.push({
          type,
          channel,
          enabled: preferences[type]?.[channel] ?? true,
        });
      });
    });

    try {
      const res = await fetch(`${API_BASE}/notification-preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ preferences: payloadItems }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } finally {
      setIsSavingPref(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Bell className="h-6 w-6 text-secondary" />
            Notifications & Preferences
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Stay updated with community activity and manage how alerts reach you.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Activity Feed {unreadCount > 0 && `(${unreadCount})`}
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'preferences'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Preferences
          </button>
        </div>
      </div>

      {/* TAB 1: Activity Feed */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Recent Activity
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  <CheckCheck className="h-3.5 w-3.5 text-secondary" />
                  Mark All Read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchNotifications(true)}
                disabled={isRefreshing}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-secondary mx-auto" />
              <p className="text-xs text-muted-foreground font-medium">Loading notifications…</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-card space-y-3">
              <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">All caught up!</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                You don't have any notifications right now. Activity in your communities will appear here.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-2xl bg-card divide-y divide-border overflow-hidden shadow-sm">
              {notifications.map((n) => {
                const isUnread = !n.read_at;
                const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });
                const config = TYPE_CONFIG[n.data?.type as NotificationType] ?? {
                  icon: <Bell className="h-4 w-4 text-muted-foreground" />,
                };

                return (
                  <div
                    key={n.id}
                    className={`p-4 flex items-start gap-4 transition-colors ${
                      isUnread ? 'bg-secondary/5' : 'hover:bg-muted/20'
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-muted shrink-0 mt-0.5">{config.icon}</div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {n.data?.title ?? 'Notification'}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{timeAgo}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {n.data?.message ?? 'You have a new notification.'}
                      </p>
                      {n.data?.action_url && (
                        <Link
                          to={n.data.action_url}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline pt-1"
                        >
                          View Details <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    {isUnread && <span className="h-2.5 w-2.5 rounded-full bg-secondary shrink-0 mt-2" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Preferences Matrix */}
      {activeTab === 'preferences' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-start gap-3">
            <Sliders className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-foreground">Notification Channels</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Control how and where you receive notifications. Toggles apply immediately to in-app popovers, emails, and mobile push.
              </p>
            </div>
          </div>

          {isPrefLoading ? (
            <div className="py-16 text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-secondary mx-auto" />
              <p className="text-xs text-muted-foreground font-medium">Loading preferences…</p>
            </div>
          ) : (
            <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm divide-y divide-border">
              {/* Header row */}
              <div className="p-4 bg-muted/40 grid grid-cols-12 gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
                <div className="col-span-6 sm:col-span-7">Notification Category</div>
                <div className="col-span-2 sm:col-span-1 text-center">In-App</div>
                <div className="col-span-2 sm:col-span-2 text-center">Email</div>
                <div className="col-span-2 sm:col-span-2 text-center">Push</div>
              </div>

              {/* Rows */}
              {(Object.keys(TYPE_CONFIG) as NotificationType[]).map((type) => {
                const cfg = TYPE_CONFIG[type];
                const inApp = preferences[type]?.in_app ?? true;
                const email = preferences[type]?.email ?? true;
                const push = preferences[type]?.push ?? true;

                return (
                  <div key={type} className="p-4 grid grid-cols-12 gap-2 items-center hover:bg-muted/20 transition-colors">
                    <div className="col-span-6 sm:col-span-7 space-y-0.5">
                      <div className="flex items-center gap-2">
                        {cfg.icon}
                        <span className="text-xs font-bold text-foreground">{cfg.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{cfg.description}</p>
                    </div>

                    {/* In-App Toggle */}
                    <div className="col-span-2 sm:col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleTogglePref(type, 'in_app')}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${
                          inApp ? 'bg-secondary' : 'bg-muted-foreground/30'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                            inApp ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Email Toggle */}
                    <div className="col-span-2 sm:col-span-2 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleTogglePref(type, 'email')}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${
                          email ? 'bg-secondary' : 'bg-muted-foreground/30'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                            email ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Push Toggle */}
                    <div className="col-span-2 sm:col-span-2 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleTogglePref(type, 'push')}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${
                          push ? 'bg-secondary' : 'bg-muted-foreground/30'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                            push ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            {saveSuccess && (
              <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                <Check className="h-4 w-4" /> Preferences saved!
              </span>
            )}
            <Button
              onClick={handleSavePreferences}
              disabled={isSavingPref || prefsLoadError}
              className="text-xs font-bold gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground px-6"
            >
              {isSavingPref ? 'Saving…' : 'Save Preferences'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
