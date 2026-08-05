import { useState, useEffect, useCallback } from "react";
import { Settings, Loader2, Save, AlertCircle, Coins, Smartphone, ShieldCheck, Key, ChevronDown, ChevronUp, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

const WEB_ROLES = [
  { id: "member", label: "Member dashboard", desc: "Standard user dashboard for members" },
  { id: "creator", label: "Creator dashboard", desc: "Dashboard for creators (studio, store, brand deals…)" },
  { id: "vendor", label: "Vendor dashboard", desc: "Dashboard for vendors (fulfilment, shipping, orders…)" },
] as const;

interface KycProviderInfo {
  name: string;
  label: string;
  enabled: boolean;
}

const KYC_PROVIDERS: KycProviderInfo[] = [
  { name: "didit", label: "Didit", enabled: false },
  { name: "sumsub", label: "Sumsub", enabled: false },
  { name: "manual", label: "Manual review", enabled: true },
];

const KYC_CREDENTIAL_FIELDS: Record<string, Array<{ key: string; label: string; placeholder: string; type?: string }>> = {
  didit: [
    { key: "api_key", label: "API Key", placeholder: "didit_api_...", type: "password" },
    { key: "workflow_id", label: "Workflow ID", placeholder: "e.g. wf_123456" },
    { key: "client_id", label: "Client ID", placeholder: "Optional Client ID" },
    { key: "client_secret", label: "Client Secret", placeholder: "Optional Client Secret", type: "password" },
    { key: "webhook_secret", label: "Webhook Secret", placeholder: "didit_whsec_...", type: "password" },
  ],
  sumsub: [
    { key: "app_token", label: "App Token", placeholder: "sbx:... or prd:...", type: "password" },
    { key: "secret_key", label: "Secret Key", placeholder: "Sumsub secret key", type: "password" },
    { key: "webhook_secret", label: "Webhook Secret", placeholder: "Sumsub webhook secret", type: "password" },
  ],
};

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
  const [kycProviders, setKycProviders] = useState<string[]>(["manual"]);
  const [kycProviderStatus, setKycProviderStatus] = useState<Record<string, boolean>>({});
  const [kycCredentialsStatus, setKycCredentialsStatus] = useState<Record<string, Record<string, boolean>>>({});
  const [kycCredentialsInput, setKycCredentialsInput] = useState<Record<string, Record<string, string>>>({});
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

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
      const d = j?.data?.data ?? j?.data ?? j;
      if (d?.platform_name) setPlatformName(d.platform_name);
      if (d?.support_email) setSupportEmail(d.support_email);
      if (d?.maintenance_mode !== undefined) setMaintenanceMode(Boolean(d.maintenance_mode));
      if (d?.default_currency && SUPPORTED_CURRENCIES.includes(d.default_currency)) setDefaultCurrency(d.default_currency);
      if (Array.isArray(d?.web_disabled_roles)) setWebDisabledRoles(d.web_disabled_roles);
      if (Array.isArray(d?.kyc_providers) && d.kyc_providers.length > 0) setKycProviders(d.kyc_providers);
      if (d?.kyc_credentials && typeof d.kyc_credentials === "object") setKycCredentialsStatus(d.kyc_credentials);
      if (Array.isArray(d?.kyc_providers_available)) {
        const status: Record<string, boolean> = {};
        d.kyc_providers_available.forEach((p: KycProviderInfo) => { status[p.name] = Boolean(p.enabled); });
        setKycProviderStatus(status);
      }
    } catch (e) { setFetchError(e instanceof Error ? e.message : "Failed to load settings"); }
    finally { setInitialLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        platform_name: platformName,
        support_email: supportEmail,
        maintenance_mode: maintenanceMode,
        default_currency: defaultCurrency,
        web_disabled_roles: webDisabledRoles,
        kyc_providers: kycProviders,
      };

      // Strip empty strings so a cleared-then-not-retyped field is never
      // submitted as an override (major data-integrity fix from CR review).
      const nonEmptyCredentials: Record<string, Record<string, string>> = {};
      for (const [provider, fields] of Object.entries(kycCredentialsInput)) {
        const filtered = Object.fromEntries(
          Object.entries(fields).filter(([, v]) => v !== "")
        );
        if (Object.keys(filtered).length > 0) {
          nonEmptyCredentials[provider] = filtered;
        }
      }
      if (Object.keys(nonEmptyCredentials).length > 0) {
        payload.kyc_credentials = nonEmptyCredentials;
      }

      const res = await fetch(`${API_BASE}/securegate/settings`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");

      const d = j?.data?.data ?? j?.data ?? j;
      if (d) {
        if (d?.kyc_credentials) setKycCredentialsStatus(d.kyc_credentials);
        if (Array.isArray(d?.kyc_providers_available)) {
          const status: Record<string, boolean> = {};
          d.kyc_providers_available.forEach((p: KycProviderInfo) => { status[p.name] = Boolean(p.enabled); });
          setKycProviderStatus(status);
        }
      }

      setKycCredentialsInput({});
      setMsg("Settings saved!");
      toast.success("Settings saved successfully.");
      setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Save failed";
      setMsg(m);
      toast.error(m);
    } finally { setSaving(false); }
  };

  if (initialLoading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;

  return (
    <div className="w-full mx-auto max-w-[800px] space-y-6 p-6 lg:p-10">
      <div><h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5"><Settings className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Admin Settings</h1><p className="text-xs text-muted-foreground mt-1">Platform configuration and settings.</p></div>

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
              className="appearance-none w-full h-10 pl-9 pr-8 rounded-lg border border-border bg-background text-sm font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2164b6]/30"
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
            <Smartphone className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" />
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
        <div className="rounded-xl border border-border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" />
            <p className="text-xs font-bold text-foreground">Identity Verification (KYC) Providers</p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Enable automated KYC providers (ID check + liveness) or use manual review. Configure provider credentials directly here or via environment variables.
          </p>
          {KYC_PROVIDERS.map((p) => {
            const active = kycProviders.includes(p.name);
            const configured = p.name === "manual" ? true : kycProviderStatus[p.name] === true;
            const isExpanded = expandedProvider === p.name;
            const fields = KYC_CREDENTIAL_FIELDS[p.name];

            return (
              <div key={p.name} className="rounded-xl bg-slate-50 dark:bg-muted/40 border border-border/50 overflow-hidden">
                <div className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-foreground">{p.label}</p>
                      {p.name !== "manual" && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${configured ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
                          {configured ? "Configured" : "Credentials needed"}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {p.name === "manual"
                        ? "Always available fallback verification"
                        : configured
                        ? "Ready for live customer verification"
                        : "Configure API credentials below to enable this provider"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {fields && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedProvider(isExpanded ? null : p.name)}
                        className="h-7 px-2 text-[11px] font-bold gap-1"
                      >
                        <Key className="h-3 w-3" />
                        Credentials
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    )}

                    <button
                      onClick={() => setKycProviders((prev) => active ? prev.filter((x) => x !== p.name) : [...prev, p.name])}
                      disabled={!configured}
                      role="switch"
                      aria-checked={active}
                      aria-disabled={!configured}
                      aria-label={`Toggle ${p.label} KYC provider`}
                      className={`w-10 h-5 rounded-full transition-colors shrink-0 ${active ? 'bg-emerald-500' : 'bg-muted'} ${configured ? '' : 'opacity-40 cursor-not-allowed'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>

                {fields && isExpanded && (
                  <div className="border-t border-border/50 bg-background/50 p-3.5 space-y-3">
                    <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-[#2164b6] dark:text-[#7ab0ff]" />
                      API Credentials for {p.label} (Encrypted at rest)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fields.map((f) => {
                        const keyIsSet = kycCredentialsStatus[p.name]?.[f.key] ?? false;
                        const currentValue = kycCredentialsInput[p.name]?.[f.key] ?? "";

                        return (
                          <div key={f.key} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label htmlFor={`kyc-cred-${p.name}-${f.key}`} className="text-[11px] font-medium text-foreground">{f.label}</label>
                              <span className={`text-[10px] ${keyIsSet ? "text-emerald-500 font-medium" : "text-muted-foreground"}`}>
                                {keyIsSet ? "✓ Configured" : "Not set"}
                              </span>
                            </div>
                            <div className="relative">
                              <Input
                                id={`kyc-cred-${p.name}-${f.key}`}
                                type={f.type ?? "text"}
                                value={currentValue}
                                placeholder={keyIsSet ? "•••••••••••• (configured)" : f.placeholder}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setKycCredentialsInput((prev) => ({
                                    ...prev,
                                    [p.name]: {
                                      ...(prev[p.name] ?? {}),
                                      [f.key]: val,
                                    },
                                  }));
                                }}
                                className="text-xs h-8 pr-7"
                              />
                              {currentValue !== "" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setKycCredentialsInput((prev) => ({
                                      ...prev,
                                      [p.name]: {
                                        ...(prev[p.name] ?? {}),
                                        [f.key]: "",
                                      },
                                    }));
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[10px]"
                                  title="Clear input"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                      Note: Entering new values will encrypt & save overrides to admin settings. Empty inputs remain unchanged.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          {kycProviders.length === 0 && (
            <p className="text-[10px] text-rose-400 text-center py-1">No providers selected — sellers will be blocked from payouts/escrow until one is enabled.</p>
          )}
        </div>
        {msg && <p className={`text-xs font-bold ${msg === 'Settings saved!' ? 'text-emerald-400' : 'text-rose-400'}`}>{msg}</p>}
        <Button onClick={handleSave} disabled={saving} className="text-sm font-bold gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings</Button>
      </div>
    </div>
  );
}
