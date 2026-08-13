import { getAuthToken } from "@/lib/auth/token";
import { useState, useEffect, useCallback } from "react";
import { BarChart3, Loader2, Users, ShoppingCart, CreditCard, Repeat, ArrowRight, AlertCircle } from "lucide-react";
import { authFetch } from "@/lib/api/authFetch";



function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export default function AdminConversionMetricsPage() {
  const [funnel, setFunnel] = useState<any>(null);
  const [rates, setRates] = useState<any>(null);
  const [totals, setTotals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await authFetch(`/securegate/analytics/conversions`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load conversion metrics");
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      setFunnel(d?.data?.funnel ?? d?.funnel ?? d);
      setRates(d?.data?.conversion_rates ?? d?.conversion_rates ?? null);
      setTotals(d?.data?.totals ?? d?.totals ?? null);
    } catch (e) { setFetchError(e instanceof Error ? e.message : "Failed to load metrics"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;

  const steps = [
    { label: "Visitors", value: funnel?.visitors ?? 0, icon: Users, color: "bg-blue-500" },
    { label: "Creators", value: funnel?.creators ?? 0, icon: BarChart3, color: "bg-violet-500" },
    { label: "Vendors", value: funnel?.vendors ?? 0, icon: ShoppingCart, color: "bg-amber-500" },
    { label: "First Order", value: funnel?.first_order ?? 0, icon: CreditCard, color: "bg-emerald-500" },
    { label: "Repeat Buyer", value: funnel?.repeat_order ?? 0, icon: Repeat, color: "bg-rose-500" },
  ];

  const maxVal = Math.max(...steps.map(s => s.value), 1);

  const rateCards = rates ? [
    { label: "Signup → Creator", value: `${rates.signup_to_creator}%` },
    { label: "Creator → Seller", value: `${rates.creator_to_seller}%` },
    { label: "Checkout Completion", value: `${rates.checkout_completion}%` },
    { label: "Order Completion", value: `${rates.order_completion}%` },
  ] : [];

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div><h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5"><BarChart3 className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Conversion Metrics</h1><p className="text-xs text-muted-foreground mt-1">Platform conversion funnel analytics.</p></div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setLoading(true); loadData(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      <div className="space-y-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const pct = (s.value / maxVal) * 100;
          return (
            <div key={s.label} className="relative">
              <div className="flex items-center gap-4 px-4 py-3 border border-border rounded-2xl bg-card relative z-10">
                <div className={`p-2 rounded-xl ${s.color}/20`}><Icon className={`h-4 w-4 ${s.color.replace('bg-', 'text-')}`} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-foreground">{s.label}</span>
                    <span className="text-sm font-black text-foreground">{s.value.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${s.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="flex justify-center -mt-2 mb-1 relative z-0">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {rateCards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {rateCards.map(r => (
            <div key={r.label} className="border border-border rounded-2xl bg-card p-4 text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{r.label}</p>
              <p className="text-xl font-black text-[#2164b6] dark:text-[#7ab0ff]">{r.value}</p>
            </div>
          ))}
        </div>
      )}

      {totals && (
        <div className="border border-border rounded-2xl bg-card p-5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Totals</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div><p className="text-xs text-muted-foreground">Users</p><p className="text-lg font-black text-foreground">{totals.total_users?.toLocaleString()}</p></div>
            <div><p className="text-xs text-muted-foreground">Creators</p><p className="text-lg font-black text-foreground">{totals.total_creators?.toLocaleString()}</p></div>
            <div><p className="text-xs text-muted-foreground">Orders</p><p className="text-lg font-black text-foreground">{totals.total_orders?.toLocaleString()}</p></div>
            <div><p className="text-xs text-muted-foreground">Completed</p><p className="text-lg font-black text-foreground">{totals.completed_orders?.toLocaleString()}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
