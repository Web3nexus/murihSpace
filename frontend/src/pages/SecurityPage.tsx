import { useState } from "react";
import {
  Shield,
  Smartphone,
  LogOut,
  Key,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface Session {
  id: string;
  device: string;
  browser: string;
  ip: string;
  last_active: string;
  is_current: boolean;
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

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessLoading, setSessLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPassMsg({ ok: false, text: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setPassMsg({ ok: false, text: "Password must be at least 8 characters." });
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
    try {
      if (twoFactorEnabled) {
        await apiClient.post("/auth/2fa/disable");
        setTwoFactorEnabled(false);
      } else {
        await apiClient.post("/auth/2fa/enable");
        setTwoFactorEnabled(true);
      }
    } catch {
      // backend not ready yet
    } finally {
      setTfaLoading(false);
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
    <div className="space-y-6 w-full max-w-3xl">
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
                <div className="mt-1.5 space-y-1">
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${strengthColor(newPassword)}`} style={{ width: `${([newPassword.length >= 8, /[A-Z]/.test(newPassword), /[a-z]/.test(newPassword), /[0-9]/.test(newPassword), /[^A-Za-z0-9]/.test(newPassword)].filter(Boolean).length / 5) * 100}%` }} />
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
        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-foreground">
              {twoFactorEnabled ? "2FA is enabled" : "2FA is disabled"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {twoFactorEnabled
                ? "An authenticator app or SMS code is required to sign in."
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
