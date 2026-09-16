import { getAuthToken } from "@/lib/auth/token";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bell as Bell,
  Checks as CheckCheck,
  ShieldWarning as ShieldWarning,
  ShieldCheck as ShieldCheck,
  ChatTeardropText as MessageSquare,
  UserPlus as UserPlus,
  Lightning as Zap,
  Sliders as Sliders,
  Check as Check,
  Spinner as Loader2,
  ArrowsClockwise as RefreshCw,
  ArrowRight as ArrowRight,
  Lifebuoy as Lifebuoy,
  Medal as Award,
  Gift as Gift,
  Wallet as Wallet,
  CheckCircle as CheckCircle2,
  PaperPlaneTilt as PaperPlaneTilt,
} from "@phosphor-icons/react";
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router';
import type {
  AppNotification,
  NotificationPreferencesMap,
  NotificationType,
  NotificationChannel,
} from '@/types/notification';
import { authFetch } from "@/lib/api/authFetch";
import { NOTIFICATION_EVENT_NAME } from '@/hooks/useGlobalRealtimeNotifications';

const TYPE_CONFIG: Record<
  NotificationType,
  { label: string; description: string; icon: React.ReactNode }
> = {
  new_post: {
    label: 'Community Post',
    description: 'Notifications when creators or members publish new posts in joined communities.',
    icon: <MessageSquare weight="fill" className="h-4 w-4 text-[#0088cc]" />,
  },
  new_comment: {
    label: 'Comment Reply',
    description: 'Notifications when someone comments on your post or replies to your comment.',
    icon: <MessageSquare weight="fill" className="h-4 w-4 text-[#0088cc]" />,
  },
  new_reaction: {
    label: 'Reaction',
    description: 'Notifications when members react (like, love, fire, clap) to your content.',
    icon: <Zap weight="fill" className="h-4 w-4 text-amber-500" />,
  },
  new_member: {
    label: 'New Member',
    description: 'Notifications when new members join your community.',
    icon: <UserPlus weight="fill" className="h-4 w-4 text-emerald-500" />,
  },
  join_request: {
    label: 'Join Request',
    description: 'Notifications when a member requests access to your private community.',
    icon: <UserPlus weight="fill" className="h-4 w-4 text-amber-500" />,
  },
  join_approved: {
    label: 'Join Approved',
    description: 'Notifications when your request to join a private community is accepted.',
    icon: <Check weight="fill" className="h-4 w-4 text-emerald-500" />,
  },
  moderation_action: {
    label: 'Safety Alert',
    description: 'Notifications regarding content reports, warnings, or moderation actions.',
    icon: <ShieldWarning weight="fill" className="h-4 w-4 text-destructive" />,
  },
  ticket_created: {
    label: 'Support Ticket',
    description: 'When a support ticket you opened is created.',
    icon: <Lifebuoy weight="fill" className="h-4 w-4 text-blue-500" />,
  },
  ticket_reply: {
    label: 'Support Reply',
    description: 'When a support agent replies to your ticket.',
    icon: <Lifebuoy weight="fill" className="h-4 w-4 text-emerald-500" />,
  },
  ticket_status_changed: {
    label: 'Ticket Status',
    description: 'When the status of your support ticket changes.',
    icon: <RefreshCw weight="fill" className="h-4 w-4 text-blue-500" />,
  },
  ticket_info_requested: {
    label: 'Ticket Update',
    description: 'When support asks you for more information on a ticket.',
    icon: <MessageSquare weight="fill" className="h-4 w-4 text-amber-500" />,
  },
  ticket_resolved: {
    label: 'Ticket Resolved',
    description: 'When your support ticket is marked resolved.',
    icon: <Check weight="fill" className="h-4 w-4 text-emerald-500" />,
  },
  ticket_reopened: {
    label: 'Ticket Reopened',
    description: 'When your support ticket is reopened.',
    icon: <RefreshCw weight="fill" className="h-4 w-4 text-amber-500" />,
  },
  role_upgrade_approved: {
    label: 'Role Upgrade',
    description: 'Official notifications when your account upgrade or tier is approved.',
    icon: <Award weight="fill" className="h-4 w-4 text-amber-500" />,
  },
  role_upgrade_rejected: {
    label: 'Role Update',
    description: 'Updates and feedback regarding account role submissions.',
    icon: <ShieldWarning weight="fill" className="h-4 w-4 text-rose-500" />,
  },
  kyc_approved: {
    label: 'Identity Verified',
    description: 'Official confirmation when your identity verification is verified.',
    icon: <ShieldCheck weight="fill" className="h-4 w-4 text-emerald-500" />,
  },
  kyc_rejected: {
    label: 'Verification Alert',
    description: 'Notifications if your identity verification requires re-submission.',
    icon: <ShieldWarning weight="fill" className="h-4 w-4 text-rose-500" />,
  },
  kyc_requested: {
    label: 'KYC Action',
    description: 'Requests to submit identity documents for high-tier account features.',
    icon: <ShieldWarning weight="fill" className="h-4 w-4 text-blue-500" />,
  },
  gift_received: {
    label: 'Gift Received',
    description: 'Alerts when members send you gifts during streams or on profile.',
    icon: <Gift weight="fill" className="h-4 w-4 text-pink-500" />,
  },
  money_received: {
    label: 'Wallet Credit',
    description: 'Instant alerts when donations, transfers, or wallet credits arrive.',
    icon: <Wallet weight="fill" className="h-4 w-4 text-emerald-500" />,
  },
};

