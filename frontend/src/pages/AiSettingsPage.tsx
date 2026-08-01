import { useEffect, useState } from "react";
import {
  Bot, Sparkles, ShieldCheck, Loader2, CheckCircle2, AlertCircle, Save, BookOpen, ArrowLeftRight, CornerDownLeft,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface ProfileSnapshot {
  about: string | null;
  niche: string | null;
  content_interests: string[];
}

const TONE_OPTIONS = [
  { value: "Warm, friendly and practical. Encouraging without being generic.", label: "Warm & friendly" },
  { value: "Professional, concise and confident.", label: "Professional" },
  { value: "Casual and conversational, like a friend who gets the business.", label: "Casual" },
  { value: "Playful and energetic.", label: "Playful" },
  { value: "Bold, punchy and direct.", label: "Bold & direct" },
  { value: "Straightforward and no-nonsense.", label: "Straightforward" },
];

const OFF_TOPIC_OPTIONS = [
  { value: "redirect", label: "Politely redirect back", desc: "Acknowledge briefly, then steer back to your niche and business." },
  { value: "decline", label: "Decline off-topic questions", desc: "Strictly refuse anything unrelated to your niche and business." },
  { value: "flexible", label: "Fully flexible", desc: "No topic guardrail — answer anything, but stay personalized." },
];

export default function AiSettingsPage() {
  const [persona, setPersona] = useState("Mera");
  const [tone, setTone] = useState(TONE_OPTIONS[0].value);
  const [keepOnTopic, setKeepOnTopic] = useState(true);
  const [offTopicMode, setOffTopicMode] = useState("redirect");
  const [focusTopicsText, setFocusTopicsText] = useState("");
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    apiClient
      .get("/ai/settings")
      .then((res) => {
        const j = res.data;
        const d = j?.success ? j?.data : j;
        const payload = d?.data ?? d;
        const s = payload?.settings;
        if (!mounted) return;
        if (s) {
          setPersona(s.persona || payload?.effective?.persona || "Mera");
          setTone(s.tone || payload?.effective?.tone || TONE_OPTIONS[0].value);
          setKeepOnTopic(s.keep_on_topic ?? true);
          setOffTopicMode(s.off_topic_mode || "redirect");
          setFocusTopicsText((s.focus_topics ?? []).join(", "));
        }
        setProfile(payload?.profile ?? null);
      })
      .catch(() => {
        if (mounted) setStatus({ ok: false, text: "Could not load your AI settings." });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const parseTopics = (): string[] =>
    focusTopicsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await apiClient.put("/ai/settings", {
        persona,
        tone,
        keep_on_topic: keepOnTopic,
        off_topic_mode: offTopicMode,
        focus_topics: parseTopics(),
      });
      setStatus({ ok: true, text: "Mera's behavior updated. Changes apply to new conversations." });
    } catch {
      setStatus({ ok: false, text: "Failed to save settings. Try again." });
    } finally {
      setSaving(false);
    }
  };

  const scope =
    parseTopics().length > 0
      ? parseTopics().join(", ")
      : [profile?.niche, profile?.about ? `their business: ${profile.about}` : null]
          .filter(Boolean)
          .join("; ") || "their niche and creator business";

  const boundary =
    offTopicMode === "decline"
      ? "Strictly stays on-topic. Declines unrelated questions and offers help within your niche instead."
      : offTopicMode === "flexible"
        ? "No topic guardrail — can answer anything, but keeps your profile in mind."
        : "Acknowledges off-topic questions briefly, then politely steers back to your niche and business.";

  return (
    <div className="min-h-full bg-gradient-to-br from-[#F8FAFB] via-white to-[#E8F8FF]/40 dark:from-[#0a1a2a] dark:via-[#0f1f30] dark:to-[#0a1a2a]">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#38A8D8] to-[#1a6b9e] flex items-center justify-center shadow-md shadow-[#38A8D8]/20">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">Mera's Behavior</h1>
            <p className="text-xs text-muted-foreground/70">
              Control how your AI assistant talks, what it focuses on, and how it handles off-topic questions.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading settings…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Persona */}
                <section className="rounded-2xl border border-border/60 bg-white dark:bg-[#102840]/60 p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#38A8D8]" />
                    <h2 className="text-sm font-bold text-foreground">Assistant identity</h2>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Name</label>
                    <input
                      type="text"
                      value={persona}
                      onChange={(e) => setPersona(e.target.value)}
                      maxLength={80}
                      className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-[#38A8D8]/40 focus:ring-2 focus:ring-[#38A8D8]/15"
                    />
                    <p className="text-[11px] text-muted-foreground/50 mt-1">
                      The persona the assistant speaks as across chat, onboarding, and analytics insights.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Tone</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-[#38A8D8]/40 focus:ring-2 focus:ring-[#38A8D8]/15"
                    >
                      {TONE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </section>

                {/* Topic scope */}
                <section className="rounded-2xl border border-border/60 bg-white dark:bg-[#102840]/60 p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-[#38A8D8]" />
                    <h2 className="text-sm font-bold text-foreground">Topic scope</h2>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Focus topics <span className="text-muted-foreground/40">(comma-separated, optional)</span>
                    </label>
                    <textarea
                      value={focusTopicsText}
                      onChange={(e) => setFocusTopicsText(e.target.value)}
                      rows={2}
                      placeholder="e.g. quick family recipes, meal prep, cooking videos"
                      className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-[#38A8D8]/40 focus:ring-2 focus:ring-[#38A8D8]/15 resize-none"
                    />
                    <p className="text-[11px] text-muted-foreground/50 mt-1">
                      Leave empty to auto-derive the scope from your onboarding profile (niche, about, interests).
                    </p>
                  </div>
                  {profile && (
                    <div className="rounded-xl bg-[#38A8D8]/5 border border-[#38A8D8]/15 px-3.5 py-3 text-xs text-muted-foreground space-y-1">
                      <p className="font-bold text-foreground/80">Derived from your profile</p>
                      {profile.niche && <p>Niche: {profile.niche}</p>}
                      {profile.about && <p>About: {profile.about}</p>}
                      {profile.content_interests?.length > 0 && (
                        <p>Interests: {profile.content_interests.join(", ")}</p>
                      )}
                      {!profile.niche && !profile.about && (
                        <p>No profile details yet — complete onboarding to give Mera stronger context.</p>
                      )}
                    </div>
                  )}
                </section>

                {/* Guardrails */}
                <section className="rounded-2xl border border-border/60 bg-white dark:bg-[#102840]/60 p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#38A8D8]" />
                    <h2 className="text-sm font-bold text-foreground">Stay on-topic</h2>
                  </div>
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Keep Mera focused on your business</p>
                      <p className="text-xs text-muted-foreground/60">
                        Anchor answers to your niche and business profile so it never drifts or talks about the wrong brand.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={keepOnTopic}
                      onClick={() => setKeepOnTopic((v) => !v)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${keepOnTopic ? "bg-[#38A8D8]" : "bg-muted"}`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${keepOnTopic ? "left-[22px]" : "left-0.5"}`}
                      />
                    </button>
                  </label>
                  <div className="space-y-2 pt-1">
                    {OFF_TOPIC_OPTIONS.map((o) => (
                      <label
                        key={o.value}
                        className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 cursor-pointer transition-all ${
                          offTopicMode === o.value
                            ? "border-[#38A8D8]/40 bg-[#38A8D8]/5"
                            : "border-border/50 hover:border-border"
                        }`}
                      >
                        <input
                          type="radio"
                          name="off_topic_mode"
                          value={o.value}
                          checked={offTopicMode === o.value}
                          onChange={() => setOffTopicMode(o.value)}
                          disabled={!keepOnTopic}
                          className="mt-0.5 accent-[#38A8D8]"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-foreground">{o.label}</span>
                          <span className="block text-xs text-muted-foreground/60">{o.desc}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>

                {/* Save */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#38A8D8] to-[#2e8ab8] text-white text-sm font-bold hover:from-[#2e8ab8] hover:to-[#256e91] disabled:opacity-50 transition-all shadow-sm hover:shadow-md hover:shadow-[#38A8D8]/20"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save behavior
                  </button>
                  {status && (
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        status.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {status.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                      {status.text}
                    </span>
                  )}
                </div>
              </div>

              {/* Live summary */}
              <div className="space-y-6">
                <div className="rounded-2xl border border-[#38A8D8]/30 bg-gradient-to-br from-[#38A8D8]/10 to-purple-500/10 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-[#38A8D8]" />
                    <h3 className="text-sm font-bold text-foreground">How Mera will behave</h3>
                  </div>
                  <ul className="space-y-3 text-xs text-foreground/85 leading-relaxed">
                    <li className="flex gap-2">
                      <Bot className="h-3.5 w-3.5 text-[#38A8D8] shrink-0 mt-0.5" />
                      Speaks as <span className="font-bold">{persona.trim() || "Mera"}</span> with a{" "}
                      <span className="font-bold">{TONE_OPTIONS.find((t) => t.value === tone)?.label.toLowerCase()}</span> tone.
                    </li>
                    <li className="flex gap-2">
                      <ArrowLeftRight className="h-3.5 w-3.5 text-[#38A8D8] shrink-0 mt-0.5" />
                      Focused on: <span className="font-semibold">{scope}</span>
                    </li>
                    <li className="flex gap-2">
                      <CornerDownLeft className="h-3.5 w-3.5 text-[#38A8D8] shrink-0 mt-0.5" />
                      {boundary}
                    </li>
                  </ul>
                  <p className="text-[11px] text-foreground/50 mt-4">
                    Applies to the AI Assistant, onboarding chat, profile drafts, and AI Insights. Changes take effect on new
                    messages.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
