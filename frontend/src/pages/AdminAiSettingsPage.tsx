import { useEffect, useState } from "react";
import { Sparkles, Loader2, Save, AlertCircle, CheckCircle2, Eye, EyeOff, PlugZap, Bot, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

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

export default function AdminAiSettingsPage() {
  const [provider, setProvider] = useState("anthropic");
  const [providers, setProviders] = useState<Record<string, ProviderMeta>>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [models, setModels] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; text: string }>>({});
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
      const body: Record<string, unknown> = { provider };
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
      setKeys({});
      setTestResult({});
      toast.success("AI provider settings saved.");
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
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;
  }

  return (
    <div className="w-full mx-auto max-w-[860px] space-y-6 p-6 lg:p-10">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <Sparkles className="h-6 w-6 text-[#38A8D8]" /> AI Providers
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
              className={`text-left rounded-2xl border p-4 transition-all ${active ? "border-[#38A8D8] ring-2 ring-[#38A8D8]/20 bg-[#38A8D8]/5" : "border-border bg-card hover:border-[#38A8D8]/40"}`}
            >
              <div className={`flex items-center justify-between mb-2`}>
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center`}>
                  <Bot className="h-4.5 w-4.5 text-[#38A8D8]" />
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
                <p className="text-[10px] font-bold text-[#38A8D8] mt-2 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#38A8D8]" /> Active provider
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
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-[#38A8D8] disabled:opacity-50 transition-colors"
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

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="text-sm font-bold gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save provider settings
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Changing the active provider takes effect on the next AI request. Existing behavior settings (persona, tone, guardrails) carry over.
        </p>
      </div>
    </div>
  );
}
