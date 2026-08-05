import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, FileText, Loader2, Trash2, RefreshCw } from "lucide-react";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface ScheduledItem {
  id: number;
  title: string;
  type: string;
  status: string;
  scheduled_at: string;
  day: string;
  date: string;
  community: string | null;
}

export default function ContentPlannerPage() {
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/content-planner/upcoming`, { headers: getAuthHeaders() });
      if (!res.ok) { setError("Failed to load content plan"); return; }
      const json = await res.json();
      setScheduled(json.data ?? []);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const handleUnschedule = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/content-planner/${id}/unschedule`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      setScheduled((prev) => prev.filter((s) => s.id !== id));
    } catch { /* ignore */ }
  };

  const groupByDate = (items: ScheduledItem[]) => {
    const groups: Record<string, ScheduledItem[]> = {};
    for (const item of items) {
      const d = new Date(item.scheduled_at).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      (groups[d] ??= []).push(item);
    }
    return groups;
  };

  const groups = groupByDate(scheduled);
  const dates = Object.keys(groups);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Content Planner
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Schedule and manage your upcoming posts</p>
        </div>
        <button
          onClick={() => loadPlan()}
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

      {!loading && !error && scheduled.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No scheduled content</p>
          <p className="text-xs mt-1">Schedule a post from the Content Studio to see it here</p>
        </div>
      )}

      {!loading && !error && scheduled.length > 0 && (
        <div className="space-y-6">
          {dates.map((date) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {date}
              </h2>
              <div className="space-y-2">
                {groups[date].map((item) => (
                  <div key={item.id} className="flex items-start gap-4 rounded-lg border border-border/50 bg-card p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {item.scheduled_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(item.scheduled_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {item.community && (
                          <span>{item.community}</span>
                        )}
                        <span className="rounded-full bg-amber-500/10 text-amber-400 px-2 py-0.5 text-[10px] font-medium">
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleUnschedule(item.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remove from schedule"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
