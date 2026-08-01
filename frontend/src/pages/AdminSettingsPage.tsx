import { useState, useEffect, useCallback } from "react";
import { Settings, Loader2, Save, AlertCircle, Coins, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

const WEB_ROLES = [
  { id: "member", label: "Member dashboard", desc: "Standard user dashboard for members" },
  { id: "creator", label: "Creator dashboard", desc: "Dashboard for creators (studio, store, brand deals…)" },
  { id: "vendor", label: "Vendor dashboard", desc: "Dashboard for vendors (fulfilment, shipping, orders…)" },
] as const;

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "\u20A6",
  USD: "$",
  GBP: "\u00A3",
  EUR: "\u20AC",
  GHS: "GH\u20B5",
  KES: "KSh",
  ZAR: "R",
  XOF: "CFA",
};

const SUPPORTED_CURRENCIES = ["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR", "XOF"];

function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export default function AdminSettingsPage() {
  const [platformName, setPlatformName] = useState("MurihSpace");
  const [supportEmail, setSupportEmail] = useState("support@murihspace.com");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState("NGN");
  const [webDisabledRoles, setWebDisabledRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/securegate/settings`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load settings");
      const j = await res.json();
      const d = j?.success ? j?.data?.data ?? j?.data : j;
      if (d?.platform_name) setPlatformName(d.platform_name);
      if (d?.support_email) setSupportEmail(d.support_email);
      if (d?.maintenance_mode !== undefined) setMaintenanceMode(Boolean(d.maintenance_mode));
      if (d?.default_currency && SUPPORTED_CURRENCIES.includes(d.default_currency)) setDefaultCurrency(d.default_currency);
      if (Array.isArray(d?.web_disabled_roles)) setWebDisabledRoles(d.web_disabled_roles);
    } catch (e) { setFetchError(e instanceof Error ? e.message : "Failed to load settings"); }
    finally { setInitialLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/securegate/settings`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ platform_name: platformName, support_email: supportEmail, maintenance_mode: maintenanceMode, default_currency: defaultCurrency, web_disabled_roles: webDisabledRoles }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      setMsg("Settings saved!");
      toast.success("Settings saved successfully.");
      setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Save failed";
      setMsg(m);
      toast.error(m);
    } finally { setSaving(false); }
  };

  if (initialLoading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  return (
    <div className="w-full mx-auto max-w-[800px] space-y-6 p-6 lg:p-10">
      <div><h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5"><Settings className="h-6 w-6 text-[#38A8D8]" /> Admin Settings</h1><p className="text-xs text-muted-foreground mt-1">Platform configuration and settings.</p></div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setInitialLoading(true); fetchSettings(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
        <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground">Platform Name</label><Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} /></div>
        <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground">Support Email</label><Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} /></div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground">Default Currency</label>
          <div className="relative">
            <Coins className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
              className="appearance-none w-full h-10 pl-9 pr-8 rounded-lg border border-border bg-background text-sm font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#38A8D8]/30"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c} — {CURRENCY_SYMBOLS[c]}</option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-muted-foreground">Analytics dashboards display amounts converted to this currency.</p>
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl border border-border">
          <div><p className="text-xs font-bold text-foreground">Maintenance Mode</p><p className="text-[10px] text-muted-foreground">Block all user access except admins</p></div>
          <button onClick={() => setMaintenanceMode(!maintenanceMode)} role="switch" aria-checked={maintenanceMode} aria-label="Toggle maintenance mode" className={`w-10 h-5 rounded-full transition-colors ${maintenanceMode ? 'bg-rose-500' : 'bg-muted'}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${maintenanceMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <div className="rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-[#38A8D8]" />
            <p className="text-xs font-bold text-foreground">Web Dashboard Access</p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Disable a dashboard on the web to lock it to the app only. Affected users see a "download the app" QR screen instead of the web dashboard, and web signups for those roles get the QR code after registration.
          </p>
          {WEB_ROLES.map((r) => {
            const disabled = webDisabledRoles.includes(r.id);
            return (
              <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-muted/40 border border-border/50">
                <div>
                  <p className="text-xs font-bold text-foreground">{r.label}</p>
                  <p className="text-[10px] text-muted-foreground">{r.desc}</p>
                </div>
                <button
                  onClick={() => setWebDisabledRoles((prev) => disabled ? prev.filter((x) => x !== r.id) : [...prev, r.id])}
                  role="switch"
                  aria-checked={!disabled}
                  aria-label={`Toggle web dashboard access for ${r.label}`}
                  className={`w-10 h-5 rounded-full transition-colors shrink-0 ${disabled ? 'bg-rose-500' : 'bg-emerald-500'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${disabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            );
          })}
          {webDisabledRoles.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-1">All dashboards are available on the web.</p>
          )}
        </div>
        {msg && <p className={`text-xs font-bold ${msg === 'Settings saved!' ? 'text-emerald-400' : 'text-rose-400'}`}>{msg}</p>}
        <Button onClick={handleSave} disabled={saving} className="text-sm font-bold gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings</Button>
      </div>
    </div>
  );
}
