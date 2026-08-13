import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Megaphone, Loader2, Mail, Plus, Eye, MousePointerClick, ListOrdered, Link2, Gift, TrendingUp, Target, ArrowRight, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/api/authFetch";





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
        authFetch(`/marketing/campaigns`, {  }),
        authFetch(`/email-broadcasts`, {  }),
        authFetch(`/email-sequences`, {  }),
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

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5"><Megaphone className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Marketing & Automations</h1>
          <p className="text-xs text-muted-foreground mt-1">Email campaigns, broadcasts, automated sequences and more.</p>
        </div>
        <Button size="sm" className="bg-[#2164b6] hover:bg-[#1a5091] text-white" onClick={() => { setCfMsg(null); setShowCampaignForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Campaign
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Target className="h-5 w-5 text-blue-500" /></div>
          <div><p className="text-2xl font-bold">{campaigns.length + broadcasts.length + sequences.length}</p><p className="text-xs text-muted-foreground">Total Campaigns</p></div>
        </div></div>
        <div className="rounded-xl border bg-card p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center"><Mail className="h-5 w-5 text-green-500" /></div>
          <div><p className="text-2xl font-bold">{totalSent.toLocaleString()}</p><p className="text-xs text-muted-foreground">Emails Sent</p></div>
        </div></div>
        <div className="rounded-xl border bg-card p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center"><Eye className="h-5 w-5 text-purple-500" /></div>
          <div><p className="text-2xl font-bold">{totalOpens.toLocaleString()}</p><p className="text-xs text-muted-foreground">Opens</p></div>
        </div></div>
        <div className="rounded-xl border bg-card p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><MousePointerClick className="h-5 w-5 text-amber-500" /></div>
          <div><p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p><p className="text-xs text-muted-foreground">Clicks</p></div>
        </div></div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => navigate("/app/marketing/broadcasts")} className="rounded-xl border bg-card p-4 text-left hover:bg-muted/50 transition-all">
          <Mail className="h-5 w-5 text-[#2164b6] dark:text-[#7ab0ff] mb-2" />
          <p className="text-sm font-bold">Broadcasts</p>
          <p className="text-[11px] text-muted-foreground">{broadcasts.length} broadcasts</p>
        </button>
        <button onClick={() => navigate("/app/marketing/sequences")} className="rounded-xl border bg-card p-4 text-left hover:bg-muted/50 transition-all">
          <ListOrdered className="h-5 w-5 text-emerald-500 mb-2" />
          <p className="text-sm font-bold">Sequences</p>
          <p className="text-[11px] text-muted-foreground">{sequences.length} sequences</p>
        </button>
        <button onClick={() => navigate("/app/marketing/affiliates")} className="rounded-xl border bg-card p-4 text-left hover:bg-muted/50 transition-all">
          <Link2 className="h-5 w-5 text-purple-500 mb-2" />
          <p className="text-sm font-bold">Affiliates</p>
          <p className="text-[11px] text-muted-foreground">Commission tracking</p>
        </button>
        <button onClick={() => navigate("/app/marketing/referrals")} className="rounded-xl border bg-card p-4 text-left hover:bg-muted/50 transition-all">
          <Gift className="h-5 w-5 text-amber-500 mb-2" />
          <p className="text-sm font-bold">Referrals</p>
          <p className="text-[11px] text-muted-foreground">Referral program</p>
        </button>
      </div>

      {/* Performance Overview */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-[#2164b6] dark:text-[#7ab0ff]" /><h2 className="text-sm font-bold">Performance Overview</h2></div>
        </div>
        <div className="grid grid-cols-3 gap-px bg-border">
          {[
            { label: "Avg. Open Rate", value: totalSent > 0 ? `${((totalOpens / totalSent) * 100).toFixed(1)}%` : "—", color: "text-blue-600" },
            { label: "Avg. Click Rate", value: totalOpens > 0 ? `${((totalClicks / totalOpens) * 100).toFixed(1)}%` : "—", color: "text-amber-600" },
            { label: "Active Now", value: campaigns.filter(c => c.status === "active").length + sequences.filter(s => s.is_active).length, color: "text-emerald-600" },
          ].map((stat, i) => (
            <div key={i} className="bg-card px-5 py-4">
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-bold">Recent Campaigns</h2>
          <Button variant="ghost" size="sm" className="text-xs text-[#2164b6] dark:text-[#7ab0ff]" onClick={() => { setCfMsg(null); setShowCampaignForm(true); }}>
            <Plus className="h-3 w-3 mr-1" /> New
          </Button>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-xs text-muted-foreground p-6 text-center">No campaigns yet.</p>
        ) : (
          <div className="divide-y">
            {campaigns.slice(0, 5).map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{c.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      c.status === "active" ? "bg-green-100 text-green-700" :
                      c.status === "draft" ? "bg-yellow-100 text-yellow-700" :
                      "bg-muted text-muted-foreground"
                    }`}>{c.status}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{c.type} campaign</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {c.sent_count} sent</span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" /> {c.open_count} opens</span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {c.click_count} clicks</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {campaigns.length > 5 && (
          <div className="px-5 py-3 border-t text-center">
            <Button variant="link" size="sm" className="text-xs text-muted-foreground" onClick={() => navigate("/app/marketing")}>
              View all campaigns <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* New Campaign Modal */}
      {showCampaignForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8" onClick={() => { setShowCampaignForm(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold flex items-center gap-2"><Megaphone className="h-5 w-5 text-[#2164b6] dark:text-[#7ab0ff]" /> New Campaign</h2>
              <button onClick={() => setShowCampaignForm(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">&times;</button>
            </div>

            {cfMsg && (
              <div className={`mb-4 flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                cfMsg.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
              }`}>
                {cfMsg.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                {cfMsg.text}
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Campaign Name</label>
                <input value={cfName} onChange={(e) => setCfName(e.target.value)} required placeholder="e.g. Summer Sale 2026" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-secondary/50 transition-colors" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Type</label>
                <select value={cfType} onChange={(e) => setCfType(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-secondary/50 transition-colors">
                  <option value="email">Email</option>
                  <option value="social">Social Media</option>
                  <option value="ads">Paid Ads</option>
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
