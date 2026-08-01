import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { Loader2, Sparkles, Send, Plus, X, Check, ChevronRight, ChevronLeft, Camera, Music, Hash, Film, MessageCircle, Link as LinkIcon, ShoppingCart, Palette, ArrowRight, Wand2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";
import { useAuth } from "@/hooks/useAuth";
import { TEMPLATES, templateBySlug } from "@/lib/linkBioTemplates";
import type { LinkBioPageData, LinkBioSocial } from "@/lib/linkBioTypes";
import TemplateRenderer from "@/components/linkbio/TemplateRenderer";
import TemplateThumb from "@/components/linkbio/TemplateThumb";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

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

const URL_PREFIX: Record<string, string> = {
  instagram: "instagram.com/",
  twitter: "x.com/",
  tiktok: "tiktok.com/@",
  youtube: "youtube.com/@",
  facebook: "facebook.com/",
  snapchat: "snapchat.com/add/",
  linkedin: "linkedin.com/in/",
  github: "github.com/",
  pinterest: "pinterest.com/",
  twitch: "twitch.tv/",
};

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

interface ChatMsg { role: "user" | "assistant"; content: string; }

const QUICK_PROMPTS = [
  "I want to build an audience",
  "What content should I make?",
  "I sell products online",
  "Help me plan my first week",
];

function handleFromUrl(platform: string, url: string): string {
  const prefix = URL_PREFIX[platform];
  if (!prefix) return url;
  const idx = url.toLowerCase().indexOf(prefix.toLowerCase());
  if (idx === -1) return url;
  return url.slice(idx + prefix.length).replace(/\/$/, "").replace(/^@/, "");
}

const STEPS = [
  { key: "ai", label: "Meet Mera" },
  { key: "socials", label: "Connect socials" },
  { key: "interests", label: "Your interests" },
  { key: "profile", label: "AI profile" },
  { key: "template", label: "Pick a template" },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Step 1: AI chat
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [about, setAbout] = useState("");
  const [niche, setNiche] = useState("");

  // Step 2: socials
  const [socialRows, setSocialRows] = useState<{ platform: string; handle: string }[]>([]);
  const [socialPlatform, setSocialPlatform] = useState("instagram");
  const [socialHandle, setSocialHandle] = useState("");

  // Step 3: interests
  const [communityInterests, setCommunityInterests] = useState<string[]>([]);
  const [contentInterests, setContentInterests] = useState<string[]>([]);

  // Step 4: profile draft
  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);

  // Step 5: template
  const [template, setTemplate] = useState("minimal");

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadState = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/onboarding`, { headers: getAuthHeaders() });
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      const unwrapped = d?.data ?? d;
      if (unwrapped) {
        const p = unwrapped.profile ?? {};
        setAbout(p.about ?? "");
        setNiche(p.niche ?? "");
        setCommunityInterests(p.community_interests ?? []);
        setContentInterests(p.content_interests ?? []);
        const socials: { platform: string; handle: string }[] = (unwrapped.social_links ?? []).map((s: LinkBioSocial) => ({
          platform: s.platform,
          handle: handleFromUrl(s.platform, s.url),
        }));
        setSocialRows(socials);
        if (unwrapped.template) setTemplate(unwrapped.template);
        const draft = unwrapped.profile_draft;
        if (draft) {
          setProfileName(draft.profile_name ?? "");
          setProfileBio(draft.profile_bio ?? "");
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadState(); }, [loadState]);

  const greeting: ChatMsg = {
    role: "assistant",
    content: `Hey ${user?.name?.split(" ")[0] ?? "there"}! I'm Mera, your AI onboarding buddy. Tell me a little about you, your brand or what you create — I'll help you set up a standout link-in-bio in the next few minutes.`,
  };

  const sendChat = async (text?: string) => {
    const body = (text ?? chatInput).trim();
    if (!body || chatSending) return;
    setChatInput("");
    const next = [...messages, { role: "user" as const, content: body }];
    setMessages(next);
    setChatSending(true);
    try {
      const res = await fetch(`${API_BASE}/onboarding/chat`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ message: body }),
      });
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      const reply = d?.reply ?? (d?.data?.reply ?? "Got it — tell me more!");
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Let's keep going — tell me more about what you create." }]);
    }
    setChatSending(false);
  };

  const saveAbout = async () => {
    await fetch(`${API_BASE}/onboarding/about`, {
      method: "POST", headers: getAuthHeaders(),
      body: JSON.stringify({ about: about || null, niche: niche || null }),
    });
  };

  const saveSocials = async () => {
    const valid = socialRows.filter((r) => r.handle.trim());
    if (valid.length === 0) return;
    await fetch(`${API_BASE}/onboarding/socials`, {
      method: "POST", headers: getAuthHeaders(),
      body: JSON.stringify({ socials: valid.map((r) => ({ platform: r.platform, handle: r.handle })) }),
    });
  };

  const saveInterests = async () => {
    await fetch(`${API_BASE}/onboarding/interests`, {
      method: "POST", headers: getAuthHeaders(),
      body: JSON.stringify({ community_interests: communityInterests, content_interests: contentInterests }),
    });
  };

  const generateDraft = async () => {
    setDraftLoading(true);
    try {
      const res = await fetch(`${API_BASE}/onboarding/draft-profile`, {
        method: "POST", headers: getAuthHeaders(),
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

  const handleFinish = async () => {
    setSaving(true);
    try {
      const def = templateBySlug(template);
      await fetch(`${API_BASE}/onboarding/setup`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ template: def.slug, ...def.palette, profile_name: profileName, profile_bio: profileBio }),
      });
      await fetch(`${API_BASE}/onboarding/complete`, { method: "POST", headers: getAuthHeaders() });
      navigate("/app/link-in-bio", { replace: true });
    } catch { /* ignore */ }
    setSaving(false);
  };

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const goNext = async () => {
    if (step === 0) await saveAbout();
    if (step === 1) await saveSocials();
    if (step === 2) await saveInterests();
    if (step === 3 && (!profileName || !profileBio)) await generateDraft();
    setStep((s) => Math.min(s + 1, 4));
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

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <Sparkles className="h-6 w-6 text-[#38A8D8]" /> AI Onboarding
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Mera sets up your presence in 5 quick steps.</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1 bg-muted p-1 rounded-xl overflow-x-auto">
        {STEPS.map((s, i) => (
          <div key={s.key} className={`flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap ${i === step ? "bg-card text-foreground shadow-sm" : i < step ? "text-emerald-400" : "text-muted-foreground"}`}>
            <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] ${i < step ? "bg-emerald-500 text-white" : i === step ? "bg-[#38A8D8] text-white" : "bg-muted-foreground/20"}`}>{i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}</span>
            {s.label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* ── Step 1: AI chat ── */}
          {step === 0 && (
            <div className="border border-border rounded-2xl bg-card overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#38A8D8] to-[#2164b6] flex items-center justify-center text-white"><Sparkles className="h-4 w-4" /></div>
                <div>
                  <p className="text-xs font-black">Mera — your AI buddy</p>
                  <p className="text-[10px] text-muted-foreground">I'll remember what you tell me to build your profile.</p>
                </div>
              </div>
              <div className="p-4 h-72 overflow-y-auto space-y-3 bg-muted/30">
                {[greeting, ...messages].map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-3.5 py-2.5 text-xs leading-relaxed ${m.role === "user" ? "bg-[#38A8D8] text-white rounded-2xl rounded-br-sm" : "bg-card border border-border text-foreground rounded-2xl rounded-bl-sm"}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatSending && <div className="flex justify-start"><div className="px-3.5 py-2.5 text-xs bg-card border border-border rounded-2xl rounded-bl-sm"><Loader2 className="h-3.5 w-3.5 animate-spin text-[#38A8D8]" /></div></div>}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 border-t border-border space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((q) => (
                    <button key={q} onClick={() => sendChat(q)} className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-muted text-muted-foreground hover:bg-[#38A8D8]/10 hover:text-[#38A8D8] transition-colors">{q}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Tell Mera about you..." className="flex-1" />
                  <Button size="sm" onClick={() => sendChat()} disabled={chatSending || !chatInput.trim()} className="text-xs font-bold"><Send className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1b: About (captures business info) ── */}
          {step === 0 && (
            <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">What do you do?</h2>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">About you / your business</label>
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

          {/* ── Step 2: Socials ── */}
          {step === 1 && (
            <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-[#38A8D8]" />
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Connect your socials</h2>
              </div>
              <p className="text-[11px] text-muted-foreground">Add your handles — Mera will build canonical profile links and weave them into your page.</p>
              <div className="flex gap-2">
                <select value={socialPlatform} onChange={(e) => setSocialPlatform(e.target.value)}
                  className="w-36 rounded-xl border border-border bg-card p-2.5 text-xs font-medium text-foreground">
                  {SOCIAL_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <Input value={socialHandle} onChange={(e) => setSocialHandle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSocialRow()} placeholder={SOCIAL_PLATFORMS.find((p) => p.value === socialPlatform)?.placeholder ?? "handle"} className="flex-1" />
                <Button size="sm" variant="ghost" onClick={addSocialRow} disabled={!socialHandle.trim()} className="text-xs font-bold"><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              {socialPlatform && socialHandle.trim() && (
                <p className="text-[10px] text-muted-foreground font-mono">→ https://{URL_PREFIX[socialPlatform]}{socialHandle.trim().replace(/^@/, "")}</p>
              )}
              {socialRows.length > 0 && (
                <div className="space-y-1.5">
                  {socialRows.map((r) => (
                    <div key={r.platform} className="flex items-center justify-between p-2 rounded-xl bg-muted/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[#38A8D8]">{SOCIAL_PLATFORMS.find((p) => p.value === r.platform)?.icon}</span>
                        <span className="text-xs font-bold text-muted-foreground capitalize shrink-0">{r.platform}</span>
                        <span className="text-[10px] text-muted-foreground truncate">@{r.handle}</span>
                      </div>
                      <button onClick={() => setSocialRows((rows) => rows.filter((x) => x.platform !== r.platform))} className="p-1 text-rose-400"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between">
                <Button size="sm" variant="ghost" onClick={() => setStep(0)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Back</Button>
                <Button size="sm" onClick={goNext} className="text-xs font-bold">Continue <ChevronRight className="h-3 w-3 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Interests ── */}
          {step === 2 && (
            <div className="border border-border rounded-2xl bg-card p-6 space-y-5">
              <div>
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><ShoppingCart className="h-3 w-3" /> Community interests</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">Who do you want to attract?</p>
                <div className="flex flex-wrap gap-1.5">
                  {COMMUNITY_OPTIONS.map((o) => (
                    <button key={o} onClick={() => toggle(communityInterests, setCommunityInterests, o)}
                      className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-colors ${communityInterests.includes(o) ? "bg-[#38A8D8] text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{o}</button>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-5">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Wand2 className="h-3 w-3" /> Content interests</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">What will you share?</p>
                <div className="flex flex-wrap gap-1.5">
                  {CONTENT_OPTIONS.map((o) => (
                    <button key={o} onClick={() => toggle(contentInterests, setContentInterests, o)}
                      className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-colors ${contentInterests.includes(o) ? "bg-[#38A8D8] text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{o}</button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <Button size="sm" variant="ghost" onClick={() => setStep(1)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Back</Button>
                <Button size="sm" onClick={goNext} className="text-xs font-bold">Continue <ChevronRight className="h-3 w-3 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* ── Step 4: AI profile ── */}
          {step === 3 && (
            <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-[#38A8D8]" />
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your AI-drafted profile</h2>
              </div>
              <p className="text-[11px] text-muted-foreground">Mera drafted these from your socials and interests. Edit anything you like.</p>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Display name</label>
                <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Bio</label>
                <textarea value={profileBio} onChange={(e) => setProfileBio(e.target.value)} rows={3} className="w-full rounded-xl border border-border bg-card p-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground resize-none" />
              </div>
              <Button variant="ghost" size="sm" onClick={generateDraft} disabled={draftLoading} className="text-xs font-bold text-[#38A8D8]">
                {draftLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wand2 className="h-3 w-3 mr-1" />} Regenerate with AI
              </Button>
              <div className="flex justify-between">
                <Button size="sm" variant="ghost" onClick={() => setStep(2)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Back</Button>
                <Button size="sm" onClick={goNext} className="text-xs font-bold">Continue <ChevronRight className="h-3 w-3 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* ── Step 5: Template ── */}
          {step === 4 && (
            <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-[#38A8D8]" />
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pick your template</h2>
              </div>
              <p className="text-[11px] text-muted-foreground">10 ready-made layouts — change anytime from the Link in Bio builder.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {TEMPLATES.map((t) => {
                  const isActive = template === t.slug;
                  return (
                    <button key={t.slug} onClick={() => setTemplate(t.slug)}
                      className={`relative rounded-xl border-2 transition-all overflow-hidden text-left ${isActive ? "border-[#38A8D8] shadow-md" : "border-border hover:border-[#38A8D8]/50"}`}>
                      {isActive && <span className="absolute top-1.5 left-1.5 z-10 bg-[#38A8D8] text-white rounded-full p-0.5"><Check className="h-3 w-3" /></span>}
                      <div className="p-2"><TemplateThumb template={t} /></div>
                      <div className="px-2.5 pb-2.5">
                        <p className="text-xs font-bold truncate text-foreground">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{t.tagline}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between">
                <Button size="sm" variant="ghost" onClick={() => setStep(3)} className="text-xs font-bold"><ChevronLeft className="h-3 w-3 mr-1" /> Back</Button>
                <Button size="sm" onClick={handleFinish} disabled={saving} className="text-xs font-bold">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Finish & open builder <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: live preview ── */}
        <div className="lg:sticky lg:top-6 space-y-3 self-start">
          <div className="border border-border rounded-2xl bg-card p-6">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2"><Smartphone className="h-3 w-3" /> Live preview</h2>
            <div className="mx-auto max-w-[300px] rounded-[2rem] border-[6px] border-border overflow-hidden shadow-xl max-h-[560px] overflow-y-auto">
              <TemplateRenderer data={previewData} />
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-3">Your page at murihspace.com/@{user?.username ?? "you"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
