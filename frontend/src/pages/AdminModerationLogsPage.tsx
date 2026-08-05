import { useState, useEffect, useCallback } from "react";
import { Shield, Loader2, AlertCircle } from "lucide-react";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

interface LogEntry {
  id: number; user_name: string; action: string; resource_type: string;
  resource_id: string; metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function AdminModerationLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const loadData = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/securegate/moderation-logs?page=${page}&per_page=20`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load moderation logs");
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setLogs(Array.isArray(list?.data ?? list) ? (list?.data ?? list) : []);
      setLastPage(j.data?.last_page ?? j.data?.data?.last_page ?? 1);
    } catch (e) { setFetchError(e instanceof Error ? e.message : "Failed to load moderation logs"); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div><h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5"><Shield className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Moderation Logs</h1><p className="text-xs text-muted-foreground mt-1">View content moderation history.</p></div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setLoading(true); loadData(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      {logs.length === 0 && !fetchError ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card"><Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><h3 className="text-sm font-bold">No logs</h3></div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border">
                <tr className="text-left">{["User", "Action", "Resource", "Details", "Date"].map((h) => <th key={h} className="px-4 py-3 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{l.user_name}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">{l.action}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{l.resource_type} #{l.resource_id}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{l.metadata ? JSON.stringify(l.metadata) : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Previous</button>
          <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
          <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
