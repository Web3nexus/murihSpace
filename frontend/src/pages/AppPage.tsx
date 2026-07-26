import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { AnimatedPage } from "@/components/common/AnimatedPage";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/hooks/useAuth";
import {
  TrendingUp,
  Users,
  Wallet,
  Sparkles,
  Plus,
  MessageSquare,
  AlertCircle,
  Package,
  Calendar,
  ArrowRight,
  Bot,
  MessageCircle,
  HelpCircle,
  Crown,
  Inbox,
  DollarSign,
  Activity,
} from "lucide-react";

function formatPrice(cents: number, currency = "USD"): string {
  const symbols: Record<string, string> = { USD: "$", NGN: "₦", GBP: "£", EUR: "€" };
  const sym = symbols[currency] ?? currency + " ";
  return sym + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function extractData<T>(res: { data: Record<string, unknown> }): T {
  const body = res.data;
  const extracted = (body.success ? body.data : body) as Record<string, unknown>;
  if (extracted && typeof extracted === "object" && "data" in extracted) return extracted.data as T;
  return extracted as unknown as T;
}

function GrowthBadge({ value, period }: { value: number | null; period?: string }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const up = value >= 0;
  return (
    <div className={`flex items-center gap-1 text-[11px] font-bold mt-1 ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
      <TrendingUp className={`h-3 w-3 ${!up ? "rotate-180" : ""}`} />
      <span>{up ? "+" : ""}{value.toFixed(1)}% {period ? <span className="text-muted-foreground font-normal">vs {period}</span> : null}</span>
    </div>
  );
}

function Sparkline({ color, path }: { color: string; path?: string }) {
  return (
    <svg className="w-16 h-8 stroke-current fill-none shrink-0" viewBox="0 0 60 30" strokeWidth="2.5" color={color}>
      <path d={path ?? "M 0,15 Q 15,10 30,15 T 60,12"} strokeLinecap="round" />
    </svg>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-white/10 rounded-lg ${className ?? ""}`} />;
}

// ── Data types ────────────────────────────────────────────────────────────

interface AnalyticsOverview {
  revenue: { total: number; physical: number; digital: number; subscription: number; deals: number; referral: number };
  orders: { total: number; digital: number; physical: number; completed: number };
  products: { total: number };
  audience: { followers: number; subscribers: number; monthly_recurring: number };
  engagement: { rate: number; broadcasts: number; emails_sent: number; referral_clicks: number; referrals: number; active_deals: number };
  growth: { member_since: string; revenue_change_pct: number | null; audience_change_pct: number | null; engagement_change_pct: number | null; orders_change_pct: number | null };
}

interface SalesTrend { date: string; revenue: number; orders: number }
interface TopProduct { name: string; type: string; orders: number; revenue: number }

interface ChatChannel {
  name: string; description: string; type: string; unread: number;
  new_since_last_visit: number; active_members: number; ai_replies: number;
  ai_reply_percentage: number; human_follow_ups: number; priority: string;
}

interface ContentItem { id: number; title: string; date: string; status: string }
interface CommunityActivity { id: number; user_name: string; user_initials: string; action: string; timestamp: string; icon?: string }
interface InboxStats { unread: number; ai_replies: number; human_follow_ups: number; active_conversations: number }
interface WalletOverview { balance: number; currency: string; next_payout_date: string | null; payout_threshold: number; payout_progress: number; payout_ready: boolean }
interface RecentActivity { id: number; type: string; title: string; subtitle: string; timestamp: string }

interface DashboardData {
  overview: AnalyticsOverview | null;
  salesTrends: SalesTrend[];
  topProducts: TopProduct[];
  channels: ChatChannel[];
  contentPlanner: ContentItem[];
  communityActivity: CommunityActivity[];
  inboxStats: InboxStats | null;
  walletOverview: WalletOverview | null;
  recentActivity: RecentActivity[];
  unreadCount: number;
}

// ── Section Loader ────────────────────────────────────────────────────────

// ── Component ─────────────────────────────────────────────────────────────

export function AppPage() {
  const { user } = useAuth();

  const [dashboard, setDashboard] = useState<DashboardData>({
    overview: null, salesTrends: [], topProducts: [], channels: [],
    contentPlanner: [], communityActivity: [], inboxStats: null,
    walletOverview: null, recentActivity: [], unreadCount: 0,
  });

  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const sectionLoading = useMemo(() => {
    return {
      overview: pageLoading,
      trends: pageLoading,
      products: pageLoading,
      channels: pageLoading,
      planner: pageLoading,
      activity: pageLoading,
      inbox: pageLoading,
      wallet: pageLoading,
      recent: pageLoading,
    };
  }, [pageLoading]);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setPageLoading(true);
      setPageError(null);

      try {
        const results = await Promise.allSettled([
          apiClient.get("/analytics/overview"),
          apiClient.get("/analytics/sales-trends"),
          apiClient.get("/analytics/top-products"),
          apiClient.get("/analytics/chat-channels"),
          apiClient.get("/analytics/content-planner"),
          apiClient.get("/analytics/community-activity"),
          apiClient.get("/conversations/stats"),
          apiClient.get("/wallet/overview"),
          apiClient.get("/messages/recent-activity"),
          apiClient.get("/conversations?unread_only=true"),
        ]);

        if (cancelled) return;

        const extract = <T,>(result: PromiseSettledResult<unknown>, fallback: T): T =>
          result.status === "fulfilled" ? extractData<T>(result.value as any) : fallback;

        const d: DashboardData = {
          overview: extract<AnalyticsOverview | null>(results[0], null),
          salesTrends: extract<SalesTrend[]>(results[1], []),
          topProducts: extract<TopProduct[]>(results[2], []),
          channels: extract<ChatChannel[]>(results[3], []),
          contentPlanner: extract<ContentItem[]>(results[4], []),
          communityActivity: extract<CommunityActivity[]>(results[5], []),
          inboxStats: extract<InboxStats | null>(results[6], null),
          walletOverview: extract<WalletOverview | null>(results[7], null),
          recentActivity: extract<RecentActivity[]>(results[8], []),
          unreadCount: 0,
        };

        if (results[9].status === "fulfilled") {
          const d9 = (results[9] as PromiseFulfilledResult<any>).value.data;
          d.unreadCount = Array.isArray(d9) ? d9.length : d9?.data?.length ?? d9?.count ?? 0;
        }

        setDashboard(d);
      } catch {
        if (!cancelled) setPageError("Failed to load dashboard data.");
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────

  const ov = dashboard.overview;
  const trendDates = useMemo(() => {
    if (dashboard.salesTrends.length < 2) return null;
    const items = dashboard.salesTrends;
    return { first: items[0].date, mid: items[Math.floor(items.length / 2)].date, last: items[items.length - 1].date };
  }, [dashboard.salesTrends]);

  // ── Loading / Error ─────────────────────────────────────────────────────

  if (pageError && !ov) {
    return (
      <AnimatedPage className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm font-medium text-foreground">Failed to load dashboard</p>
          <p className="text-xs text-muted-foreground">{pageError}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="w-full space-y-6 p-4 sm:p-6 lg:p-8">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {user?.role === "creator" ? "Creator Dashboard" : "Dashboard"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {user?.role === "creator" ? "Here's what's happening with your brand today." : "Welcome to your dashboard."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground shadow-2xs">
            <Calendar className="h-4 w-4 text-[#38A8D8]" />
            <span>{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>
      </div>

      {/* ── Welcome Banner ── */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-100 dark:border-blue-950 bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/40 dark:from-[#102438] dark:via-[#162f4a] dark:to-[#1a2538] p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-xl">
            <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
              👋 Welcome back, {user?.name?.split(" ")[0] || "there"}! 👋
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {user?.role === "creator"
                ? "You're building something amazing. Keep creating, engaging and growing your community."
                : "Welcome to MurihSpace. Explore and connect with your community."}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/app/communities">
                <Button size="sm" className="bg-[#38A8D8] hover:bg-[#2e94c0] text-white font-semibold rounded-xl shadow-xs gap-2">
                  <Plus className="h-4 w-4" /> Create Post
                </Button>
              </Link>
              <Link to="/app/store">
                <Button size="sm" variant="outline" className="bg-card hover:bg-muted font-semibold rounded-xl gap-2 border-border">
                  <Package className="h-4 w-4 text-muted-foreground" /> Add Product
                </Button>
              </Link>
              <Link to="/app/messages">
                <Button size="sm" variant="outline" className="bg-card hover:bg-muted font-semibold rounded-xl gap-2 border-border">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" /> Open Inbox
                </Button>
              </Link>
            </div>
          </div>
          <div className="hidden md:flex items-center justify-center shrink-0 pr-2">
            <img src="/creator.png" alt="Creator Ecosystem" className="h-36 sm:h-44 w-auto object-contain drop-shadow-lg hover:scale-105 transition-transform duration-300" />
          </div>
        </div>
      </div>

      {/* ── 4 KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          iconBg="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          label="Revenue"
          value={ov?.revenue?.total != null ? formatPrice(ov.revenue.total) : null}
          loading={sectionLoading.overview}
          growth={ov?.growth?.revenue_change_pct ?? null}
          growthPeriod="last period"
          sparkColor="rgb(59,130,246)"
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          iconBg="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          label="Audience"
          value={ov?.audience?.followers != null ? compactNumber(ov.audience.followers) : null}
          loading={sectionLoading.overview}
          growth={ov?.growth?.audience_change_pct ?? null}
          growthPeriod="last period"
          sparkColor="rgb(16,185,129)"
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          iconBg="bg-purple-500/10 text-purple-600 dark:text-purple-400"
          label="Engagement"
          value={ov?.engagement?.rate != null ? ov.engagement.rate.toFixed(2) + "%" : null}
          loading={sectionLoading.overview}
          growth={ov?.growth?.engagement_change_pct ?? null}
          growthPeriod="last period"
          sparkColor="rgb(139,92,246)"
        />
        <KpiCard
          icon={<MessageCircle className="h-4 w-4" />}
          iconBg="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          label="Unread Messages"
          value={dashboard.unreadCount > 0 ? dashboard.unreadCount.toLocaleString() : "0"}
          loading={sectionLoading.overview}
          growth={ov?.growth?.orders_change_pct ?? null}
          growthPeriod="last period"
          sparkColor="rgb(245,158,11)"
        />
      </div>

      {/* ── Main Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: 8 cols */}
        <div className="lg:col-span-8 space-y-6">

          {/* Chat Center */}
          <ChatCenterSection
            channels={dashboard.channels}
            unreadCount={dashboard.unreadCount}
            loading={sectionLoading.channels}
          />

          {/* Revenue Chart */}
          <RevenueChartSection
            revenueVal={ov?.revenue?.total != null ? formatPrice(ov.revenue.total) : null}
            salesTrends={dashboard.salesTrends}
            trendDates={trendDates}
            loading={sectionLoading.trends}
          />

          {/* 3-Column Widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ContentPlannerSection items={dashboard.contentPlanner} loading={sectionLoading.planner} />
            <TopProductsSection products={dashboard.topProducts} loading={sectionLoading.products} />
            <CommunityActivitySection activities={dashboard.communityActivity} loading={sectionLoading.activity} />
          </div>
        </div>

        {/* RIGHT: 4 cols */}
        <div className="lg:col-span-4 space-y-6">
          <AiAssistantCard />
          <InboxWidget stats={dashboard.inboxStats} unreadCount={dashboard.unreadCount} loading={sectionLoading.inbox} />
          <MonetizationWidget wallet={dashboard.walletOverview} loading={sectionLoading.wallet} />
          <ChatActivityWidget activities={dashboard.recentActivity} loading={sectionLoading.recent} />
        </div>
      </div>
    </AnimatedPage>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function KpiCard({
  icon, iconBg, label, value, loading, growth, growthPeriod, sparkColor,
}: {
  icon: React.ReactNode; iconBg: string; label: string; value: string | null;
  loading: boolean; growth: number | null; growthPeriod?: string; sparkColor: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-3 hover:border-primary/30 transition-all">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-xl ${iconBg}`}>{icon}</div>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-36" />
        </div>
      ) : (
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              {value ?? "—"}
            </div>
            <GrowthBadge value={growth} period={growthPeriod} />
          </div>
          <Sparkline color={sparkColor} />
        </div>
      )}
    </div>
  );
}

function ChatCenterSection({ channels, unreadCount, loading }: { channels: ChatChannel[]; unreadCount: number; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h3 className="font-bold text-foreground text-base flex items-center gap-2">
            <MessageSquare className="h-4.5 w-4.5 text-[#38A8D8]" />
            MurihSpace Chat Center
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">All your community conversations in one place</p>
        </div>
        <Link to="/app/messages" className="text-xs font-bold text-[#38A8D8] hover:underline flex items-center gap-1">
          Go to Inbox <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : channels.length === 0 ? (
        <div className="py-8 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No chat channels yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border/60 text-[10px] font-extrabold uppercase tracking-wider">
                <th className="pb-3 font-semibold">Channel</th>
                <th className="pb-3 font-semibold text-center">Unread</th>
                <th className="pb-3 font-semibold text-center">Active</th>
                <th className="pb-3 font-semibold text-center">AI Replies</th>
                <th className="pb-3 font-semibold text-center">Follow-Ups</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {channels.map((ch, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-xs">{ch.name}</p>
                        <p className="text-[11px] text-muted-foreground">{ch.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      {ch.unread} {ch.new_since_last_visit > 0 && <span className="ml-1 text-[9px] text-blue-500">+{ch.new_since_last_visit} new</span>}
                    </span>
                  </td>
                  <td className="py-3.5 text-center font-bold text-foreground">{ch.active_members}</td>
                  <td className="py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-bold text-foreground">{ch.ai_replies}</span>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-md">{ch.ai_reply_percentage}%</span>
                    </div>
                  </td>
                  <td className="py-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-bold text-foreground">{ch.human_follow_ups}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ch.priority === "high" ? "bg-rose-500/10 text-rose-500" :
                        ch.priority === "medium" ? "bg-amber-500/10 text-amber-500" :
                        "bg-emerald-500/10 text-emerald-500"
                      }`}>
                        {ch.priority === "high" ? "High" : ch.priority === "medium" ? "Medium" : "Low"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {channels.length > 0 && (
        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
          <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 font-bold text-[11px]">
            Unread Messages <span className="ml-1 bg-blue-600 text-white rounded-full px-1.5 py-0.2">{unreadCount}</span>
          </span>
          <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground font-bold text-[11px]">
            Active Conversations <span className="ml-1 text-foreground font-bold">{channels.reduce((s, c) => s + c.active_members, 0)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function RevenueChartSection({
  revenueVal, salesTrends, trendDates, loading,
}: {
  revenueVal: string | null; salesTrends: SalesTrend[];
  trendDates: { first: string; mid: string; last: string } | null;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h3 className="font-bold text-foreground text-base flex items-center gap-2">
            <TrendingUp className="h-4.5 w-4.5 text-emerald-500" />
            Revenue & Growth
          </h3>
          <div className="text-xs text-muted-foreground mt-0.5">
            {loading ? <Skeleton className="h-4 w-48 inline-block" /> : (
              <>{revenueVal ?? "—"} total revenue</>
            )}
          </div>
        </div>
      </div>

      <div className="relative pt-4 pb-2">
        {loading ? (
          <Skeleton className="h-44 w-full" />
        ) : salesTrends.length === 0 ? (
          <div className="h-44 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No revenue data available yet</p>
          </div>
        ) : (
          <svg className="w-full h-44 overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38A8D8" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#38A8D8" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <line x1="0" y1="30" x2="500" y2="30" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4 4" />
            <line x1="0" y1="70" x2="500" y2="70" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4 4" />
            <line x1="0" y1="110" x2="500" y2="110" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4 4" />
            <path d={buildAreaPath(salesTrends)} fill="url(#revenueGrad)" />
            <path d={buildLinePath(salesTrends)} fill="none" stroke="#38A8D8" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="500" cy={getLastY(salesTrends)} r="5" fill="#38A8D8" className="animate-ping opacity-75" />
            <circle cx="500" cy={getLastY(salesTrends)} r="4" fill="#38A8D8" stroke="#ffffff" strokeWidth="2" />
          </svg>
        )}

        {trendDates && (
          <div className="flex justify-between text-[11px] font-semibold text-muted-foreground mt-2 px-1">
            <span>{formatDateLabel(trendDates.first)}</span>
            <span>{formatDateLabel(trendDates.mid)}</span>
            <span className="text-[#38A8D8] font-bold">{formatDateLabel(trendDates.last)} ({revenueVal ?? "—"})</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ContentPlannerSection({ items, loading }: { items: ContentItem[]; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-3 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#38A8D8]" /> Content Planner
          </h4>
          <Link to="/app/marketing" className="text-[10px] font-bold text-[#38A8D8] hover:underline">View Calendar</Link>
        </div>
        {loading ? (
          <div className="space-y-2.5 mt-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-muted-foreground">No scheduled content</p>
            <Link to="/app/marketing" className="text-[10px] font-bold text-[#38A8D8] hover:underline mt-1 inline-block">Schedule your first post</Link>
          </div>
        ) : (
          <div className="space-y-2.5 mt-3">
            {items.slice(0, 3).map((item) => {
              const d = new Date(item.date);
              const day = d.toLocaleDateString("en-US", { weekday: "short" });
              const dateNum = d.getDate();
              return (
                <div key={item.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-muted/40">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-card text-[10px] font-black text-foreground text-center leading-tight">
                      <span className="block text-[9px] text-muted-foreground uppercase">{day}</span>
                      <span>{dateNum}</span>
                    </div>
                    <span className="font-semibold text-foreground text-[11px] truncate max-w-[100px]">{item.title}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    item.status === "scheduled" ? "bg-emerald-500/10 text-emerald-600" :
                    item.status === "draft" ? "bg-muted text-muted-foreground" :
                    "bg-blue-500/10 text-blue-600"
                  }`}>
                    {item.status === "scheduled" ? "Scheduled" : item.status === "draft" ? "Draft" : "Published"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Link to="/app/marketing" className="text-center text-[11px] font-bold text-[#38A8D8] hover:underline pt-2 border-t border-border/40">
        View all content &rarr;
      </Link>
    </div>
  );
}

function TopProductsSection({ products, loading }: { products: TopProduct[]; loading: boolean }) {
  const icons = ["📦", "📘", "🎨", "🎧", "📱", "💻"];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-3 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-amber-500" /> Top Products
          </h4>
          <Link to="/app/store" className="text-[10px] font-bold text-[#38A8D8] hover:underline">View All</Link>
        </div>
        {loading ? (
          <div className="space-y-2.5 mt-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-muted-foreground">No products yet</p>
            <Link to="/app/store" className="text-[10px] font-bold text-[#38A8D8] hover:underline mt-1 inline-block">Add your first product</Link>
          </div>
        ) : (
          <div className="space-y-2.5 mt-3">
            {products.slice(0, 3).map((prod, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-muted/40">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs shrink-0">
                    {icons[idx % icons.length]}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-foreground text-[11px] block truncate">{prod.name}</span>
                    <span className="text-[9px] text-muted-foreground">{prod.orders} sold</span>
                  </div>
                </div>
                <span className="font-mono font-bold text-[11px] text-foreground">{formatPrice(prod.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <Link to="/app/store" className="text-center text-[11px] font-bold text-[#38A8D8] hover:underline pt-2 border-t border-border/40">
        Manage Products &rarr;
      </Link>
    </div>
  );
}

function CommunityActivitySection({ activities, loading }: { activities: CommunityActivity[]; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-3 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-purple-500" /> Community Activity
          </h4>
          <Link to="/app/communities" className="text-[10px] font-bold text-[#38A8D8] hover:underline">View All</Link>
        </div>
        {loading ? (
          <div className="space-y-2.5 mt-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : activities.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-muted-foreground">No recent activity</p>
            <Link to="/app/communities" className="text-[10px] font-bold text-[#38A8D8] hover:underline mt-1 inline-block">Explore communities</Link>
          </div>
        ) : (
          <div className="space-y-2.5 mt-3">
            {activities.slice(0, 3).map((act) => (
              <div key={act.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-muted/40">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-purple-500/20 text-purple-600 font-bold flex items-center justify-center text-[10px] shrink-0">
                    {act.user_initials}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-foreground text-[11px] block truncate">{act.user_name}</span>
                    <span className="text-[9px] text-muted-foreground">{act.action}</span>
                  </div>
                </div>
                <span className="text-[9px] text-muted-foreground font-semibold">{timeAgo(act.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <Link to="/app/communities" className="text-center text-[11px] font-bold text-[#38A8D8] hover:underline pt-2 border-t border-border/40">
        Go to Community &rarr;
      </Link>
    </div>
  );
}

function AiAssistantCard() {
  const prompts = [
    { icon: <Bot className="h-3.5 w-3.5" />, bg: "bg-purple-500/10 text-purple-600", text: "Create a poll to engage your community" },
    { icon: <Sparkles className="h-3.5 w-3.5" />, bg: "bg-emerald-500/10 text-emerald-600", text: "Suggest content ideas based on your audience" },
    { icon: <MessageSquare className="h-3.5 w-3.5" />, bg: "bg-blue-500/10 text-blue-600", text: "Summarize top conversations from this week" },
  ];

  return (
    <div className="rounded-2xl border border-purple-200 dark:border-purple-900 bg-gradient-to-br from-purple-50/60 via-purple-50/20 to-card dark:from-[#201430] dark:to-[#102840] p-6 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <h3 className="font-black text-foreground text-sm">AI Assistant</h3>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-600 dark:text-purple-300">Beta</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">Your MurihSpace AI, built to help you grow faster.</p>
      <div className="space-y-2.5 pt-1">
        {prompts.map((p, i) => (
          <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-card/80 border border-purple-100 dark:border-purple-900/50 text-xs">
            <div className={`p-1 rounded-md ${p.bg} mt-0.5`}>{p.icon}</div>
            <span className="text-foreground font-medium text-[11px]">{p.text}</span>
          </div>
        ))}
      </div>
      <Link to="/app/ai-assistant" className="block text-center text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline pt-1">
        Go to AI Assistant &rarr;
      </Link>
    </div>
  );
}

function InboxWidget({ stats, unreadCount, loading }: { stats: InboxStats | null; unreadCount: number; loading: boolean }) {
  const items = [
    { label: "Unread", value: unreadCount },
    { label: "AI Replies", value: stats?.ai_replies ?? 0 },
    { label: "Human Follow-Ups", value: stats?.human_follow_ups ?? 0 },
    { label: "Active Conversations", value: stats?.active_conversations ?? 0 },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
          <Inbox className="h-4 w-4 text-[#38A8D8]" />
          MurihSpace Inbox
        </h3>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 gap-2.5">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((item) => (
            <div key={item.label} className="p-3 rounded-xl bg-muted/40 border border-border/50">
              <span className="text-[10px] text-muted-foreground font-bold block">{item.label}</span>
              <span className="text-lg font-black text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      )}
      <Link to="/app/messages" className="block text-center text-xs font-bold text-[#38A8D8] hover:underline pt-1">Open Inbox &rarr;</Link>
    </div>
  );
}

function MonetizationWidget({ wallet, loading }: { wallet: WalletOverview | null; loading: boolean }) {
  const balance = wallet ? formatPrice(wallet.balance, wallet.currency) : null;
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
          <Wallet className="h-4 w-4 text-emerald-500" />
          Monetization Status
        </h3>
      </div>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
        </div>
      ) : !wallet ? (
        <div className="py-4 text-center">
          <p className="text-xs text-muted-foreground">Wallet data unavailable</p>
          <Link to="/app/wallet" className="text-[10px] font-bold text-[#38A8D8] hover:underline mt-1 inline-block">Go to Wallet</Link>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Total Balance</span>
              <span className="text-xl font-black text-foreground">{balance}</span>
            </div>
            {wallet.payout_ready && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Payout Ready
              </span>
            )}
          </div>
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground font-medium">
                Next Payout:{" "}
                <span className="font-bold text-foreground">
                  {wallet.next_payout_date ? new Date(wallet.next_payout_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                </span>
              </span>
              <Link to="/app/wallet" className="font-bold text-[#38A8D8] hover:underline">View Wallet &rarr;</Link>
            </div>
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#38A8D8] to-emerald-500 rounded-full" style={{ width: `${Math.min(wallet.payout_progress, 100)}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground text-right">
                {formatPrice(wallet.balance)} of {formatPrice(wallet.payout_threshold)} payout threshold
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ChatActivityWidget({ activities, loading }: { activities: RecentActivity[]; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-500" />
          Chat Activity
        </h3>
        <Link to="/app/messages" className="text-xs font-bold text-[#38A8D8] hover:underline">View All</Link>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : activities.length === 0 ? (
        <div className="py-6 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.slice(0, 3).map((act) => {
            const icons: Record<string, React.ReactNode> = {
              message: <MessageSquare className="h-3.5 w-3.5" />,
              support: <HelpCircle className="h-3.5 w-3.5" />,
              community: <Crown className="h-3.5 w-3.5" />,
              ai_reply: <Bot className="h-3.5 w-3.5" />,
            };
            const colors: Record<string, string> = {
              message: "bg-blue-500/10 text-blue-600",
              support: "bg-blue-500/10 text-blue-600",
              community: "bg-purple-500/10 text-purple-600",
              ai_reply: "bg-emerald-500/10 text-emerald-600",
            };
            return (
              <div key={act.id} className="flex items-start justify-between text-xs">
                <div className="flex items-start gap-2.5">
                  <div className={`p-1.5 rounded-lg ${colors[act.type] ?? "bg-muted"} mt-0.5 shrink-0`}>
                    {icons[act.type] ?? <MessageSquare className="h-3.5 w-3.5" />}
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-[11px]">{act.title}</p>
                    <p className="text-[10px] text-muted-foreground">{act.subtitle}</p>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground font-semibold">{timeAgo(act.timestamp)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Chart helpers ─────────────────────────────────────────────────────────

function buildLinePath(data: SalesTrend[]): string {
  if (data.length < 2) return "";
  const max = Math.max(...data.map((t) => t.revenue), 1);
  return data.map((t, i) => {
    const x = (i / (data.length - 1)) * 500;
    const y = 140 - (t.revenue / max) * 120;
    return `${i === 0 ? "M" : "L"} ${x},${y}`;
  }).join(" ");
}

function buildAreaPath(data: SalesTrend[]): string {
  if (data.length < 2) return "";
  const max = Math.max(...data.map((t) => t.revenue), 1);
  const line = data.map((t, i) => {
    const x = (i / (data.length - 1)) * 500;
    const y = 140 - (t.revenue / max) * 120;
    return `${i === 0 ? "M" : "L"} ${x},${y}`;
  }).join(" ");
  return `${line} L 500,140 L 0,140 Z`;
}

function getLastY(data: SalesTrend[]): number {
  if (data.length === 0) return 140;
  const max = Math.max(...data.map((t) => t.revenue), 1);
  const last = data[data.length - 1];
  return 140 - (last.revenue / max) * 120;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
