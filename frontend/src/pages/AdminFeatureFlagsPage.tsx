import { useState, useEffect, useCallback } from "react";
import {
  Settings2, Film, Link2, Users, Radio, Package, ShoppingCart, Crown,
  Megaphone, Briefcase, BarChart3, MessageSquare, Bot, Wallet,
  Shield, Globe, BookOpen, Calendar, Store, Heart, ShieldCheck,
  Flag, Loader2, AlertCircle, CheckCircle2, Search, Plus, Trash2, X,
} from "lucide-react";
import { getAuthToken } from "@/lib/auth/token";
import { refreshFeatureFlags } from "@/hooks/useFeatureFlags";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function authHeaders() {
  const t = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

interface FeatureFlag {
  id: number; key: string; label: string; description?: string; enabled: boolean;
  created_at: string; updated_at: string;
}

interface FeatureDef {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  category: "CREATE" | "COMMUNITY" | "COMMERCE" | "MARKETING" | "CONNECT" | "FINANCE" | "ADMIN" | "AI";
}

const ALL_FEATURES: FeatureDef[] = [
  { key: "content_studio", label: "Content Studio", description: "Video creation and editing tools", icon: Film, category: "CREATE" },
  { key: "link_in_bio", label: "Link in Bio", description: "Custom landing page builder", icon: Link2, category: "CREATE" },
  { key: "stories", label: "Stories", description: "Ephemeral story posts", icon: Radio, category: "CREATE" },
  { key: "events", label: "Events", description: "Create and host events", icon: Calendar, category: "COMMUNITY" },
  { key: "audio_rooms", label: "Audio Rooms", description: "Live voice chat rooms", icon: Radio, category: "COMMUNITY" },
  { key: "community_hub", label: "Community Hub", description: "Create and manage communities", icon: Users, category: "COMMUNITY" },
  { key: "community_feed", label: "Community Feed", description: "Posts and activity feed", icon: Globe, category: "COMMUNITY" },
  { key: "community_chat", label: "Community Chat", description: "Real-time group chat channels", icon: MessageSquare, category: "COMMUNITY" },
  { key: "digital_products", label: "Digital Products", description: "Sell digital downloads and files", icon: Package, category: "COMMERCE" },
  { key: "online_courses", label: "Online Courses", description: "Video course platform", icon: BookOpen, category: "COMMERCE" },
  { key: "coaching", label: "1:1 Coaching", description: "Booking and scheduling", icon: Users, category: "COMMERCE" },
  { key: "physical_products", label: "Physical Products", description: "Merchandise and physical goods", icon: Store, category: "COMMERCE" },
  { key: "subscriptions", label: "Memberships", description: "Recurring subscription plans", icon: Crown, category: "COMMERCE" },
  { key: "storefront", label: "Storefront", description: "Public creator store page", icon: Store, category: "COMMERCE" },
  { key: "orders", label: "Orders & Fulfilment", description: "Order management system", icon: ShoppingCart, category: "COMMERCE" },
  { key: "email_broadcasts", label: "Email Broadcasts", description: "Send marketing emails", icon: Megaphone, category: "MARKETING" },
  { key: "email_sequences", label: "Automated Sequences", description: "Email drip campaigns", icon: Megaphone, category: "MARKETING" },
  { key: "affiliates", label: "Affiliate Program", description: "Referral and affiliate system", icon: Heart, category: "MARKETING" },
  { key: "brand_deals", label: "Brand Deals", description: "Sponsorship marketplace", icon: Briefcase, category: "MARKETING" },
  { key: "media_kit", label: "Media Kit", description: "Creator press kit builder", icon: Briefcase, category: "MARKETING" },
  { key: "referrals", label: "Referral Program", description: "User referral rewards", icon: Heart, category: "MARKETING" },
  { key: "inbox", label: "MurihSpace Inbox", description: "Direct messaging system", icon: MessageSquare, category: "CONNECT" },
  { key: "ai_assistant", label: "AI Assistant", description: "AI-powered content assistant", icon: Bot, category: "AI" },
  { key: "analytics", label: "Analytics", description: "Dashboard and insights", icon: BarChart3, category: "ADMIN" },
  { key: "wallet", label: "MurihPay Wallet", description: "Digital wallet and payments", icon: Wallet, category: "FINANCE" },
  { key: "payouts", label: "Payouts", description: "Creator earnings withdrawals", icon: Wallet, category: "FINANCE" },
  { key: "escrow", label: "Escrow", description: "Secure transaction escrow", icon: Shield, category: "FINANCE" },
  { key: "kyc", label: "KYC Verification", description: "Identity verification system", icon: ShieldCheck, category: "ADMIN" },
  { key: "moderation", label: "Moderation", description: "Content moderation tools", icon: Shield, category: "ADMIN" },
  { key: "securegate", label: "Securegate Admin", description: "Admin panel access", icon: Settings2, category: "ADMIN" },
];

const CATEGORY_ORDER: ["CREATE", "COMMUNITY", "COMMERCE", "MARKETING", "CONNECT", "AI", "FINANCE", "ADMIN"] = [
  "CREATE", "COMMUNITY", "COMMERCE", "MARKETING", "CONNECT", "AI", "FINANCE", "ADMIN",
];

const CATEGORY_BADGE: Record<string, string> = {
  CREATE: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  COMMUNITY: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  COMMERCE: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  MARKETING: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  CONNECT: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  AI: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  FINANCE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  ADMIN: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

export function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchFlags = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/securegate/feature-flags`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      const j = await res.json();
      const d = j?.success ? j.data : j;
      setFlags((d?.data as FeatureFlag[]) ?? []);
    } catch { setError("Failed to load feature flags"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const allFlagKeys = flags.map((f) => f.key);

  const featuresWithStatus = ALL_FEATURES.map((f) => ({
    ...f,
    enabled: allFlagKeys.includes(f.key) ? flags.find((fl) => fl.key === f.key)!.enabled : false,
    dbFlag: flags.find((fl) => fl.key === f.key) ?? null,
    exists: allFlagKeys.includes(f.key),
  }));

  const toggleFeature = async (feature: { key: string; label: string; description?: string; enabled: boolean }, currentEnabled: boolean) => {
    setToggling(feature.key);
    try {
      const existing = flags.find((f) => f.key === feature.key);
      if (existing) {
        const res = await fetch(`${API_BASE}/securegate/feature-flags/${existing.id}`, {
          method: "PUT", headers: authHeaders(),
          body: JSON.stringify({ enabled: !currentEnabled }),
        });
        if (res.ok) {
          const j = await res.json();
          const d = j?.success ? j.data : j;
          if (d?.data) setFlags((prev) => prev.map((f) => f.id === existing.id ? (d.data as FeatureFlag) : f));
          refreshFeatureFlags();
        } else {
          const j = await res.json().catch(() => null);
          const d = j?.success ? j.data : j;
          setError((d?.message as string) || `Failed to toggle ${feature.label} (${res.status}).`);
        }
      } else {
        const res = await fetch(`${API_BASE}/securegate/feature-flags`, {
          method: "POST", headers: authHeaders(),
          body: JSON.stringify({ key: feature.key, label: feature.label, description: feature.description, enabled: true }),
        });
        if (res.ok) { fetchFlags(); refreshFeatureFlags(); }
        else {
          const j = await res.json().catch(() => null);
          const d = j?.success ? j.data : j;
          setError((d?.message as string) || `Failed to enable ${feature.label} (${res.status}).`);
        }
      }
    } catch { setError("Failed to toggle feature"); }
    finally { setToggling(null); }
  };

  const deleteFlag = async (id: number) => {
    setDeleting(id);
    try {
      const res = await fetch(`${API_BASE}/securegate/feature-flags/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        const d = j?.success ? j.data : j;
        setError((d?.message as string) || `Failed to delete flag (${res.status}).`);
        return;
      }
      setFlags((prev) => prev.filter((f) => f.id !== id));
      refreshFeatureFlags();
    } catch { setError("Failed to delete flag"); }
    finally { setDeleting(null); }
  };

  const createFlag = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setSubmitting(true); setMsg(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`${API_BASE}/securegate/feature-flags`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ key: form.get("key"), label: form.get("label"), description: form.get("description") }),
      });
      if (res.ok) { setMsg({ type: "success", text: "Feature flag created." }); setShowCreate(false); fetchFlags(); refreshFeatureFlags(); }
      else {
        const j = await res.json().catch(() => null);
        const d = j?.success ? j.data : j;
        setMsg({ type: "error", text: (d?.message as string) || `Failed. (${res.status})` });
      }
    } catch { setMsg({ type: "error", text: "Network error." }); }
    setSubmitting(false);
  };

  const filtered = featuresWithStatus.filter((f) => {
    if (categoryFilter && f.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.key.toLowerCase().includes(q);
    }
    return true;
  });

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = filtered.filter((f) => f.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {} as Record<string, typeof featuresWithStatus>);

  const enabledCount = featuresWithStatus.filter((f) => f.enabled).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#2164b6] to-[#1a6b9e] flex items-center justify-center shadow-sm">
                <Settings2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-foreground tracking-tight">Feature Management</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Enable, disable, and manage all platform features</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border/50">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {enabledCount}/{ALL_FEATURES.length} features enabled
            </div>
            <button
              onClick={() => { setShowCreate(true); setMsg(null); }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2164b6] text-white text-xs font-bold hover:bg-[#1a5091] transition-all shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Custom Flag
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground font-bold">Dismiss</button>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search features..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-muted/50 border border-border/50 outline-none focus:ring-1 focus:ring-[#2164b6]/40 focus:border-[#2164b6]/30 placeholder:text-muted-foreground/40 transition-all"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  categoryFilter === cat
                    ? `${CATEGORY_BADGE[cat]} ring-1 ring-inset ring-current`
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {cat.charAt(0) + cat.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Feature List */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" />
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-16 text-center">
                <Settings2 className="h-10 w-10 text-muted-foreground/30" />
                <h3 className="text-sm font-bold text-foreground">No features found</h3>
                <p className="text-xs text-muted-foreground/60">Try adjusting your search or filter.</p>
              </div>
            ) : (
              Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-sm font-extrabold text-foreground tracking-tight">{cat.charAt(0) + cat.slice(1).toLowerCase()}</h3>
                    <div className="h-px flex-1 bg-border/40" />
                    <span className="text-[10px] font-medium text-muted-foreground/50">{items.length} features</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((f) => (
                      <div
                        key={f.key}
                        className={`group relative rounded-2xl border bg-card p-4 transition-all duration-200 hover:shadow-sm ${
                          f.enabled
                            ? "border-[#2164b6]/20 hover:border-[#2164b6]/40"
                            : "border-border/60 hover:border-border"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${f.enabled ? "from-[#2164b6]/15 to-[#1a6b9e]/10" : "from-muted to-muted/50"} flex items-center justify-center shrink-0 transition-all group-hover:scale-105`}>
                              <f.icon className={`h-4 w-4 ${f.enabled ? "text-[#2164b6] dark:text-[#7ab0ff]" : "text-muted-foreground/40"}`} />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs font-bold truncate ${f.enabled ? "text-foreground" : "text-muted-foreground/60"}`}>
                                {f.label}
                              </p>
                              <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">{f.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {f.dbFlag && (
                              <button
                                onClick={() => deleteFlag(f.dbFlag!.id)}
                                disabled={deleting === f.dbFlag!.id}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground/30 hover:text-destructive transition-all"
                                title="Remove flag"
                              >
                                {deleting === f.dbFlag!.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                              </button>
                            )}
                            <button
                              onClick={() => toggleFeature(f, f.enabled)}
                              disabled={toggling === f.key}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                f.enabled ? "bg-[#2164b6]" : "bg-muted-foreground/20"
                              } ${toggling === f.key ? "opacity-50" : ""}`}
                              role="switch"
                              aria-checked={f.enabled}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  f.enabled ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                        <div className={`absolute top-3 right-12 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${CATEGORY_BADGE[f.category]} opacity-0 group-hover:opacity-100 transition-opacity`}>
                          {f.category}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Custom flags section */}
        {flags.filter((f) => !ALL_FEATURES.some((af) => af.key === f.key)).length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-sm font-extrabold text-foreground tracking-tight">Custom Flags</h3>
              <div className="h-px flex-1 bg-border/40" />
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="divide-y divide-border">
                {flags.filter((f) => !ALL_FEATURES.some((af) => af.key === f.key)).map((f) => (
                  <div key={f.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-muted-foreground/40" />
                        <p className="text-sm font-bold text-foreground">{f.label}</p>
                        <code className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{f.key}</code>
                      </div>
                      {f.description && <p className="mt-0.5 text-xs text-muted-foreground/60 ml-6">{f.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleFeature(f, f.enabled)}
                        disabled={toggling === f.key}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          f.enabled ? "bg-[#2164b6]" : "bg-muted-foreground/20"
                        } ${toggling === f.key ? "opacity-50" : ""}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ${
                          f.enabled ? "translate-x-4" : "translate-x-0"
                        }`} />
                      </button>
                      <button
                        onClick={() => deleteFlag(f.id)}
                        disabled={deleting === f.id}
                        className="rounded-lg p-1.5 text-muted-foreground/30 hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        {deleting === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) setMsg(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <Flag className="h-5 w-5 text-[#2164b6] dark:text-[#7ab0ff]" /> Custom Feature Flag
              </DialogTitle>
              <DialogDescription>Add a custom toggle for any platform feature.</DialogDescription>
            </DialogHeader>

            {msg && (
              <div className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                msg.type === "success" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
              }`}>
                {msg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                {msg.text}
              </div>
            )}

            <form onSubmit={createFlag} className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Key</label>
                <input name="key" placeholder="e.g. new_checkout" required
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-[#2164b6]/50 focus:ring-1 focus:ring-[#2164b6]/20" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Label</label>
                <input name="label" placeholder="Display label" required
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-[#2164b6]/50 focus:ring-1 focus:ring-[#2164b6]/20" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Description</label>
                <input name="description" placeholder="What does this flag control?"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-[#2164b6]/50 focus:ring-1 focus:ring-[#2164b6]/20" />
              </div>
              <DialogFooter className="-mx-4 -mb-4 mt-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => { setShowCreate(false); setMsg(null); }}
                  className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="rounded-xl bg-[#2164b6] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#1a5091] disabled:opacity-50 shadow-xs transition-all">
                  {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Create Flag"}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
