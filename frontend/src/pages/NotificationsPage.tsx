import { getAuthToken } from "@/lib/auth/token";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bell,
  Checks as CheckCheck,
  ShieldWarning,
  ShieldCheck,
  ChatTeardropText as MessageSquare,
  UserPlus,
  Lightning as Zap,
  Sliders,
  Check,
  Spinner as Loader2,
  ArrowsClockwise as RefreshCw,
  ArrowRight,
  Lifebuoy,
  Medal as Award,
  Gift,
  Wallet,
  CheckCircle as CheckCircle2,
  PaperPlaneTilt,
  Trash,
  CaretDown,
  CaretUp,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  EnvelopeSimple,
  X as XIcon,
} from "@phosphor-icons/react";
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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

const CATEGORY_GROUPS: Record<string, { label: string; types: NotificationType[] }> = {
  all: {
    label: 'All Categories',
    types: Object.keys(TYPE_CONFIG) as NotificationType[],
  },
  community: {
    label: 'Community',
    types: ['new_post', 'new_comment', 'new_reaction', 'new_member', 'join_request', 'join_approved', 'moderation_action'],
  },
  support: {
    label: 'Support Tickets',
    types: ['ticket_created', 'ticket_reply', 'ticket_status_changed', 'ticket_info_requested', 'ticket_resolved', 'ticket_reopened'],
  },
  account: {
    label: 'Account & KYC',
    types: ['role_upgrade_approved', 'role_upgrade_rejected', 'kyc_approved', 'kyc_rejected', 'kyc_requested'],
  },
  wallet: {
    label: 'Wallet & Gifts',
    types: ['gift_received', 'money_received'],
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

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'preferences'>('all');
  const [activeFeedFilter, setActiveFeedFilter] = useState<'all' | 'unread'>('all');

  // Notifications state
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAllCount, setTotalAllCount] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Accordion state (set of expanded notification IDs)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Deletion state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Preferences state
  const [preferences, setPreferences] = useState<Partial<NotificationPreferencesMap>>({});
  const [isPrefLoading, setIsPrefLoading] = useState(false);
  const [prefsLoadError, setPrefsLoadError] = useState(false);
  const [isSavingPref, setIsSavingPref] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Preferences pagination & search state
  const [selectedPrefGroup, setSelectedPrefGroup] = useState<string>('all');
  const [prefSearchQuery, setPrefSearchQuery] = useState('');
  const [prefPage, setPrefPage] = useState(1);
  const prefPerPage = 7;

  const toggleAccordion = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchNotifications = useCallback(
    async (quiet = false, targetPage = 1, currentFilter = activeFeedFilter, limit = perPage) => {
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);

      const token = getAuthToken();
      try {
        const res = await authFetch(
          `/notifications?page=${targetPage}&per_page=${limit}&filter=${currentFilter}`,
          {
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );
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

          const unread =
            typeof root?.unread === 'number'
              ? root.unread
              : typeof json?.unread === 'number'
              ? json.unread
              : 0;

          const paginator = root?.pagination ?? root?.data;
          const total =
            typeof root?.total === 'number'
              ? root.total
              : typeof paginator?.total === 'number'
              ? paginator.total
              : typeof json?.total === 'number'
              ? json.total
              : normalizedList.length;

          const totalAll =
            typeof root?.total_all === 'number'
              ? root.total_all
              : typeof json?.total_all === 'number'
              ? json.total_all
              : total;

          const lp =
            typeof root?.pagination?.last_page === 'number'
              ? root.pagination.last_page
              : typeof paginator?.last_page === 'number'
              ? paginator.last_page
              : Math.max(1, Math.ceil(total / limit));

          setNotifications(normalizedList);
          setPage(targetPage);
          setLastPage(Math.max(1, lp));
          setUnreadCount(unread);
          setTotalCount(total);
          setTotalAllCount(totalAll);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeFeedFilter, perPage]
  );

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
    fetchNotifications(false, 1, activeFeedFilter);
  }, [fetchNotifications, activeFeedFilter]);

  useEffect(() => {
    const handleLiveNotif = () => {
      fetchNotifications(true, 1, activeFeedFilter);
    };
    window.addEventListener(NOTIFICATION_EVENT_NAME, handleLiveNotif);
    return () => {
      window.removeEventListener(NOTIFICATION_EVENT_NAME, handleLiveNotif);
    };
  }, [fetchNotifications, activeFeedFilter]);

  useEffect(() => {
    if (activeTab === 'preferences') {
      fetchPreferences();
    }
  }, [activeTab, fetchPreferences]);

  const handleFilterChange = (filter: 'all' | 'unread') => {
    if (filter === activeFeedFilter) return;
    setActiveFeedFilter(filter);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > lastPage || newPage === page) return;
    fetchNotifications(false, newPage, activeFeedFilter);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const handlePerPageChange = (newLimit: number) => {
    setPerPage(newLimit);
    setPage(1);
    fetchNotifications(false, 1, activeFeedFilter, newLimit);
  };

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
      if (activeFeedFilter === 'unread') {
        fetchNotifications(true, 1, 'unread');
      }
    } catch (e) {
      console.error('Failed to mark all read', e);
    }
  };

  const handleMarkSingleRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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
      if (activeFeedFilter === 'unread') {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setTotalCount((prev) => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error('Failed to mark notification read', e);
    }
  };

  const handleMarkSingleUnread = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const token = getAuthToken();
    try {
      await authFetch(`/notifications/${id}/unread`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: null } : n))
      );
      setUnreadCount((prev) => prev + 1);
    } catch (e) {
      console.error('Failed to mark notification unread', e);
    }
  };

  const handleDeleteSingle = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeletingId(id);
    const token = getAuthToken();
    try {
      const res = await authFetch(`/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const deletedNotif = notifications.find((n) => n.id === id);
        if (deletedNotif && !deletedNotif.read_at) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setTotalCount((prev) => Math.max(0, prev - 1));
        setTotalAllCount((prev) => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error('Failed to delete notification', e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    setIsClearingAll(true);
    const token = getAuthToken();
    try {
      const res = await authFetch(`/notifications/clear-all`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        setNotifications([]);
        setUnreadCount(0);
        setTotalCount(0);
        setTotalAllCount(0);
        setLastPage(1);
        setShowClearConfirm(false);
      }
    } catch (e) {
      console.error('Failed to clear notifications', e);
    } finally {
      setIsClearingAll(false);
    }
  };

  // Preferences toggles
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

  const handleBulkToggleChannel = (channel: NotificationChannel, enabled: boolean) => {
    setPreferences((prev) => {
      const next = { ...prev };
      currentPrefTypes.forEach((type) => {
        next[type] = {
          ...(next[type] ?? { in_app: true, email: true, push: true }),
          [channel]: enabled,
        };
      });
      return next;
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

  // Grouped by day (Telegram style)
  const groupedNotifications = useMemo(() => {
    const map = new Map<string, AppNotification[]>();

    for (const n of notifications) {
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
  }, [notifications]);

  // Filtered preference categories for pagination & search
  const filteredPrefTypes = useMemo(() => {
    let types =
      selectedPrefGroup === 'all'
        ? (Object.keys(TYPE_CONFIG) as NotificationType[])
        : CATEGORY_GROUPS[selectedPrefGroup]?.types || [];

    if (prefSearchQuery.trim()) {
      const q = prefSearchQuery.toLowerCase();
      types = types.filter((type) => {
        const cfg = TYPE_CONFIG[type];
        return (
          cfg.label.toLowerCase().includes(q) ||
          cfg.description.toLowerCase().includes(q) ||
          type.toLowerCase().includes(q)
        );
      });
    }
    return types;
  }, [selectedPrefGroup, prefSearchQuery]);

  const prefTotalPages = Math.max(1, Math.ceil(filteredPrefTypes.length / prefPerPage));

  useEffect(() => {
    setPrefPage(1);
  }, [selectedPrefGroup, prefSearchQuery]);

  const currentPrefTypes = useMemo(() => {
    const start = (prefPage - 1) * prefPerPage;
    return filteredPrefTypes.slice(start, start + prefPerPage);
  }, [filteredPrefTypes, prefPage, prefPerPage]);

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
            ) : totalAllCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                {totalAllCount}
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
          {/* Sub-toolbar with Telegram Filters & Bulk Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/50 border border-border/40">
              <button
                type="button"
                onClick={() => handleFilterChange('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeFeedFilter === 'all'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All {totalAllCount > 0 && `(${totalAllCount})`}
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('unread')}
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
              {totalCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  className="h-8 rounded-xl text-xs font-semibold gap-1.5 border-border/60 text-destructive/85 hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                >
                  <Trash weight="bold" className="h-3.5 w-3.5 text-destructive" />
                  <span className="hidden sm:inline">Clear All</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchNotifications(true, page, activeFeedFilter)}
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
          ) : notifications.length === 0 ? (
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
                  onClick={() => fetchNotifications(true, 1, activeFeedFilter)}
                  disabled={isRefreshing}
                  className="rounded-xl text-xs font-semibold gap-1.5 border-border/80 hover:bg-muted"
                >
                  <RefreshCw weight="bold" className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh Feed
                </Button>
                {activeFeedFilter === 'unread' && totalAllCount > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleFilterChange('all')}
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

                      const bodyText = formatNotificationMessage(n.data?.body ?? n.data?.message ?? (n.data as any)?.content);
                      const hasExtraMeta = Boolean(
                        n.data?.reason ||
                        n.data?.admin_note ||
                        n.data?.details ||
                        n.data?.ticket_id ||
                        n.data?.ticket_code ||
                        n.data?.amount
                      );
                      const isLong = bodyText.length > 130 || bodyText.includes('\n') || hasExtraMeta;
                      const isExpanded = expandedIds.has(n.id);

                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.read_at) handleMarkSingleRead(n.id);
                          }}
                          className={`relative p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer group/card ${
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
                            <div className="flex-1 min-w-0 space-y-1 pr-6 sm:pr-8">
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

                              {/* Accordion / Message Body */}
                              <div className="pt-0.5">
                                <p
                                  className={`text-xs sm:text-[13px] text-muted-foreground leading-relaxed break-words ${
                                    !isExpanded && isLong ? 'line-clamp-2' : 'whitespace-pre-line'
                                  }`}
                                >
                                  {bodyText}
                                </p>

                                {/* Accordion extra details when expanded */}
                                {isExpanded && hasExtraMeta && (
                                  <div className="mt-2.5 p-3 rounded-xl bg-muted/60 border border-border/50 text-xs space-y-1.5 animate-in fade-in-50 duration-200">
                                    {n.data?.reason && (
                                      <div className="text-muted-foreground">
                                        <span className="font-bold text-foreground">Reason: </span>
                                        {String(n.data.reason)}
                                      </div>
                                    )}
                                    {n.data?.admin_note && (
                                      <div className="text-muted-foreground">
                                        <span className="font-bold text-foreground">Admin Note: </span>
                                        {String(n.data.admin_note)}
                                      </div>
                                    )}
                                    {(n.data?.ticket_id || n.data?.ticket_code) && (
                                      <div className="text-muted-foreground">
                                        <span className="font-bold text-foreground">Reference: </span>
                                        #{String(n.data.ticket_code || n.data.ticket_id)}
                                      </div>
                                    )}
                                    {n.data?.amount && (
                                      <div className="text-muted-foreground">
                                        <span className="font-bold text-foreground">Amount: </span>
                                        {String(n.data.amount)} {n.data.currency || ''}
                                      </div>
                                    )}
                                    {n.data?.details && typeof n.data.details === 'string' && (
                                      <div className="text-muted-foreground">
                                        <span className="font-bold text-foreground">Details: </span>
                                        {String(n.data.details)}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Accordion Toggle Trigger Button */}
                                {isLong && (
                                  <button
                                    type="button"
                                    onClick={(e) => toggleAccordion(n.id, e)}
                                    className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-[#0088cc] hover:text-[#0077b5] dark:text-[#38bdf8] dark:hover:text-[#7dd3fc] transition-colors group cursor-pointer"
                                  >
                                    <span>{isExpanded ? 'Show less' : 'Show full details'}</span>
                                    {isExpanded ? (
                                      <CaretUp weight="bold" className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                                    ) : (
                                      <CaretDown weight="bold" className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                                    )}
                                  </button>
                                )}
                              </div>

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

                              {/* Bottom Timestamp & Actions (Read/Unread + Delete) */}
                              <div className="flex items-center justify-between gap-2 pt-2 text-[11px] text-muted-foreground border-t border-border/30 mt-2">
                                <div className="flex items-center gap-1.5">
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

                                {/* Action Buttons: Mark as Read/Unread & Delete */}
                                <div
                                  className="flex items-center gap-1 opacity-80 group-hover/card:opacity-100 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {isUnread ? (
                                    <button
                                      type="button"
                                      title="Mark as read"
                                      onClick={(e) => handleMarkSingleRead(n.id, e)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-[#0088cc] hover:bg-[#0088cc]/10 transition-colors"
                                    >
                                      <Check weight="bold" className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Mark read</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      title="Mark as unread"
                                      onClick={(e) => handleMarkSingleUnread(n.id, e)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                                    >
                                      <EnvelopeSimple weight="bold" className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Unread</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    title="Delete notification"
                                    disabled={deletingId === n.id}
                                    onClick={(e) => handleDeleteSingle(n.id, e)}
                                    className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                                  >
                                    {deletingId === n.id ? (
                                      <Loader2 weight="fill" className="w-3.5 h-3.5 animate-spin text-destructive" />
                                    ) : (
                                      <Trash weight="bold" className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* ── Activity Feed Numbered Pagination ────────────────────────────── */}
              {totalCount > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/50 text-xs text-muted-foreground">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div>
                      Showing <span className="font-bold text-foreground">{(page - 1) * perPage + 1}</span>–
                      <span className="font-bold text-foreground">{Math.min(page * perPage, totalCount)}</span> of{' '}
                      <span className="font-bold text-foreground">{totalCount}</span> notifications
                    </div>

                    <div className="flex items-center gap-1 text-[11px] bg-muted/40 px-2 py-0.5 rounded-lg border border-border/40">
                      <span className="text-muted-foreground">Per page:</span>
                      {[10, 15, 25, 50].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => handlePerPageChange(size)}
                          className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                            perPage === size
                              ? 'bg-[#0088cc] text-white shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || isLoading}
                      onClick={() => handlePageChange(page - 1)}
                      className="h-8 px-2.5 rounded-xl text-xs gap-1 border-border/60 disabled:opacity-40"
                    >
                      <CaretLeft weight="bold" className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </Button>

                    {getPageNumbers(page, lastPage).map((p, idx) => {
                      if (p === '...') {
                        return (
                          <span key={`notif-ellipsis-${idx}`} className="px-1 text-muted-foreground">
                            …
                          </span>
                        );
                      }
                      const isCurrent = p === page;
                      return (
                        <button
                          key={`notif-page-${p}`}
                          type="button"
                          onClick={() => handlePageChange(p as number)}
                          disabled={isLoading}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                            isCurrent
                              ? 'bg-[#0088cc] text-white shadow-sm'
                              : 'bg-muted/50 hover:bg-muted text-foreground border border-border/40'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= lastPage || isLoading}
                      onClick={() => handlePageChange(page + 1)}
                      className="h-8 px-2.5 rounded-xl text-xs gap-1 border-border/60 disabled:opacity-40"
                    >
                      <span>Next</span>
                      <CaretRight weight="bold" className="w-3.5 h-3.5" />
                    </Button>
                  </div>
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
                Control how and where you receive notifications. Toggles apply to in-app popovers, emails, and mobile push.
              </p>
            </div>
          </div>

          {/* Preferences Category Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Category Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {Object.entries(CATEGORY_GROUPS).map(([key, group]) => {
                const isSelected = selectedPrefGroup === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedPrefGroup(key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-[#0088cc] text-white shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px] sm:w-64">
              <MagnifyingGlass weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter categories…"
                value={prefSearchQuery}
                onChange={(e) => setPrefSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 rounded-xl text-xs bg-card border border-border/70 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[#0088cc]/30"
              />
              {prefSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPrefSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {isPrefLoading ? (
            <div className="py-16 text-center space-y-2">
              <Loader2 weight="fill" className="h-8 w-8 animate-spin text-[#0088cc] mx-auto" />
              <p className="text-xs text-muted-foreground font-medium">Loading preferences…</p>
            </div>
          ) : filteredPrefTypes.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-border/80 space-y-2">
              <p className="text-xs font-bold text-foreground">No matching categories found</p>
              <p className="text-xs text-muted-foreground">Try clearing your search or selecting a different category.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPrefSearchQuery('');
                  setSelectedPrefGroup('all');
                }}
                className="rounded-xl text-xs"
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border border-border/60 rounded-2xl bg-card overflow-hidden divide-y divide-border/60 shadow-sm">
                {/* Header row with bulk controls */}
                <div className="p-4 bg-muted/40 grid grid-cols-12 gap-2 text-xs font-bold text-foreground uppercase tracking-wider items-center">
                  <div className="col-span-6 sm:col-span-6">Notification Category</div>
                  <div className="col-span-2 sm:col-span-2 text-center flex flex-col items-center">
                    <span>In-App</span>
                    <button
                      type="button"
                      onClick={() => {
                        const anyOff = currentPrefTypes.some((t) => !(preferences[t]?.in_app ?? true));
                        handleBulkToggleChannel('in_app', anyOff);
                      }}
                      className="text-[10px] text-[#0088cc] hover:underline normal-case font-normal mt-0.5"
                    >
                      toggle page
                    </button>
                  </div>
                  <div className="col-span-2 sm:col-span-2 text-center flex flex-col items-center">
                    <span>Email</span>
                    <button
                      type="button"
                      onClick={() => {
                        const anyOff = currentPrefTypes.some((t) => !(preferences[t]?.email ?? true));
                        handleBulkToggleChannel('email', anyOff);
                      }}
                      className="text-[10px] text-[#0088cc] hover:underline normal-case font-normal mt-0.5"
                    >
                      toggle page
                    </button>
                  </div>
                  <div className="col-span-2 sm:col-span-2 text-center flex flex-col items-center">
                    <span>Push</span>
                    <button
                      type="button"
                      onClick={() => {
                        const anyOff = currentPrefTypes.some((t) => !(preferences[t]?.push ?? true));
                        handleBulkToggleChannel('push', anyOff);
                      }}
                      className="text-[10px] text-[#0088cc] hover:underline normal-case font-normal mt-0.5"
                    >
                      toggle page
                    </button>
                  </div>
                </div>

                {/* Rows for the current page */}
                {currentPrefTypes.map((type) => {
                  const cfg = TYPE_CONFIG[type];
                  const inApp = preferences[type]?.in_app ?? true;
                  const email = preferences[type]?.email ?? true;
                  const push = preferences[type]?.push ?? true;

                  return (
                    <div key={type} className="p-4 grid grid-cols-12 gap-2 items-center hover:bg-muted/20 transition-colors">
                      <div className="col-span-6 sm:col-span-6 space-y-0.5">
                        <div className="flex items-center gap-2">
                          {cfg.icon}
                          <span className="text-xs font-bold text-foreground">{cfg.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{cfg.description}</p>
                      </div>

                      {/* In-App Toggle */}
                      <div className="col-span-2 sm:col-span-2 flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleTogglePref(type, 'in_app')}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
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
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
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
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
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

              {/* ── Preferences Numbered Pagination ─────────────────────────────────── */}
              {filteredPrefTypes.length > prefPerPage && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-muted-foreground">
                  <div>
                    Showing <span className="font-bold text-foreground">{(prefPage - 1) * prefPerPage + 1}</span>–
                    <span className="font-bold text-foreground">
                      {Math.min(prefPage * prefPerPage, filteredPrefTypes.length)}
                    </span>{' '}
                    of <span className="font-bold text-foreground">{filteredPrefTypes.length}</span> categories
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={prefPage <= 1}
                      onClick={() => setPrefPage((p) => Math.max(1, p - 1))}
                      className="h-8 px-2.5 rounded-xl text-xs gap-1 border-border/60 disabled:opacity-40"
                    >
                      <CaretLeft weight="bold" className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </Button>

                    {getPageNumbers(prefPage, prefTotalPages).map((p, idx) => {
                      if (p === '...') {
                        return (
                          <span key={`pref-ellipsis-${idx}`} className="px-1 text-muted-foreground">
                            …
                          </span>
                        );
                      }
                      const isCurrent = p === prefPage;
                      return (
                        <button
                          key={`pref-page-${p}`}
                          type="button"
                          onClick={() => setPrefPage(p as number)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                            isCurrent
                              ? 'bg-[#0088cc] text-white shadow-sm'
                              : 'bg-muted/50 hover:bg-muted text-foreground border border-border/40'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={prefPage >= prefTotalPages}
                      onClick={() => setPrefPage((p) => Math.min(prefTotalPages, p + 1))}
                      className="h-8 px-2.5 rounded-xl text-xs gap-1 border-border/60 disabled:opacity-40"
                    >
                      <span>Next</span>
                      <CaretRight weight="bold" className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
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

      {/* ── Clear All Confirmation Dialog ──────────────────────────────────── */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center">
              <Trash weight="bold" className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold">Clear all notifications?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will permanently delete all notifications from your activity feed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearConfirm(false)}
              disabled={isClearingAll}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearAll}
              disabled={isClearingAll}
              className="rounded-xl text-xs gap-1.5"
            >
              {isClearingAll ? (
                <>
                  <Loader2 weight="fill" className="w-3.5 h-3.5 animate-spin" />
                  <span>Clearing…</span>
                </>
              ) : (
                <span>Yes, clear all</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
