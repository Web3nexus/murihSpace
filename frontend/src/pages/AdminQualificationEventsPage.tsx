import { useState, useEffect } from "react";
import {
  RefreshCwIcon,
  SendIcon,
  ClockIcon,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

interface QualificationEvent {
  id: number;
  user: {
    id: number;
    name: string;
    username: string;
    email: string;
  };
  snapshot?: {
    combined_followers: number;
    provider_breakdown: Record<string, number>;
  };
  status: "pending" | "notified" | "accepted" | "declined" | "expired";
  scheduled_at: string | null;
  notified_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export default function AdminQualificationEventsPage() {
  const [events, setEvents] = useState<QualificationEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [notifyingId, setNotifyingId] = useState<number | null>(null);

  useEffect(() => {
    fetchEvents();
  }, [statusFilter]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const url = statusFilter
        ? `/api/v1/securegate/creator-qualification/events?status=${statusFilter}`
        : "/api/v1/securegate/creator-qualification/events";
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const d = await res.json();
        setEvents(d.data || []);
      } else {
        toast.error("Failed to load qualification events.");
      }
    } catch (e) {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualNotify = async (id: number) => {
    setNotifyingId(id);
    try {
      const res = await fetch(`/api/v1/securegate/creator-qualification/events/${id}/notify`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        toast.success("Outreach notification job dispatched!");
        fetchEvents();
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to notify.");
      }
    } catch (e) {
      toast.error("Error dispatching notification.");
    } finally {
      setNotifyingId(null);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ClockIcon className="h-3 w-3" /> Scheduled
          </span>
        );
      case "notified":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <SendIcon className="h-3 w-3" /> Notified
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2Icon className="h-3 w-3" /> Accepted
          </span>
        );
      case "expired":
      case "declined":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            <XCircleIcon className="h-3 w-3" /> {status}
          </span>
        );
      default:
        return <span className="text-xs">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Creator Qualification Events</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor automated outreach jobs triggered when users reach social follower thresholds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="notified">Notified</option>
            <option value="accepted">Accepted</option>
            <option value="expired">Expired</option>
          </select>
          <button
            onClick={fetchEvents}
            className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition"
          >
            <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Follower Total</th>
                <th className="px-4 py-3">Breakdown</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Scheduled / Notified</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    <RefreshCwIcon className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading qualification events...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No qualification events found.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3 font-medium">
                      <div className="font-semibold text-foreground">{ev.user?.name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">@{ev.user?.username || ev.user?.email}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground">
                      {(ev.snapshot?.combined_followers || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {ev.snapshot?.provider_breakdown ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(ev.snapshot.provider_breakdown).map(([prov, count]) => (
                            <span key={prov} className="px-2 py-0.5 bg-muted rounded capitalize">
                              {prov}: {Number(count).toLocaleString()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{statusBadge(ev.status)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {ev.notified_at
                        ? `Notified ${new Date(ev.notified_at).toLocaleDateString()}`
                        : ev.scheduled_at
                        ? `Scheduled ${new Date(ev.scheduled_at).toLocaleDateString()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(ev.status === "pending" || ev.status === "notified") && (
                        <button
                          onClick={() => handleManualNotify(ev.id)}
                          disabled={notifyingId === ev.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-medium text-xs rounded-lg transition disabled:opacity-50"
                        >
                          <SendIcon className="h-3.5 w-3.5" />
                          {notifyingId === ev.id ? "Sending..." : "Notify Now"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
