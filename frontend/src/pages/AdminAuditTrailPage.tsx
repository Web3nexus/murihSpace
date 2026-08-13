import { getAuthToken } from "@/lib/auth/token";
import { useState, useEffect, useCallback } from "react";
import { ClipboardList, Loader2, Search, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/authFetch";



function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export default function AdminAuditTrailPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const loadData = useCallback(async () => {
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("per_page", "20");
      const res = await authFetch(`/securegate/audit-trail?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load audit trail");
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setLogs(list?.data ?? list ?? []);
      setLastPage(j.data?.last_page ?? j.data?.data?.last_page ?? 1);
    } catch (e) { setFetchError(e instanceof Error ? e.message : "Failed to load audit trail"); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => { setPage(1); }, [search]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div><h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5"><ClipboardList className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Audit Trail</h1><p className="text-xs text-muted-foreground mt-1">View platform audit logs.</p></div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8 text-sm" placeholder="Search audit logs..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setLoading(true); loadData(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      {logs.length === 0 && !fetchError ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card"><ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><h3 className="text-sm font-bold">No audit logs</h3></div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border">
                <tr className="text-left">{["User", "Action", "Resource", "IP Address", "Date"].map((h) => <th key={h} className="px-4 py-3 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {logs.map((l: any) => (
                  <tr key={l.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{l.user?.name ?? l.user_name ?? "—"}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">{l.action}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{l.resource_type ? `${l.resource_type}#${l.resource_id}` : "—"}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{l.ip_address ?? "—"}</td>
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
