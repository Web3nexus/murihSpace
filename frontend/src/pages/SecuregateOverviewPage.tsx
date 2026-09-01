import { useState, useEffect } from 'react';
import {
  TrendingUp, Users, Wallet, Coins,
  UserCheck, AlertCircle, ArrowUpRight, RefreshCw,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';

const COLORS = ['#2164b6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#EC4899'];

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '\u20A6',
  USD: '$',
  GBP: '\u00A3',
  EUR: '\u20AC',
  GHS: 'GH\u20B5',
  KES: 'KSh',
  ZAR: 'R',
  XOF: 'CFA',
};

const SUPPORTED_CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR', 'XOF'];

interface OverviewData {
  users: { total: number; creators: number; members: number; verified_kyc: number; pending_kyc: number };
  content: { digital_products: number; published_products: number; physical_products: number; communities: number; public_communities: number };
  revenue: { digital_revenue: number; digital_orders: number; mrr: number; active_subscriptions: number; total_subscriptions: number };
  subscriptions: { total_plans: number; active_plans: number };
  wallet: { platform_balance: number; user_balances: number };
}

interface TrendData {
  user_growth: { date: string; count: number }[];
  revenue_trend: { date: string; revenue: number; orders: number }[];
  subscription_trend: { date: string; count: number }[];
}

interface TopContent {
  top_digital_products: { id: number; title: string; price: number; currency: string; sales_count: number; status: string }[];
  top_communities: { id: number; name: string; slug: string; members_count: number; category: string }[];
  top_creators: { id: number; name: string; username: string; product_count: number; plan_count: number; subscriber_count: number }[];
}

function MetricCard({ label, value, icon: Icon, trend, trendUp, color, sparklineColor = "#2164b6" }: {
  label: string; value: string; icon: React.ElementType; trend?: string; trendUp?: boolean; color: string; sparklineColor?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded-xl p-2.5 ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
      </div>
      <div className="flex items-end justify-between mt-3">
        <div>
          <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{value}</div>
          {trend && (
            <div className={`flex items-center gap-1 text-[11px] font-bold mt-1 ${trendUp ? 'text-emerald-500' : 'text-muted-foreground'}`}>
              {trendUp && <ArrowUpRight className="h-3 w-3" />}
              <span>{trend}</span>
            </div>
          )}
        </div>
        <svg className="w-16 h-8 stroke-current fill-none shrink-0" style={{ color: sparklineColor }} viewBox="0 0 60 30" strokeWidth="2.5">
          <path d={trendUp ? "M 0,25 Q 15,10 30,18 T 60,5" : "M 0,10 Q 15,22 30,12 T 60,25"} strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

function formatCurrency(amount: number, currency = 'NGN'): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount / 100).replace('$', sym);
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

const chartTooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  fontSize: '12px',
  color: 'hsl(var(--foreground))',
};

