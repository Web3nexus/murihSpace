import { useState, useEffect, useCallback } from "react";
import { History, Loader2, RefreshCw, FileText, Users, ShoppingCart, Wallet, Gift, Calendar, CreditCard } from "lucide-react";
import { authFetch } from "@/lib/api/authFetch";


interface ActivityItem {
  id: number;
  type: string;
  description: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const ACTIVITY_ICONS: Record<string, typeof FileText> = {
  "post.created": FileText,
  "post.published": FileText,
  "community.joined": Users,
  "purchase.completed": ShoppingCart,
  "withdrawal.requested": Wallet,
  "donation.sent": Gift,
  "event.registered": Calendar,
  "subscription.started": CreditCard,
};

const ACTIVITY_COLORS: Record<string, string> = {
  "post.created": "bg-blue-500/20 text-blue-400",
  "post.published": "bg-green-500/20 text-green-400",
  "community.joined": "bg-violet-500/20 text-violet-400",
  "purchase.completed": "bg-emerald-500/20 text-emerald-400",
  "withdrawal.requested": "bg-amber-500/20 text-amber-400",
  "donation.sent": "bg-rose-500/20 text-rose-400",
  "event.registered": "bg-cyan-500/20 text-cyan-400",
  "subscription.started": "bg-indigo-500/20 text-indigo-400",
};

export default function ActivityLogPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const loadActivities = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await authFetch(`/activity-logs?page=${p}&per_page=25`);
      if (!res.ok) { setError("Failed to load activity"); return; }
      const json = await res.json();
      setActivities(json.data ?? json.data?.data ?? []);
      setLastPage(json.data?.last_page ?? json.meta?.last_page ?? 1);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadActivities(page); }, [loadActivities, page]);

  const groupByDate = (items: ActivityItem[]) => {
    const groups: Record<string, ActivityItem[]> = {};
    for (const item of items) {
      const date = new Date(item.created_at).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
      (groups[date] ??= []).push(item);
    }
    return groups;
  };

  const groups = groupByDate(activities);
  const dates = Object.keys(groups);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="h-6 w-6" />
            Activity Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your recent activity on the platform</p>
        </div>
        <button
          onClick={() => loadActivities(page)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && activities.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No activity yet</p>
          <p className="text-xs mt-1">Your actions will appear here as you use the platform</p>
        </div>
      )}

      {!loading && !error && activities.length > 0 && (
        <>
          {dates.map((date) => (
            <div key={date} className="mb-6">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{date}</h2>
              <div className="space-y-2">
                {groups[date].map((item) => {
                  const Icon = ACTIVITY_ICONS[item.type] ?? History;
                  const color = ACTIVITY_COLORS[item.type] ?? "bg-gray-500/20 text-gray-400";
                  return (
                    <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{item.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(item.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {lastPage > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
              <button
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page === lastPage}
                className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