function formatNotificationMessage(content: unknown, fallback = 'You have a new notification.'): string {
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
      return formatNotificationMessage(parsed, fallback);
    } catch {
      return str;
    }
  }
  return str;
}

function getDayLabel(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return 'Recent';
  }
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'preferences'>('all');
  const [activeFeedFilter, setActiveFeedFilter] = useState<'all' | 'unread'>('all');

  // Notifications state
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Preferences state
  const [preferences, setPreferences] = useState<Partial<NotificationPreferencesMap>>({});
  const [isPrefLoading, setIsPrefLoading] = useState(false);
  const [prefsLoadError, setPrefsLoadError] = useState(false);
  const [isSavingPref, setIsSavingPref] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchNotifications = useCallback(async (quiet = false, targetPage = 1) => {
    if (targetPage === 1) {
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);
    } else {
      setIsLoadingMore(true);
    }

    const token = getAuthToken();
    try {
      const res = await authFetch(`/notifications?page=${targetPage}`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const json = await res.json();
        const root = json.data ?? json;

        let rawList: any[] = [];
        if (Array.isArray(root?.notifications)) {
          rawList = root.notifications;
        } else if (Array.isArray(root?.data?.data)) {
          rawList = root.data.data;
        } else if (Array.isArray(root?.data)) {
          rawList = root.data;
        } else if (Array.isArray(root?.items)) {
          rawList = root.items;
        } else if (Array.isArray(root)) {
          rawList = root;
        } else if (Array.isArray(json?.data?.data?.data)) {
          rawList = json.data.data.data;
        }

        const normalizedList: AppNotification[] = rawList.map((item: any) => {
          let itemData = item.data;
          if (typeof itemData === 'string') {
            try {
              itemData = JSON.parse(itemData);
            } catch (_) {
              itemData = { message: itemData };
            }
          }
          return {
            ...item,
            data: itemData || {},
          };
        });

        const unread = typeof root?.unread === 'number'
          ? root.unread
          : (typeof json?.unread === 'number' ? json.unread : 0);

        const paginator = root?.pagination ?? root?.data;
        const total = typeof root?.total === 'number'
          ? root.total
          : (typeof paginator?.total === 'number'
              ? paginator.total
              : (typeof json?.total === 'number' ? json.total : normalizedList.length));

        const lastPage = typeof root?.pagination?.last_page === 'number'
          ? root.pagination.last_page
          : (typeof paginator?.last_page === 'number' ? paginator.last_page : 1);

        if (targetPage === 1) {
          setNotifications(normalizedList);
        } else {
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const newItems = normalizedList.filter((n) => !existingIds.has(n.id));
            return [...prev, ...newItems];
          });
        }

        setPage(targetPage);
        setHasMore(targetPage < lastPage);
        setUnreadCount(unread);
        setTotalCount(total);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, []);

  const fetchPreferences = useCallback(async () => {
    setIsPrefLoading(true);
    setPrefsLoadError(false);
    const token = getAuthToken();
    try {
      const res = await authFetch(`/notification-preferences`, {
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
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const handleLiveNotif = () => {
      fetchNotifications(true, 1);
    };
    window.addEventListener(NOTIFICATION_EVENT_NAME, handleLiveNotif);
    return () => {
      window.removeEventListener(NOTIFICATION_EVENT_NAME, handleLiveNotif);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (activeTab === 'preferences') {
      fetchPreferences();
    }
  }, [activeTab, fetchPreferences]);

  const handleMarkAllRead = async () => {
    const token = getAuthToken();
    try {
      await authFetch(`/notifications/read-all`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all read', e);
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    const token = getAuthToken();
    try {
      await authFetch(`/notifications/${id}/read`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Failed to mark notification read', e);
    }
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

    const token = getAuthToken();
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
      const res = await authFetch(`/notification-preferences`, {
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

  // Filtered notifications
  const displayedNotifications = useMemo(() => {
    if (activeFeedFilter === 'unread') {
      return notifications.filter((n) => !n.read_at);
    }
    return notifications;
  }, [notifications, activeFeedFilter]);

  // Grouped by day (Telegram style)
  const groupedNotifications = useMemo(() => {
    const map = new Map<string, AppNotification[]>();

    for (const n of displayedNotifications) {
      const day = getDayLabel(n.created_at);
      if (!map.has(day)) {
        map.set(day, []);
      }
      map.get(day)!.push(n);
    }

    const groups: { day: string; items: AppNotification[] }[] = [];
    for (const [day, items] of map.entries()) {
      groups.push({ day, items });
    }
    return groups;
  }, [displayedNotifications]);

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* ── Telegram-Style Centered Header ─────────────────────────────────── */}
      <div className="flex flex-col items-center text-center space-y-2.5 py-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0088cc]/15 text-[#0088cc] ring-8 ring-[#0088cc]/10 shadow-sm transition-transform hover:scale-105">
          <PaperPlaneTilt weight="fill" className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
          Notifications &amp; Preferences
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Stay updated with community activity, gifts, wallet credits, and official alerts.
        </p>

        {/* Telegram-style Segmented Switcher */}
        <div className="inline-flex items-center p-1 rounded-2xl bg-muted/70 backdrop-blur-md border border-border/50 shadow-inner mt-3">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Activity Feed</span>
            {unreadCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#0088cc] text-white shadow-sm">
                {unreadCount}
              </span>
            ) : totalCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                {totalCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'preferences'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sliders weight="fill" className="h-3.5 w-3.5" />
            <span>Preferences</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: Activity Feed ────────────────────────────────────────────── */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* Sub-toolbar with Telegram Filters & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/50 border border-border/40">
              <button
                type="button"
                onClick={() => setActiveFeedFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeFeedFilter === 'all'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All {totalCount > 0 && `(${totalCount})`}
              </button>
              <button
                type="button"
                onClick={() => setActiveFeedFilter('unread')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeFeedFilter === 'unread'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#0088cc] text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="h-8 rounded-xl text-xs font-semibold gap-1.5 border-border/60 hover:border-[#0088cc]/40 hover:text-[#0088cc]"
                >
                  <CheckCheck weight="bold" className="h-3.5 w-3.5 text-[#0088cc]" />
                  <span>Mark All Read</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchNotifications(true, 1)}
                disabled={isRefreshing}
                className="h-8 rounded-xl text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw weight="bold" className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 weight="fill" className="h-8 w-8 animate-spin text-[#0088cc] mx-auto" />
              <p className="text-xs text-muted-foreground font-medium">Loading notifications…</p>
            </div>
          ) : displayedNotifications.length === 0 ? (
            /* Telegram-Style Centered Empty State */
            <div className="py-16 px-6 text-center border border-dashed border-border/70 rounded-3xl bg-card/40 space-y-4 max-w-lg mx-auto shadow-sm">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#0088cc]/20 to-[#2AABEE]/10 flex items-center justify-center mx-auto ring-8 ring-[#0088cc]/10 shadow-inner">
                <PaperPlaneTilt weight="fill" className="w-9 h-9 text-[#0088cc]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-foreground">All caught up!</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  {activeFeedFilter === 'unread'
                    ? "You don't have any unread notifications right now."
                    : "You don't have any notifications right now. Activity in your communities and official updates will appear here."}
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNotifications(true, 1)}
                  disabled={isRefreshing}
                  className="rounded-xl text-xs font-semibold gap-1.5 border-border/80 hover:bg-muted"
                >
                  <RefreshCw weight="bold" className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh Feed
                </Button>
                {activeFeedFilter === 'unread' && notifications.length > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setActiveFeedFilter('all')}
                    className="rounded-xl text-xs font-semibold bg-[#0088cc] hover:bg-[#0077b5] text-white"
                  >
                    View All History
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* Telegram-Style Message Cards List */
            <div className="space-y-6">
              {groupedNotifications.map((group) => (
                <div key={group.day} className="space-y-3">
                  {/* Centered Telegram Date Pill */}
                  <div className="flex items-center justify-center sticky top-2 z-10 my-2">
                    <span className="px-3.5 py-1 rounded-full text-[11px] font-semibold bg-muted/85 backdrop-blur-md text-muted-foreground shadow-sm border border-border/50">
                      {group.day}
                    </span>
                  </div>

                  {/* Group Items */}
                  <div className="space-y-2.5">
                    {group.items.map((n) => {
                      const isUnread = !n.read_at;
                      const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });
                      const config = TYPE_CONFIG[n.data?.type as NotificationType] ?? {
                        label: 'Notification',
                        description: '',
                        icon: <Bell weight="fill" className="h-4 w-4 text-[#0088cc]" />,
                      };
                      const isOfficial =
                        n.data?.is_official ||
                        n.data?.sender_name === 'Murih Notifications Official' ||
                        ['role_upgrade_approved', 'role_upgrade_rejected', 'kyc_approved', 'kyc_rejected', 'kyc_requested', 'gift_received', 'money_received'].includes(n.data?.type || n.type);
                      const isVerified = n.data?.is_verified || isOfficial;
                      const channelName = isOfficial ? 'Murih Notifications Official' : (n.data?.sender_name ?? 'Notification');

                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.read_at) handleMarkSingleRead(n.id);
                          }}
                          className={`relative p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                            isUnread
                              ? 'bg-card border-[#0088cc]/40 dark:border-[#0088cc]/30 shadow-sm shadow-[#0088cc]/5 hover:border-[#0088cc]/60'
                              : 'bg-card/70 border-border/60 hover:bg-card hover:border-border'
                          }`}
                        >
                          {/* Telegram Unread Pulse Dot */}
                          {isUnread && (
                            <span className="absolute top-4 right-4 flex h-2.5 w-2.5" title="Unread">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0088cc] opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0088cc]" />
                            </span>
                          )}

                          <div className="flex items-start gap-3.5 sm:gap-4">
                            {/* Left Telegram Avatar / Badge */}
                            <div className="relative shrink-0">
                              <div
                                className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${
                                  isOfficial
                                    ? 'bg-gradient-to-br from-[#0088cc] to-[#006699] text-white'
                                    : 'bg-muted text-foreground'
                                }`}
                              >
                                {isOfficial ? (
                                  <Bell weight="fill" className="w-5 h-5 text-white" />
                                ) : (
                                  config.icon
                                )}
                              </div>
                              {isVerified && (
                                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow">
                                  <CheckCircle2 weight="fill" className="w-3.5 h-3.5 fill-[#0088cc] text-white" />
                                </div>
                              )}
                            </div>

                            {/* Main Content */}
                            <div className="flex-1 min-w-0 space-y-1 pr-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-xs sm:text-sm font-bold truncate ${
                                    isOfficial ? 'text-[#0088cc] dark:text-[#38bdf8]' : 'text-foreground'
                                  }`}
                                >
                                  {channelName}
                                </span>
                                {isVerified && (
                                  <CheckCircle2 weight="fill" className="h-3.5 w-3.5 fill-[#0088cc] text-white shrink-0 -ml-1" />
                                )}
                                <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-muted/70 text-muted-foreground font-medium">
                                  {config.label}
                                </span>
                              </div>

                              {n.data?.title && n.data?.title !== channelName && (
                                <h4 className="text-xs sm:text-sm font-bold text-foreground pt-0.5">
                                  {n.data.title}
                                </h4>
                              )}

                              <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed break-words pt-0.5">
                                {formatNotificationMessage(n.data?.body ?? n.data?.message ?? (n.data as any)?.content)}
                              </p>

                              {/* Telegram-style Inline Action Pill */}
                              {n.data?.action_url && (
                                <div className="pt-2">
                                  <Link
                                    to={
                                      n.data.action_url.startsWith('http')
                                        ? n.data.action_url.replace(/https?:\/\/[^/]+/, '')
                                        : n.data.action_url
                                    }
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!n.read_at) handleMarkSingleRead(n.id);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] dark:text-[#38bdf8] text-xs font-semibold border border-[#0088cc]/25 transition-all active:scale-95 shadow-sm"
                                  >
                                    <span>{n.data?.action_label ?? 'View Details'}</span>
                                    <ArrowRight weight="bold" className="w-3 h-3" />
                                  </Link>
                                </div>
                              )}

                              {/* Bottom Timestamp & Read Receipts */}
                              <div className="flex items-center justify-end gap-1.5 pt-1 text-[11px] text-muted-foreground">
                                <span>{timeAgo}</span>
                                {isUnread ? (
                                  <span title="Delivered">
                                    <Check weight="bold" className="w-3.5 h-3.5 text-muted-foreground/60" />
                                  </span>
                                ) : (
                                  <span title="Read">
                                    <CheckCheck weight="bold" className="w-3.5 h-3.5 text-[#0088cc]" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Load More Button */}
              {hasMore && (
                <div className="flex justify-center pt-2 pb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchNotifications(true, page + 1)}
                    disabled={isLoadingMore}
                    className="rounded-xl text-xs font-semibold gap-2 border-border/80 hover:bg-muted px-6"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 weight="fill" className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading older notifications…</span>
                      </>
                    ) : (
                      <span>Load older notifications</span>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Preferences Matrix ──────────────────────────────────────── */}
      {activeTab === 'preferences' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-[#0088cc]/10 border border-[#0088cc]/20 flex items-start gap-3">
            <Sliders weight="fill" className="h-5 w-5 text-[#0088cc] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-foreground">Notification Channels</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Control how and where you receive notifications. Toggles apply immediately to in-app popovers, emails, and mobile push.
              </p>
            </div>
          </div>

          {isPrefLoading ? (
            <div className="py-16 text-center space-y-2">
              <Loader2 weight="fill" className="h-8 w-8 animate-spin text-[#0088cc] mx-auto" />
              <p className="text-xs text-muted-foreground font-medium">Loading preferences…</p>
            </div>
          ) : (
            <div className="border border-border/60 rounded-2xl bg-card overflow-hidden divide-y divide-border/60 shadow-sm">
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
                          inApp ? 'bg-[#0088cc]' : 'bg-muted-foreground/30'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
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
                          email ? 'bg-[#0088cc]' : 'bg-muted-foreground/30'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
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
                          push ? 'bg-[#0088cc]' : 'bg-muted-foreground/30'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
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
                <Check weight="fill" className="h-4 w-4" /> Preferences saved!
              </span>
            )}
            <Button
              onClick={handleSavePreferences}
              disabled={isSavingPref || prefsLoadError}
              className="text-xs font-bold gap-2 bg-[#0088cc] hover:bg-[#0077b5] text-white px-6 rounded-xl"
            >
              {isSavingPref ? 'Saving…' : 'Save Preferences'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
