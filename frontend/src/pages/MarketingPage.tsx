import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Megaphone, Loader2, Mail, Plus, Eye, MousePointerClick, ListOrdered, Link2, Gift, TrendingUp, Target, Check, AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/api/authFetch";
import { Skeleton, SkeletonStatsGrid, SkeletonTable } from "@/components/ui/skeletons";

interface Campaign {
  id: number; name: string; type: string; status: string;
  sent_count: number; open_count: number; click_count: number;
  created_at: string;
}

interface Broadcast {
  id: number; title: string; subject: string; status: string;
  recipient_count: number; sent_count: number;
  open_count: number; click_count: number;
  sent_at: string | null; created_at: string;
}

interface Sequence {
  id: number; title: string; is_active: boolean; status: string;
  trigger_event: string; steps_count: number; created_at: string;
}

export default function MarketingPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [cfName, setCfName] = useState("");
  const [cfType, setCfType] = useState("email");
  const [cfSaving, setCfSaving] = useState(false);
  const [cfMsg, setCfMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, bRes, sRes] = await Promise.all([
        authFetch(`/marketing/campaigns`),
        authFetch(`/email-broadcasts`),
        authFetch(`/email-sequences`),
      ]);
      if (cRes.ok) { const j = await cRes.json(); setCampaigns(j?.success ? j?.data?.data ?? j?.data : j?.data ?? j); }
      if (bRes.ok) { const j = await bRes.json(); setBroadcasts(j?.data?.data ?? j?.data ?? []); }
      if (sRes.ok) { const j = await sRes.json(); setSequences(j?.data?.data ?? j?.data ?? []); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalSent = campaigns.reduce((s, c) => s + c.sent_count, 0) + broadcasts.reduce((s, b) => s + b.sent_count, 0);
  const totalOpens = campaigns.reduce((s, c) => s + c.open_count, 0) + broadcasts.reduce((s, b) => s + b.open_count, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.click_count, 0) + broadcasts.reduce((s, b) => s + b.click_count, 0);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setCfSaving(true);
    setCfMsg(null);
    try {
      const res = await authFetch(`/marketing/campaigns`, {
        method: "POST", 
        body: JSON.stringify({ name: cfName, type: cfType }),
      });
      if (res.ok) {
        setCfMsg({ ok: true, text: "Campaign created!" });
        setCfName(""); setCfType("email"); setShowCampaignForm(false);
        fetchData();
      } else {
        const j = await res.json().catch(() => ({}));
        setCfMsg({ ok: false, text: j.message || "Failed to create." });
      }
    } catch { setCfMsg({ ok: false, text: "Network error." }); }
    finally { setCfSaving(false); }
  };

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8 animate-in fade-in duration-300">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64 rounded-lg" />
            <Skeleton className="h-3.5 w-80 rounded-md" />
          </div>
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>

        {/* Summary Cards Skeleton */}
        <SkeletonStatsGrid count={4} />

        {/* Quick Actions Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
              <Skeleton className="h-6 w-6 rounded-lg" />
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-3 w-32 rounded-md" />
            </div>
          ))}
        </div>

        {/* Performance Overview Skeleton */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border/40 bg-muted/20">
            <Skeleton className="h-4 w-44 rounded-md" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/40 p-6 gap-4">
            <div className="space-y-2 flex flex-col items-center">
              <Skeleton className="h-3 w-28 rounded-md" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
            <div className="space-y-2 flex flex-col items-center">
              <Skeleton className="h-3 w-28 rounded-md" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
            <div className="space-y-2 flex flex-col items-center">
              <Skeleton className="h-3 w-28 rounded-md" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Table Skeleton */}
        <SkeletonTable rows={4} cols={4} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5 text-foreground">
            <Megaphone className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" />
            Marketing & Automations
          </h1>
          <p className="text-xs font-medium text-muted-foreground mt-1">
            Email campaigns, broadcasts, automated sequences, and referral tracking.
          </p>
        </div>
        <Button size="sm" className="bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold shadow-sm" onClick={() => { setCfMsg(null); setShowCampaignForm(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> New Campaign
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs hover:border-[#2164b6]/40 transition-all">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Target className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground tracking-tight">{campaigns.length + broadcasts.length + sequences.length}</p>
              <p className="text-xs font-semibold text-muted-foreground">Total Campaigns</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs hover:border-emerald-500/40 transition-all">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground tracking-tight">{totalSent.toLocaleString()}</p>
              <p className="text-xs font-semibold text-muted-foreground">Emails Sent</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs hover:border-purple-500/40 transition-all">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
              <Eye className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground tracking-tight">{totalOpens.toLocaleString()}</p>
              <p className="text-xs font-semibold text-muted-foreground">Opens</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs hover:border-amber-500/40 transition-all">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <MousePointerClick className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground tracking-tight">{totalClicks.toLocaleString()}</p>
              <p className="text-xs font-semibold text-muted-foreground">Clicks</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={() => navigate("/app/marketing/broadcasts")} className="rounded-2xl border border-border/60 bg-card p-5 text-left hover:border-[#2164b6]/50 hover:bg-muted/40 transition-all group shadow-xs">
          <Mail className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff] mb-3 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-bold text-foreground">Broadcasts</p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">{broadcasts.length} broadcasts active</p>
        </button>

        <button onClick={() => navigate("/app/marketing/sequences")} className="rounded-2xl border border-border/60 bg-card p-5 text-left hover:border-emerald-500/50 hover:bg-muted/40 transition-all group shadow-xs">
          <ListOrdered className="h-6 w-6 text-emerald-500 mb-3 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-bold text-foreground">Sequences</p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">{sequences.length} automated flows</p>
        </button>

        <button onClick={() => navigate("/app/marketing/affiliates")} className="rounded-2xl border border-border/60 bg-card p-5 text-left hover:border-purple-500/50 hover:bg-muted/40 transition-all group shadow-xs">
          <Link2 className="h-6 w-6 text-purple-500 mb-3 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-bold text-foreground">Affiliates</p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">Commission tracking</p>
        </button>

        <button onClick={() => navigate("/app/marketing/referrals")} className="rounded-2xl border border-border/60 bg-card p-5 text-left hover:border-amber-500/50 hover:bg-muted/40 transition-all group shadow-xs">
          <Gift className="h-6 w-6 text-amber-500 mb-3 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-bold text-foreground">Referrals</p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">Referral program</p>
        </button>
      </div>

      {/* Performance Overview */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#2164b6] dark:text-[#7ab0ff]" />
            <h2 className="text-sm font-extrabold text-foreground">Performance Overview</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/40">
          {[
            { label: "Avg. Open Rate", value: totalSent > 0 ? `${((totalOpens / totalSent) * 100).toFixed(1)}%` : "0%", color: "text-[#2164b6] dark:text-[#7ab0ff]" },
            { label: "Avg. Click Rate", value: totalOpens > 0 ? `${((totalClicks / totalOpens) * 100).toFixed(1)}%` : "0%", color: "text-amber-500" },
            { label: "Active Campaigns", value: campaigns.filter(c => c.status === "active").length + sequences.filter(s => s.is_active).length, color: "text-emerald-500" },
          ].map((stat, i) => (
            <div key={i} className="p-6 text-center">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              <p className={`text-3xl font-black mt-2 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between bg-muted/20">
          <h2 className="text-sm font-extrabold text-foreground">Recent Campaigns</h2>
          <Button variant="ghost" size="sm" className="text-xs font-bold text-[#2164b6] dark:text-[#7ab0ff]" onClick={() => { setCfMsg(null); setShowCampaignForm(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New
          </Button>
        </div>
        {campaigns.length === 0 ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center space-y-3.5 w-full">
            <div className="w-14 h-14 rounded-2xl bg-[#2164b6]/10 flex items-center justify-center">
              <Inbox className="h-7 w-7 text-[#2164b6] dark:text-[#7ab0ff]" />
            </div>
            <div className="space-y-1 max-w-md mx-auto text-center">
              <p className="text-base font-extrabold text-foreground">No campaigns created yet</p>
              <p className="text-xs font-medium text-muted-foreground leading-relaxed text-center">
                Launch your first email or social campaign to engage your audience and track conversions.
              </p>
            </div>
            <Button size="sm" className="bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold text-xs shadow-xs mx-auto" onClick={() => { setCfMsg(null); setShowCampaignForm(true); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Create Campaign
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {campaigns.slice(0, 5).map((c) => (
              <div key={c.id} className="p-5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate">{c.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      c.status === "active" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                      c.status === "draft" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                      "bg-muted text-muted-foreground border border-border"
                    }`}>{c.status}</span>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5 capitalize">{c.type} campaign</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {c.sent_count} sent</span>
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Eye className="h-3.5 w-3.5 text-muted-foreground" /> {c.open_count} opens</span>
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" /> {c.click_count} clicks</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Campaign Modal */}
      {showCampaignForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={() => { setShowCampaignForm(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-[#2164b6] dark:text-[#7ab0ff]" />
                New Campaign
              </h2>
              <button onClick={() => setShowCampaignForm(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted text-lg leading-none">&times;</button>
            </div>

            {cfMsg && (
              <div className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                cfMsg.ok ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
              }`}>
                {cfMsg.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                {cfMsg.text}
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Campaign Name</label>
                <input value={cfName} onChange={(e) => setCfName(e.target.value)} required placeholder="e.g. Summer Special Offer" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#2164b6] transition-colors" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Campaign Type</label>
                <select value={cfType} onChange={(e) => setCfType(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-medium text-foreground focus:outline-none focus:border-[#2164b6] transition-colors">
                  <option value="email">Email Campaign</option>
                  <option value="social">Social Media Post</option>
                  <option value="ads">Paid Ad Promotion</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCampaignForm(false)} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button type="submit" disabled={cfSaving} className="flex-1 rounded-xl bg-[#2164b6] text-white px-4 py-2.5 text-xs font-bold hover:bg-[#1a5091] disabled:opacity-50 shadow-xs transition-all">
                  {cfSaving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Create Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
