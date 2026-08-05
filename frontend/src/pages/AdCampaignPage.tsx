import { useState, useEffect, useCallback } from "react";
import { useConfirm } from "@/components/ui/DialogProvider";
import { toast } from "sonner";
import { Megaphone, Loader2, Plus, Eye, MousePointerClick, DollarSign, BarChart3, Play, Pause, Copy, Trash2, AlertCircle, Check, Calendar, Globe, Users, Radio, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const OBJECTIVES = [
  { value: "post_engagement", label: "Post Engagement", icon: MousePointerClick },
  { value: "profile_followers", label: "Profile Followers", icon: Users },
  { value: "product_sales", label: "Product Sales", icon: DollarSign },
  { value: "product_traffic", label: "Product Page Traffic", icon: Eye },
  { value: "community_promotion", label: "Promote Community", icon: Users },
  { value: "community_membership", label: "Community Members", icon: Users },
  { value: "event_promotion", label: "Promote Event", icon: Calendar },
  { value: "video_views", label: "Video Views", icon: Radio },
  { value: "messages_enquiries", label: "Messages & Enquiries", icon: FileText },
  { value: "external_traffic", label: "External Website", icon: Globe },
];

const PLACEMENTS = [
  { value: "home_feed", label: "Home Feed" },
  { value: "community_feed", label: "Community Feeds" },
  { value: "video_feed", label: "Video Feed" },
  { value: "marketplace", label: "Marketplace" },
  { value: "search", label: "Search Results" },
  { value: "creator_profile", label: "Creator Profiles" },
  { value: "community_recommendations", label: "Community Recommendations" },
  { value: "stories", label: "Stories" },
  { value: "mobile", label: "Mobile App" },
  { value: "desktop_web", label: "Desktop Web" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

const REVIEW_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-orange-100 text-orange-700",
  removed: "bg-gray-100 text-gray-500",
};

export default function AdCampaignPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "", objective: "post_engagement", daily_budget: "", total_budget: "",
    start_date: "", end_date: "", headline: "", description: "", cta_text: "",
    destination_url: "", media_url: "", placements: [] as string[],
    targeting: { country: [], region: [], city: [], age_min: 18, age_max: 65, language: [], interests: [] },
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ads`, { headers: getAuthHeaders() });
      if (res.ok) { const j = await res.json(); setCampaigns(j?.data ?? j); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const body: any = { ...form };
      if (form.start_date) body.start_date = new Date(form.start_date).toISOString();
      if (form.end_date) body.end_date = new Date(form.end_date).toISOString();
      if (form.daily_budget) body.daily_budget = parseFloat(form.daily_budget);
      if (form.total_budget) body.total_budget = parseFloat(form.total_budget);
      if (!form.placements.length) delete body.placements;

      const res = await fetch(`${API_BASE}/ads`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Campaign created! Submitted for review." });
        setShowForm(false); fetchCampaigns();
        setForm({ name: "", objective: "post_engagement", daily_budget: "", total_budget: "", start_date: "", end_date: "", headline: "", description: "", cta_text: "", destination_url: "", media_url: "", placements: [], targeting: { country: [], region: [], city: [], age_min: 18, age_max: 65, language: [], interests: [] } });
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j.message || "Failed to create campaign." });
      }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    finally { setSaving(false); }
  };

  const handleAction = async (id: number, action: string) => {
    try {
      const res = await fetch(`${API_BASE}/ads/${id}/${action}`, { method: "POST", headers: getAuthHeaders() });
      if (res.ok) fetchCampaigns();
    } catch { /* ignore */ }
  };

  const confirm = useConfirm();

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: "Cancel Campaign", message: "Cancel this campaign?", variant: "destructive" })) return;
    try {
      await fetch(`${API_BASE}/ads/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      fetchCampaigns();
    } catch { /* ignore */ }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await fetch(`${API_BASE}/ads/${id}/duplicate`, { method: "POST", headers: getAuthHeaders() });
      fetchCampaigns();
    } catch { /* ignore */ }
  };

  const loadAnalytics = async (campaign: any) => {
    try {
      const res = await fetch(`${API_BASE}/ads/${campaign.id}/analytics`, { headers: getAuthHeaders() });
      if (res.ok) {
        const j = await res.json();
        toast.info(`Analytics — CTR: ${j.ctr}%, CPC: $${j.cpc}, Spent: $${j.summary?.total_spent || 0}`);
      }
    } catch { /* ignore */ }
  };

  const formatCurrency = (v: any) => v ? `$${parseFloat(v).toLocaleString()}` : "-";

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="w-6 h-6 text-orange-500" /> Ad Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage your advertising campaigns</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}><Plus className="w-4 h-4 mr-2" />{showForm ? "Cancel" : "New Campaign"}</Button>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{msg.text}
        </div>
      )}

      {showForm && (
        <div className="bg-white border rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Create New Campaign</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Campaign Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Summer Launch Promo" />
              </div>
              <div>
                <Label>Objective *</Label>
                <select value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Headline</Label>
                <Input value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} placeholder="Catchy headline" />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe your promotion" />
              </div>
              <div>
                <Label>CTA Text</Label>
                <Input value={form.cta_text} onChange={e => setForm(f => ({ ...f, cta_text: e.target.value }))} placeholder="e.g. Shop Now" />
              </div>
              <div>
                <Label>Destination URL</Label>
                <Input value={form.destination_url} onChange={e => setForm(f => ({ ...f, destination_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <Label>Media URL</Label>
                <Input value={form.media_url} onChange={e => setForm(f => ({ ...f, media_url: e.target.value }))} placeholder="Image or video URL" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Daily Budget</Label>
                  <Input type="number" min="0" step="0.01" value={form.daily_budget} onChange={e => setForm(f => ({ ...f, daily_budget: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <Label>Total Budget</Label>
                  <Input type="number" min="0" step="0.01" value={form.total_budget} onChange={e => setForm(f => ({ ...f, total_budget: e.target.value }))} placeholder="0.00" />
                </div>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Placements</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                  {PLACEMENTS.map(p => (
                    <label key={p.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.placements.includes(p.value)} onChange={e => {
                        if (e.target.checked) setForm(f => ({ ...f, placements: [...f.placements, p.value] }));
                        else setForm(f => ({ ...f, placements: f.placements.filter(v => v !== p.value) }));
                      }} className="rounded" />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving || !form.name}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Create Campaign</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold">Your Campaigns</h2>
          <span className="text-sm text-gray-500">{campaigns.length} total</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No campaigns yet. Create your first ad campaign!</p>
          </div>
        ) : (
          <div className="divide-y">
            {campaigns.map((c: any) => (
              <div key={c.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{c.name}</h3>
                      <Badge className={STATUS_COLORS[c.status] || ""}>{c.status}</Badge>
                      <Badge className={REVIEW_COLORS[c.review_status] || ""}>{c.review_status}</Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {OBJECTIVES.find(o => o.value === c.objective)?.label || c.objective}
                      {c.daily_budget && <span className="ml-3">Daily: {formatCurrency(c.daily_budget)}</span>}
                      {c.total_budget && <span className="ml-3">Total: {formatCurrency(c.total_budget)}</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Created {new Date(c.created_at).toLocaleDateString()}
                      {c.start_date && <> &middot; {new Date(c.start_date).toLocaleDateString()} - {c.end_date ? new Date(c.end_date).toLocaleDateString() : "ongoing"}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Button variant="ghost" size="sm" onClick={() => loadAnalytics(c)} title="Analytics"><BarChart3 className="w-4 h-4" /></Button>
                    {c.status === "active" && <Button variant="ghost" size="sm" onClick={() => handleAction(c.id, "pause")} title="Pause"><Pause className="w-4 h-4" /></Button>}
                    {c.status === "paused" && <Button variant="ghost" size="sm" onClick={() => handleAction(c.id, "resume")} title="Resume"><Play className="w-4 h-4" /></Button>}
                    <Button variant="ghost" size="sm" onClick={() => handleDuplicate(c.id)} title="Duplicate"><Copy className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} title="Cancel"><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
