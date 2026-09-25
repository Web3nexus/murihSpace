import { useState, useEffect, useCallback } from "react";
import {
  Storefront,
  Spinner as Loader2,
  FloppyDisk as FloppyDisk,
  WarningCircle as AlertCircle,
  ChatCircleDots,
  Sparkle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/authFetch";
import { Link } from "react-router";

export default function StoreSettingsPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [greetingEnabled, setGreetingEnabled] = useState(false);
  const [greetingMessage, setGreetingMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await authFetch(`/store/settings`);
      if (res.ok) {
        const j = await res.json();
        const d = j?.success ? j?.data : j;
        const data = d?.data ?? d;
        if (data?.name) setName(data.name);
        if (data?.description) setDescription(data.description);
        if (data?.default_currency || data?.currency) setCurrency(data.default_currency || data.currency);
        if (typeof data?.greeting_message_enabled === "boolean") setGreetingEnabled(data.greeting_message_enabled);
        if (data?.greeting_message) setGreetingMessage(data.greeting_message);
      }
    } catch { setLoadError("Failed to load settings."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authFetch(`/store/settings`, {
        method: "PUT", 
        body: JSON.stringify({
          name,
          description,
          default_currency: currency,
          currency,
          greeting_message_enabled: greetingEnabled,
          greeting_message: greetingMessage.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      setMsg("Settings saved!");
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 weight="fill" className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-4 lg:p-5">
      <div>
        <h1 className="text-xl font-black tracking-tight flex items-center gap-2.5">
          <Storefront weight="fill" className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Storefront Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Configure your store profile and preferences.</p>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle weight="fill" className="h-4 w-4 shrink-0" /> {loadError}
          <button onClick={() => fetchSettings()} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      <div className="border-none rounded-lg bg-card p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground">Storefront Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Storefront" />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border-none bg-card p-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground resize-none" placeholder="Tell customers about your store..." />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground">Default Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-lg border-none bg-card p-2.5 text-sm font-medium text-foreground">
            {["USD", "NGN", "GBP", "EUR"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Automated Greeting section */}
        <div className="pt-4 border-t border-border/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkle weight="fill" className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" />
              <label className="text-xs font-bold text-foreground">Automated Customer Greeting</label>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={greetingEnabled}
                onChange={(e) => setGreetingEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2164b6]"></div>
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Instantly greet customers with an automated welcome message when they reach out to your store.
          </p>

          {greetingEnabled && (
            <div className="space-y-2 pt-1 animate-in fade-in duration-150">
              <textarea
                value={greetingMessage}
                onChange={(e) => setGreetingMessage(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-card p-2.5 text-xs font-medium text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/20"
                placeholder="Hello! Thanks for visiting my store. Let me know if you have questions about products, shipping, or custom orders."
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{greetingMessage.length}/1000 characters</span>
                <Link
                  to="/app/settings/automated-replies"
                  className="font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline flex items-center gap-1"
                >
                  <ChatCircleDots weight="fill" className="h-3 w-3" />
                  Advanced auto-reply settings &gt;
                </Link>
              </div>
            </div>
          )}
        </div>

        {msg && <p className={`text-xs font-bold ${msg === 'Settings saved!' ? 'text-emerald-400' : 'text-rose-400'}`}>{msg}</p>}
        <Button onClick={handleSave} disabled={saving} className="text-sm font-bold gap-1.5">
          {saving ? <Loader2 weight="fill" className="h-4 w-4 animate-spin" /> : <FloppyDisk weight="fill" className="h-4 w-4" />} Save Settings
        </Button>
      </div>
    </div>
  );
}
