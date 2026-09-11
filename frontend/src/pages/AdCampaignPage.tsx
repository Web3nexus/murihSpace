import { useState, useEffect, useCallback } from "react";
import { useConfirm } from "@/components/ui/DialogProvider";
import { toast } from "sonner";
import {
  Megaphone as Megaphone,
  Spinner as Loader2,
  Plus as Plus,
  Eye as Eye,
  CursorClick as CursorClick,
  CurrencyDollar as DollarSign,
  ChartBar as BarChart3,
  Play as Play,
  Pause as Pause,
  Copy as Copy,
  Trash as Trash2,
  WarningCircle as AlertCircle,
  Check as Check,
  Calendar as Calendar,
  Globe as Globe,
  Users as Users,
  Radio as Radio,
  FileText as FileText,
  ArrowSquareOut,
  Database,
  ShieldCheck,
  X,
  MagnifyingGlass as Search,
  CheckCircle as CheckCircle2
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/api/authFetch";
import { ImageUploader } from "@/components/upload/ImageUploader";

const OBJECTIVES = [
  { value: "post_engagement", label: "Post Engagement", icon: CursorClick },
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

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  draft: { label: "Draft", class: "bg-muted text-muted-foreground border-border/80" },
  active: { label: "Active", class: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" },
  paused: { label: "Paused", class: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25" },
  completed: { label: "Completed", class: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25" },
  cancelled: { label: "Cancelled", class: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25" },
};

const REVIEW_CONFIG: Record<string, { label: string; class: string }> = {
  pending: { label: "Review Pending", class: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25" },
  approved: { label: "Approved", class: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" },
  rejected: { label: "Rejected", class: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25" },
  suspended: { label: "Suspended", class: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25" },
  removed: { label: "Removed", class: "bg-muted text-muted-foreground border-border/80" },
};

export default function AdCampaignPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "draft">("all");

  const [form, setForm] = useState({
    name: "", objective: "post_engagement", daily_budget: "", total_budget: "",
    start_date: "", end_date: "", headline: "", description: "", cta_text: "",
    destination_url: "", media_url: "", placements: [] as string[],
    targeting: { country: [], region: [], city: [], age_min: 18, age_max: 65, language: [], interests: [] },
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [launchingStudio, setLaunchingStudio] = useState(false);

  const handleLaunchStudio = useCallback(async () => {
    setLaunchingStudio(true);
    try {
      const res = await authFetch(`/ads/sso-token`, { method: "POST" });
      if (res.ok) {
        const j = await res.json();
        const launchUrl = j.data?.sso_launch_url;
        if (launchUrl) {
          window.open(launchUrl, "_blank", "noopener,noreferrer");
          toast.success("Opening MurihSpace Ads Studio with Single Sign-On...");
        } else {
          toast.error("Unable to generate Ads Studio launch URL");
        }
      } else {
        toast.error("Failed to authenticate with Ads Studio");
      }
    } catch {
      toast.error("Network error connecting to Ads Studio");
    } finally {
      setLaunchingStudio(false);
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/ads`);
      if (res.ok) {
        const j = await res.json();
        const payload = j?.data ?? j;
        let list: any[] = [];
        if (Array.isArray(payload)) {
          list = payload;
        } else if (Array.isArray(payload?.data)) {
          list = payload.data;
        } else if (Array.isArray(j?.data?.data)) {
          list = j.data.data;
        } else if (Array.isArray(j)) {
          list = j;
        }
        setCampaigns(list);
      } else {
        setCampaigns([]);
      }
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
    const params = new URLSearchParams(window.location.search);
    if (params.get("launch_studio") === "true") {
      handleLaunchStudio();
    }
  }, [fetchCampaigns, handleLaunchStudio]);

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

      const res = await authFetch(`/ads`, {
        method: "POST", 
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
      const res = await authFetch(`/ads/${id}/${action}`, { method: "POST" });
      if (res.ok) fetchCampaigns();
    } catch { /* ignore */ }
  };

  const confirm = useConfirm();

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: "Cancel Campaign", message: "Cancel this campaign?", variant: "destructive" })) return;
    try {
      await authFetch(`/ads/${id}`, { method: "DELETE" });
      fetchCampaigns();
    } catch { /* ignore */ }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await authFetch(`/ads/${id}/duplicate`, { method: "POST" });
      fetchCampaigns();
    } catch { /* ignore */ }
  };

  const loadAnalytics = async (campaign: any) => {
    try {
      const res = await authFetch(`/ads/${campaign.id}/analytics`);
      if (res.ok) {
        const j = await res.json();
        toast.info(`Analytics — CTR: ${j.ctr}%, CPC: $${j.cpc}, Spent: $${j.summary?.total_spent || 0}`);
      }
    } catch { /* ignore */ }
  };

  const formatCurrency = (v: any) => v ? `$${parseFloat(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-";

  const campaignList = Array.isArray(campaigns) ? campaigns : [];
  const activeCount = campaignList.filter(c => c && c.status === "active").length;
  const pausedCount = campaignList.filter(c => c && c.status === "paused").length;
  const draftCount = campaignList.filter(c => c && c.status === "draft").length;
  const totalBudget = campaignList.reduce((acc, c) => acc + (parseFloat(c?.total_budget) || 0), 0);

  const filteredCampaigns = campaignList.filter(c => {
    if (!c) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchObjective = c.objective?.toLowerCase().includes(q);
      const matchHeadline = c.headline?.toLowerCase().includes(q);
      if (!matchName && !matchObjective && !matchHeadline) return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* ── Top Header & Action ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] flex items-center justify-center">
              <Megaphone weight="fill" className="w-5 h-5" />
            </div>
            Ads Manager
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Create, promote, and scale your brand, products, communities, and content.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            disabled={launchingStudio}
            onClick={handleLaunchStudio}
            className="border-primary/30 text-primary hover:bg-primary/10 font-bold text-xs rounded-xl"
          >
            {launchingStudio ? (
              <Loader2 weight="fill" className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <ArrowSquareOut weight="bold" className="w-4 h-4 mr-1.5" />
            )}
            Launch Ads Studio
          </Button>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold text-xs rounded-xl shadow-xs"
          >
            {showForm ? (
              <>
                <X weight="bold" className="w-4 h-4 mr-1.5" />
                Close Form
              </>
            ) : (
              <>
                <Plus weight="bold" className="w-4 h-4 mr-1.5" />
                Create Campaign
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── MurihSpace Ads Studio SSO Integration Card ── */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-blue-500/10 via-primary/5 to-transparent p-5 relative overflow-hidden backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#2164b6] text-white">
                  <CheckCircle2 weight="fill" className="w-3 h-3" />
                  Dedicated Ads Studio
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <Database weight="fill" className="w-3 h-3" />
                Database Synced
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                <ShieldCheck weight="fill" className="w-3 h-3" />
                SSO Enabled
              </span>
            </div>
            <h3 className="text-sm font-bold text-foreground">
              MurihSpace Enterprise Ads Studio & Pixel Center
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Use your MurihSpace credentials to access the dedicated Ads Manager with audience targeting, catalog sync, and multi-placement delivery.
            </p>
          </div>

          <button
            type="button"
            disabled={launchingStudio}
            onClick={handleLaunchStudio}
            className="px-4 py-2.5 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 self-start md:self-auto cursor-pointer"
          >
            <span>Log in to Ads Account</span>
            <ArrowSquareOut weight="bold" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Metric Snapshot Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col justify-between hover:border-border transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Total Campaigns
            </span>
            <div className="w-7 h-7 rounded-lg bg-muted/60 text-muted-foreground flex items-center justify-center">
              <Megaphone weight="fill" className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{campaignList.length}</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col justify-between hover:border-border transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Active Campaigns
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Play weight="fill" className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{activeCount}</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col justify-between hover:border-border transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Allocated Budget
            </span>
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <DollarSign weight="bold" className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            ${totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col justify-between hover:border-border transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Placements Active
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Globe weight="bold" className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-primary tracking-tight">Web & Feed</p>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl flex items-center gap-2.5 text-xs font-semibold border ${
          msg.ok
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
        }`}>
          {msg.ok ? <Check className="w-4 h-4" weight="bold" /> : <AlertCircle weight="fill" className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* ── Create Campaign Form ── */}
      {showForm && (
        <div className="rounded-3xl border border-primary/25 bg-card shadow-xl p-6 sm:p-7 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-5">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Plus weight="bold" className="w-5 h-5 text-primary" />
                Create New Campaign
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure your creative, placement targets, and budget.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X weight="bold" className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label className="text-xs font-bold text-foreground mb-1.5 block">Campaign Name *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="e.g. Summer Launch Promo"
                  className="rounded-xl bg-background border-border/80"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground mb-1.5 block">Objective *</Label>
                <select
                  value={form.objective}
                  onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
                  className="w-full border border-border/80 rounded-xl px-3 py-2.5 text-xs font-medium bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  {OBJECTIVES.map(o => (
                    <option key={o.value} value={o.value} className="bg-popover text-popover-foreground">
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground mb-1.5 block">Headline</Label>
                <Input
                  value={form.headline}
                  onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
                  placeholder="Catchy ad headline"
                  className="rounded-xl bg-background border-border/80"
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs font-bold text-foreground mb-1.5 block">Description</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe your promotion or special offer"
                  className="rounded-xl bg-background border-border/80 min-h-[90px]"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground mb-1.5 block">CTA Button Text</Label>
                <Input
                  value={form.cta_text}
                  onChange={e => setForm(f => ({ ...f, cta_text: e.target.value }))}
                  placeholder="e.g. Shop Now, Learn More"
                  className="rounded-xl bg-background border-border/80"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground mb-1.5 block">Destination URL</Label>
                <Input
                  value={form.destination_url}
                  onChange={e => setForm(f => ({ ...f, destination_url: e.target.value }))}
                  placeholder="https://..."
                  className="rounded-xl bg-background border-border/80"
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs font-bold text-foreground mb-1.5 block">Ad Creative Media</Label>
                <ImageUploader
                  value={form.media_url}
                  onChange={(url) => setForm((f) => ({ ...f, media_url: url }))}
                  folder="ads/creatives"
                  label="Upload Ad Creative Image"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 md:col-span-2">
                <div>
                  <Label className="text-xs font-bold text-foreground mb-1.5 block">Daily Budget ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.daily_budget}
                    onChange={e => setForm(f => ({ ...f, daily_budget: e.target.value }))}
                    placeholder="0.00"
                    className="rounded-xl bg-background border-border/80"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-foreground mb-1.5 block">Total Budget ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.total_budget}
                    onChange={e => setForm(f => ({ ...f, total_budget: e.target.value }))}
                    placeholder="0.00"
                    className="rounded-xl bg-background border-border/80"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground mb-1.5 block">Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="rounded-xl bg-background border-border/80"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground mb-1.5 block">End Date (Optional)</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="rounded-xl bg-background border-border/80"
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs font-bold text-foreground mb-1.5 block">Placements</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mt-2">
                  {PLACEMENTS.map(p => {
                    const isSelected = form.placements.includes(p.value);
                    return (
                      <label
                        key={p.value}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) setForm(f => ({ ...f, placements: [...f.placements, p.value] }));
                            else setForm(f => ({ ...f, placements: f.placements.filter(v => v !== p.value) }));
                          }}
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        <span>{p.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-border/60">
              <Button
                type="submit"
                disabled={saving || !form.name}
                className="bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold text-xs rounded-xl px-5 py-2.5 shadow-sm"
              >
                {saving ? <Loader2 weight="fill" className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Campaign
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="border-border/80 text-foreground hover:bg-muted text-xs font-semibold rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Your Campaigns Hub ── */}
      <div className="rounded-3xl border border-border/80 bg-card shadow-xs overflow-hidden">
        {/* Header & Controls */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span>Your Campaigns</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60">
                {campaignList.length} total
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage, pause, or monitor live sponsored promotions across web and mobile feeds.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Search */}
            <div className="relative w-full sm:w-48">
              <Search weight="bold" className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search campaigns..."
                className="w-full h-8 pl-8 pr-3 rounded-xl bg-background border border-border/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-background rounded-xl p-0.5 border border-border/80">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  statusFilter === "active"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("paused")}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  statusFilter === "paused"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Paused ({pausedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("draft")}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  statusFilter === "draft"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Drafts ({draftCount})
              </button>
            </div>
          </div>
        </div>

        {/* Content Stream */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 weight="fill" className="w-7 h-7 animate-spin text-primary" />
            <p className="text-xs font-medium text-muted-foreground">Loading your ad campaigns...</p>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-16 px-4 max-w-md mx-auto flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] flex items-center justify-center mb-4 shadow-inner">
              <Megaphone weight="fill" className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {campaignList.length === 0 ? "No campaigns yet" : "No campaigns match your filter"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {campaignList.length === 0
                ? "Create your first sponsored ad to promote your store products, communities, courses, or brand deals across MurihSpace."
                : "Try clearing your search query or switching tabs to view other campaigns."}
            </p>
            <div className="flex items-center gap-3 mt-6">
              <Button
                onClick={() => setShowForm(true)}
                className="bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold text-xs shadow-sm rounded-xl px-4 py-2"
              >
                <Plus weight="bold" className="w-4 h-4 mr-1.5" />
                Create First Campaign
              </Button>
              <Button
                variant="outline"
                disabled={launchingStudio}
                onClick={handleLaunchStudio}
                className="border-border/80 text-foreground hover:bg-muted font-bold text-xs rounded-xl px-4 py-2"
              >
                <ArrowSquareOut weight="bold" className="w-4 h-4 mr-1.5" />
                Launch Ads Studio
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredCampaigns.map((c: any) => {
              const statusCfg = STATUS_CONFIG[c?.status] || STATUS_CONFIG.draft;
              const reviewCfg = REVIEW_CONFIG[c?.review_status] || REVIEW_CONFIG.pending;
              const objectiveLabel = OBJECTIVES.find(o => o.value === c?.objective)?.label || c?.objective || "General";

              return (
                <div key={c?.id ?? Math.random()} className="p-4 sm:p-5 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1.5">
                        <h3 className="font-bold text-sm text-foreground truncate">{c?.name || "Untitled Campaign"}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.class}`}>
                          {statusCfg.label}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${reviewCfg.class}`}>
                          {reviewCfg.label}
                        </span>
                      </div>

                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">{objectiveLabel}</span>
                        {c?.daily_budget && <span>Daily: <strong className="text-foreground">{formatCurrency(c.daily_budget)}</strong></span>}
                        {c?.total_budget && <span>Total: <strong className="text-foreground">{formatCurrency(c.total_budget)}</strong></span>}
                        <span>Created {c?.created_at ? new Date(c.created_at).toLocaleDateString() : "-"}</span>
                        {c?.start_date && (
                          <span>
                            {new Date(c.start_date).toLocaleDateString()} - {c?.end_date ? new Date(c.end_date).toLocaleDateString() : "ongoing"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadAnalytics(c)}
                        title="Analytics"
                        className="h-8 w-8 p-0 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <BarChart3 weight="fill" className="w-4 h-4" />
                      </Button>
                      {c?.status === "active" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction(c.id, "pause")}
                          title="Pause"
                          className="h-8 w-8 p-0 rounded-lg hover:bg-amber-500/10 text-amber-600 hover:text-amber-700 dark:hover:text-amber-400"
                        >
                          <Pause weight="fill" className="w-4 h-4" />
                        </Button>
                      )}
                      {c?.status === "paused" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction(c.id, "resume")}
                          title="Resume"
                          className="h-8 w-8 p-0 rounded-lg hover:bg-emerald-500/10 text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400"
                        >
                          <Play weight="fill" className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(c?.id)}
                        title="Duplicate"
                        className="h-8 w-8 p-0 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <Copy weight="fill" className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(c?.id)}
                        title="Cancel"
                        className="h-8 w-8 p-0 rounded-lg hover:bg-rose-500/10 text-rose-500 hover:text-rose-600"
                      >
                        <Trash2 weight="fill" className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

