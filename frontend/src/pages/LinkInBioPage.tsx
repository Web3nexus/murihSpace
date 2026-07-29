import { useState, useEffect, useCallback } from "react";
import { Link2, Loader2, GripVertical, Edit, Trash2, Globe, ExternalLink, Tag, ShoppingCart, Plus, X, Music, Camera, MessageCircle, Send, Hash, Film, Link as LinkIcon, Check, Crown, Palette, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUploader } from "@/components/upload/ImageUploader";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = localStorage.getItem("murihspace-token") || localStorage.getItem("auth_token");
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface LinkItem { id: number; title: string; url: string; sort_order: number; is_active: boolean; click_count?: number; }
interface SocialLink { id: number; platform: string; url: string; sort_order: number; }
interface ProductItem { id: number; title: string; description: string | null; price: string; currency: string; type: string; media_url: string | null; checkout_url: string | null; is_active: boolean; sort_order: number; }

interface Theme {
  id: number; name: string; slug: string; description: string | null; is_premium: boolean;
  config: { bg: string; card_bg: string; text_color: string; accent: string; font: string; button_style: string; layout: string; background_type: string; background_value: string | null; };
}

const SOCIAL_PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: Camera }, { value: "twitter", label: "Twitter / X", icon: Hash },
  { value: "tiktok", label: "TikTok", icon: Music }, { value: "youtube", label: "YouTube", icon: Film },
  { value: "facebook", label: "Facebook", icon: MessageCircle }, { value: "snapchat", label: "Snapchat", icon: Send },
  { value: "linkedin", label: "LinkedIn", icon: LinkIcon }, { value: "github", label: "GitHub", icon: LinkIcon },
  { value: "website", label: "Website", icon: LinkIcon },
];

const CURRENCIES = ["GBP", "USD", "EUR"];
const FONT_OPTIONS = [
  { value: "sans", label: "Sans" }, { value: "serif", label: "Serif" }, { value: "mono", label: "Mono" },
];
const BUTTON_STYLES = [
  { value: "rounded", label: "Rounded" }, { value: "pill", label: "Pill" }, { value: "sharp", label: "Sharp" },
];
const LAYOUT_OPTIONS = [
  { value: "list", label: "List" }, { value: "grid", label: "Grid" },
];

const STEPS = [
  { key: "theme", label: "Theme", icon: Palette },
  { key: "style", label: "Style", icon: Palette },
  { key: "profile", label: "Profile", icon: Globe },
  { key: "links", label: "Links", icon: Link2 },
  { key: "social", label: "Social", icon: Send },
  { key: "products", label: "Products", icon: ShoppingCart },
];

