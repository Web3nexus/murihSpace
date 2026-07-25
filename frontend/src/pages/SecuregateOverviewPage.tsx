import { useState, useEffect } from 'react';
import {
  ShieldAlert, Users, Store, Package, Wallet, Flag,
  TrendingUp, CheckCircle2, Loader2,
} from 'lucide-react';
import type { AdminStats } from '@/types/admin';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
const authHeaders = () => {
  const t = localStorage.getItem('auth_token') || localStorage.getItem('murihspace-token');
  return { Accept: 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

export function SecuregateOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/securegate/dashboard`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => setStats(j?.data ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-secondary" /></div>;

  const cards = [
    { label: 'Total Users', value: stats?.users.total ?? 0, icon: Users, color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950', sub: `${stats?.users.active ?? 0} active` },
    { label: 'Pending KYC', value: stats?.users.pending_kyc ?? 0, icon: ShieldAlert, color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950', sub: `${stats?.users.suspended ?? 0} suspended` },
    { label: 'Products', value: stats?.store.total_products ?? 0, icon: Package, color: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950', sub: `${stats?.store.published_products ?? 0} published` },
    { label: 'Orders', value: stats?.commerce.total_orders ?? 0, icon: Store, color: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-950', sub: `${stats?.commerce.completed_orders ?? 0} completed` },
    { label: 'Revenue', value: `$${Number(stats?.commerce.revenue ?? 0).toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950', sub: 'total completed' },
    { label: 'Pending Withdrawals', value: stats?.operations.pending_withdrawals ?? 0, icon: Wallet, color: 'text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-950', sub: `${stats?.operations.pending_reports ?? 0} pending reports` },
    { label: 'Platform Balance', value: `${((stats?.wallet.platform_balance ?? 0) / 100).toFixed(2)} NGN`, icon: Flag, color: 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950', sub: `${((stats?.wallet.user_balances ?? 0) / 100).toFixed(2)} NGN in user wallets` },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
          <ShieldAlert className="h-6 w-6 text-secondary" />
          Securegate
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Platform administration dashboard.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="border border-border rounded-2xl bg-card p-4 shadow-sm flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${c.color} shrink-0`}><c.icon className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">{c.label}</p>
              <p className="text-xl font-black text-foreground">{c.value}</p>
              <p className="text-[10px] text-muted-foreground">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-2xl bg-card p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-black text-foreground">Recent Activity</h2>
        {(!stats?.recent_activity || stats.recent_activity.length === 0) ? (
          <p className="text-xs text-muted-foreground">No recent activity.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {stats.recent_activity.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="font-medium text-foreground">{a.action}</span>
                  {a.user_name && <span className="text-muted-foreground">by {a.user_name}</span>}
                </div>
                <span className="text-muted-foreground">{a.created_at}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
