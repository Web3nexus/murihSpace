import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Users, DollarSign, ShoppingBag, Globe, Loader2, Crown, Wallet, TrendingUp, BookOpen } from 'lucide-react';
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = localStorage.getItem('murihspace-token');
  return { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatAmount(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  return (symbols[currency] ?? currency + ' ') + (amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

export function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [overviewRes, topRes] = await Promise.all([
        fetch(`${API_BASE}/securegate/analytics/overview`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/securegate/analytics/top-content`, { headers: getAuthHeaders() }),
      ]);
      if (overviewRes.ok) { const j = await overviewRes.json(); setData((prev: any) => ({ ...prev, ...(j.data?.data ?? j.data) })); }
      if (topRes.ok) { const j = await topRes.json(); setData((prev: any) => ({ ...prev, ...(j.data?.data ?? j.data) })); }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (isLoading) return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const stats = [
    { label: 'Total Users', value: data?.users?.total ?? 0, sub: `${data?.users?.creators ?? 0} creators · ${data?.users?.members ?? 0} members`, icon: Users, color: 'bg-blue-500/20 text-blue-400' },
    { label: 'Digital Revenue', value: formatAmount(data?.revenue?.digital_revenue ?? 0), sub: `${data?.revenue?.digital_orders ?? 0} orders`, icon: DollarSign, color: 'bg-emerald-500/20 text-emerald-400' },
    { label: 'Monthly Recurring', value: formatAmount(data?.revenue?.mrr ?? 0), sub: `${data?.revenue?.active_subscriptions ?? 0} active subs`, icon: TrendingUp, color: 'bg-purple-500/20 text-purple-400' },
    { label: 'Platform Balance', value: formatAmount(data?.wallet?.platform_balance ?? 0), sub: `${formatAmount(data?.wallet?.user_balances ?? 0)} in user wallets`, icon: Wallet, color: 'bg-amber-500/20 text-amber-400' },
    { label: 'Products', value: (data?.content?.digital_products ?? 0) + (data?.content?.physical_products ?? 0), sub: `${data?.content?.published_products ?? 0} published digital · ${data?.content?.physical_products ?? 0} physical`, icon: ShoppingBag, color: 'bg-rose-500/20 text-rose-400' },
    { label: 'Communities', value: data?.content?.communities ?? 0, sub: `${data?.content?.public_communities ?? 0} public`, icon: Globe, color: 'bg-cyan-500/20 text-cyan-400' },
    { label: 'Subscription Plans', value: data?.subscriptions?.active_plans ?? 0, sub: `${data?.subscriptions?.total_plans ?? 0} total`, icon: Crown, color: 'bg-indigo-500/20 text-indigo-400' },
    { label: 'KYC', value: data?.users?.verified_kyc ?? 0, sub: `${data?.users?.pending_kyc ?? 0} pending`, icon: BookOpen, color: 'bg-teal-500/20 text-teal-400' },
  ];

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <span className="px-2.5 py-0.5 rounded-full bg-[#38A8D8]/20 text-[#38A8D8] text-xs font-semibold uppercase tracking-wider border border-[#38A8D8]/30">Admin</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Platform Analytics</h1>
          <p className="text-sm text-white/70 max-w-xl">Platform-wide metrics, growth trends, and top content.</p>
        </div>
        <Button onClick={fetchAll} variant="secondary" size="sm" className="gap-1.5 shrink-0"><BarChart3 className="h-4 w-4" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</span>
                <div className={`p-2 rounded-xl ${s.color}`}><Icon className="h-4 w-4" /></div>
              </div>
              <p className="text-2xl font-black text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </div>
          );
        })}
      </div>

      {data?.top_digital_products && data.top_digital_products.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Top Digital Products</h3>
          <div className="space-y-2">
            {data.top_digital_products.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">#{i + 1} <span className="text-foreground font-medium">{p.title}</span></span>
                <span className="text-muted-foreground">{p.sales_count ?? 0} sales · {formatAmount(p.price, p.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.top_creators && data.top_creators.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><Crown className="h-4 w-4" /> Top Creators</h3>
          <div className="space-y-2">
            {data.top_creators.map((c: any, i: number) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">#{i + 1} <span className="text-foreground font-medium">@{c.username}</span> ({c.name})</span>
                <span className="text-muted-foreground">{c.product_count} products · {c.plan_count} plans · {c.subscriber_count} subscribers</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.top_communities && data.top_communities.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><Globe className="h-4 w-4" /> Top Communities</h3>
          <div className="space-y-2">
            {data.top_communities.map((c: any, i: number) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">#{i + 1} <span className="text-foreground font-medium">{c.name}</span> ({c.category})</span>
                <span className="text-muted-foreground">{c.members_count} members</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