export default function LinkInBioPage() {
  const [step, setStep] = useState(0);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [socials, setSocials] = useState<SocialLink[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Link form
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [editing, setEditing] = useState<LinkItem | null>(null);

  // Profile
  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  // Social form
  const [socialPlatform, setSocialPlatform] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [editingSocial, setEditingSocial] = useState<SocialLink | null>(null);

  // Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [prodTitle, setProdTitle] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodCurrency, setProdCurrency] = useState("GBP");
  const [prodType, setProdType] = useState<"digital" | "physical">("digital");
  const [prodMediaUrl, setProdMediaUrl] = useState("");
  const [prodCheckoutUrl, setProdCheckoutUrl] = useState("");
  const [editingProd, setEditingProd] = useState<ProductItem | null>(null);

  // Theme / Design
  const [availableThemes, setAvailableThemes] = useState<Theme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<number | null>(null);
  const [designBg, setDesignBg] = useState("#ffffff");
  const [designCardBg, setDesignCardBg] = useState("#f5f5f5");
  const [designText, setDesignText] = useState("#1a1a1a");
  const [designAccent, setDesignAccent] = useState("#2164b6");
  const [font, setFont] = useState("sans");
  const [buttonStyle, setButtonStyle] = useState("rounded");
  const [layout, setLayout] = useState("list");

  // ── Fetch ─────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bioRes, desRes] = await Promise.all([
        fetch(`${API_BASE}/link-in-bio`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/link-in-bio/design`, { headers: getAuthHeaders() }),
      ]);
      if (bioRes.ok) {
        const j = await bioRes.json();
        const list = j?.success ? j?.data : j;
        const data = list?.data ?? list;
        setLinks(Array.isArray(data?.links ?? data) ? (data?.links ?? []) : []);
        setSocials(Array.isArray(data?.social_links) ? data.social_links : []);
        setProducts(Array.isArray(data?.products) ? data.products : []);
        if (data) {
          setProfileName(data.profile_name ?? "");
          setProfileBio(data.profile_bio ?? "");
          setAvatarUrl(data.avatar_url ?? "");
          setBannerUrl(data.banner_url ?? "");
        }
      }
      if (desRes.ok) {
        const j = await desRes.json();
        const d = j?.success ? j?.data : j;
        const unwrapped = d?.data ?? d;
        if (unwrapped) {
          setAvailableThemes(unwrapped.available_themes ?? []);
          setSelectedTheme(unwrapped.theme_id);
          setDesignBg(unwrapped.bg ?? designBg);
          setDesignCardBg(unwrapped.card_bg ?? designCardBg);
          setDesignText(unwrapped.text_color ?? designText);
          setDesignAccent(unwrapped.accent ?? designAccent);
          setFont(unwrapped.font ?? font);
          setButtonStyle(unwrapped.button_style ?? buttonStyle);
          setLayout(unwrapped.layout ?? layout);
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Theme apply ──────────────────────────────────────────────

  const applyTheme = async (theme: Theme) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/link-in-bio/design/apply-theme`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ theme_id: theme.id }),
      });
      const j = await res.json();
      if (res.ok) {
        const d = j?.success ? j?.data : j;
        const unwrapped = d?.data ?? d;
        setDesignBg(unwrapped.bg ?? theme.config.bg);
        setDesignCardBg(unwrapped.card_bg ?? theme.config.card_bg);
        setDesignText(unwrapped.text_color ?? theme.config.text_color);
        setDesignAccent(unwrapped.accent ?? theme.config.accent);
        setFont(unwrapped.font ?? theme.config.font);
        setButtonStyle(unwrapped.button_style ?? theme.config.button_style);
        setLayout(unwrapped.layout ?? theme.config.layout);
        setSelectedTheme(theme.id);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const saveCustomDesign = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/link-in-bio/design`, {
        method: "PUT", headers: getAuthHeaders(),
        body: JSON.stringify({ bg: designBg, card_bg: designCardBg, text_color: designText, accent: designAccent, font, button_style: buttonStyle, layout }),
      });
      setSelectedTheme(null);
    } catch { /* ignore */ }
    setSaving(false);
  };

  // ── Link CRUD ────────────────────────────────────────────────

  const resetForm = () => { setTitle(""); setUrl(""); setEditing(null); setMsg(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setSaving(true); setMsg(null);
    try {
      const body = { title: title.trim(), url: url.trim(), sort_order: editing ? editing.sort_order : links.length };
      const res = editing
        ? await fetch(`${API_BASE}/link-in-bio/${editing.id}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(body) })
        : await fetch(`${API_BASE}/link-in-bio`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      setMsg({ ok: true, text: editing ? "Link updated." : "Link added." });
      resetForm(); fetchAll();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this link?")) return;
    try { await fetch(`${API_BASE}/link-in-bio/${id}`, { method: "DELETE", headers: getAuthHeaders() }); fetchAll(); } catch { /* ignore */ }
  };

  const startEdit = (link: LinkItem) => { setEditing(link); setTitle(link.title); setUrl(link.url); setMsg(null); };

  // ── Profile ──────────────────────────────────────────────────

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/link-in-bio/profile`, {
        method: "PUT", headers: getAuthHeaders(),
        body: JSON.stringify({ profile_name: profileName, profile_bio: profileBio, avatar_url: avatarUrl || null, banner_url: bannerUrl || null }),
      });
      if (res.ok) setMsg({ ok: true, text: "Profile saved!" }); else setMsg({ ok: false, text: "Save failed" });
    } catch { setMsg({ ok: false, text: "Save failed" }); }
    setTimeout(() => setMsg(null), 2000);
    setSaving(false);
  };

  // ── Social Links CRUD ────────────────────────────────────────

  const resetSocialForm = () => { setSocialPlatform(""); setSocialUrl(""); setEditingSocial(null); };

  const handleSaveSocial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socialPlatform || !socialUrl.trim()) return;
    setSaving(true);
    try {
      const body = { platform: socialPlatform, url: socialUrl.trim(), sort_order: editingSocial ? editingSocial.sort_order : socials.length };
      const res = editingSocial
        ? await fetch(`${API_BASE}/link-in-bio/socials/${editingSocial.id}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(body) })
        : await fetch(`${API_BASE}/link-in-bio/socials`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (res.ok) { resetSocialForm(); fetchAll(); } else setMsg({ ok: false, text: "Save social failed" });
    } catch { setMsg({ ok: false, text: "Save social failed" }); }
    setSaving(false);
  };

  const handleDeleteSocial = async (id: number) => {
    if (!confirm("Remove this social link?")) return;
    try { await fetch(`${API_BASE}/link-in-bio/socials/${id}`, { method: "DELETE", headers: getAuthHeaders() }); fetchAll(); } catch { /* ignore */ }
  };

  // ── Products CRUD ────────────────────────────────────────────

  const resetProductForm = () => {
    setProdTitle(""); setProdDesc(""); setProdPrice(""); setProdCurrency("GBP");
    setProdType("digital"); setProdMediaUrl(""); setProdCheckoutUrl(""); setEditingProd(null); setShowProductForm(false);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodTitle.trim() || !prodPrice) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: prodTitle.trim(), description: prodDesc.trim() || null, price: parseFloat(prodPrice),
        currency: prodCurrency, type: prodType, media_url: prodMediaUrl || null, checkout_url: prodCheckoutUrl || null,
        sort_order: editingProd ? editingProd.sort_order : products.length,
      };
      const res = editingProd
        ? await fetch(`${API_BASE}/link-in-bio/products/${editingProd.id}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(body) })
        : await fetch(`${API_BASE}/link-in-bio/products`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (res.ok) { resetProductForm(); fetchAll(); } else setMsg({ ok: false, text: "Save product failed" });
    } catch { setMsg({ ok: false, text: "Save product failed" }); }
    setSaving(false);
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm("Delete this product?")) return;
    try { await fetch(`${API_BASE}/link-in-bio/products/${id}`, { method: "DELETE", headers: getAuthHeaders() }); fetchAll(); } catch { /* ignore */ }
  };

  const startEditProduct = (p: ProductItem) => {
    setEditingProd(p); setProdTitle(p.title); setProdDesc(p.description ?? ""); setProdPrice(p.price);
    setProdCurrency(p.currency); setProdType(p.type as "digital" | "physical");
    setProdMediaUrl(p.media_url ?? ""); setProdCheckoutUrl(p.checkout_url ?? ""); setShowProductForm(true);
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  const msgBg = msg ? (msg.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400") : "";

  const btnRadius = buttonStyle === "pill" ? "rounded-full" : buttonStyle === "sharp" ? "rounded-none" : "rounded-xl";

  return (
    <div className="w-full mx-auto max-w-[1200px] space-y-6 p-6 lg:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Link2 className="h-6 w-6 text-[#38A8D8]" /> Link in Bio Builder
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Set up your page in 6 easy steps.</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1 bg-muted p-1 rounded-xl overflow-x-auto">
        {STEPS.map((s, i) => (
          <button key={s.key} onClick={() => setStep(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors ${
              step === i ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            } ${i < step ? "text-emerald-400" : ""}`}>
            <s.icon className="h-3 w-3" />
            {s.label}
          </button>
        ))}
      </div>

      {msg && <div className={`p-3 rounded-xl border text-xs font-bold ${msgBg}`}>{msg.text}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ──────────── Left Column: Step Content ──────────── */}
        <div className="space-y-4">

          {/* Step 0: Theme */}
          {step === 0 && (
            <div className="border border-border rounded-2xl bg-card p-6">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Choose a Theme</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {availableThemes.map((theme) => {
                  const c = theme.config;
                  const isActive = selectedTheme === theme.id;
                  return (
                    <button key={theme.id} onClick={() => applyTheme(theme)} disabled={saving}
                      className={`relative p-3 rounded-xl border-2 transition-all text-left overflow-hidden ${
                        isActive ? "border-[#38A8D8] shadow-md" : "border-border hover:border-[#38A8D8]/50"
                      }`} style={{ background: c.bg, color: c.text_color }}>
                      {theme.is_premium && <span className="absolute top-1 right-1"><Crown className="h-3 w-3 text-amber-400" /></span>}
                      {isActive && <span className="absolute top-1 left-1 bg-[#38A8D8] text-white rounded-full p-0.5"><Check className="h-3 w-3" /></span>}
                      <div className="flex gap-1 mb-2">
                        <div className="w-4 h-4 rounded-full" style={{ background: c.bg, border: "1px solid rgba(0,0,0,0.1)" }} />
                        <div className="w-4 h-4 rounded-full" style={{ background: c.card_bg, border: "1px solid rgba(0,0,0,0.1)" }} />
                        <div className="w-4 h-4 rounded-full" style={{ background: c.accent }} />
                      </div>
                      <p className="text-xs font-bold truncate">{theme.name}</p>
                    </button>
                  );
                })}
              </div>
              {availableThemes.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No themes available.</p>}
              <div className="flex justify-end mt-4">
                <Button size="sm" onClick={() => setStep(1)} className="text-xs font-bold">
                  Customize <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 1: Style */}
          {step === 1 && (
            <div className="border border-border rounded-2xl bg-card p-6 space-y-5">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Customize Style</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  ["Background", designBg, setDesignBg], ["Card", designCardBg, setDesignCardBg],
                  ["Text", designText, setDesignText], ["Accent", designAccent, setDesignAccent],
                ] as const).map(([label, val, set]) => (
                  <div key={label} className="flex items-center gap-3">
                    <label className="text-xs font-bold text-muted-foreground w-20">{label}</label>
                    <input type="color" value={val} onChange={(e) => set(e.target.value)} className="w-8 h-8 rounded-lg border border-border cursor-pointer shrink-0" />
                    <input value={val} onChange={(e) => set(e.target.value)} className="flex-1 rounded-xl border border-border bg-card p-2 text-xs font-mono text-foreground" />
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1.5">Font</label>
                    <div className="flex gap-1">
                      {FONT_OPTIONS.map((f) => (
                        <button key={f.value} onClick={() => setFont(f.value)}
                          className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${font === f.value ? "bg-[#38A8D8] text-white" : "bg-muted text-muted-foreground"}`}>{f.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1.5">Buttons</label>
                    <div className="flex gap-1">
                      {BUTTON_STYLES.map((b) => (
                        <button key={b.value} onClick={() => setButtonStyle(b.value)}
                          className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${buttonStyle === b.value ? "bg-[#38A8D8] text-white" : "bg-muted text-muted-foreground"}`}>{b.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1.5">Layout</label>
                    <div className="flex gap-1">
                      {LAYOUT_OPTIONS.map((l) => (
                        <button key={l.value} onClick={() => setLayout(l.value)}
                          className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${layout === l.value ? "bg-[#38A8D8] text-white" : "bg-muted text-muted-foreground"}`}>{l.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <Button size="sm" variant="ghost" onClick={() => setStep(0)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Theme</Button>
                <Button size="sm" onClick={async () => { await saveCustomDesign(); setStep(2); }} className="text-xs font-bold" disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Save & Next <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Profile */}
          {step === 2 && (
            <div className="border border-border rounded-2xl bg-card overflow-hidden">
              <div className="h-32 sm:h-40 bg-gradient-to-br from-[#38A8D8]/20 to-[#2164b6]/20 relative">
                {bannerUrl && <img src={bannerUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                <div className="absolute inset-0 flex items-end p-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-card bg-muted shadow-md">
                    {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center"><Globe className="h-6 w-6 text-muted-foreground/50" /></div>}
                  </div>
                </div>
              </div>
              <div className="p-4 pt-2 space-y-3">
                <h3 className="text-base font-black text-foreground">{profileName || "Your Name"}</h3>
                {profileBio && <p className="text-xs text-muted-foreground mt-0.5">{profileBio}</p>}
                <div className="flex gap-2">
                  <ImageUploader value={bannerUrl} onChange={setBannerUrl} folder="banners" label="Banner" />
                  <ImageUploader value={avatarUrl} onChange={setAvatarUrl} folder="avatars" label="Avatar" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Display Name</label>
                  <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Bio</label>
                  <textarea value={profileBio} onChange={(e) => setProfileBio(e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-card p-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground resize-none" placeholder="A short bio..." />
                </div>
                <Button onClick={saveProfile} disabled={saving} className="text-sm font-bold w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save Profile
                </Button>
                <div className="flex justify-between">
                  <Button size="sm" variant="ghost" onClick={() => setStep(1)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Style</Button>
                  <Button size="sm" onClick={() => setStep(3)} className="text-xs font-bold">Next: Links <ChevronRight className="h-3 w-3 ml-1" /></Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Links */}
          {step === 3 && (
            <>
              <form onSubmit={handleSave} className="border border-border rounded-2xl bg-card p-6 space-y-4">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{editing ? "Edit Link" : "Add Link"}</h2>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Title</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Website" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">URL</label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." required />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving || !title.trim() || !url.trim()} className="text-sm font-bold">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editing ? "Update" : "Add"}
                  </Button>
                  {editing && <Button type="button" variant="ghost" onClick={resetForm} className="text-sm">Cancel</Button>}
                </div>
              </form>
              <div className="border border-border rounded-2xl bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">All Links</span>
                </div>
                {links.length === 0 ? (
                  <div className="p-12 text-center"><Link2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" /><p className="text-xs text-muted-foreground">No links added yet.</p></div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {links.map((link, i) => (
                      <div key={link.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] text-muted-foreground font-mono w-4">{i + 1}</span>
                          <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{link.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{link.url}</p>
                          {link.click_count !== undefined && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {link.click_count} click{link.click_count !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => startEdit(link)}><Edit className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => handleDelete(link.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between items-center p-4 border-t border-border">
                  <Button size="sm" variant="ghost" onClick={() => setStep(2)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Profile</Button>
                  <Button size="sm" onClick={() => setStep(4)} className="text-xs font-bold">Next: Social <ChevronRight className="h-3 w-3 ml-1" /></Button>
                </div>
              </div>
            </>
          )}

          {/* Step 4: Social */}
          {step === 4 && (
            <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Send className="h-3 w-3" /> Social Links</h2>
              <form onSubmit={handleSaveSocial} className="space-y-3">
                <select value={socialPlatform} onChange={(e) => setSocialPlatform(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-medium text-foreground">
                  <option value="">Select platform</option>
                  {SOCIAL_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <div className="flex gap-2">
                  <Input value={socialUrl} onChange={(e) => setSocialUrl(e.target.value)} placeholder="https://..." className="flex-1" />
                  <Button type="submit" disabled={saving || !socialPlatform || !socialUrl.trim()} size="sm" className="text-xs font-bold">
                    {editingSocial ? "Update" : "Add"}
                  </Button>
                  {editingSocial && <Button type="button" variant="ghost" size="sm" onClick={resetSocialForm} className="text-xs"><X className="h-3 w-3" /></Button>}
                </div>
              </form>
              {socials.length > 0 && (
                <div className="space-y-1.5">
                  {socials.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-xl bg-muted/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground capitalize shrink-0">{s.platform}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{s.url}</span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditingSocial(s); setSocialPlatform(s.platform); setSocialUrl(s.url); }} className="p-1 text-muted-foreground hover:text-foreground"><Edit className="h-3 w-3" /></button>
                        <button onClick={() => handleDeleteSocial(s.id)} className="p-1 text-rose-400"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between">
                <Button size="sm" variant="ghost" onClick={() => setStep(3)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Links</Button>
                <Button size="sm" onClick={() => setStep(5)} className="text-xs font-bold">Next: Products <ChevronRight className="h-3 w-3 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* Step 5: Products */}
          {step === 5 && (
            <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><ShoppingCart className="h-3 w-3" /> Products</h2>
                {!showProductForm && <Button size="sm" variant="ghost" onClick={() => setShowProductForm(true)} className="text-xs font-bold"><Plus className="h-3 w-3 mr-1" /> Add</Button>}
              </div>
              {showProductForm && (
                <form onSubmit={handleSaveProduct} className="space-y-3 border border-border rounded-xl p-4 bg-muted/30">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-muted-foreground">Title</label>
                      <Input value={prodTitle} onChange={(e) => setProdTitle(e.target.value)} placeholder="Product name" required />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-muted-foreground">Description</label>
                      <textarea value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-medium text-foreground placeholder:text-muted-foreground resize-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground">Price</label>
                      <div className="flex gap-1">
                        <select value={prodCurrency} onChange={(e) => setProdCurrency(e.target.value)} className="w-16 rounded-xl border border-border bg-card p-2 text-xs font-medium text-foreground">
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <Input type="number" step="0.01" min="0" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} placeholder="0.00" required />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground">Type</label>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setProdType("digital")} className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold ${prodType === "digital" ? "bg-[#38A8D8] text-white" : "bg-muted text-muted-foreground"}`}>Digital</button>
                        <button type="button" onClick={() => setProdType("physical")} className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold ${prodType === "physical" ? "bg-[#38A8D8] text-white" : "bg-muted text-muted-foreground"}`}>Physical</button>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <ImageUploader value={prodMediaUrl} onChange={setProdMediaUrl} folder="products" label="Product image" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-muted-foreground">Checkout URL</label>
                      <Input value={prodCheckoutUrl} onChange={(e) => setProdCheckoutUrl(e.target.value)} placeholder="https://..." />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="submit" disabled={saving || !prodTitle.trim() || !prodPrice} size="sm" className="text-xs font-bold">
                      {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}{editingProd ? "Update" : "Add"} Product
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={resetProductForm} className="text-xs">Cancel</Button>
                  </div>
                </form>
              )}
              {products.length > 0 && (
                <div className="space-y-1.5">
                  {products.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-muted/50">
                      <div className="flex items-center gap-2 min-w-0">
                        {p.media_url ? <img src={p.media_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          : <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><Tag className="h-3 w-3 text-muted-foreground" /></div>}
                        <div className="min-w-0"><p className="text-xs font-bold truncate">{p.title}</p><p className="text-[10px] text-muted-foreground">{p.currency} {p.price} · {p.type}</p></div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEditProduct(p)} className="p-1 text-muted-foreground hover:text-foreground"><Edit className="h-3 w-3" /></button>
                        <button onClick={() => handleDeleteProduct(p.id)} className="p-1 text-rose-400"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {products.length === 0 && !showProductForm && <p className="text-xs text-muted-foreground text-center py-4">No products yet.</p>}
              <div className="flex">
                <Button size="sm" variant="ghost" onClick={() => setStep(4)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Social</Button>
              </div>
            </div>
          )}
        </div>

        {/* ──────────── Right Column: Preview ──────────── */}
        <div className="border border-border rounded-2xl bg-card p-6">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Preview</h2>
          <div className="mx-auto max-w-[320px] rounded-2xl shadow-sm transition-all duration-300 overflow-hidden"
            style={{ background: designBg, color: designText }}>
            {/* Banner hero */}
            <div className="h-36 relative" style={{ background: `${designAccent}15` }}>
              {bannerUrl ? (
                <img src={bannerUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Globe className="h-10 w-10" style={{ color: `${designAccent}30` }} />
                </div>
              )}
            </div>
            <div className="px-5 pb-5 -mt-10 relative z-10">
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center overflow-hidden border-4 shadow-md"
                style={{ borderColor: designBg, background: avatarUrl ? "transparent" : `${designAccent}20` }}>
                {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <Globe className="h-8 w-8" style={{ color: designAccent }} />}
              </div>
              <div className="mt-2 text-center">
                <h3 className="text-base font-black" style={{ color: designText }}>{profileName || "Your Name"}</h3>
                {profileBio && <p className="text-xs mt-0.5" style={{ color: `${designText}99` }}>{profileBio}</p>}
              </div>
              {socials.length > 0 && (
                <div className="flex justify-center gap-2 mt-3">
                  {socials.map((s) => (
                    <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                      style={{ background: `${designAccent}20`, color: designAccent }}>
                      {s.platform === "instagram" && <Camera className="h-3.5 w-3.5" />}
                      {s.platform === "twitter" && <Hash className="h-3.5 w-3.5" />}
                      {s.platform === "tiktok" && <Music className="h-3.5 w-3.5" />}
                      {s.platform === "youtube" && <Film className="h-3.5 w-3.5" />}
                      {s.platform === "facebook" && <MessageCircle className="h-3.5 w-3.5" />}
                      {s.platform === "snapchat" && <Send className="h-3.5 w-3.5" />}
                      {!["instagram","twitter","tiktok","youtube","facebook","snapchat"].includes(s.platform) && <LinkIcon className="h-3.5 w-3.5" />}
                    </a>
                  ))}
                </div>
              )}
              <div className="space-y-2 mt-4">
                {links.map((link) => (
                  <div key={link.id} className={`flex items-center gap-3 p-3 transition-colors text-left ${btnRadius}`}
                    style={{ background: designCardBg, color: designText, border: `1px solid ${designText}20` }}>
                    <GripVertical className="h-4 w-4 shrink-0" style={{ color: `${designText}30` }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{link.title}</p>
                      <p className="text-[10px] truncate" style={{ color: `${designText}70` }}>{link.url}</p>
                    </div>
                    <ExternalLink className="h-3 w-3 shrink-0" style={{ color: `${designText}50` }} />
                  </div>
                ))}
                {links.length === 0 && <p className="text-xs py-4 text-center" style={{ color: `${designText}50` }}>No links yet</p>}
              </div>
              {layout === "grid" && links.length > 0 && <p className="text-[10px] text-center mt-2" style={{ color: `${designText}50` }}>Grid layout</p>}
              {products.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: `${designText}70` }}>Products</h4>
                  <div className="space-y-2">
                    {products.map((p) => (
                      <div key={p.id} className={`flex items-center gap-3 p-2.5 text-left ${btnRadius}`}
                        style={{ background: designCardBg, border: `1px solid ${designText}20` }}>
                        {p.media_url ? <img src={p.media_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          : <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${designAccent}20` }}><Tag className="h-4 w-4" style={{ color: designAccent }} /></div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: designText }}>{p.title}</p>
                          <p className="text-[10px]" style={{ color: `${designText}70` }}>{p.currency} {p.price}</p>
                        </div>
                        <div className="text-[10px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap" style={{ background: designAccent, color: "#fff" }}>Buy</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className={`w-full py-2 text-xs font-bold mt-4 text-center ${btnRadius}`} style={{ background: designAccent, color: "#fff" }}>
                @{profileName || "username"}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-3">
            Changes update in real time
          </p>
        </div>
      </div>
    </div>
  );
}
