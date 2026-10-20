import { useState, useEffect } from "react";
import { Graph as TrendingUp, N2User as Users } from "@/components/icons";
import { Spinner as Loader2, Storefront, CurrencyDollar as DollarSign } from "@/components/icons/rounded";;
import { authFetch } from "@/lib/api/authFetch";



interface EcosystemMetrics {
  total_users?: number;
  new_users_30d?: number;
  active_creators?: number;
  gmv_30d?: number;
  signups_by_day: { date: string; count: number }[];
}


function authHeaders() {
  return { Accept: "application/json", "Content-Type": "application/json", };
}

export default function AdminEcosystemGrowthPage() {
  const [metrics, setMetrics] = useState<EcosystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`/securegate/analytics/growth`, { headers: authHeaders() });
        if (!res.ok) throw new Error();
        const j = await res.json();
        const d = j?.success ? j?.data : j;
        setMetrics(d);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-24"><Loader2 weight="fill" className="h-8 w-8 animate-spin text-[var(--shell-accent)] dark:text-[var(--shell-accent)]" /></div>;

  const cards = [
    { label: "Total Users", value: metrics?.total_users ?? 0, icon: <Users weight="fill" className="h-5 w-5" />, color: "text-[var(--shell-accent)]" },
    { label: "New Users (30d)", value: metrics?.new_users_30d ?? 0, icon: <TrendingUp weight="fill" className="h-5 w-5" />, color: "text-emerald-400" },
    { label: "Active Creators", value: metrics?.active_creators ?? 0, icon: <Storefront weight="fill" className="h-5 w-5" />, color: "text-purple-400" },
    { label: "GMV (30d)", value: metrics?.gmv_30d ? `$${metrics.gmv_30d.toLocaleString()}` : "$0", icon: <DollarSign weight="fill" className="h-5 w-5" />, color: "text-amber-400" },
  ];

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-4 lg:p-10">
      <div><h1 className="text-xl font-black tracking-tight flex items-center gap-2.5"><TrendingUp weight="fill" className="h-6 w-6 text-[var(--shell-accent)] dark:text-[var(--shell-accent)]" /> Ecosystem Growth</h1><p className="text-xs text-muted-foreground mt-1">Platform growth and user acquisition metrics.</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="border-none rounded-lg bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <span className={c.color}>{c.icon}</span>
            </div>
            <p className="text-xl font-black text-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      {metrics?.signups_by_day && metrics.signups_by_day.length > 0 && (
        <div className="border-none rounded-lg bg-card p-4">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Signups (Last 30 Days)</h2>
          <div className="flex items-end gap-1 h-24">
            {metrics.signups_by_day.map((d, i) => {
              const max = Math.max(...metrics.signups_by_day.map((x: { count: number }) => x.count));
              return <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-sm bg-[var(--shell-accent-solid)]/30 hover:bg-[var(--shell-accent-solid)]/50 transition-colors" style={{ height: `${max ? (d.count / max) * 100 : 0}%` }} title={`${d.date}: ${d.count} signups`} />
              </div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
