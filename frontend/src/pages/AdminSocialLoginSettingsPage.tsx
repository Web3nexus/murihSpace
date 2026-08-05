import { useEffect, useState } from "react";
import { Loader2, Save, LinkIcon, Eye, EyeOff, Lock, CheckCircle2, AlertCircle, Globe, KeyRound, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

interface ProviderMeta {
  configured: boolean;
  client_id: string;
  client_id_from_env: boolean;
  secret_from_env: boolean;
  redirect: string;
}

const PROVIDERS: { id: string; label: string; desc: string; color: string; callback: string }[] = [
  {
    id: "google",
    label: "Google",
    desc: "Google Sign-In (OAuth 2.0) for your Google account.",
    color: "from-sky-500/20 to-blue-600/20",
    callback: "https://accounts.google.com/o/oauth2/v2/auth",
  },
  {
    id: "apple",
    label: "Apple",
    desc: "Sign in with Apple, using a signed ES256 JWT client secret.",
    color: "from-slate-400/20 to-zinc-600/20",
    callback: "https://appleid.apple.com/auth/authorize",
  },
];

interface ProviderForm {
  client_id: string;
  client_secret: string;
  redirect: string;
  team_id: string;
  key_id: string;
  private_key: string;
}

const EMPTY_FORM: ProviderForm = { client_id: "", client_secret: "", redirect: "", team_id: "", key_id: "", private_key: "" };

function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

const defaultRedirect = (id: string) =>
  id === "apple"
    ? `${API_BASE}/auth/social/apple/callback`
    : `${window.location.origin}/social/callback?provider=${id}`;

export default function AdminSocialLoginSettingsPage() {
  const [providers, setProviders] = useState<Record<string, ProviderMeta>>({});
  const [forms, setForms] = useState<Record<string, ProviderForm>>({});
  const [reveal, setReveal] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/securegate/social-login`, { headers: authHeaders() });
        if (!res.ok) throw new Error("Failed to load social login settings");
        const j = await res.json();
        const d = j?.success ? j?.data?.data ?? j?.data : j;
        setProviders(d?.providers ?? {});
        const f: Record<string, ProviderForm> = {};
        for (const p of PROVIDERS) {
          const meta = (d?.providers ?? {})[p.id];
          f[p.id] = { ...EMPTY_FORM, client_id: meta?.client_id ?? "", redirect: meta?.redirect ?? defaultRedirect(p.id) };
        }
        setForms(f);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (id: string, field: keyof ProviderForm, value: string) =>
    setForms((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const toggleReveal = (id: string, field: string) =>
    setReveal((prev) => {
      const list = prev[id] ?? [];
      return { ...prev, [id]: list.includes(field) ? list.filter((f) => f !== field) : [...list, field] };
    });

  const isRevealed = (id: string, field: string) => (reveal[id] ?? []).includes(field);

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { providers: {} };
      for (const p of PROVIDERS) {
        const f = forms[p.id];
        const entry: Record<string, string> = {};
        if (f.client_id?.trim()) entry.client_id = f.client_id.trim();
        if (f.redirect?.trim()) entry.redirect = f.redirect.trim();
        if (f.client_secret?.trim()) entry.client_secret = f.client_secret.trim();
        if (p.id === "apple") {
          if (f.team_id?.trim()) entry.team_id = f.team_id.trim();
          if (f.key_id?.trim()) entry.key_id = f.key_id.trim();
          if (f.private_key?.trim()) entry.private_key = f.private_key.trim();
        }
        (body.providers as Record<string, unknown>)[p.id] = entry;
      }
      const res = await fetch(`${API_BASE}/securegate/social-login`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      const d = j?.success ? j?.data?.data ?? j?.data : j;
      setProviders(d?.providers ?? providers);
      setForms((prev) => {
        const next = { ...prev };
        for (const p of PROVIDERS) {
          next[p.id] = { ...next[p.id], client_secret: "", private_key: "" };
        }
        return next;
      });
      toast.success("Social login settings saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;
  }

  return (
    <div className="w-full mx-auto max-w-[860px] space-y-6 p-6 lg:p-10">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <LinkIcon className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Social Login
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Configure OAuth credentials for Google and Apple. Secrets are encrypted at rest. Sign-in buttons appear on the login and register screens once a provider is configured.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PROVIDERS.map((p) => {
          const meta = providers[p.id];
          const configured = meta?.configured ?? false;
          return (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center`}>
                  <Globe className="h-4.5 w-4.5 text-[#2164b6] dark:text-[#7ab0ff]" />
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    configured ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {configured ? (meta.client_id_from_env || meta.secret_from_env ? "Configured (env)" : "Configured") : "Not configured"}
                </span>
              </div>
              <p className="text-sm font-bold text-foreground">{p.label}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{p.desc}</p>
            </div>
          );
        })}
      </div>

      {PROVIDERS.map((p) => {
        const meta = providers[p.id];
        const f = forms[p.id] ?? EMPTY_FORM;
        return (
          <div key={p.id} className="border border-border rounded-2xl bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">{p.label} credentials</p>
                {meta?.configured && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                  </span>
                )}
              </div>
              {meta?.client_id_from_env || meta?.secret_from_env ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-600 dark:text-sky-400">
                  <ShieldQuestion className="h-3.5 w-3.5" /> Overridden by env vars
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor={`${p.id}-client-id`} className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Client ID
                </label>
                <Input
                  id={`${p.id}-client-id`}
                  value={f.client_id}
                  onChange={(e) => set(p.id, "client_id", e.target.value)}
                  placeholder={meta?.client_id_from_env ? "Using value from environment (.env)" : "e.g. 1234567890.apps.googleusercontent.com"}
                  autoComplete="off"
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <label htmlFor={`${p.id}-client-secret`} className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> Client Secret
                </label>
                <div className="relative mt-1">
                  <Input
                    id={`${p.id}-client-secret`}
                    type={isRevealed(p.id, "client_secret") ? "text" : "password"}
                    value={f.client_secret}
                    onChange={(e) => set(p.id, "client_secret", e.target.value)}
                    placeholder={meta?.secret_from_env ? "Using value from environment (.env)" : f.client_secret ? "Saved — enter a new value to replace" : "Paste client secret"}
                    autoComplete="off"
                    className="pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => toggleReveal(p.id, "client_secret")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {isRevealed(p.id, "client_secret") ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor={`${p.id}-redirect`} className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                <LinkIcon className="h-3 w-3" /> Redirect URI
              </label>
              <Input
                id={`${p.id}-redirect`}
                value={f.redirect}
                onChange={(e) => set(p.id, "redirect", e.target.value)}
                placeholder={defaultRedirect(p.id)}
                autoComplete="off"
                className="mt-1 font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Register this exact URL in your {p.label} developer console. Default:
                <code className="text-[10px] font-mono ml-1">{defaultRedirect(p.id)}</code>
              </p>
            </div>

            {p.id === "apple" && (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-4">
                <p className="text-[11px] font-bold text-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Apple Sign-In (team, key & private key)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor={`${p.id}-team-id`} className="text-[11px] font-bold text-muted-foreground">Team ID</label>
                    <Input
                      id={`${p.id}-team-id`}
                      value={f.team_id}
                      onChange={(e) => set(p.id, "team_id", e.target.value)}
                      placeholder="e.g. 5PHZZX4K2Q"
                      className="mt-1 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${p.id}-key-id`} className="text-[11px] font-bold text-muted-foreground">Key ID</label>
                    <Input
                      id={`${p.id}-key-id`}
                      value={f.key_id}
                      onChange={(e) => set(p.id, "key_id", e.target.value)}
                      placeholder="e.g. 8V22QZXH9D"
                      className="mt-1 font-mono text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor={`${p.id}-private-key`} className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Private key (.p8 contents)
                  </label>
                  <textarea
                    id={`${p.id}-private-key`}
                    value={f.private_key}
                    onChange={(e) => set(p.id, "private_key", e.target.value)}
                    placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                    autoComplete="off"
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2164b6]/20"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Used to sign the ES256 JWT client secret. Never commit this key to the repository.
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="text-sm font-bold gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save social login settings
        </Button>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" /> Configuring a provider enables its sign-in button on the auth screens.
        </p>
      </div>
    </div>
  );
}
