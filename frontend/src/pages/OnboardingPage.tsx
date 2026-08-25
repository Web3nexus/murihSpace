import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Loader2, Wand2, Send, Plus, X, Check, ChevronRight, ChevronLeft,
  Camera, Music, Hash, Film, MessageCircle, Link as LinkIcon, ShoppingCart,
  Palette, ArrowRight, Smartphone, Store, User as UserIcon,
  Package, Globe, Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeraIcon } from "@/components/brand/MeraIcon";
import { authFetch } from "@/lib/api/authFetch";
import { useAuth } from "@/hooks/useAuth";
import { TEMPLATES, templateBySlug } from "@/lib/linkBioTemplates";
import type { LinkBioPageData } from "@/lib/linkBioTypes";
import TemplateRenderer from "@/components/linkbio/TemplateRenderer";
import TemplateThumb from "@/components/linkbio/TemplateThumb";
import { CountrySelect } from "@/components/forms/CountrySelect";





const SOCIAL_PLATFORMS: { value: string; label: string; placeholder: string; icon: React.ReactNode }[] = [
  { value: "instagram", label: "Instagram", placeholder: "your_handle", icon: <Camera className="h-4 w-4" /> },
  { value: "twitter", label: "Twitter / X", placeholder: "your_handle", icon: <Hash className="h-4 w-4" /> },
  { value: "tiktok", label: "TikTok", placeholder: "your_handle", icon: <Music className="h-4 w-4" /> },
  { value: "youtube", label: "YouTube", placeholder: "your_channel", icon: <Film className="h-4 w-4" /> },
  { value: "facebook", label: "Facebook", placeholder: "your.page", icon: <MessageCircle className="h-4 w-4" /> },
  { value: "snapchat", label: "Snapchat", placeholder: "your_snap", icon: <Send className="h-4 w-4" /> },
  { value: "linkedin", label: "LinkedIn", placeholder: "your_name", icon: <LinkIcon className="h-4 w-4" /> },
  { value: "github", label: "GitHub", placeholder: "your_name", icon: <LinkIcon className="h-4 w-4" /> },
  { value: "pinterest", label: "Pinterest", placeholder: "your_name", icon: <LinkIcon className="h-4 w-4" /> },
  { value: "twitch", label: "Twitch", placeholder: "your_channel", icon: <LinkIcon className="h-4 w-4" /> },
];


const COMMUNITY_OPTIONS = [
  "Creators", "Artists", "Musicians", "Fitness & Health", "Cooking & Food", "Parenting",
  "Gaming", "Tech & Coding", "Fashion", "Beauty", "Travel", "Education", "Business & Finance",
  "Photography", "Writing & Books", "Sports", "DIY & Crafts", "Spirituality & Wellness",
];

const CONTENT_OPTIONS = [
  "Short videos", "Long videos", "Photos", "Live streams", "Blog posts", "Courses",
  "Podcasts", "Newsletters", "Digital products", "Coaching & consulting", "Merch & products",
  "Community events", "Exclusive content", "How-to guides",
];

const FULFILMENT_MODELS = [
  "Self-fulfilled (hand-shipped)", "Dropshipping", "Print-on-demand", "Digital / Instant download", "Local pickup only"
];

const BUSINESS_CATEGORIES = [
  "Apparel & Fashion", "Beauty & Cosmetics", "Electronics & Tech", "Home & Living",
  "Fitness & Sports", "Digital Downloads", "Art & Collectibles", "Food & Beverage", "Services & Consulting"
];

interface ChatMsg { role: "user" | "assistant"; content: string; }

const QUICK_PROMPTS = [
  "I want to build an audience",
  "What content should I make?",
  "I sell products online",
  "Help me plan my first week",
];



