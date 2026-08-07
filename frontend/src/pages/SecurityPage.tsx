import { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Key,
  Smartphone,
  Shield,
  AlertCircle,
  Copy,
  Loader2,
  Check,
  CheckCheck,
  LogOut,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { PASSWORD_RULES } from "@/lib/auth/passwordRules";
import { AppDownloadQR } from "@/components/WebLockedPage";

interface Session {
  id: string;
  device: string;
  browser: string;
  ip: string;
  last_active: string;
  is_current: boolean;
}

interface TwoFactorSetup {
  secret: string;
  provision_url: string;
  recovery_codes: string[];
}

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passMsg, setPassMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [passSaving, setPassSaving] = useState(false);

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [tfaLoading, setTfaLoading] = useState(false);
  const [tfaSetup, setTfaSetup] = useState<TwoFactorSetup | null>(null);
  const [tfaConfirmCode, setTfaConfirmCode] = useState("");
  const [tfaConfirming, setTfaConfirming] = useState(false);
  const [tfaError, setTfaError] = useState<string | null>(null);
  const [tfaPassword, setTfaPassword] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessLoading, setSessLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get("/auth/2fa/status");
        const data = res.data?.data ?? res.data;
        if (!cancelled) setTwoFactorEnabled(Boolean(data?.enabled));
      } catch {
        // leave the default state
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPassMsg({ ok: false, text: "New passwords do not match." });
      return;
    }
    const unmet = PASSWORD_RULES.filter(rule => !rule.check(newPassword)).map(r => r.label);

    if (unmet.length > 0) {
      setPassMsg({ ok: false, text: `Password must contain ${unmet.join(", ")}.` });
      return;
    }
    setPassSaving(true);
    setPassMsg(null);
    try {
      await apiClient.put("/auth/password", {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setPassMsg({ ok: true, text: "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPassMsg({ ok: false, text: "Failed to update password. Check your current password." });
    } finally {
      setPassSaving(false);
    }
  };

  const handleToggle2FA = async () => {
    setTfaLoading(true);
    setTfaError(null);
    try {
      if (twoFactorEnabled) {
        if (!tfaPassword) {
          setTfaError("Enter your current password to disable 2FA.");
          return;
        }
        await apiClient.post("/auth/2fa/disable", { current_password: tfaPassword });
        setTwoFactorEnabled(false);
        setTfaSetup(null);
        setTfaPassword("");
      } else {
        const res = await apiClient.post("/auth/2fa/enable");
        const data = res.data?.data ?? res.data;
        if (!data?.secret || !data?.provision_url) {
          setTfaError("Unexpected response from the server. Please try again.");
          setTfaSetup(null);
          return;
        }
        setTfaSetup({
          secret: data.secret,
          provision_url: data.provision_url,
          recovery_codes: Array.isArray(data.recovery_codes) ? data.recovery_codes : [],
        });
      }
    } catch {
      setTfaError("Failed to toggle two-factor authentication.");
    } finally {
      setTfaLoading(false);
    }
  };

  const handleConfirm2FA = async () => {
    setTfaConfirming(true);
    setTfaError(null);
    try {
      await apiClient.post("/auth/2fa/confirm", { code: tfaConfirmCode });
      setTwoFactorEnabled(true);
      setTfaSetup(null);
      setTfaConfirmCode("");
    } catch {
      setTfaError("Invalid code. Please try again.");
    } finally {
      setTfaConfirming(false);
    }
  };

  const handleCopyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      setTfaError("Copy failed. Select the code and copy it manually.");
    }
  };

  const handleLoadSessions = async () => {
    setSessLoading(true);
    try {
      const res = await apiClient.get("/auth/sessions");
      const data = res.data?.data ?? res.data;
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    } finally {
      setSessLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiClient.delete(`/auth/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // ignore
    }
  };

  const strengthColor = (pw: string) => {
    if (!pw) return "bg-muted-foreground/20";
    const score = [pw.length >= 8, /[A-Z]/.test(pw), /[a-z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
    if (score <= 2) return "bg-red-500";
    if (score <= 3) return "bg-amber-500";
    return "bg-emerald-500";
  };
  const strengthLabel = (pw: string) => {
    if (!pw) return "";
    const score = [pw.length >= 8, /[A-Z]/.test(pw), /[a-z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
    if (score <= 2) return "Weak";
    if (score <= 3) return "Moderate";
    return "Strong";
  };

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Shield className="h-5 w-5 text-secondary" />
          Security
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your password, two-factor authentication, and active sessions.
        </p>
      </div>

      {/* ── Password ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
          <Key className="h-3.5 w-3.5 text-secondary" /> Password
        </h3>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div className="relative">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-secondary/50 transition-colors"
                placeholder="Enter current password"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                New Password
              </label>
              <input
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-secondary/50 transition-colors"
                placeholder="Min. 8 characters"
                minLength={8}
                required
              />
              {newPassword && (
                <div className="mt-2 space-y-1.5 pl-1">
                  {PASSWORD_RULES.map((rule, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {rule.check(newPassword) ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-700" />}
                      <span className={`text-[11px] font-medium ${rule.check(newPassword) ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}`}>{rule.label}</span>
                    </div>
                  ))}
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden mt-2">
                    <div className={`h-full rounded-full ${strengthColor(newPassword)}`} style={{ width: `${(PASSWORD_RULES.filter(r => r.check(newPassword)).length / PASSWORD_RULES.length) * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{strengthLabel(newPassword)}</p>
                </div>
              )}
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Confirm Password
              </label>
              <input
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-secondary/50 transition-colors"
                placeholder="Repeat new password"
                required
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={() => setShowPasswords(!showPasswords)}
                className="rounded border-border"
              />
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                {showPasswords ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                Show passwords
              </span>
            </label>
            <button
              type="submit"
              disabled={passSaving || !currentPassword || !newPassword || !confirmPassword}
              className="px-5 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs"
            >
              {passSaving ? "Updating..." : "Update Password"}
            </button>
          </div>
          {passMsg && (
            <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${
              passMsg.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
            }`}>
              {passMsg.ok ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              {passMsg.text}
            </div>
          )}
        </form>
      </section>

      {/* ── Two-Factor Authentication ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
          <Smartphone className="h-3.5 w-3.5 text-secondary" /> Two-Factor Authentication
        </h3>

        {tfaError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-600 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {tfaError}
          </div>
        )}

        {tfaSetup ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
              <p className="text-xs font-bold text-foreground">Scan this QR code</p>
              <p className="text-[10px] text-muted-foreground">
                Open your authenticator app (Google Authenticator, Authy, etc.) and scan the QR code below.
              </p>
              <div className="flex justify-center py-3">
                <AppDownloadQR content={tfaSetup.provision_url} size={160} />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
              <p className="text-xs font-bold text-foreground">Or enter this key manually</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-card px-3 py-2 rounded-lg border border-border break-all">
                  {tfaSetup.secret}
                </code>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400">Recovery Codes</p>
              <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70">
                Save these codes in a secure place. Each code can be used once if you lose access to your authenticator app.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {tfaSetup.recovery_codes.map((code, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleCopyCode(code, i)}
                    className="flex items-center justify-between font-mono text-[11px] bg-card px-3 py-1.5 rounded-lg border border-border hover:border-secondary/50 transition-colors"
                  >
                    <span>{code}</span>
                    {copiedIndex === i ? (
                      <CheckCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Confirm setup — enter 6-digit code from app
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={tfaConfirmCode}
                  onChange={(e) => setTfaConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-foreground text-center font-mono text-lg tracking-widest focus:outline-none focus:border-secondary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleConfirm2FA}
                  disabled={tfaConfirming || tfaConfirmCode.length !== 6}
                  className="px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs"
                >
                  {tfaConfirming ? "Verifying..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">
                  {twoFactorEnabled ? "2FA is enabled" : "2FA is disabled"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {twoFactorEnabled
                    ? "An authenticator app code is required to sign in."
                    : "Add an extra layer of security to your account."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={twoFactorEnabled}
                onClick={handleToggle2FA}
                disabled={tfaLoading}
                className={`relative h-6 w-11 rounded-full p-0.5 transition-colors shrink-0 ${
                  twoFactorEnabled ? "bg-secondary" : "bg-muted-foreground/30"
                } disabled:opacity-50`}
              >
                {tfaLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white mx-auto" />
                ) : (
                  <div className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${twoFactorEnabled ? "translate-x-5" : "translate-x-0"}`} />
                )}
              </button>
            </div>
            {twoFactorEnabled && (
              <div className="space-y-1">
                <label htmlFor="tfa-password" className="text-[10px] text-muted-foreground">
                  Current password (required to disable 2FA)
                </label>
                <input
                  id="tfa-password"
                  type="password"
                  value={tfaPassword}
                  onChange={(e) => setTfaPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Active Sessions ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
            <LogOut className="h-3.5 w-3.5 text-secondary" /> Active Sessions
          </h3>
          <button
            type="button"
            onClick={handleLoadSessions}
            className="text-[11px] font-bold text-secondary hover:underline"
          >
            {sessLoading ? "Loading..." : sessions.length > 0 ? "Refresh" : "Load sessions"}
          </button>
        </div>
        {sessLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-secondary mx-auto" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No active sessions found. Click "Load sessions" to view your logged-in devices.
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30"
              >
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    {s.device || s.browser || "Unknown device"}
                    {s.is_current && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary font-bold">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.browser && `${s.browser} · `}IP: {s.ip} · Last active: {s.last_active}
                  </p>
                </div>
                {!s.is_current && (
                  <button
                    type="button"
                    onClick={() => handleRevokeSession(s.id)}
                    className="text-[11px] font-bold text-red-500 hover:underline shrink-0"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
