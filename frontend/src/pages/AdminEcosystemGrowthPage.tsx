import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Loader2, Users, Store, DollarSign } from "lucide-react";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export default function AdminEcosystemGrowthPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/securegate/analytics/growth`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      setMetrics(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  const cards = [
    { label: "Total Users", value: metrics?.total_users ?? 0, icon: <Users className="h-5 w-5" />, color: "text-blue-400" },
    { label: "New Users (30d)", value: metrics?.new_users_30d ?? 0, icon: <TrendingUp className="h-5 w-5" />, color: "text-emerald-400" },
    { label: "Active Creators", value: metrics?.active_creators ?? 0, icon: <Store className="h-5 w-5" />, color: "text-purple-400" },
    { label: "GMV (30d)", value: metrics?.gmv_30d ? `$${metrics.gmv_30d.toLocaleString()}` : "$0", icon: <DollarSign className="h-5 w-5" />, color: "text-amber-400" },
  ];

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div><h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5"><TrendingUp className="h-6 w-6 text-[#38A8D8]" /> Ecosystem Growth</h1><p className="text-xs text-muted-foreground mt-1">Platform growth and user acquisition metrics.</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="border border-border rounded-2xl bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <span className={c.color}>{c.icon}</span>
            </div>
            <p className="text-2xl font-black text-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      {metrics?.signups_by_day && metrics.signups_by_day.length > 0 && (
        <div className="border border-border rounded-2xl bg-card p-6">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Signups (Last 30 Days)</h2>
          <div className="flex items-end gap-1 h-24">
            {metrics.signups_by_day.map((d: any, i: number) => {
              const max = Math.max(...metrics.signups_by_day.map((x: any) => x.count));
              return <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-sm bg-[#38A8D8]/30 hover:bg-[#38A8D8]/50 transition-colors" style={{ height: `${max ? (d.count / max) * 100 : 0}%` }} title={`${d.date}: ${d.count} signups`} />
              </div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
