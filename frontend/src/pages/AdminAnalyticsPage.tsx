import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  BarChart3, TrendingUp, DollarSign, Users, ShoppingBag, Globe, Crown, Wallet,
  Loader2, Store, ShieldCheck, RefreshCw, CreditCard, Coins,
  ArrowUpRight, ArrowDownRight, Package, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

const PIE_COLORS = ["#2164b6", "#2164b6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "\u20A6",
  USD: "$",
  GBP: "\u00A3",
  EUR: "\u20AC",
  GHS: "GH\u20B5",
  KES: "KSh",
  ZAR: "R",
  XOF: "CFA",
};

const SUPPORTED_CURRENCIES = ["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR", "XOF"];

function formatAmount(cents: number, currency = "NGN"): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency + " ";
  return (sym + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}

function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function StatCard({ icon, label, value, sub, trend }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; trend?: { value: number; isUp: boolean };
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-2.5 hover:border-primary/30 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-muted-foreground/60">{icon}</span>
      </div>
      <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {trend && (
        <p className={`flex items-center gap-1 text-xs font-semibold ${trend.isUp ? "text-emerald-500" : "text-rose-500"}`}>
          {trend.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trend.value}% {trend.isUp ? "up" : "down"}
        </p>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
        active ? "bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] shadow-xs" : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

export function AdminAnalyticsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathTab = location.pathname.split("/").pop() ?? "";
  const tab: "overview" | "growth" | "revenue" | "content" = (
    ["overview", "growth", "revenue", "content"].includes(pathTab) ? pathTab as "overview" | "growth" | "revenue" | "content" : "overview"
  );

  const [overview, setOverview] = useState<any>(null);
  const [topContent, setTopContent] = useState<any>(null);
  const [growth, setGrowth] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("NGN");
  const [loadingCurrency, setLoadingCurrency] = useState(true);

  const fetchAll = useCallback(async (currencyCode: string) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const q = `?currency=${encodeURIComponent(currencyCode)}`;
      const [ovRes, topRes, grRes, revRes] = await Promise.allSettled([
        apiClient.get(`/securegate/analytics/overview${q}`),
        apiClient.get(`/securegate/analytics/top-content${q}`),
        apiClient.get(`/securegate/analytics/growth${q}`),
        apiClient.get(`/securegate/analytics/revenue${q}`),
      ]);
      if (ovRes.status === "fulfilled") setOverview(ovRes.value.data?.data ?? ovRes.value.data);
      if (topRes.status === "fulfilled") setTopContent(topRes.value.data?.data ?? topRes.value.data);
      if (grRes.status === "fulfilled") setGrowth(grRes.value.data?.data ?? grRes.value.data);
      if (revRes.status === "fulfilled") setRevenue(revRes.value.data?.data ?? revRes.value.data);

      const failed = [ovRes, topRes, grRes, revRes].filter(r => r.status === "rejected");
      if (failed.length > 0) setFetchError(`${failed.length} data source(s) failed to load. Some charts may be empty.`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    apiClient.get("/securegate/settings")
      .then((res) => {
        const data = res.data?.data?.data ?? res.data?.data ?? res.data;
        const def = (data as { default_currency?: string } | undefined)?.default_currency;
        if (def && SUPPORTED_CURRENCIES.includes(def)) {
          setCurrency(def);
          return def;
        }
        return "NGN";
      })
      .catch(() => "NGN")
      .then((def: string) => fetchAll(def))
      .finally(() => setLoadingCurrency(false));
  }, [fetchAll]);

  if (isLoading && loadingCurrency) {
    return (
      <div className="w-full flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" />
      </div>
    );
  }

  const setTab = (t: string) => navigate("/app/securegate/analytics/" + t, { replace: true });
  const changeCurrency = (code: string) => {
    setCurrency(code);
    fetchAll(code);
  };

  const tabs = [
    { key: "overview", label: "Overview", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { key: "growth", label: "Growth", icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { key: "revenue", label: "Revenue", icon: <DollarSign className="h-3.5 w-3.5" /> },
    { key: "content", label: "Content", icon: <ShoppingBag className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <span className="px-2.5 py-0.5 rounded-full bg-[#2164b6]/20 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-semibold uppercase tracking-wider border border-[#2164b6]/30">
            Admin
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Platform Analytics</h1>
          <p className="text-sm text-white/70 max-w-xl">Platform-wide metrics, growth trends, and top content.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Coins className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
            <select
              value={currency}
              onChange={(e) => changeCurrency(e.target.value)}
              disabled={isLoading}
              className="appearance-none h-9 pl-9 pr-8 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold cursor-pointer hover:bg-white/15 transition-colors disabled:opacity-50 disabled:cursor-wait focus:outline-none"
              aria-label="Analytics currency"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c} className="text-slate-900">{c} — {CURRENCY_SYMBOLS[c]}</option>
              ))}
            </select>
          </div>
          <Button onClick={() => fetchAll(currency)} variant="secondary" size="sm" className="gap-1.5 shrink-0">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => fetchAll(currency)} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      <div className="flex gap-2 border-b border-border pb-3 overflow-x-auto">
        {tabs.map((t) => (
          <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            <span className="flex items-center gap-1.5">{t.icon}{t.label}</span>
          </TabButton>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab overview={overview} topContent={topContent} currency={currency} />
      )}

      {tab === "growth" && <GrowthTab data={growth} currency={currency} />}

      {tab === "revenue" && <RevenueTab data={revenue} currency={currency} />}

      {tab === "content" && <ContentTab data={topContent} />}
    </div>
  );
}

function OverviewTab({ overview, topContent, currency }: { overview: any; topContent: any; currency: string }) {
  const stats = [
    { label: "Total Users", value: compact(overview?.users?.total ?? 0), sub: `${compact(overview?.users?.creators ?? 0)} creators \u00B7 ${compact(overview?.users?.members ?? 0)} members`, icon: <Users className="h-4 w-4" /> },
    { label: "Digital Revenue", value: formatAmount(overview?.revenue?.digital_revenue ?? 0, currency), sub: `${overview?.revenue?.digital_orders ?? 0} orders`, icon: <DollarSign className="h-4 w-4" /> },
    { label: "Monthly Recurring", value: formatAmount(overview?.revenue?.mrr ?? 0, currency), sub: `${overview?.revenue?.active_subscriptions ?? 0} active subs`, icon: <TrendingUp className="h-4 w-4" /> },
    { label: "Platform Balance", value: formatAmount(overview?.wallet?.platform_balance ?? 0, currency), sub: `${formatAmount(overview?.wallet?.user_balances ?? 0, currency)} in user wallets`, icon: <Wallet className="h-4 w-4" /> },
    { label: "Products", value: (overview?.content?.digital_products ?? 0) + (overview?.content?.physical_products ?? 0), sub: `${overview?.content?.published_products ?? 0} published digital \u00B7 ${overview?.content?.physical_products ?? 0} physical`, icon: <Package className="h-4 w-4" /> },
    { label: "Communities", value: overview?.content?.communities ?? 0, sub: `${overview?.content?.public_communities ?? 0} public`, icon: <Globe className="h-4 w-4" /> },
    { label: "KYC Verified", value: overview?.users?.verified_kyc ?? 0, sub: `${overview?.users?.pending_kyc ?? 0} pending`, icon: <ShieldCheck className="h-4 w-4" /> },
    { label: "Subscription Plans", value: overview?.subscriptions?.active_plans ?? 0, sub: `${overview?.subscriptions?.total_plans ?? 0} total`, icon: <Crown className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.isArray(topContent?.top_digital_products) && topContent.top_digital_products.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" /> Top Digital Products
            </h3>
            <div className="space-y-2.5">
              {topContent.top_digital_products.slice(0, 5).map((p: any, i: number) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                    <span className="text-foreground font-medium truncate">{p.title}</span>
                  </div>
                  <span className="text-muted-foreground shrink-0 ml-2">{p.sales_count ?? 0} sales</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(topContent?.top_creators) && topContent.top_creators.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
              <Crown className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" /> Top Creators
            </h3>
            <div className="space-y-2.5">
              {topContent.top_creators.slice(0, 5).map((c: any, i: number) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                    <span className="text-foreground font-medium truncate">@{c.username}</span>
                  </div>
                  <span className="text-muted-foreground shrink-0 ml-2">{c.subscriber_count} subs</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(topContent?.top_communities) && topContent.top_communities.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" /> Top Communities
            </h3>
            <div className="space-y-2.5">
              {topContent.top_communities.slice(0, 5).map((c: any, i: number) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                    <span className="text-foreground font-medium truncate">{c.name}</span>
                  </div>
                  <span className="text-muted-foreground shrink-0 ml-2">{c.members_count} members</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GrowthTab({ data, currency }: { data: any; currency: string }) {
  if (!data) return <p className="text-sm text-muted-foreground">No growth data available.</p>;

  const signups = Array.isArray(data.signups_by_day) ? data.signups_by_day : [];
  const roleData = (Array.isArray(data.role_breakdown) ? data.role_breakdown : []).map((r: any) => ({ name: r.role, value: parseInt(r.count) }));
  const kyc = data.kyc_stats ?? {};
  const kycTotal = (kyc.verified ?? 0) + (kyc.pending ?? 0) + (kyc.none ?? 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={compact(data.total_users ?? 0)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="New Users (30d)" value={compact(data.new_users_30d ?? 0)} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Active Creators" value={compact(data.active_creators ?? 0)} icon={<Store className="h-4 w-4" />} />
        <StatCard label="GMV (30d)" value={formatAmount(data.gmv_30d ?? 0, currency)} icon={<DollarSign className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Daily Signups ({signups.length} days)</h3>
          {signups.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={signups}>
                <defs>
                  <linearGradient id="signupGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2164b6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2164b6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                <Area type="monotone" dataKey="count" stroke="#2164b6" fill="url(#signupGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No signup data in this period.</p>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Users by Role</h3>
            {roleData.length > 0 ? (
              <div className="flex items-center gap-6">
                <div className="shrink-0">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={roleData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" paddingAngle={2}>
                        {roleData.map((_: any, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {roleData.map((r: any, i: number) => (
                    <div key={r.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground capitalize">{r.name}</span>
                      <span className="font-bold text-foreground ml-auto">{compact(r.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No user data.</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">KYC Status</h3>
            <div className="space-y-3">
              {[
                { label: "Verified", value: kyc.verified ?? 0, pct: kycTotal > 0 ? Math.round(((kyc.verified ?? 0) / kycTotal) * 100) : 0, color: "bg-emerald-500" },
                { label: "Pending", value: kyc.pending ?? 0, pct: kycTotal > 0 ? Math.round(((kyc.pending ?? 0) / kycTotal) * 100) : 0, color: "bg-amber-500" },
                { label: "Not Submitted", value: kyc.none ?? 0, pct: kycTotal > 0 ? Math.round(((kyc.none ?? 0) / kycTotal) * 100) : 0, color: "bg-slate-400" },
              ].map((k) => (
                <div key={k.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{k.label}</span>
                    <span className="font-bold text-foreground">{compact(k.value)} ({k.pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${k.color} transition-all`} style={{ width: `${k.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueTab({ data, currency }: { data: any; currency: string }) {
  if (!data) return <p className="text-sm text-muted-foreground">No revenue data available.</p>;

  const trend = Array.isArray(data.revenue_trend) ? data.revenue_trend : [];
  const bySource = data.revenue_by_source ?? {};

  const sourceData = Object.entries(bySource).map(([k, v]) => ({
    name: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: Math.round(parseFloat(v as string)),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Digital Revenue" value={formatAmount(data.digital_revenue ?? 0, currency)} sub={`${data.digital_orders ?? 0} orders`} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="MRR" value={formatAmount(data.mrr ?? 0, currency)} sub={`${data.active_subscriptions ?? 0} active subs`} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Platform Fees" value={formatAmount(data.platform_fees ?? 0, currency)} icon={<CreditCard className="h-4 w-4" />} />
        <StatCard label="Pending Payouts" value={formatAmount(data.pending_payouts ?? 0, currency)} icon={<Wallet className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Monthly Revenue Trend</h3>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatAmount(v * 100, currency)} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(value: any) => [formatAmount(Number(value) * 100, currency), "Revenue"]} />
                <Bar dataKey="revenue" fill="#2164b6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No revenue trend data available.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Revenue by Source</h3>
          {sourceData.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="shrink-0">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                      {sourceData.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(value: any) => [formatAmount(Number(value), currency), ""]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {sourceData.map((s: any, i: number) => (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-muted-foreground">{s.name}</span>
                    <span className="font-bold text-foreground ml-auto">{formatAmount(s.value, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No revenue source data.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ContentTab({ data }: { data: any }) {
  if (!data) return <p className="text-sm text-muted-foreground">No content data available.</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" /> Top Digital Products
        </h3>
        <div className="space-y-3">
          {Array.isArray(data.top_digital_products) && data.top_digital_products.length > 0 ? (
            data.top_digital_products.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                  <span className="text-foreground font-medium truncate">{p.title}</span>
                </div>
                <span className="text-muted-foreground shrink-0 ml-2 text-xs">{p.sales_count ?? 0} sales</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No products yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <Crown className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" /> Top Creators
        </h3>
        <div className="space-y-3">
          {Array.isArray(data.top_creators) && data.top_creators.length > 0 ? (
            data.top_creators.map((c: any, i: number) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-foreground font-medium truncate">@{c.username}</p>
                    <p className="text-[10px] text-muted-foreground">{c.product_count} products</p>
                  </div>
                </div>
                <span className="text-muted-foreground shrink-0 ml-2 text-xs">{c.subscriber_count} subs</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No creators yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" /> Top Communities
        </h3>
        <div className="space-y-3">
          {Array.isArray(data.top_communities) && data.top_communities.length > 0 ? (
            data.top_communities.map((c: any, i: number) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-foreground font-medium truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{c.category ?? "General"}</p>
                  </div>
                </div>
                <span className="text-muted-foreground shrink-0 ml-2 text-xs">{c.members_count} members</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No communities yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
