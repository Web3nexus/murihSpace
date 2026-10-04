import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Checks as CheckCheck,
  Check,
  ShieldWarning,
  ShieldCheck,
  UserPlus,
  Sliders,
  Spinner as Loader2,
  ArrowsClockwise as RefreshCw,
  Wallet,
  WarningCircle,
  Lifebuoy,
  Warning as AlertTriangle,
  Cpu,
  CreditCard,
  Key,
  MagnifyingGlass,
  ArrowRight,
  EnvelopeSimple,
  PaperPlaneRight,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/api/authFetch";
import { getAuthToken } from "@/lib/auth/token";
import { toast } from "sonner";
import { Link } from "react-router";

function authHeaders() {
  const t = getAuthToken();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

export interface AdminNotificationItem {
  id: number;
  category: string;
  severity: "info" | "warning" | "critical" | "error";
  title: string;
  message: string;
  action_url: string | null;
  reference_id: string | null;
  reference_type: string | null;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface AdminCategoryMeta {
  key: string;
  label: string;
  description: string;
  unread: number;
}

const CATEGORY_ICONS: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  new_user_registration: {
    icon: <UserPlus weight="fill" className="h-4 w-4 text-emerald-500" />,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  kyc_request: {
    icon: <ShieldCheck weight="fill" className="h-4 w-4 text-indigo-500" />,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10 border-indigo-500/20",
  },
  account_upgrade_request: {
    icon: <ShieldCheck weight="fill" className="h-4 w-4 text-amber-500" />,
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  deposit_request: {
    icon: <Wallet weight="fill" className="h-4 w-4 text-blue-500" />,
    color: "text-blue-500",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  withdrawal_request: {
    icon: <CreditCard weight="fill" className="h-4 w-4 text-purple-500" />,
    color: "text-purple-500",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
  payment_issues: {
    icon: <WarningCircle weight="fill" className="h-4 w-4 text-rose-500" />,
    color: "text-rose-500",
    bg: "bg-rose-500/10 border-rose-500/20",
  },
  system_alerts: {
    icon: <AlertTriangle weight="fill" className="h-4 w-4 text-amber-500" />,
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  security_alerts: {
    icon: <Key weight="fill" className="h-4 w-4 text-red-600" />,
    color: "text-red-600",
    bg: "bg-red-500/10 border-red-500/20",
  },
  support_requests: {
    icon: <Lifebuoy weight="fill" className="h-4 w-4 text-sky-500" />,
    color: "text-sky-500",
    bg: "bg-sky-500/10 border-sky-500/20",
  },
  moderation_events: {
    icon: <ShieldWarning weight="fill" className="h-4 w-4 text-orange-500" />,
    color: "text-orange-500",
    bg: "bg-orange-500/10 border-orange-500/20",
  },
  infrastructure_notifications: {
    icon: <Cpu weight="fill" className="h-4 w-4 text-slate-400" />,
    color: "text-slate-400",
    bg: "bg-slate-500/10 border-slate-500/20",
  },
};

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [categories, setCategories] = useState<AdminCategoryMeta[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"feed" | "preferences">("feed");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  // Preferences state
  const [prefs, setPrefs] = useState<Record<string, Record<string, boolean>>>({});
  const [savingPrefs, setSavingPrefs] = useState(false);

  const loadNotifications = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true);
      try {
        const params = new URLSearchParams();
        params.set("page", page.toString());
        if (activeCategory !== "all") params.set("category", activeCategory);
        if (statusFilter !== "all") params.set("status", statusFilter);

        const res = await authFetch(`/securegate/notifications?${params.toString()}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error("Failed to load admin notifications");
        const json = await res.json();
        const data = json.data ?? json;

        setNotifications(data.data ?? []);
        setCategories(data.categories ?? []);
        setTotalUnread(data.unread_count ?? 0);
        if (data.pagination) {
          setLastPage(data.pagination.last_page ?? 1);
        }
      } catch (err) {
        console.error("Failed to load admin notifications", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, activeCategory, statusFilter]
  );

  const loadPreferences = useCallback(async () => {
    try {
      const res = await authFetch(`/securegate/notifications/preferences`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setPrefs(json.data ?? {});
      }
    } catch (e) {
      console.error("Failed to load admin preferences", e);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (activeTab === "preferences") {
      loadPreferences();
    }
  }, [activeTab, loadPreferences]);

  const handleMarkRead = async (id: number) => {
    try {
      const res = await authFetch(`/securegate/notifications/${id}/read`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setTotalUnread((prev) => Math.max(0, prev - 1));
      }
    } catch {
      toast.error("Failed to mark notification read");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const body = activeCategory !== "all" ? JSON.stringify({ category: activeCategory }) : undefined;
      const res = await authFetch(`/securegate/notifications/read-all`, {
        method: "POST",
        headers: authHeaders(),
        body,
      });
      if (res.ok) {
        // Re-read rather than assuming success cleared everything. When a
        // category is selected the server only clears that category, so
        // zeroing the count here would hide notifications that are still unread.
        await loadNotifications();
        toast.success("All notifications marked as read");
      } else {
        toast.error("Failed to mark all read");
      }
    } catch {
      toast.error("Failed to mark all read");
    }
  };

  const handleTogglePreference = async (category: string, channel: string, currentVal: boolean) => {
    const newVal = !currentVal;
    setPrefs((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category] || {}),
        [channel]: newVal,
      },
    }));

    try {
      setSavingPrefs(true);
      const res = await authFetch(`/securegate/notifications/preferences`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          preferences: [
            {
              category,
              channel,
              enabled: newVal,
            },
          ],
        }),
      });
      // authFetch resolves on a 4xx/5xx too, so the optimistic flip has to be
      // rolled back by hand or the switch lies about what the server stored.
      if (!res.ok) {
        setPrefs((prev) => ({
          ...prev,
          [category]: {
            ...(prev[category] || {}),
            [channel]: currentVal,
          },
        }));
        toast.error("Failed to save preference");
        return;
      }
      toast.success("Preferences updated");
    } catch {
      setPrefs((prev) => ({
        ...prev,
        [category]: {
          ...(prev[category] || {}),
          [channel]: currentVal,
        },
      }));
      toast.error("Failed to save preference");
    } finally {
      setSavingPrefs(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.message.toLowerCase().includes(q) ||
      n.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-4 lg:p-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2.5">
              <Bell weight="fill" className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" />
              Admin Notification Center
            </h1>
            {totalUnread > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white">
                {totalUnread} unread
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Section 17 &amp; 18 isolated administrator notifications, alert center, and category routing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex p-1 bg-muted/60 rounded-xl border border-border/50 text-xs font-bold">
            <button
              onClick={() => setActiveTab("feed")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "feed"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Alerts Feed
            </button>
            <button
              onClick={() => setActiveTab("preferences")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "preferences"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Category Preferences
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadNotifications(true)}
            className="h-8 px-2.5 rounded-xl text-xs gap-1 border-border/60"
          >
            <RefreshCw weight="bold" className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {activeTab === "feed" && totalUnread > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleMarkAllRead}
              className="h-8 px-3 rounded-xl text-xs gap-1 bg-[#2164b6] hover:bg-[#1a5194] text-white"
            >
              <CheckCheck weight="bold" className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </Button>
          )}
        </div>
      </div>

      {activeTab === "feed" ? (
        <div className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => {
                setActiveCategory("all");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === "all"
                  ? "bg-[#2164b6] text-white shadow-sm"
                  : "bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              All Categories
            </button>

            {categories.map((cat) => {
              const isSelected = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => {
                    setActiveCategory(cat.key);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? "bg-[#2164b6] text-white shadow-sm"
                      : "bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <span>{cat.label}</span>
                  {cat.unread > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        isSelected
                          ? "bg-white text-[#2164b6]"
                          : "bg-rose-500 text-white"
                      }`}
                    >
                      {cat.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sub-Filters: Status & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40 text-xs font-medium">
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg ${
                  statusFilter === "all" ? "bg-card font-bold text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                All
              </button>
              <button
                onClick={() => {
                  setStatusFilter("unread");
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg ${
                  statusFilter === "unread" ? "bg-card font-bold text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                Unread Only
              </button>
              <button
                onClick={() => {
                  setStatusFilter("read");
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg ${
                  statusFilter === "read" ? "bg-card font-bold text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                Read Only
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <MagnifyingGlass weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search admin notifications…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-card border border-border/60 focus:outline-none focus:ring-1 focus:ring-[#2164b6]"
              />
            </div>
          </div>

          {/* Alert List */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 weight="fill" className="h-7 w-7 animate-spin text-[#2164b6]" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="rounded-3xl border border-border/60 bg-card p-12 text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-muted/60 text-muted-foreground">
                <CheckCheck weight="fill" className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">No Admin Notifications</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {activeCategory !== "all"
                  ? "No alerts found in this category matching your filter."
                  : "Everything is quiet. No administrative alerts or actions require attention."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((notif) => {
                const conf = CATEGORY_ICONS[notif.category] ?? {
                  icon: <Bell weight="fill" className="h-4 w-4 text-muted-foreground" />,
                  color: "text-muted-foreground",
                  bg: "bg-muted border-border",
                };

                return (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      notif.is_read
                        ? "bg-card/60 border-border/50 opacity-80"
                        : "bg-card border-border shadow-xs hover:border-[#2164b6]/50"
                    }`}
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className={`p-2.5 rounded-xl border shrink-0 ${conf.bg}`}>
                        {conf.icon}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-foreground truncate">
                            {notif.title}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              notif.severity === "critical"
                                ? "bg-rose-500/20 text-rose-500"
                                : notif.severity === "warning"
                                ? "bg-amber-500/20 text-amber-500"
                                : "bg-blue-500/20 text-blue-500"
                            }`}
                          >
                            {notif.severity}
                          </span>
                          {!notif.is_read && (
                            <span className="w-2 h-2 rounded-full bg-[#2164b6] animate-pulse" />
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {notif.message}
                        </p>

                        <div className="text-[10px] text-muted-foreground/70">
                          {new Date(notif.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {notif.action_url && (
                        <Link
                          to={notif.action_url}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#2164b6] text-white hover:bg-[#1a5194] transition-colors flex items-center gap-1"
                        >
                          <span>Review</span>
                          <ArrowRight weight="bold" className="h-3 w-3" />
                        </Link>
                      )}

                      {!notif.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkRead(notif.id)}
                          className="h-8 px-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                          title="Mark as Read"
                        >
                          <Check weight="bold" className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {lastPage > 1 && (
            <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
              <span>Page {page} of {lastPage}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-8 rounded-xl"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 rounded-xl"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Preferences Tab */
        <div className="rounded-3xl border border-border/70 bg-card p-6 space-y-6">
          <div className="p-4 rounded-2xl bg-[#2164b6]/10 border border-[#2164b6]/20 flex items-start gap-3">
            <Sliders weight="fill" className="h-5 w-5 text-[#2164b6] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-foreground">
                Section 17: Admin Notification Routing Preferences
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configure which of the 11 administrative categories you want delivered to your in-app console,
                registered administrator email, or priority channels.
              </p>
            </div>
          </div>

          <div className="divide-y divide-border/40 border border-border/60 rounded-2xl overflow-hidden">
            {categories.map((cat) => {
              const inAppEnabled = prefs[cat.key]?.in_app ?? true;
              const emailEnabled = prefs[cat.key]?.email ?? true;
              const telegramEnabled = prefs[cat.key]?.telegram ?? false;

              return (
                <div
                  key={cat.key}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="space-y-1 max-w-lg">
                    <h5 className="text-xs font-bold text-foreground">{cat.label}</h5>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {cat.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    {/* In-app */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inAppEnabled}
                        disabled={savingPrefs}
                        onChange={() => handleTogglePreference(cat.key, "in_app", inAppEnabled)}
                        className="rounded border-border text-[#2164b6] focus:ring-[#2164b6]"
                      />
                      <span className="text-[11px] font-medium text-foreground">In-App Console</span>
                    </label>

                    {/* Email */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailEnabled}
                        disabled={savingPrefs}
                        onChange={() => handleTogglePreference(cat.key, "email", emailEnabled)}
                        className="rounded border-border text-[#2164b6] focus:ring-[#2164b6]"
                      />
                      <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                        <EnvelopeSimple weight="bold" className="h-3 w-3" />
                        Email
                      </span>
                    </label>

                    {/* Telegram */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={telegramEnabled}
                        disabled={savingPrefs}
                        onChange={() => handleTogglePreference(cat.key, "telegram", telegramEnabled)}
                        className="rounded border-border text-[#2164b6] focus:ring-[#2164b6]"
                      />
                      <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                        <PaperPlaneRight weight="bold" className="h-3 w-3" />
                        Telegram
                      </span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