export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, markOnboardingCompleted, refreshUser } = useAuth();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string>("member");
  const [steps, setSteps] = useState<{ key: string; label: string }[]>([]);

  // Member state
  const [memberInterests, setMemberInterests] = useState<string[]>([]);
  const [notifyFeed, setNotifyFeed] = useState(true);

  // Vendor state
  const [businessName, setBusinessName] = useState("");
  const [businessCategory, setBusinessCategory] = useState("Apparel & Fashion");
  const [fulfilmentModel, setFulfilmentModel] = useState("Self-fulfilled (hand-shipped)");
  const [vendorCountry, setVendorCountry] = useState("GB");
  const [vendorBio, setVendorBio] = useState("");

  // Creator state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [about, setAbout] = useState("");
  const [niche, setNiche] = useState("");

  // Socials
  const [socialRows, setSocialRows] = useState<{ platform: string; handle: string }[]>([]);
  const [socialPlatform, setSocialPlatform] = useState("instagram");
  const [socialHandle, setSocialHandle] = useState("");

  // Creator Interests
  const [communityInterests, setCommunityInterests] = useState<string[]>([]);
  const [contentInterests, setContentInterests] = useState<string[]>([]);

  // Profile Draft
  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);

  // Template
  const [template, setTemplate] = useState("minimal");

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load config & saved progress
  const loadConfig = useCallback(async () => {
    const userRole = (user?.role as string) ?? "member";
    if (userRole === "admin" || user?.onboarding_completed) {
      markOnboardingCompleted();
      navigate(userRole === "admin" ? "/app/securegate" : "/app", { replace: true });
      return;
    }

    try {
      const res = await authFetch(`/onboarding/config`, {  });
      const j = await res.json();
      const d = j?.data ?? j;
      if (d) {
        if (d.onboarding_completed) {
          markOnboardingCompleted();
          navigate(userRole === "admin" ? "/app/securegate" : userRole === "vendor" ? "/app/storefront" : userRole === "creator" ? "/app/link-in-bio" : "/app", { replace: true });
          return;
        }

        setRole(d.role ?? user?.role ?? "member");
        setSteps(d.steps ?? []);

        // Restore saved progress if available
        const saved = d.saved_progress;
        if (saved && typeof saved.step === "number") {
          setStep(saved.step);
        }

        const p = d.profile ?? {};
        setAbout(p.about ?? "");
        setNiche(p.niche ?? "");
        setCommunityInterests(p.community_interests ?? []);
        setContentInterests(p.content_interests ?? []);

        if (d.storefront) {
          setBusinessName(d.storefront.name ?? "");
          setVendorBio(d.storefront.bio ?? "");
          if (d.storefront.tagline) setBusinessCategory(d.storefront.tagline);
        }
      }
    } catch {
      // Fall back to the role from the auth user so the correct onboarding
      // flow is shown even when the config request fails
      setRole(user?.role ?? 'member');
    }
    finally { setLoading(false); }
  }, [user, markOnboardingCompleted, navigate]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const saveProgress = async (newStep: number) => {
    const validStep = typeof newStep === 'number' && !isNaN(newStep) ? Math.max(0, Math.floor(newStep)) : 0;
    setStep(validStep);
    try {
      await authFetch(`/onboarding/progress`, {
        method: "POST", 
        body: JSON.stringify({ step: validStep, form_data: { role, niche, businessName } }),
      });
    } catch { /* ignore */ }
  };

  const greeting: ChatMsg = {
    role: "assistant",
    content: `Hey ${user?.name?.split(" ")[0] ?? "there"}! I'm Mera, your MurihSpace AI assistant. Tell me a little about what you create — I'll help you set up a standout presence in a few quick steps.`,
  };

  const sendChat = async (text?: string) => {
    const body = (text ?? chatInput).trim();
    if (!body || chatSending) return;
    setChatInput("");
    const next = [...messages, { role: "user" as const, content: body }];
    setMessages(next);
    setChatSending(true);
    try {
      const res = await authFetch(`/onboarding/chat`, {
        method: "POST", 
        body: JSON.stringify({ message: body }),
      });
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      const reply = d?.reply ?? (d?.data?.reply ?? "Got it — tell me more!");
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Let me know what else you create or sell." }]);
    }
    setChatSending(false);
  };

  const saveAbout = async () => {
    await authFetch(`/onboarding/about`, {
      method: "POST", 
      body: JSON.stringify({ about: about || null, niche: niche || null }),
    });
  };

  const saveSocials = async () => {
    const valid = socialRows.filter((r) => r.handle.trim());
    if (valid.length === 0) return;
    await authFetch(`/onboarding/socials`, {
      method: "POST", 
      body: JSON.stringify({ socials: valid.map((r) => ({ platform: r.platform, handle: r.handle })) }),
    });
  };

  const saveInterests = async () => {
    await authFetch(`/onboarding/interests`, {
      method: "POST", 
      body: JSON.stringify({ community_interests: communityInterests, content_interests: contentInterests }),
    });
  };

  const generateDraft = async () => {
    setDraftLoading(true);
    try {
      const res = await authFetch(`/onboarding/draft-profile`, {
        method: "POST", 
      });
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      const draft = d?.data ?? d;
      if (draft) {
        setProfileName(draft.profile_name ?? "");
        setProfileBio(draft.profile_bio ?? "");
      }
    } catch { /* ignore */ }
    setDraftLoading(false);
  };

  const handleFinishCreator = async () => {
    setSaving(true);
    try {
      const def = templateBySlug(template);
      await authFetch(`/onboarding/setup`, {
        method: "POST", 
        body: JSON.stringify({ template: def.slug, ...def.palette, profile_name: profileName, profile_bio: profileBio }),
      });
      await authFetch(`/onboarding/complete`, { method: "POST",  });
      markOnboardingCompleted();
      refreshUser();
      navigate("/app/link-in-bio", { replace: true });
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleFinishVendor = async () => {
    setSaving(true);
    try {
      await authFetch(`/onboarding/vendor-info`, {
        method: "POST", 
        body: JSON.stringify({
          business_name: businessName || user?.name || "My Store",
          business_category: businessCategory,
          fulfilment_model: fulfilmentModel,
          country: vendorCountry,
          bio: vendorBio,
        }),
      });
      await authFetch(`/onboarding/complete`, { method: "POST",  });
      markOnboardingCompleted();
      refreshUser();
      navigate("/app/storefront", { replace: true });
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleFinishMember = async () => {
    setSaving(true);
    try {
      await authFetch(`/onboarding/member-setup`, {
        method: "POST", 
        body: JSON.stringify({
          interests: memberInterests,
          notification_preferences: { feed: notifyFeed },
        }),
      });
      await authFetch(`/onboarding/complete`, { method: "POST",  });
      markOnboardingCompleted();
      refreshUser();
      navigate("/app", { replace: true });
    } catch { /* ignore */ }
    setSaving(false);
  };

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const goNext = async () => {
    if (role === "creator") {
      if (step === 0) await saveAbout();
      if (step === 1) await saveSocials();
      if (step === 2) await saveInterests();
      if (step === 3 && (!profileName || !profileBio)) await generateDraft();
    }
    saveProgress(Math.min(step + 1, steps.length - 1));
  };

  const addSocialRow = () => {
    const p = socialPlatform;
    if (!socialHandle.trim()) return;
    const cleaned = socialHandle.trim().replace(/^@/, "");
    setSocialRows((rows) => [...rows.filter((r) => r.platform !== p), { platform: p, handle: cleaned }]);
    setSocialHandle("");
  };

  const previewData: LinkBioPageData = {
    username: user?.username ?? "you",
    profile_name: profileName || user?.name || "Your Name",
    profile_bio: profileBio || null,
    avatar_url: null,
    banner_url: null,
    bg: templateBySlug(template).palette.bg,
    card_bg: templateBySlug(template).palette.card_bg,
    text_color: templateBySlug(template).palette.text_color,
    accent: templateBySlug(template).palette.accent,
    font: templateBySlug(template).palette.font,
    button_style: templateBySlug(template).palette.button_style,
    layout: "list",
    template,
    background_type: templateBySlug(template).palette.background_type,
    background_value: templateBySlug(template).palette.background_value,
    links: [
      { id: 1, title: "My latest content", url: "#", sort_order: 0 },
      { id: 2, title: "Shop my products", url: "#", sort_order: 1 },
      { id: 3, title: "Join my community", url: "#", sort_order: 2 },
    ],
    social_links: socialRows.filter((r) => r.handle).map((r, i) => ({ id: i + 1, platform: r.platform, url: `#${r.handle}` })),
    products: [],
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;



  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Wand2 className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" />
            {role === "vendor" ? "Vendor AI Onboarding" : role === "creator" ? "Creator AI Onboarding" : "Account Setup"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {role === "vendor"
              ? "Mera helps you set up your storefront and products. Fill in details or skip anytime."
              : role === "creator"
              ? "Mera sets up your link-in-bio and creator tools. Use AI assistance or enter details manually."
              : "Quick account setup to get you started."}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={role === "creator" ? handleFinishCreator : role === "vendor" ? handleFinishVendor : handleFinishMember}
          disabled={saving}
          className="text-xs font-bold gap-1.5 border-[#2164b6] text-[#2164b6] hover:bg-[#2164b6] hover:text-white transition-all shrink-0"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Skip & Complete Setup
        </Button>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-1 bg-muted p-1 rounded-xl overflow-x-auto scrollbar-none">
        {steps.map((s, i) => (
          <div key={s.key} className={`flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap ${i === step ? "bg-card text-foreground shadow-sm" : i < step ? "text-emerald-400" : "text-muted-foreground"}`}>
            <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] ${i < step ? "bg-emerald-500 text-white" : i === step ? "bg-[#2164b6] text-white" : "bg-muted-foreground/20"}`}>{i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}</span>
            {s.label}
          </div>
        ))}
      </div>

      {/* ── MEMBER ONBOARDING ── */}
      {(role === "member" || !["creator", "vendor"].includes(role)) && (
        <div className="max-w-xl mx-auto border border-border rounded-2xl bg-card p-6 space-y-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-[#2164b6] dark:text-[#7ab0ff]" />
                <h2 className="text-sm font-bold text-foreground">Welcome, @{user?.username}!</h2>
              </div>
              <p className="text-xs text-muted-foreground">Your account is ready. Let's customize your experience.</p>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Display Name</label>
                <Input value={user?.name ?? ""} disabled className="bg-muted/50" />
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => saveProgress(1)} className="text-xs font-bold">Continue <ChevronRight className="h-3 w-3 ml-1" /></Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select your interests</h2>
              <div className="flex flex-wrap gap-1.5">
                {COMMUNITY_OPTIONS.map((o) => (
                  <button key={o} onClick={() => toggle(memberInterests, setMemberInterests, o)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${memberInterests.includes(o) ? "bg-[#2164b6] text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{o}</button>
                ))}
              </div>
              <div className="flex justify-between pt-2">
                <Button size="sm" variant="ghost" onClick={() => setStep(0)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Back</Button>
                <Button size="sm" onClick={() => saveProgress(2)} className="text-xs font-bold">Continue <ChevronRight className="h-3 w-3 ml-1" /></Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Notification Preferences</h2>
              <div className="p-3 rounded-xl border border-border flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold">Feed & Community Notifications</p>
                  <p className="text-[10px] text-muted-foreground">Receive updates when posts or events are published.</p>
                </div>
                <input type="checkbox" checked={notifyFeed} onChange={(e) => setNotifyFeed(e.target.checked)} className="h-4 w-4 rounded accent-[#2164b6]" />
              </div>
              <div className="flex justify-between pt-2">
                <Button size="sm" variant="ghost" onClick={() => setStep(1)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Back</Button>
                <Button size="sm" onClick={handleFinishMember} disabled={saving} className="text-xs font-bold">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Complete Setup <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VENDOR ONBOARDING ── */}
      {role === "vendor" && (
        <div className="max-w-2xl mx-auto border border-border rounded-2xl bg-card p-6 space-y-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-[#2164b6] dark:text-[#7ab0ff]" />
                <h2 className="text-sm font-bold text-foreground">Tell us about your business</h2>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Store / Business Name *</label>
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Acme Outfitters" required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Business Category</label>
                <select value={businessCategory} onChange={(e) => setBusinessCategory(e.target.value)} className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-medium text-foreground">
                  {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Short Bio / Tagline</label>
                <textarea value={vendorBio} onChange={(e) => setVendorBio(e.target.value)} rows={3} placeholder="Describe your store in a few words..." className="w-full rounded-xl border border-border bg-card p-2.5 text-sm font-medium text-foreground resize-none" />
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={goNext} disabled={!businessName.trim()} className="text-xs font-bold">Continue <ChevronRight className="h-3 w-3 ml-1" /></Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-[#2164b6] dark:text-[#7ab0ff]" />
                <h2 className="text-sm font-bold text-foreground">Fulfilment & Shipping</h2>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Fulfilment Model</label>
                <select value={fulfilmentModel} onChange={(e) => setFulfilmentModel(e.target.value)} className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-medium text-foreground">
                  {FULFILMENT_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex justify-between pt-2">
                <Button size="sm" variant="ghost" onClick={() => saveProgress(0)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Back</Button>
                <Button size="sm" onClick={goNext} className="text-xs font-bold">Continue <ChevronRight className="h-3 w-3 ml-1" /></Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-[#2164b6] dark:text-[#7ab0ff]" />
                <h2 className="text-sm font-bold text-foreground">Target Country</h2>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Primary Sales Country</label>
                <CountrySelect value={vendorCountry} onChange={(iso2) => setVendorCountry(iso2)} />
              </div>
              <div className="flex justify-between pt-2">
                <Button size="sm" variant="ghost" onClick={() => saveProgress(1)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Back</Button>
                <Button size="sm" onClick={goNext} className="text-xs font-bold">Continue <ChevronRight className="h-3 w-3 ml-1" /></Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-[#2164b6] dark:text-[#7ab0ff]" />
                <h2 className="text-sm font-bold text-foreground">Brand & Social Accounts</h2>
              </div>
              <div className="flex gap-2">
                <select value={socialPlatform} onChange={(e) => setSocialPlatform(e.target.value)} className="w-36 rounded-xl border border-border bg-card p-2.5 text-xs font-medium text-foreground">
                  {SOCIAL_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <Input value={socialHandle} onChange={(e) => setSocialHandle(e.target.value)} placeholder="your_business_handle" className="flex-1" />
                <Button size="sm" variant="ghost" onClick={addSocialRow} disabled={!socialHandle.trim()} className="text-xs font-bold"><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              {socialRows.length > 0 && (
                <div className="space-y-1.5">
                  {socialRows.map((r) => (
                    <div key={r.platform} className="flex items-center justify-between p-2 rounded-xl bg-muted/50">
                      <span className="text-xs font-bold capitalize">{r.platform}: @{r.handle}</span>
                      <button onClick={() => setSocialRows((rows) => rows.filter((x) => x.platform !== r.platform))} className="p-1 text-rose-400"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between pt-2">
                <Button size="sm" variant="ghost" onClick={() => saveProgress(2)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Back</Button>
                <Button size="sm" onClick={goNext} className="text-xs font-bold">Continue <ChevronRight className="h-3 w-3 ml-1" /></Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-[#2164b6]/10 flex items-center justify-center text-[#2164b6] dark:text-[#7ab0ff]">
                <Store className="h-6 w-6" />
              </div>
              <h2 className="text-base font-black">Your Storefront is Ready</h2>
              <p className="text-xs text-muted-foreground">Mera has configured your store settings for <span className="font-bold text-foreground">{businessName}</span>.</p>
              <div className="pt-3 flex justify-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => saveProgress(3)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Back</Button>
                <Button size="sm" onClick={handleFinishVendor} disabled={saving} className="text-xs font-bold">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Open Vendor Dashboard <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CREATOR ONBOARDING ── */}
      {role === "creator" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Step 1: AI chat */}
            {step === 0 && (
              <div className="border border-border rounded-2xl bg-card overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2164b6] to-[#2164b6] flex items-center justify-center text-white"><MeraIcon className="h-4 w-4" /></div>
                  <div>
                    <p className="text-xs font-black">Mera — your AI assistant</p>
                    <p className="text-[10px] text-muted-foreground">I'll remember what you tell me to build your profile.</p>
                  </div>
                </div>
                <div className="p-4 h-72 overflow-y-auto space-y-3 bg-muted/30">
                  {[greeting, ...messages].map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-3.5 py-2.5 text-xs leading-relaxed ${m.role === "user" ? "bg-[#2164b6] text-white rounded-2xl rounded-br-sm" : "bg-card border border-border text-foreground rounded-2xl rounded-bl-sm"}`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {chatSending && <div className="flex justify-start"><div className="px-3.5 py-2.5 text-xs bg-card border border-border rounded-2xl rounded-bl-sm"><Loader2 className="h-3.5 w-3.5 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div></div>}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-border space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PROMPTS.map((q) => (
                      <button key={q} onClick={() => sendChat(q)} className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-muted text-muted-foreground hover:bg-[#2164b6]/10 hover:text-[#2164b6] dark:text-[#7ab0ff] transition-colors">{q}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Tell Mera about you..." className="flex-1" />
                    <Button size="sm" onClick={() => sendChat()} disabled={chatSending || !chatInput.trim()} className="text-xs font-bold"><Send className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            )}

            {step === 0 && (
              <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">What do you create?</h2>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">About your brand</label>
                  <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} placeholder="e.g. I'm a fitness coach sharing workout plans and healthy recipes" className="w-full rounded-xl border border-border bg-card p-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground resize-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Niche (one word works)</label>
                  <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. fitness, art, gaming, food" />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={goNext} className="text-xs font-bold">Continue <ChevronRight className="h-3 w-3 ml-1" /></Button>
                </div>
              </div>
            )}

            {/* Step 2: Socials */}
            {step === 1 && (
              <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" />
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Connect your socials</h2>
                </div>
                <div className="flex gap-2">
                  <select value={socialPlatform} onChange={(e) => setSocialPlatform(e.target.value)} className="w-36 rounded-xl border border-border bg-card p-2.5 text-xs font-medium text-foreground">
                    {SOCIAL_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <Input value={socialHandle} onChange={(e) => setSocialHandle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSocialRow()} placeholder={SOCIAL_PLATFORMS.find((p) => p.value === socialPlatform)?.placeholder ?? "handle"} className="flex-1" />
                  <Button size="sm" variant="ghost" onClick={addSocialRow} disabled={!socialHandle.trim()} className="text-xs font-bold"><Plus className="h-3.5 w-3.5" /></Button>
                </div>
                {socialRows.length > 0 && (
                  <div className="space-y-1.5">
                    {socialRows.map((r) => (
                      <div key={r.platform} className="flex items-center justify-between p-2 rounded-xl bg-muted/50">
                        <span className="text-xs font-bold capitalize">{r.platform}: @{r.handle}</span>
                        <button onClick={() => setSocialRows((rows) => rows.filter((x) => x.platform !== r.platform))} className="p-1 text-rose-400"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between">
                  <Button size="sm" variant="ghost" onClick={() => saveProgress(0)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Back</Button>
                  <Button size="sm" onClick={goNext} className="text-xs font-bold">Continue <ChevronRight className="h-3 w-3 ml-1" /></Button>
                </div>
              </div>
            )}

            {/* Step 3: Interests */}
            {step === 2 && (
              <div className="border border-border rounded-2xl bg-card p-6 space-y-5">
                <div>
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><ShoppingCart className="h-3 w-3" /> Community interests</h2>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {COMMUNITY_OPTIONS.map((o) => (
                      <button key={o} onClick={() => toggle(communityInterests, setCommunityInterests, o)}
                        className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-colors ${communityInterests.includes(o) ? "bg-[#2164b6] text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{o}</button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-border pt-5">
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Wand2 className="h-3 w-3" /> Content interests</h2>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {CONTENT_OPTIONS.map((o) => (
                      <button key={o} onClick={() => toggle(contentInterests, setContentInterests, o)}
                        className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-colors ${contentInterests.includes(o) ? "bg-[#2164b6] text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{o}</button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button size="sm" variant="ghost" onClick={() => saveProgress(1)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Back</Button>
                  <Button size="sm" onClick={goNext} className="text-xs font-bold">Continue <ChevronRight className="h-3 w-3 ml-1" /></Button>
                </div>
              </div>
            )}

            {/* Step 4: AI profile */}
            {step === 3 && (
              <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" />
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your AI-drafted profile</h2>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Display name</label>
                  <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Bio</label>
                  <textarea value={profileBio} onChange={(e) => setProfileBio(e.target.value)} rows={3} className="w-full rounded-xl border border-border bg-card p-2.5 text-sm font-medium text-foreground resize-none" />
                </div>
                <Button variant="ghost" size="sm" onClick={generateDraft} disabled={draftLoading} className="text-xs font-bold text-[#2164b6] dark:text-[#7ab0ff]">
                  {draftLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wand2 className="h-3 w-3 mr-1" />} Regenerate with AI
                </Button>
                <div className="flex justify-between">
                  <Button size="sm" variant="ghost" onClick={() => saveProgress(2)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Back</Button>
                  <Button size="sm" onClick={goNext} className="text-xs font-bold">Continue <ChevronRight className="h-3 w-3 ml-1" /></Button>
                </div>
              </div>
            )}

            {/* Step 5: Template */}
            {step === 4 && (
              <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" />
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pick your template</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {TEMPLATES.map((t) => {
                    const isActive = template === t.slug;
                    return (
                      <button key={t.slug} onClick={() => setTemplate(t.slug)}
                        className={`relative rounded-xl border-2 transition-all overflow-hidden text-left ${isActive ? "border-[#2164b6] shadow-md" : "border-border hover:border-[#2164b6]/50"}`}>
                        {isActive && <span className="absolute top-1.5 left-1.5 z-10 bg-[#2164b6] text-white rounded-full p-0.5"><Check className="h-3 w-3" /></span>}
                        <div className="p-2"><TemplateThumb template={t} /></div>
                        <div className="px-2.5 pb-2.5">
                          <p className="text-xs font-bold truncate text-foreground">{t.name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between">
                  <Button size="sm" variant="ghost" onClick={() => saveProgress(3)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Back</Button>
                  <Button size="sm" onClick={handleFinishCreator} disabled={saving} className="text-xs font-bold">
                    {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Finish & open builder <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right: live preview */}
          <div className="lg:sticky lg:top-6 space-y-3 self-start">
            <div className="border border-border rounded-2xl bg-card p-6">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2"><Smartphone className="h-3 w-3" /> Live preview</h2>
              <div className="mx-auto max-w-[300px] rounded-[2rem] border-[6px] border-border overflow-hidden shadow-xl max-h-[560px] overflow-y-auto">
                <TemplateRenderer data={previewData} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
