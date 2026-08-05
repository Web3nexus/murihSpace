import { useEffect, useState } from "react";
import {
  Mail,
  Loader2,
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Server,
  TerminalSquare,
  ShipWheel,
  Cloud,
  Paperclip,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

const TRANSPORTS: { id: string; label: string; desc: string; color: string; icon: typeof Server }[] = [
  { id: "smtp", label: "SMTP", desc: "Any SMTP relay or mailbox (Mailgun, SendGrid, Gmail, etc.).", color: "from-sky-500/20 to-indigo-500/20", icon: Server },
  { id: "postmark", label: "Postmark", desc: "High-deliverability transactional email API.", color: "from-emerald-500/20 to-teal-500/20", icon: ShipWheel },
  { id: "ses", label: "Amazon SES", desc: "Simple Email Service for cost-effective volume sending.", color: "from-orange-500/20 to-amber-500/20", icon: Cloud },
  { id: "resend", label: "Resend", desc: "Developer-friendly email API with great deliverability.", color: "from-rose-500/20 to-pink-500/20", icon: Paperclip },
  { id: "sendmail", label: "Sendmail", desc: "Local MTA on the server.", color: "from-slate-500/20 to-slate-600/20", icon: TerminalSquare },
  { id: "log", label: "Log", desc: "Write emails to the log for development and testing.", color: "from-amber-500/20 to-yellow-500/20", icon: Archive },
  { id: "array", label: "Array", desc: "Collect emails in memory (test suites only).", color: "from-gray-500/20 to-gray-600/20", icon: Archive },
];

interface MailSettings {
  transport: string;
  default_transport: string;
  from_address: string;
  from_name: string;
  smtp: {
    host: string;
    port: string;
    scheme: string | null;
    encryption: string | null;
    username: string | null;
    has_password: boolean;
  };
  postmark: { has_key: boolean };
  resend: { has_key: boolean };
  sendmail: { path: string };
}

function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export default function AdminEmailEngineSettingsPage() {
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/securegate/mail-settings`, { headers: authHeaders() });
        if (!res.ok) throw new Error("Failed to load mail engine settings");
        const j = await res.json();
        const d = j?.success ? j?.data?.data ?? j?.data : j;
        setSettings((d?.config ?? d) ?? null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const patch = (path: string[], value: string | boolean) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev) as MailSettings;
      let cur: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let i = 0; i < path.length - 1; i++) {
        cur = cur[path[i]] as Record<string, unknown>;
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  };

  const setSecret = (key: string, value: string) => setSecrets((prev) => ({ ...prev, [key]: value }));

  const toggleReveal = (key: string) => setReveal((prev) => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        transport: settings.transport,
        from_address: settings.from_address,
        from_name: settings.from_name,
        smtp_host: settings.smtp.host,
        smtp_port: settings.smtp.port,
        smtp_username: settings.smtp.username,
        smtp_password: secrets.smtp_password,
        postmark_key: secrets.postmark_key,
        resend_key: secrets.resend_key,
        sendmail_path: settings.sendmail.path,
      };
      const res = await fetch(`${API_BASE}/securegate/mail-settings`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      const d = j?.success ? j?.data?.data ?? j?.data : j;
      setSettings(((d?.config ?? d) ?? settings));
      setSecrets({});
      setTestResult(null);
      toast.success("Mail engine configuration saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    const to = testTo.trim();
    if (!to) {
      toast.error("Enter an email address to receive the test email.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/securegate/mail-settings/test`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ to }),
      });
      const j = await res.json();
      if (!res.ok) {
        setTestResult({ ok: false, text: j?.message ?? "Test email failed to send." });
        return;
      }
      setTestResult({ ok: true, text: "Test email sent successfully." });
    } catch {
      setTestResult({ ok: false, text: "Request failed." });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;
  }

  if (!settings) {
    return <div className="flex justify-center py-24"><AlertCircle className="h-8 w-8 text-rose-500" /></div>;
  }

  const s = settings;

  return (
    <div className="w-full mx-auto max-w-[880px] space-y-6 p-6 lg:p-10">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <Mail className="h-6 w-6 text-[#38A8D8]" /> Mail Engine
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Choose the mail transport used for transactional email. Secrets are encrypted at rest and never exposed again; enter a new value to replace one.
        </p>
      </div>

      {/* Transport selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {TRANSPORTS.map((t) => {
          const Icon = t.icon;
          const active = s.transport === t.id;
          return (
            <button
              key={t.id}
              onClick={() => patch(["transport"], t.id)}
              className={`text-left rounded-2xl border p-4 transition-all ${active ? "border-[#38A8D8] ring-2 ring-[#38A8D8]/20 bg-[#38A8D8]/5" : "border-border bg-card hover:border-[#38A8D8]/40"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center`}>
                  <Icon className="h-4.5 w-4.5 text-[#38A8D8]" />
                </div>
                {active && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#38A8D8]/15 text-[#38A8D8]">
                    Active
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-foreground">{t.label}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{t.desc}</p>
            </button>
          );
        })}
      </div>

      {/* From / identity */}
      <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
        <p className="text-xs font-black text-foreground uppercase tracking-wide">Sender identity</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] font-bold text-muted-foreground">From address</Label>
            <Input
              value={s.from_address ?? ""}
              onChange={(e) => patch(["from_address"], e.target.value)}
              placeholder="no-reply@murihspace.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-[11px] font-bold text-muted-foreground">From name</Label>
            <Input
              value={s.from_name ?? ""}
              onChange={(e) => patch(["from_name"], e.target.value)}
              placeholder="MurihSpace"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* SMTP config */}
      {s.transport === "smtp" && (
        <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
          <p className="text-xs font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-[#38A8D8]" /> SMTP settings
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-[11px] font-bold text-muted-foreground">Host</Label>
              <Input value={s.smtp.host ?? ""} onChange={(e) => patch(["smtp", "host"], e.target.value)} placeholder="smtp.example.com" className="mt-1" />
            </div>
            <div>
              <Label className="text-[11px] font-bold text-muted-foreground">Port</Label>
              <Input value={s.smtp.port ?? ""} onChange={(e) => patch(["smtp", "port"], e.target.value)} placeholder="587" className="mt-1" />
            </div>
            <div>
              <Label className="text-[11px] font-bold text-muted-foreground">Encryption</Label>
              <Input value={s.smtp.encryption ?? ""} onChange={(e) => patch(["smtp", "encryption"], e.target.value)} placeholder="tls / ssl" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] font-bold text-muted-foreground">Username</Label>
              <Input value={s.smtp.username ?? ""} onChange={(e) => patch(["smtp", "username"], e.target.value)} placeholder="apikey" className="mt-1" autoComplete="off" />
            </div>
            <div>
              <Label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" /> Password
              </Label>
              <div className="relative mt-1">
                <Input
                  type={reveal.smtp_password ? "text" : "password"}
                  value={secrets.smtp_password ?? ""}
                  onChange={(e) => setSecret("smtp_password", e.target.value)}
                  placeholder={s.smtp.has_password ? "Saved — enter a new password to replace it" : "SMTP password / API key"}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button type="button" onClick={() => toggleReveal("smtp_password")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {reveal.smtp_password ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service keys */}
      {s.transport === "postmark" && (
        <div className="border border-border rounded-2xl bg-card p-6 space-y-3">
          <p className="text-xs font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
            <ShipWheel className="h-3.5 w-3.5 text-[#38A8D8]" /> Postmark
          </p>
          <div>
            <Label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> Server API token
            </Label>
            <div className="relative mt-1">
              <Input
                type={reveal.postmark_key ? "text" : "password"}
                value={secrets.postmark_key ?? ""}
                onChange={(e) => setSecret("postmark_key", e.target.value)}
                placeholder={s.postmark.has_key ? "Saved — enter a new token to replace it" : "Paste Postmark server token"}
                autoComplete="new-password"
                className="pr-10"
              />
              <button type="button" onClick={() => toggleReveal("postmark_key")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {reveal.postmark_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {s.transport === "ses" && (
        <div className="border border-border rounded-2xl bg-card p-6">
          <p className="text-xs font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Cloud className="h-3.5 w-3.5 text-[#38A8D8]" /> Amazon SES
          </p>
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            Amazon SES uses your IAM credentials from <code className="text-[#38A8D8]">AWS_ACCESS_KEY_ID</code> / <code className="text-[#38A8D8]">AWS_SECRET_ACCESS_KEY</code> and the region set in <code className="text-[#38A8D8]">AWS_DEFAULT_REGION</code>. Configure those via the server environment.
          </p>
        </div>
      )}

      {s.transport === "resend" && (
        <div className="border border-border rounded-2xl bg-card p-6 space-y-3">
          <p className="text-xs font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5 text-[#38A8D8]" /> Resend
          </p>
          <div>
            <Label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> API key
            </Label>
            <div className="relative mt-1">
              <Input
                type={reveal.resend_key ? "text" : "password"}
                value={secrets.resend_key ?? ""}
                onChange={(e) => setSecret("resend_key", e.target.value)}
                placeholder={s.resend.has_key ? "Saved — enter a new key to replace it" : "Paste Resend API key"}
                autoComplete="new-password"
                className="pr-10"
              />
              <button type="button" onClick={() => toggleReveal("resend_key")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {reveal.resend_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {s.transport === "sendmail" && (
        <div className="border border-border rounded-2xl bg-card p-6 space-y-3">
          <p className="text-xs font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
            <TerminalSquare className="h-3.5 w-3.5 text-[#38A8D8]" /> Sendmail
          </p>
          <div>
            <Label className="text-[11px] font-bold text-muted-foreground">Sendmail path</Label>
            <Input value={s.sendmail.path ?? ""} onChange={(e) => patch(["sendmail", "path"], e.target.value)} placeholder="/usr/sbin/sendmail -bs -i" className="mt-1" />
          </div>
        </div>
      )}

      {/* Save + test */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between border border-border rounded-2xl bg-card p-5">
        <Button onClick={save} disabled={saving} className="text-sm font-bold gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save mail engine
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
            className="sm:w-64"
          />
          <Button variant="outline" onClick={test} disabled={testing} className="text-sm font-bold gap-1.5">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send test email
          </Button>
        </div>
      </div>

      {testResult && (
        <p className={`text-[12px] font-semibold flex items-center gap-1.5 ${testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {testResult.text}
        </p>
      )}
    </div>
  );
}