export function SecuregateOverviewPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [topContent, setTopContent] = useState<TopContent | null>(null);
  const [pendingRoleApps, setPendingRoleApps] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'content'>('overview');
  const [currency, setCurrency] = useState('NGN');

  const fetchAll = async (currencyCode: string) => {
    setLoading(true);
    setError(null);
    try {
      const q = `?currency=${encodeURIComponent(currencyCode)}`;
      const [oRes, tRes, cRes, dashRes] = await Promise.all([
        apiClient.get(`/securegate/analytics/overview${q}`),
        apiClient.get(`/securegate/analytics/trends${q}&days=30`),
        apiClient.get(`/securegate/analytics/top-content${q}`),
        apiClient.get(`/securegate/dashboard`),
      ]);
      const extract = (res: { data: { success?: boolean; data?: unknown } }) => res.data?.success ? res.data.data : res.data;
      setOverview(extract(oRes) as OverviewData);
      setTrends(extract(tRes) as TrendData);
      setTopContent(extract(cRes) as TopContent);

      const dashData = dashRes.data;
      if (dashData?.operations?.pending_role_applications !== undefined) {
        setPendingRoleApps(dashData.operations.pending_role_applications);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiClient.get('/securegate/settings')
      .then((res) => {
        const data = res.data?.data?.data ?? res.data?.data ?? res.data;
        const def = (data as { default_currency?: string } | undefined)?.default_currency;
        return def && SUPPORTED_CURRENCIES.includes(def) ? def : 'NGN';
      })
      .catch(() => 'NGN')
      .then((def: string) => {
        setCurrency(def);
        fetchAll(def);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Loading command center…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={() => fetchAll(currency)} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">Retry</button>
        </div>
      </div>
    );
  }

  const userPie = overview ? [
    { name: 'Creators', value: overview.users.creators },
    { name: 'Members', value: overview.users.members },
  ] : [];

  const changeCurrency = (code: string) => {
    setCurrency(code);
    fetchAll(code);
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'trends' as const, label: 'Trends' },
    { id: 'content' as const, label: 'Top Content' },
  ];

  return (
    <div className="w-full min-h-screen bg-background text-foreground">
      <div className="w-full mx-auto max-w-[1400px] space-y-8 p-6 lg:p-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <span className="bg-gradient-to-r from-[#2164b6] to-[#102840] bg-clip-text text-transparent">Command Center</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Real-time platform intelligence</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 ${
                    activeTab === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Coins className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                value={currency}
                onChange={(e) => changeCurrency(e.target.value)}
                disabled={loading}
                className="appearance-none h-9 pl-9 pr-8 rounded-xl border border-border bg-card text-sm font-bold cursor-pointer hover:border-primary/40 disabled:opacity-50 disabled:cursor-wait focus:outline-none"
                aria-label="Analytics currency"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c} — {CURRENCY_SYMBOLS[c]}</option>
                ))}
              </select>
            </div>
            <Button onClick={() => fetchAll(currency)} variant="outline" size="sm" className="gap-1.5 shrink-0">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        {activeTab === 'overview' && overview && (
          <>
            {/* Pending Role Applications Alert Banner */}
            {pendingRoleApps > 0 && (
              <div className="flex items-center justify-between p-4 rounded-2xl border border-[#2164b6]/30 bg-[#2164b6]/10 text-foreground">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#2164b6] text-white">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">
                      {pendingRoleApps} Pending Creator / Role Application{pendingRoleApps > 1 ? 's' : ''}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Users have requested to upgrade to Creator or Vendor accounts and require review.
                    </p>
                  </div>
                </div>
                <a
                  href="/app/securegate/role-applications"
                  className="px-4 py-2 rounded-xl bg-[#2164b6] text-white text-xs font-bold shadow hover:bg-[#1a4f91] transition-all"
                >
                  Review Applications →
                </a>
              </div>
            )}

            {/* Metric Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Total Revenue" value={formatCurrency(overview.revenue.digital_revenue, currency)} trend={`${formatNumber(overview.revenue.digital_orders)} orders`} trendUp icon={TrendingUp} color="bg-[#2164b6]/15 text-[#2164b6] dark:text-[#7ab0ff]" sparklineColor="#10B981" />
              <MetricCard label="Active Subscribers" value={formatNumber(overview.revenue.active_subscriptions)} trend={`${formatCurrency(overview.revenue.mrr, currency)} MRR`} trendUp icon={Users} color="bg-purple-500/15 text-purple-500" sparklineColor="#8B5CF6" />
              <MetricCard label="Platform Balance" value={formatCurrency(overview.wallet.platform_balance, currency)} trend={`${formatCurrency(overview.wallet.user_balances, currency)} in user wallets`} trendUp icon={Wallet} color="bg-amber-500/15 text-amber-500" sparklineColor="#F59E0B" />
              <MetricCard label="Pending KYC" value={formatNumber(overview.users.pending_kyc)} trend={`${formatNumber(overview.users.total)} total users`} icon={UserCheck} color="bg-rose-500/15 text-rose-500" sparklineColor="#EF4444" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Revenue Chart */}
              <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 text-sm font-bold text-muted-foreground uppercase tracking-[0.15em]">Revenue Overview</h3>
                <div className="flex items-center gap-6 mb-6">
                  <div>
                    <p className="text-xs text-muted-foreground/70">Digital Revenue</p>
                    <p className="text-2xl font-black text-foreground">{formatCurrency(overview.revenue.digital_revenue, currency)}</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <p className="text-xs text-muted-foreground/70">Monthly Recurring</p>
                    <p className="text-2xl font-black text-foreground">{formatCurrency(overview.revenue.mrr, currency)}</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <p className="text-xs text-muted-foreground/70">Orders</p>
                    <p className="text-2xl font-black text-foreground">{formatNumber(overview.revenue.digital_orders)}</p>
                  </div>
                </div>
                {trends && trends.revenue_trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={trends.revenue_trend}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2164b6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#2164b6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} />
                      <Area type="monotone" dataKey="revenue" stroke="#2164b6" strokeWidth={2} fill="url(#revenueGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground/40">No revenue data yet</div>
                )}
              </div>

              {/* User Distribution */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 text-sm font-bold text-muted-foreground uppercase tracking-[0.15em]">User Distribution</h3>
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={userPie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                        {userPie.map((_, i) => (
                          <Cell key={i} fill={COLORS[i]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-col gap-2 w-full">
                    {userPie.map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-bold text-foreground">{formatNumber(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Content Stats */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 text-sm font-bold text-muted-foreground uppercase tracking-[0.15em]">Platform Content</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Digital Products', value: overview.content.digital_products, sub: `${overview.content.published_products} published` },
                    { label: 'Physical Products', value: overview.content.physical_products, sub: 'in inventory' },
                    { label: 'Communities', value: overview.content.communities, sub: `${overview.content.public_communities} public` },
                    { label: 'Subscription Plans', value: overview.subscriptions.total_plans, sub: `${overview.subscriptions.active_plans} active` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-border bg-muted/30 p-4">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-xl font-black text-foreground">{formatNumber(item.value)}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/60">{item.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* User Growth Chart */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 text-sm font-bold text-muted-foreground uppercase tracking-[0.15em]">User Growth (30d)</h3>
                {trends && trends.user_growth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={trends.user_growth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Bar dataKey="count" fill="#2164b6" radius={[3, 3, 0, 0]} opacity={0.7} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground/40">No user growth data yet</div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'trends' && trends && (
          <div className="space-y-6">
            {/* Revenue Trend */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-4 text-sm font-bold text-muted-foreground uppercase tracking-[0.15em]">Revenue Trend (30d)</h3>
              {trends.revenue_trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends.revenue_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Line type="monotone" dataKey="revenue" stroke="#2164b6" strokeWidth={2} dot={{ fill: '#2164b6', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground/40">No revenue data yet</div>
              )}
            </div>

            {/* User Growth & Subscription Trends side by side */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 text-sm font-bold text-muted-foreground uppercase tracking-[0.15em]">User Growth</h3>
                {trends.user_growth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={trends.user_growth}>
                      <defs>
                        <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Area type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} fill="url(#userGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground/40">No user data yet</div>
                )}
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 text-sm font-bold text-muted-foreground uppercase tracking-[0.15em]">Subscription Growth</h3>
                {trends.subscription_trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={trends.subscription_trend}>
                      <defs>
                        <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Area type="monotone" dataKey="count" stroke="#8B5CF6" strokeWidth={2} fill="url(#subGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground/40">No subscription data yet</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'content' && topContent && (
          <div className="space-y-6">
            {/* Top Creators */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-4 text-sm font-bold text-muted-foreground uppercase tracking-[0.15em]">Top Creators</h3>
              {topContent.top_creators.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b border-border">
                        <th className="pb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">Creator</th>
                        <th className="pb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">Products</th>
                        <th className="pb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">Plans</th>
                        <th className="pb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">Subscribers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topContent.top_creators.map((c, i) => (
                        <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                              <div>
                                <p className="font-semibold text-foreground">{c.name}</p>
                                <p className="text-[10px] text-muted-foreground/60">@{c.username}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-muted-foreground">{c.product_count}</td>
                          <td className="py-3 text-muted-foreground">{c.plan_count}</td>
                          <td className="py-3">
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">{c.subscriber_count}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground/40">No creators yet</div>
              )}
            </div>

            {/* Top Products & Communities */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 text-sm font-bold text-muted-foreground uppercase tracking-[0.15em]">Top Digital Products</h3>
                {topContent.top_digital_products.length > 0 ? (
                  <div className="space-y-2">
                    {topContent.top_digital_products.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{p.title}</p>
                          <p className="text-[10px] text-muted-foreground/60">{p.sales_count} sales</p>
                        </div>
                        <span className="text-sm font-black text-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency || 'USD', minimumFractionDigits: 2 }).format(p.price / 100)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground/40">No products yet</div>
                )}
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 text-sm font-bold text-muted-foreground uppercase tracking-[0.15em]">Top Communities</h3>
                {topContent.top_communities.length > 0 ? (
                  <div className="space-y-2">
                    {topContent.top_communities.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground/60">{c.category}</p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">{c.members_count} members</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground/40">No communities yet</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
