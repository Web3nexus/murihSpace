import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import { BarChart3, DollarSign, ShoppingBag, Users, Mail, TrendingUp, Lightbulb, Target, Zap, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { AnimatedPage } from "@/components/common/AnimatedPage";
import { Button } from "@/components/ui/button";

function formatPrice(cents: number): string {
  return "$" + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface AnalyticsData {
  revenue: { total: number; physical: number; digital: number; subscription: number; deals: number; referral: number };
  orders: { total: number; digital: number; physical: number; completed: number };
  products: { total: number };
  audience: { followers: number; subscribers: number; monthly_recurring: number };
  engagement: { broadcasts: number; emails_sent: number; referral_clicks: number; referrals: number; active_deals: number };
  growth: { member_since: string };
}

interface Suggestion { type: string; title: string; description: string; action: string; link: string; }
interface ContentIdea { platform: string; idea: string; }

function StatCard({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-2 hover:border-primary/30 transition-all ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-black text-foreground tracking-tight">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
        active
          ? "bg-[#38A8D8]/10 text-[#38A8D8] shadow-xs"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

export function AnalyticsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathTab = location.pathname.split("/").pop() ?? "";
  const tab: "overview" | "traffic" | "revenue" | "ai" = (
    ["overview", "traffic", "revenue", "ai"].includes(pathTab) ? pathTab as "overview" | "traffic" | "revenue" | "ai" : "overview"
  );
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [contentIdeas, setContentIdeas] = useState<ContentIdea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const ovRes = await apiClient.get("/analytics/overview");
      const ovData = ovRes.data?.data ?? ovRes.data;
      const raw = ovData?.success ? ovData.data : ovData;
      setData(raw ? {
        revenue: { total: 0, physical: 0, digital: 0, subscription: 0, deals: 0, referral: 0, ...raw.revenue },
        orders: { total: 0, digital: 0, physical: 0, completed: 0, ...raw.orders },
        products: { total: 0, ...raw.products },
        audience: { followers: 0, subscribers: 0, monthly_recurring: 0, ...raw.audience },
        engagement: { broadcasts: 0, emails_sent: 0, referral_clicks: 0, referrals: 0, active_deals: 0, ...raw.engagement },
        growth: { member_since: "", ...raw.growth },
      } : null);
    } catch {
      setError("Failed to load analytics data.");
    }

    try {
      const aiRes = await apiClient.get("/analytics/ai-suggestions");
      if (aiRes.data) {
        const ai = aiRes.data?.data ?? aiRes.data;
        setSuggestions(ai?.suggestions ?? []);
        setContentIdeas(ai?.content_ideas ?? []);
      }
    } catch {
      // AI suggestions are optional — don't block the page
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (isLoading) {
    return (
      <AnimatedPage className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#38A8D8] mx-auto" />
          <p className="text-sm text-muted-foreground font-medium">Loading analytics...</p>
        </div>
      </AnimatedPage>
    );
  }

  if (error || !data) {
    return (
      <AnimatedPage className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm font-medium text-foreground">{error ?? "No analytics data available."}</p>
          <Button variant="outline" size="sm" onClick={fetchAll}>Try Again</Button>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="w-full space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Analytics & AI Tools</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Track performance, revenue and growth insights.</p>
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
          <TabButton active={tab === "overview"} onClick={() => navigate("/app/analytics")}>Overview</TabButton>
          <TabButton active={tab === "traffic"} onClick={() => navigate("/app/analytics/traffic")}>Traffic</TabButton>
          <TabButton active={tab === "revenue"} onClick={() => navigate("/app/analytics/revenue")}>Revenue</TabButton>
          <TabButton active={tab === "ai"} onClick={() => navigate("/app/analytics/ai")}>AI Insights</TabButton>
        </div>
      </div>

      {/* ── Overview Tab ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[#38A8D8]" /> Revenue
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={<DollarSign className="h-4 w-4" />} label="Total Revenue" value={formatPrice(data.revenue.total)} />
              <StatCard icon={<Zap className="h-4 w-4" />} label="Digital" value={formatPrice(data.revenue.digital)} />
              <StatCard icon={<ShoppingBag className="h-4 w-4" />} label="Physical" value={formatPrice(data.revenue.physical)} />
              <StatCard icon={<Users className="h-4 w-4" />} label="Subscriptions (MRR)" value={formatPrice(data.revenue.subscription)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-3">
              <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
                <ShoppingBag className="h-3.5 w-3.5 text-[#38A8D8]" /> Orders
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Total", value: data.orders.total },
                  { label: "Digital", value: data.orders.digital },
                  { label: "Physical", value: data.orders.physical },
                  { label: "Completed", value: data.orders.completed },
                ].map((o) => (
                  <div key={o.label} className="p-3 rounded-xl bg-muted/40">
                    <span className="text-[10px] text-muted-foreground font-bold block">{o.label}</span>
                    <span className="text-lg font-black text-foreground">{o.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-3">
              <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-emerald-500" /> Products
              </h3>
              <div className="p-3 rounded-xl bg-muted/40">
                <span className="text-[10px] text-muted-foreground font-bold block">Total Products</span>
                <span className="text-lg font-black text-foreground">{data.products.total}</span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" /> Audience
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={<Users className="h-4 w-4" />} label="Followers" value={data.audience.followers.toLocaleString()} />
              <StatCard icon={<Users className="h-4 w-4" />} label="Paid Subscribers" value={data.audience.subscribers} />
              <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Monthly Recurring" value={`${formatPrice(data.audience.monthly_recurring)}/mo`} />
            </div>
          </div>

          <div>
            <h2 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4 text-purple-500" /> Engagement
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={<Mail className="h-4 w-4" />} label="Broadcasts" value={data.engagement.broadcasts} />
              <StatCard icon={<Mail className="h-4 w-4" />} label="Emails Sent" value={data.engagement.emails_sent} />
              <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Referral Clicks" value={data.engagement.referral_clicks} />
              <StatCard icon={<Lightbulb className="h-4 w-4" />} label="Active Deals" value={data.engagement.active_deals} />
            </div>
          </div>
        </div>
      )}

      {/* ── Traffic Tab ── */}
      {tab === "traffic" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={<Users className="h-4 w-4" />} label="Total Followers" value={data.audience.followers.toLocaleString()} className="text-center" />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Referral Clicks" value={data.engagement.referral_clicks} className="text-center" />
            <StatCard icon={<Mail className="h-4 w-4" />} label="Emails Delivered" value={data.engagement.emails_sent} className="text-center" />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#38A8D8]" /> Traffic Sources
            </h3>
            <p className="text-xs text-muted-foreground">
              Detailed traffic analytics (link clicks, referral sources, channel breakdown) coming in a future update.
            </p>
            <div className="space-y-3">
              {[
                { label: "Referral Links", value: `${data.engagement.referral_clicks} clicks` },
                { label: "Referrals Converted", value: data.engagement.referrals },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                  <span className="text-xs font-semibold text-foreground">{r.label}</span>
                  <span className="text-xs font-bold text-foreground">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Revenue Tab ── */}
      {tab === "revenue" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon={<DollarSign className="h-4 w-4" />} label="Total" value={formatPrice(data.revenue.total)} className="text-center" />
            <StatCard icon={<Zap className="h-4 w-4" />} label="Digital Sales" value={formatPrice(data.revenue.digital)} className="text-center" />
            <StatCard icon={<ShoppingBag className="h-4 w-4" />} label="Physical Sales" value={formatPrice(data.revenue.physical)} className="text-center" />
            <StatCard icon={<Users className="h-4 w-4" />} label="Subscriptions" value={formatPrice(data.revenue.subscription)} className="text-center" />
            <StatCard icon={<Lightbulb className="h-4 w-4" />} label="Brand Deals" value={formatPrice(data.revenue.deals)} className="text-center" />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Referrals" value={formatPrice(data.revenue.referral)} className="text-center" />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#38A8D8]" /> Revenue Breakdown
            </h3>
            <div className="space-y-3">
              {[
                { label: "Digital Products", value: data.revenue.digital, color: "bg-[#38A8D8]" },
                { label: "Physical Products", value: data.revenue.physical, color: "bg-amber-500" },
                { label: "Subscriptions", value: data.revenue.subscription, color: "bg-emerald-500" },
                { label: "Brand Deals", value: data.revenue.deals, color: "bg-purple-500" },
                { label: "Referrals", value: data.revenue.referral, color: "bg-rose-500" },
              ].filter(r => r.value > 0).map(r => {
                const pct = data.revenue.total > 0 ? (r.value / data.revenue.total) * 100 : 0;
                return (
                  <div key={r.label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-semibold text-foreground">{r.label}</span>
                      <span className="font-bold text-foreground">{formatPrice(r.value)} <span className="text-muted-foreground font-normal">({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${r.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {data.revenue.total === 0 && <p className="text-xs text-muted-foreground text-center py-4">No revenue data yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── AI Insights Tab ── */}
      {tab === "ai" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" /> Smart Suggestions
            </h2>
            {suggestions.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-2xs">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
                <p className="font-bold text-foreground text-sm">You're on a roll!</p>
                <p className="text-xs text-muted-foreground mt-1">No suggestions right now — keep up the great work.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestions.map((s, i) => {
                  const borderColors: Record<string, string> = {
                    product: "border-l-[#38A8D8]", audience: "border-l-emerald-500",
                    brand: "border-l-purple-500", email: "border-l-amber-500",
                  };
                  return (
                    <div key={i} className={`rounded-2xl border border-l-4 ${borderColors[s.type] ?? "border-l-muted-foreground"} border-border bg-card p-5 shadow-2xs space-y-2`}>
                      <h3 className="font-bold text-foreground text-sm">{s.title}</h3>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                      <a href={s.link} className="inline-block text-xs font-bold text-[#38A8D8] hover:underline">{s.action} &rarr;</a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" /> AI Content Ideas
            </h2>
            <div className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
              {contentIdeas.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-xs text-muted-foreground">No content ideas yet. Check back soon.</p>
                </div>
              ) : (
                contentIdeas.map((idea, i) => {
                  const platformColors: Record<string, string> = {
                    Social: "bg-blue-500/10 text-blue-600",
                    Email: "bg-amber-500/10 text-amber-600",
                    Community: "bg-emerald-500/10 text-emerald-600",
                  };
                  return (
                    <div key={i} className={`px-4 py-3.5 flex items-start gap-3 ${i < contentIdeas.length - 1 ? "border-b border-border" : ""}`}>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${platformColors[idea.platform] ?? "bg-muted text-muted-foreground"}`}>
                        {idea.platform}
                      </span>
                      <p className="text-xs text-foreground">{idea.idea}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
            <h3 className="font-bold text-foreground text-sm">Your Creator Journey</h3>
            <p className="text-xs text-muted-foreground">Member since {data.growth.member_since}</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Products Created", value: data.products.total },
                { label: "Orders Fulfilled", value: data.orders.completed },
                { label: "Followers", value: data.audience.followers.toLocaleString() },
              ].map((m) => (
                <div key={m.label} className="p-3 rounded-xl bg-muted/40 text-center">
                  <span className="text-[10px] text-muted-foreground font-bold block">{m.label}</span>
                  <span className="text-lg font-black text-foreground">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
