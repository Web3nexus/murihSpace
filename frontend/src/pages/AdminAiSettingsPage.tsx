import { useEffect, useState } from "react";
import { Loader2, Save, AlertCircle, CheckCircle2, Eye, EyeOff, PlugZap, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthToken } from "@/lib/auth/token";
import { MeraIcon } from "@/components/brand/MeraIcon";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

const TONE_OPTIONS = [
  { value: "Warm, friendly and practical. Encouraging without being generic.", label: "Warm & friendly" },
  { value: "Professional, concise and confident.", label: "Professional" },
  { value: "Casual and conversational, like a friend who gets the business.", label: "Casual" },
  { value: "Playful and energetic.", label: "Playful" },
  { value: "Bold, punchy and direct.", label: "Bold & direct" },
  { value: "Straightforward and no-nonsense.", label: "Straightforward" },
];

const OFF_TOPIC_OPTIONS = [
  { value: "redirect", label: "Politely redirect back" },
  { value: "decline", label: "Decline off-topic questions" },
  { value: "flexible", label: "Fully flexible" },
];

const PROVIDERS: { id: string; label: string; desc: string; color: string }[] = [
  { id: "anthropic", label: "Anthropic Claude", desc: "Claude models (Opus, Sonnet, Haiku) with prompt caching.", color: "from-orange-500/20 to-red-500/20" },
  { id: "openai", label: "OpenAI", desc: "GPT models via the Chat Completions API.", color: "from-emerald-500/20 to-teal-500/20" },
  { id: "gemini", label: "Google Gemini", desc: "Gemini models via the Generative Language API.", color: "from-sky-500/20 to-indigo-500/20" },
];

interface ProviderMeta {
  configured: boolean;
  model: string;
  key_from_env: boolean;
}

function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

interface Guardrails {
  persona: string;
  tone: string;
  keep_on_topic: boolean;
  off_topic_mode: string;
  focus_topics: string[];
}

const DEFAULT_GUARDRAILS: Guardrails = {
  persona: "Mera",
  tone: TONE_OPTIONS[0].value,
  keep_on_topic: true,
  off_topic_mode: "redirect",
  focus_topics: [],
};

