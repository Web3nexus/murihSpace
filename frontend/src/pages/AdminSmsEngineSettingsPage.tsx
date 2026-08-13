import { getAuthToken } from "@/lib/auth/token";
import { useEffect, useState } from "react";
import {
  MessageSquareText,
  Loader2,
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/api/authFetch";



const TRANSPORTS: { id: string; label: string; desc: string; color: string; icon: typeof Archive }[] = [
  {
    id: "twilio",
    label: "Twilio",
    desc: "Programmable SMS over a Twilio phone number or messaging service.",
    color: "from-rose-500/20 to-red-500/20",
    icon: MessageSquareText,
  },
  {
    id: "log",
    label: "Log",
    desc: "Write messages to the log for development and testing.",
    color: "from-amber-500/20 to-yellow-500/20",
    icon: Archive,
  },
];

interface SmsSettings {
  transport: string;
  default_transport: string;
  twilio: {
    account_sid: string;
    from_number: string;
    has_auth_token: boolean;
  };
}

function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export default function AdminSmsEngineSettingsPage() {
  const [settings, setSettings] = useState<SmsSettings | null>(null);
  const [authToken, setAuthToken] = useState("");
  const [revealToken, setRevealToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`/securegate/sms-settings`, { headers: authHeaders() });
        if (!res.ok) throw new Error("Failed to load SMS engine settings");
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

  const patch = (path: string[], value: string) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev) as SmsSettings;
      let cur: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let i = 0; i < path.length - 1; i++) {
        cur = cur[path[i]] as Record<string, unknown>;
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        transport: settings.transport,
        account_sid: settings.twilio.account_sid,
        from_number: settings.twilio.from_number,
        auth_token: authToken || undefined,
      };
      const res = await authFetch(`/securegate/sms-settings`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      const d = j?.success ? j?.data?.data ?? j?.data : j;
      setSettings((d?.config ?? d) ?? settings);
      setAuthToken("");
      setTestResult(null);
      toast.success("SMS engine configuration saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    const to = testTo.trim();
    if (!to) {
      toast.error("Enter a phone number to receive the test SMS.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await authFetch(`/securegate/sms-settings/test`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ to }),
      });
      const j = await res.json();
      if (!res.ok) {
        setTestResult({ ok: false, text: j?.message ?? "Test SMS failed to send." });
        return;
      }
      setTestResult({ ok: true, text: "Test SMS sent successfully." });
    } catch {
      setTestResult({ ok: false, text: "Request failed." });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;
  }

  if (!settings) {
    return <div className="flex justify-center py-24"><AlertCircle className="h-8 w-8 text-rose-500" /></div>;
  }

  const s = settings;

  return (
    <div className="w-full mx-auto max-w-[880px] space-y-6 p-6 lg:p-10">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <MessageSquareText className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> SMS Engine
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Choose the transport used for outbound SMS. Secrets are encrypted at rest and never exposed again; enter a new value to replace one.
        </p>
      </div>

      {/* Transport selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TRANSPORTS.map((t) => {
          const Icon = t.icon;
          const active = s.transport === t.id;
          return (
            <button
              key={t.id}
              onClick={() => patch(["transport"], t.id)}
              className={`text-left rounded-2xl border p-4 transition-all ${active ? "border-[#2164b6] ring-2 ring-[#2164b6]/20 bg-[#2164b6]/5" : "border-border bg-card hover:border-[#2164b6]/40"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center`}>
                  <Icon className="h-4.5 w-4.5 text-[#2164b6] dark:text-[#7ab0ff]" />
                </div>
                {active && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2164b6]/15 text-[#2164b6] dark:text-[#7ab0ff]">
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

      {/* Twilio config */}
      {s.transport === "twilio" && (
        <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
          <p className="text-xs font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
            <MessageSquareText className="h-3.5 w-3.5 text-[#2164b6] dark:text-[#7ab0ff]" /> Twilio settings
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] font-bold text-muted-foreground">Account SID</Label>
              <Input
                value={s.twilio.account_sid ?? ""}
                onChange={(e) => patch(["twilio", "account_sid"], e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="mt-1"
                autoComplete="off"
              />
            </div>
            <div>
              <Label className="text-[11px] font-bold text-muted-foreground">From number (E.164)</Label>
              <Input
                value={s.twilio.from_number ?? ""}
                onChange={(e) => patch(["twilio", "from_number"], e.target.value)}
                placeholder="+12025550123"
                className="mt-1"
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <Label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> Auth token
            </Label>
            <div className="relative mt-1">
              <Input
                type={revealToken ? "text" : "password"}
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder={s.twilio.has_auth_token ? "Saved — enter a new token to replace it" : "Paste Twilio auth token"}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setRevealToken((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {revealToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {s.transport === "log" && (
        <div className="border border-border rounded-2xl bg-card p-6">
          <p className="text-xs font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Archive className="h-3.5 w-3.5 text-[#2164b6] dark:text-[#7ab0ff]" /> Log
          </p>
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            Messages are written to the server log instead of being delivered. Use this for development and testing.
          </p>
        </div>
      )}

      {/* Save + test */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between border border-border rounded-2xl bg-card p-5">
        <Button onClick={save} disabled={saving} className="text-sm font-bold gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save SMS engine
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="+2348012345678"
            className="sm:w-64"
          />
          <Button variant="outline" onClick={test} disabled={testing} className="text-sm font-bold gap-1.5">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send test SMS
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