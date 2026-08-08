import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Save, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { MeraIcon } from "@/components/brand/MeraIcon";

const TONE_OPTIONS = [
  { value: "Warm, friendly and practical. Encouraging without being generic.", label: "Warm & friendly" },
  { value: "Professional, concise and confident.", label: "Professional" },
  { value: "Casual and conversational, like a friend who gets the business.", label: "Casual" },
  { value: "Playful and energetic.", label: "Playful" },
  { value: "Bold, punchy and direct.", label: "Bold & direct" },
  { value: "Straightforward and no-nonsense.", label: "Straightforward" },
];

export default function AiSettingsPage() {
  const [persona, setPersona] = useState("Mera");
  const [tone, setTone] = useState(TONE_OPTIONS[0].value);
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
        }
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

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await apiClient.put("/ai/settings", { persona, tone });
      setStatus({ ok: true, text: "Mera's behavior updated. Changes apply to new conversations." });
    } catch {
      setStatus({ ok: false, text: "Failed to save settings. Try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-[#F8FAFB] via-white to-[#E8F8FF]/40 dark:from-[#0a1a2a] dark:via-[#0f1f30] dark:to-[#0a1a2a]">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#2164b6] to-[#1a6b9e] flex items-center justify-center shadow-md shadow-[#2164b6]/20">
            <MeraIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">Mera&apos;s Behavior</h1>
            <p className="text-xs text-muted-foreground/70">
              Choose how your AI assistant presents itself. Its voice is yours; its on-topic guardrails are set by the platform admin.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading settings…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Identity */}
            <section className="rounded-2xl border border-border/60 bg-white dark:bg-[#102840]/60 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <MeraIcon className="h-4 w-4" />
                <h2 className="text-sm font-bold text-foreground">Assistant identity</h2>
              </div>
              <div>
                <label htmlFor="mera-persona" className="text-xs font-semibold text-muted-foreground">Name</label>
                <input
                  id="mera-persona"
                  type="text"
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  maxLength={80}
                  className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-[#2164b6]/40 focus:ring-2 focus:ring-[#2164b6]/15"
                />
                <p className="text-[11px] text-muted-foreground/50 mt-1">
                  The persona the assistant speaks as across chat, onboarding, and analytics insights.
                </p>
              </div>
              <div>
                <label htmlFor="mera-tone" className="text-xs font-semibold text-muted-foreground">Tone</label>
                <select
                  id="mera-tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-[#2164b6]/40 focus:ring-2 focus:ring-[#2164b6]/15"
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {/* Guardrails notice */}
            <section className="rounded-2xl border border-border/60 bg-white dark:bg-[#102840]/60 p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" />
                <h2 className="text-sm font-bold text-foreground">Stay on-topic</h2>
              </div>
              <p className="text-xs text-muted-foreground/60 mt-2 leading-relaxed">
                How Mera handles off-topic questions and which topics it focuses on are managed by the platform admin to keep every
                assistant on-brand. You can always tailor the name and tone above.
              </p>
            </section>

            {/* Save */}
            <div className="flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#2164b6] to-[#1a5091] text-white text-sm font-bold hover:from-[#1a5091] hover:to-[#154074] disabled:opacity-50 transition-all shadow-sm hover:shadow-md hover:shadow-[#2164b6]/20"
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
        )}
      </div>
    </div>
  );
}