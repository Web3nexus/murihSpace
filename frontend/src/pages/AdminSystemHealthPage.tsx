import { useState, useEffect, useCallback, useRef } from "react";
import { Activity, Loader2, CheckCircle2, AlertTriangle, XCircle, RefreshCw, AlertCircle } from "lucide-react";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

interface HealthCheck {
  service: string; status: "healthy" | "degraded" | "down"; latency_ms: number; last_checked: string;
}

export default function AdminSystemHealthPage() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async (showSpinner = false) => {
    setFetchError(null);
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/securegate/system-health`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load health data");
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      const svc = d?.services ?? d?.data?.services ?? {};
      const arr: HealthCheck[] = Object.entries(svc).map(([service, status]) => ({
        service,
        status: (status === "connected" || status === "responsive") ? "healthy" : "down",
        latency_ms: 0,
        last_checked: d?.last_check ?? new Date().toISOString(),
      }));
      setChecks(arr);
    } catch (e) { setFetchError(e instanceof Error ? e.message : "Failed to load health data"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    intervalRef.current = setInterval(loadData, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadData]);

  const STATUS_ICON = { healthy: <CheckCircle2 className="h-4 w-4 text-emerald-400" />, degraded: <AlertTriangle className="h-4 w-4 text-amber-400" />, down: <XCircle className="h-4 w-4 text-rose-400" /> };
  const STATUS_COLOR = { healthy: "bg-emerald-500/20 text-emerald-400", degraded: "bg-amber-500/20 text-amber-400", down: "bg-rose-500/20 text-rose-400" };

  const total = checks.length;
  const healthy = checks.filter((c) => c.status === "healthy").length;

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5"><Activity className="h-6 w-6 text-[#38A8D8]" /> System Health</h1><p className="text-xs text-muted-foreground mt-1">Monitor platform system health and uptime.</p></div>
        <button onClick={() => loadData(true)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-bold"><RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => loadData(true)} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-border rounded-2xl bg-card p-5"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Services</p><p className="text-2xl font-black text-foreground mt-1">{total}</p></div>
        <div className="border border-border rounded-2xl bg-card p-5"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Healthy</p><p className="text-2xl font-black text-emerald-400 mt-1">{healthy}</p></div>
        <div className="border border-border rounded-2xl bg-card p-5"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Uptime</p><p className="text-2xl font-black text-foreground mt-1">{total ? Math.round(healthy / total * 100) : 0}%</p></div>
      </div>

      {checks.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card"><Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><h3 className="text-sm font-bold">No data</h3></div>
      ) : (
        <div className="space-y-2">
          {checks.map((c) => (
            <div key={c.service} className="flex items-center justify-between px-4 py-3 border border-border rounded-2xl bg-card hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                {STATUS_ICON[c.status]}
                <div><p className="text-sm font-bold text-foreground">{c.service}</p><p className="text-[10px] text-muted-foreground">Last checked: {new Date(c.last_checked).toLocaleString()}</p></div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLOR[c.status]}`}>{c.status}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{c.latency_ms}ms</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
