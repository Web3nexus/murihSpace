import { getAuthToken } from "@/lib/auth/token";
import { useEffect, useState } from "react";
import {
  Spinner as Loader2,
  FloppyDisk as FloppyDisk,
  ShieldCheck as ShieldCheck,
  WarningCircle as AlertCircle,
  CheckCircle as CheckCircle2,
  DeviceMobile as Smartphone,
  Envelope as Envelope,
  Fingerprint as Fingerprint,
  Globe as Globe,
  AppleLogo as AppleIcon
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/api/authFetch";
import { cn } from "@/lib/utils";



type MethodKey = "phone_otp" | "email_password" | "google" | "apple" | "passkey";

interface MethodCfg {
  login: boolean;
  registration: boolean;
  display_order: number;
}

interface AuthMethodsConfig {
  primary: string;
  methods: Record<MethodKey, MethodCfg>;
}

const METHOD_META: Record<MethodKey, { label: string; desc: string; icon: React.ReactNode }> = {
  phone_otp: {
    label: "Phone OTP",
    desc: "Sign in with a 6-digit SMS code. Recommended as the primary method.",
    icon: <Smartphone weight="fill" className="h-4 w-4" />,
  },
  email_password: {
    label: "Email & password",
    desc: "Classic email address plus password sign-in.",
    icon: <Envelope weight="fill" className="h-4 w-4" />,
  },
  google: {
    label: "Google",
    desc: "One-tap sign-in with Google. Requires OAuth credentials in Social Login.",
    icon: <Globe weight="fill" className="h-4 w-4" />,
  },
  apple: {
    label: "Apple",
    desc: "Sign in with Apple. Requires credentials in Social Login.",
    icon: <AppleIcon weight="fill" className="h-4 w-4" />,
  },
  passkey: {
    label: "Passkey",
    desc: "Passwordless sign-in with platform passkeys (WebAuthn).",
    icon: <Fingerprint weight="fill" className="h-4 w-4" />,
  },
};

const METHOD_KEYS: MethodKey[] = ["phone_otp", "email_password", "google", "apple", "passkey"];

function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export default function AdminAuthMethodsPage() {
  const [config, setConfig] = useState<AuthMethodsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`/securegate/auth/methods`, { headers: authHeaders() });
        if (!res.ok) throw new Error("Failed to load auth methods");
        const j = await res.json();
        const d = j?.success ? j?.data?.data ?? j?.data : j;
        setConfig(d as AuthMethodsConfig);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !config) {
    return <div className="flex justify-center py-24"><Loader2 weight="fill" className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;
  }

  const loginEnabledCount = METHOD_KEYS.filter((k) => config.methods[k].login).length;
  const coreLoginOn = config.methods.phone_otp.login || config.methods.email_password.login;

  const toggle = (key: MethodKey, field: "login" | "registration") => {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev, methods: { ...prev.methods } };
      next.methods[key] = { ...prev.methods[key], [field]: !prev.methods[key][field] };
      return next;
    });
    setDirty(true);
  };

  const setPrimary = (key: MethodKey) => {
    setConfig((prev) => (prev ? { ...prev, primary: key } : prev));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        primary: config.primary,
        methods: {},
      };
      for (const k of METHOD_KEYS) {
        (body.methods as Record<string, unknown>)[k] = {
          login: config.methods[k].login,
          registration: config.methods[k].registration,
          display_order: config.methods[k].display_order,
        };
      }
      const res = await authFetch(`/securegate/auth/methods`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) {
        const errors = j?.errors;
        const msg = errors && typeof errors === "object"
          ? (Object.values(errors as Record<string, string[]>).flat()[0] ?? j?.message ?? "FloppyDisk failed")
          : (j?.message ?? "FloppyDisk failed");
        throw new Error(msg);
      }
      const d = j?.success ? j?.data?.data ?? j?.data : j;
      setConfig(d as AuthMethodsConfig);
      setDirty(false);
      toast.success("Authentication methods saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "FloppyDisk failed");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="w-full mx-auto max-w-[860px] space-y-6 p-4 lg:p-10">
      <div>
        <h1 className="text-xl font-black tracking-tight flex items-center gap-2.5">
          <ShieldCheck weight="fill" className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Authentication Methods
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Choose which sign-in and registration methods are available. Changes apply instantly to the login and register screens. At least one core method (Phone OTP or Email &amp; password) must stay enabled to avoid locking users out.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border-none bg-card p-4">
          <p className="text-xs font-bold text-foreground">Primary method</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            {METHOD_META[config.primary as MethodKey]?.label ?? "None"} — highlighted first on the login screen.
          </p>
        </div>
        <div className="rounded-lg border-none bg-card p-4">
          <p className="text-xs font-bold text-foreground">{loginEnabledCount} login method{loginEnabledCount === 1 ? "" : "s"}</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            {coreLoginOn ? "At least one core method remains enabled." : "Warning: no core (Phone/Email) login method is enabled!"}
          </p>
        </div>
        <div className="rounded-lg border-none bg-card p-4">
          <p className="text-xs font-bold text-foreground">Registration</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            Methods with registration enabled accept new sign-ups.
          </p>
        </div>
      </div>

      <div className="border-none rounded-lg bg-card overflow-hidden">
        {METHOD_KEYS.map((key, i) => {
          const m = config.methods[key];
          const meta = METHOD_META[key];
          const isPrimary = config.primary === key;
          return (
            <div key={key} className={cn("flex items-center justify-between gap-4 px-5 py-4", i > 0 && "border-t border-border")}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center text-[#2164b6] dark:text-[#7ab0ff] shrink-0">
                  {meta.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground">{meta.label}</p>
                    {isPrimary && (
                      <span className="text-[9px] font-black uppercase tracking-wide text-[#2164b6] dark:text-[#7ab0ff] bg-[#2164b6]/10 rounded-full px-2 py-0.5">
                        Primary
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{meta.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-5 shrink-0">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={m.login}
                    onChange={() => toggle(key, "login")}
                    className="h-4 w-4 rounded border-border accent-[#2164b6]"
                  />
                  <span className="text-[11px] font-bold text-muted-foreground">Login</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={m.registration}
                    onChange={() => toggle(key, "registration")}
                    className="h-4 w-4 rounded border-border accent-[#2164b6]"
                  />
                  <span className="text-[11px] font-bold text-muted-foreground">Register</span>
                </label>
                <button
                  type="button"
                  onClick={() => setPrimary(key)}
                  disabled={!m.login}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-wide rounded-lg px-3 py-1.5 border transition-colors",
                    isPrimary
                      ? "border-[#2164b6] bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff]"
                      : m.login
                        ? "border-border text-muted-foreground hover:text-[#2164b6] dark:text-[#7ab0ff] hover:border-[#2164b6]/50"
                        : "border-border text-muted-foreground/40 cursor-not-allowed"
                  )}
                  title={m.login ? "Set as primary" : "Enable login to set as primary"}
                >
                  Primary
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!coreLoginOn && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5">
          <AlertCircle weight="fill" className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-rose-500">
            Both Phone OTP and Email &amp; password login are disabled. The platform would not allow this — saving will fail.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving || !dirty} className="text-sm font-bold gap-1.5">
          {saving ? <Loader2 weight="fill" className="h-4 w-4 animate-spin" /> : <FloppyDisk weight="fill" className="h-4 w-4" />}
          FloppyDisk changes
        </Button>
        {!dirty && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><CheckCircle2 weight="fill" className="h-3.5 w-3.5" /> All changes saved</p>}
      </div>
    </div>
  );
}