export default function AdminAiSettingsPage() {
  const [provider, setProvider] = useState("anthropic");
  const [providers, setProviders] = useState<Record<string, ProviderMeta>>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [models, setModels] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [guardrails, setGuardrails] = useState<Guardrails>(DEFAULT_GUARDRAILS);
  const [focusTopicsText, setFocusTopicsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/securegate/ai-settings`, { headers: authHeaders() });
        if (!res.ok) throw new Error("Failed to load AI provider settings");
        const j = await res.json();
        const d = j?.success ? j?.data?.data ?? j?.data : j;
        setProvider(d?.provider ?? "anthropic");
        setProviders(d?.providers ?? {});
        const m: Record<string, string> = {};
        for (const [k, v] of Object.entries<ProviderMeta>(d?.providers ?? {})) m[k] = v.model ?? "";
        setModels(m);
        const g = d?.guardrails;
        if (g) {
          setGuardrails({
            persona: g.persona ?? DEFAULT_GUARDRAILS.persona,
            tone: g.tone ?? DEFAULT_GUARDRAILS.tone,
            keep_on_topic: g.keep_on_topic ?? true,
            off_topic_mode: g.off_topic_mode ?? "redirect",
            focus_topics: g.focus_topics ?? [],
          });
          setFocusTopicsText((g.focus_topics ?? []).join(", "));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const parsedTopics = focusTopicsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (parsedTopics.length > 20) {
        toast.error("You can specify a maximum of 20 focus topics.");
        setSaving(false);
        return;
      }

      const body: Record<string, unknown> = {
        provider,
        persona: guardrails.persona,
        tone: guardrails.tone,
        keep_on_topic: guardrails.keep_on_topic,
        off_topic_mode: guardrails.off_topic_mode,
        focus_topics: parsedTopics,
      };
      for (const p of PROVIDERS) {
        if (keys[p.id]?.trim()) body[`${p.id}_key`] = keys[p.id].trim();
        if (models[p.id]?.trim()) body[`${p.id}_model`] = models[p.id].trim();
      }
      const res = await fetch(`${API_BASE}/securegate/ai-settings`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      const d = j?.success ? j?.data?.data ?? j?.data : j;
      setProviders(d?.providers ?? providers);
      setProvider(d?.provider ?? provider);
      if (d?.guardrails) {
        setGuardrails({
          persona: d.guardrails.persona ?? "Mera",
          tone: d.guardrails.tone ?? "Warm, friendly and practical. Encouraging without being generic.",
          keep_on_topic: d.guardrails.keep_on_topic ?? true,
          off_topic_mode: d.guardrails.off_topic_mode ?? "redirect",
          focus_topics: d.guardrails.focus_topics ?? [],
        });
        setFocusTopicsText((d.guardrails.focus_topics ?? []).join(", "));
      }
      setKeys({});
      setTestResult({});
      toast.success("AI settings saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const test = async (id: string) => {
    setTesting(id);
    setTestResult((prev) => ({ ...prev, [id]: { ok: false, text: "Testing…" } }));
    try {
      const res = await fetch(`${API_BASE}/securegate/ai-settings/test`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ provider: id }),
      });
      const j = await res.json();
      const d = j?.success ? j?.data?.data ?? j?.data : j;
      if (!res.ok) {
        setTestResult((prev) => ({ ...prev, [id]: { ok: false, text: j?.message ?? "Provider not configured." } }));
        return;
      }
      setTestResult((prev) => ({
        ...prev,
        [id]: d?.ok
          ? { ok: true, text: `Connected in ${d.latency_ms}ms` }
          : { ok: false, text: d?.error ?? "Provider returned an unexpected response." },
      }));
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: { ok: false, text: "Request failed." } }));
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;
  }

  return (
    <div className="w-full mx-auto max-w-[860px] space-y-6 p-6 lg:p-10">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <MeraIcon className="h-6 w-6" /> AI Providers
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Choose which model provider powers Mera across the AI Assistant, onboarding, profile drafts, and AI Insights. Keys are encrypted at rest.
        </p>
      </div>

      {/* Provider selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PROVIDERS.map((p) => {
          const meta = providers[p.id];
          const active = provider === p.id;
          const configured = meta?.configured ?? false;
          return (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`text-left rounded-2xl border p-4 transition-all ${active ? "border-[#2164b6] ring-2 ring-[#2164b6]/20 bg-[#2164b6]/5" : "border-border bg-card hover:border-[#2164b6]/40"}`}
            >
              <div className={`flex items-center justify-between mb-2`}>
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center`}>
                  <MeraIcon className="h-5 w-5" />
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    configured
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {configured ? (meta.key_from_env ? "Configured (env)" : "Configured") : "Not configured"}
                </span>
              </div>
              <p className="text-sm font-bold text-foreground">{p.label}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{p.desc}</p>
              {active && (
                <p className="text-[10px] font-bold text-[#2164b6] dark:text-[#7ab0ff] mt-2 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2164b6]" /> Active provider
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Per-provider config */}
      <div className="border border-border rounded-2xl bg-card p-6 space-y-5">
        {PROVIDERS.map((p) => {
          const meta = providers[p.id];
          return (
            <div key={p.id} className="rounded-xl border border-border/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-foreground">{p.label}</p>
                <button
                  onClick={() => test(p.id)}
                  disabled={testing === p.id}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-[#2164b6] dark:text-[#7ab0ff] disabled:opacity-50 transition-colors"
                >
                  {testing === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                  Test connection
                </button>
              </div>
              {testResult[p.id] && (
                <p
                  className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                    testResult[p.id].ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {testResult[p.id].ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                  {testResult[p.id].text}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3" /> API key
                  </label>
                  <div className="relative mt-1">
                    <Input
                      type={reveal[p.id] ? "text" : "password"}
                      value={keys[p.id] ?? ""}
                      onChange={(e) => setKeys((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder={
                        meta?.configured
                          ? meta.key_from_env
                            ? "Using key from environment (.env)"
                            : "Saved — enter a new key to replace it"
                          : "Paste API key"
                      }
                      autoComplete="off"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setReveal((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {reveal[p.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Model</label>
                  <Input
                    value={models[p.id] ?? ""}
                    onChange={(e) => setModels((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder={meta?.model ?? "Model name"}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mera behavior & guardrails (admin-locked, applied platform-wide) */}
      <div className="border border-border rounded-2xl bg-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <MeraIcon className="h-5 w-5" />
          <p className="text-xs font-black text-foreground uppercase tracking-wide">Mera behavior & guardrails</p>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2164b6]/15 text-[#2164b6] dark:text-[#7ab0ff]">
            Admin only
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          These apply to every creator. Users can only rename Mera and pick a tone; they cannot override the on-topic guardrails below.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="guardrails-persona" className="text-[11px] font-bold text-muted-foreground">Default assistant name</Label>
            <Input
              id="guardrails-persona"
              value={guardrails.persona}
              onChange={(e) => setGuardrails((prev) => ({ ...prev, persona: e.target.value }))}
              placeholder="Mera"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="guardrails-tone" className="text-[11px] font-bold text-muted-foreground">Default tone</Label>
            <select
              id="guardrails-tone"
              value={guardrails.tone}
              onChange={(e) => setGuardrails((prev) => ({ ...prev, tone: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus:border-[#2164b6]/40 focus:ring-2 focus:ring-[#2164b6]/15"
            >
              {TONE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] font-bold text-muted-foreground">Off-topic handling</Label>
            <div className="mt-1 space-y-1.5">
              {OFF_TOPIC_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer ${
                    guardrails.off_topic_mode === o.value ? "border-[#2164b6]/40 bg-[#2164b6]/5" : "border-border/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="off_topic_mode"
                    value={o.value}
                    checked={guardrails.off_topic_mode === o.value}
                    onChange={() => setGuardrails((prev) => ({ ...prev, off_topic_mode: o.value }))}
                    className="accent-[#2164b6]"
                  />
                  <span className="text-[12px] font-semibold text-foreground">{o.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-[11px] font-bold text-muted-foreground">Keep on-topic</Label>
              <button
                type="button"
                role="switch"
                aria-checked={guardrails.keep_on_topic}
                onClick={() => setGuardrails((prev) => ({ ...prev, keep_on_topic: !prev.keep_on_topic }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${guardrails.keep_on_topic ? "bg-[#2164b6]" : "bg-muted"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${guardrails.keep_on_topic ? "left-[22px]" : "left-0.5"}`}
                />
              </button>
            </div>
            <div>
              <Label htmlFor="guardrails-focus-topics" className="text-[11px] font-bold text-muted-foreground">
                Focus topics <span className="text-muted-foreground/50">(comma-separated)</span>
              </Label>
              <Input
                id="guardrails-focus-topics"
                value={focusTopicsText}
                onChange={(e) => setFocusTopicsText(e.target.value)}
                placeholder="e.g. quick family recipes, meal prep, cooking videos"
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="text-sm font-bold gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save AI settings
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Changing the active provider takes effect on the next AI request. Guardrails apply platform-wide.
        </p>
      </div>
    </div>
  );
}
