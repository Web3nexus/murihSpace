import { authFetch } from "@/lib/api/authFetch";
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/forms/PhoneInput";
import { OtpInput } from "@/components/forms/OtpInput";
import {
  ShieldFail as ShieldWarning,
  ArrowLeft,
  Swap as RefreshCw,
  TickSquare as CheckCircle2,
  Scan as ScanIcon,
} from "@/components/icons";
import { Spinner as Loader2, DeviceMobile as Smartphone } from "@/components/icons/rounded";
import { cn } from "@/lib/utils";
import { anyLoginMethodEnabled, loginVisibility } from "@/lib/loginVisibility";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { stashSocialReturn, usePostAuthRedirect } from "@/lib/usePostAuthRedirect";
import { setSessionHint } from "@/lib/auth/sessionHint";
import QRCode from "qrcode";

const DEFAULT_COUNTRY = "NG";

type LoginMode = "qr" | "phone";

export function LoginPage() {
  const { requestOtp, verifyOtp, logout, loading, error, fieldErrors } = useAuth();
  const cfg = usePlatformConfig();
  const navigate = useNavigate();
  const postAuthPath = usePostAuthRedirect();

  const methods = cfg.auth_methods.methods;
  const visibility = loginVisibility(methods);
  const phoneLoginEnabled = visibility.phoneEnabled;
  const socialProviders = visibility.socialEnabled;

  const [loginMode, setLoginMode] = useState<LoginMode>("qr");

  // Phone OTP flow
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">("phone");
  const [phoneE164, setPhoneE164] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [otpChannel, setOtpChannel] = useState<string>("sms");
  const [deliveryMessage, setDeliveryMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // QR flow
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrPollToken, setQrPollToken] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<"pending" | "scanned" | "expired" | "error">("pending");
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<number | null>(null);
  const [qrCountdown, setQrCountdown] = useState<number>(0);
  const qrPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrPollTokenRef = useRef<string | null>(null);
  const qrStartingRef = useRef(false);
  const qrRequestIdRef = useRef(0);

  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [adminBlocked, setAdminBlocked] = useState(false);
  const [memberBlocked, setMemberBlocked] = useState(false);

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
      if (qrPollRef.current) clearTimeout(qrPollRef.current);
    };
  }, []);

  const clearQrPoll = () => {
    if (qrPollRef.current) {
      clearTimeout(qrPollRef.current);
      qrPollRef.current = null;
    }
  };

  const startResendCooldown = (seconds: number) => {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    setResendIn(Math.max(seconds, 0));
    resendTimerRef.current = setInterval(() => {
      setResendIn((prev) => {
        if (prev <= 1 && resendTimerRef.current) {
          clearInterval(resendTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startQr = async () => {
    // One request at a time: the countdown can call this on several ticks.
    if (qrStartingRef.current) return;
    qrStartingRef.current = true;
    const requestId = ++qrRequestIdRef.current;
    qrPollTokenRef.current = null;
    clearQrPoll();
    setQrExpiresAt(null);
    setQrStatus("pending");
    setQrImage(null);
    setQrError(null);
    try {
      const res = await authFetch("/auth/qr/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`The server returned ${res.status}. Please try again.`);
      const j = await res.json();
      if (requestId !== qrRequestIdRef.current) return;
      const d = j?.success ? j?.data : j;
      const token = d?.qr_token as string | undefined;
      const poll = d?.poll_token as string | undefined;
      const expiresAt = d?.expires_at as string | undefined;
      if (!token || !poll) throw new Error("The server did not return a QR code.");

      qrPollTokenRef.current = poll;
      setQrPollToken(poll);
      const expires = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 120_000;
      setQrExpiresAt(expires);
      setQrCountdown(Math.max(0, Math.floor((expires - Date.now()) / 1000)));

      const link = (d?.qr_deep_link as string) || (d?.qr_url as string) || `murihspace://qr-login?token=${token}`;
      QRCode.toDataURL(link, { width: 512, margin: 1, errorCorrectionLevel: "H" })
        .then((data) => {
          if (requestId === qrRequestIdRef.current) setQrImage(data);
        })
        .catch(() => {
          setQrError("Could not render the QR code image.");
          setQrStatus("error");
        });
    } catch (err) {
      if (requestId !== qrRequestIdRef.current) return;
      setQrError(err instanceof Error ? err.message : "Could not reach the login server.");
      setQrStatus("error");
    } finally {
      qrStartingRef.current = false;
    }
  };

  const pollQr = async (pollToken: string) => {
    try {
      const res = await authFetch("/auth/qr/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poll_token: pollToken }),
      });
      // Non-2xx (410 expired / 403 denied) also carry a JSON status in `errors`.
      const j = await res.json().catch(() => null);

      // A refresh may have started a new QR while this request was in flight.
      // Bail before touching login state so an outdated poll cannot log the
      // user in or reschedule.
      if (qrPollTokenRef.current !== pollToken) return;

      const d = j?.data ?? j?.errors ?? j ?? {};
      const status = d?.status as string | undefined;

      // The approval sets the session cookie server-side. No token is returned to the browser.
      if (status === "approved") {
        const role = d?.user?.role;
        // The web dashboard is for creators and vendors only, mirroring the
        // phone-OTP path: admins use the securegate portal, members use the app.
        if (role === "admin" || role === "member") {
          // The approval already set a session cookie server-side. Revoke it
          // before discarding so it can never be replayed, then route the user
          // to the correct surface.
          await authFetch("/auth/logout", { method: "POST" }).catch(() => {});
          if (role === "admin") setAdminBlocked(true);
          else setMemberBlocked(true);
          clearQrPoll();
          return;
        }
        // A full load lets the auth provider pick up the new session from /user.
        setSessionHint(true);
        window.location.assign(postAuthPath);
        return;
      }
      if (status === "scanned") {
        setQrStatus("scanned");
      }
      if (["denied", "expired", "consumed", "failed", "not_found"].includes(status ?? "")) {
        setQrStatus("expired");
        clearQrPoll();
        return;
      }
      if (!res.ok && !status) {
        // Unexpected error payload — stop rather than loop forever, and drop
        // the now-stale QR image so it cannot be shown as if still valid.
        setQrImage(null);
        setQrStatus("error");
        return;
      }
    } catch {
      // transient network error: keep polling until expiry
    }

    qrPollRef.current = setTimeout(() => {
      // Guard against a stale in-flight poll rescheduling after the user has
      // refreshed to a new QR code.
      if (qrPollTokenRef.current === pollToken) void pollQr(qrPollTokenRef.current);
    }, 1500);
  };

  // Kick off (or tear down) the QR transaction when the mode changes.
  useEffect(() => {
    if (loginMode !== "qr") {
      clearQrPoll();
      return;
    }
    // Start just after the effect so the transaction's state updates are not synchronous in the effect body
    const start = setTimeout(() => void startQr(), 0);
    return () => {
      clearTimeout(start);
      clearQrPoll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginMode]);

  // Begin polling once we have a poll token.
  useEffect(() => {
    if (loginMode !== "qr" || !qrPollToken) return;
    void pollQr(qrPollToken);
    return () => clearQrPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginMode, qrPollToken]);

  // Countdown to expiry.
  useEffect(() => {
    if (loginMode !== "qr" || qrExpiresAt === null) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((qrExpiresAt - Date.now()) / 1000));
      setQrCountdown(diff);
      if (diff <= 0) {
        // Like a messenger's web login: when the code times out, a fresh one
        // replaces it without any action from the user.
        clearQrPoll();
        void startQr();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginMode, qrExpiresAt]);

  const handleRequestPhoneOtp = async (options?: { forceSms?: boolean; e?: React.FormEvent }) => {
    options?.e?.preventDefault();
    setOtpError(null);
    setNoAccount(false);
    if (!phoneE164) return;
    const result = await requestOtp({
      intent: "login",
      phoneE164,
      force_sms: options?.forceSms,
    });
    if (!result) return;
    setMaskedPhone(result.masked_phone);
    setOtpChannel(result.channel || "sms");
    setDeliveryMessage(result.delivery_message || null);
    setCode("");
    setPhoneStep("otp");
    setAdminBlocked(false);
    startResendCooldown(result.resend_after_seconds ?? 60);
  };

  const handleVerifyPhoneOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setOtpError(null);
    setNoAccount(false);
    if (code.length < 6) return;
    const result = await verifyOtp({ intent: "login", phoneE164, code });
    if (!result) return;
    if (!result.account_exists) {
      setNoAccount(true);
      return;
    }
    if (result.user?.role === "admin") {
      await logout();
      setAdminBlocked(true);
      return;
    }
    if (result.user?.role === "member") {
      await logout();
      setMemberBlocked(true);
      return;
    }
    navigate(postAuthPath);
  };

  const handleSocialLogin = async (provider: string) => {
    setSocialLoading(provider);
    setSocialError(null);
    try {
      const res = await authFetch(`/auth/social/${provider}/redirect`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      if (d?.redirect_url) {
        // `next` on the provider's authorize URL would never come back — Google
        // and Apple only echo their own parameters — so the destination is held
        // in this tab and read by /social/callback instead.
        stashSocialReturn(postAuthPath);
        window.location.assign(d.redirect_url);
        return;
      }
      throw new Error("Missing redirect_url");
    } catch {
      setSocialError(`Could not start ${provider} sign-in. Please try again.`);
    }
    setSocialLoading(null);
  };

  return (
    <AuthLayout
      headlineText="Better connection"
      accentText="with safety."
      subText="Connect with communities, sell digital & physical products, host live audio rooms, and grow your audience."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 text-left">
          <h2 className="text-xl sm:text-xl font-extrabold tracking-tight text-[var(--shell-text)] dark:text-white">
            Sign in to MurihSpace
          </h2>
          <p className="text-xs sm:text-sm text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
            {loginMode === "qr"
              ? "Scan this code with the MurihSpace mobile app to sign in instantly."
              : "We'll text you a code to verify it's you."}
          </p>
        </div>

        {adminBlocked && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ShieldWarning weight="fill" className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-bold text-amber-500 uppercase tracking-wide">Admin access</span>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Admins must use the{" "}
              <Link to="/securegate/login" className="font-bold underline underline-offset-2 hover:text-amber-500">
                admin login portal
              </Link>
              .
            </p>
          </div>
        )}

        {memberBlocked && (
          <div className="rounded-lg bg-[var(--shell-accent-solid)]/10 border border-[var(--shell-accent)]/20 p-4 text-center ">
            <div className="flex items-center justify-center mb-3">
              <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-full text-[var(--shell-accent)] dark:text-[var(--shell-accent)]">
                <Smartphone weight="fill" className="h-6 w-6" />
              </div>
            </div>
            <h3 className="text-sm font-bold text-[var(--shell-text)] dark:text-white mb-2">Download the App</h3>
            <p className="text-xs text-[var(--shell-muted)] dark:text-[var(--shell-muted)] mb-4 leading-relaxed">
              The web dashboard is exclusively designed for Creators and Vendors. Please use the MurihSpace mobile app to connect safely with communities.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="w-full h-10 text-xs rounded-lg" onClick={() => window.open('https://play.google.com/store', '_blank')}>
                Google Play
              </Button>
              <Button className="w-full h-10 text-xs rounded-lg bg-slate-900 text-white hover:bg-slate-800" onClick={() => window.open('https://apps.apple.com', '_blank')}>
                App Store
              </Button>
            </div>
          </div>
        )}

        {socialError && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs sm:text-sm text-rose-500 text-center font-medium">
            {socialError}
          </div>
        )}

        {/* Method switcher */}
        {phoneLoginEnabled && (
          <div className="flex gap-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 p-1">
            <button
              type="button"
              id="login-tab-qr"
              onClick={() => setLoginMode("qr")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 h-10 rounded-md text-xs sm:text-sm font-bold transition-all",
                loginMode === "qr"
                  ? "bg-white dark:bg-slate-900 text-[var(--shell-text)] dark:text-white shadow-sm"
                  : "text-[var(--shell-muted)] hover:text-[var(--shell-text)] dark:text-[var(--shell-muted)] dark:hover:text-white",
              )}
            >
              <ScanIcon className="h-4 w-4" />
              QR Code
            </button>
            <button
              type="button"
              id="login-tab-phone"
              onClick={() => setLoginMode("phone")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 h-10 rounded-md text-xs sm:text-sm font-bold transition-all",
                loginMode === "phone"
                  ? "bg-white dark:bg-slate-900 text-[var(--shell-text)] dark:text-white shadow-sm"
                  : "text-[var(--shell-muted)] hover:text-[var(--shell-text)] dark:text-[var(--shell-muted)] dark:hover:text-white",
              )}
            >
              <Smartphone className="h-4 w-4" />
              Phone OTP
            </button>
          </div>
        )}

        {/* No enabled method: mirror the mobile screen instead of showing a
            form the backend will reject. */}
        {!cfg.loading && !anyLoginMethodEnabled(visibility) && (
          <p className="text-sm font-medium text-rose-600 dark:text-rose-400 text-center">
            Login is currently disabled. Please contact support.
          </p>
        )}

        {/* QR login */}
        {loginMode === "qr" && anyLoginMethodEnabled(visibility) && (
          <div className="flex flex-col items-center justify-center gap-4 py-2">
            <div className="relative flex items-center justify-center rounded-2xl border border-[var(--shell-border)] dark:border-[var(--shell-border)] bg-white dark:bg-slate-950 p-5 shadow-sm">
              {qrImage && qrStatus === "pending" && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-white p-1.5 shadow-md ring-1 ring-slate-200">
                  <img src="/logos/member-icon-light.png" alt="" aria-hidden="true" className="h-full w-full object-contain" />
                </div>
              )}
              {qrImage ? (
                <img src={qrImage} alt="QR code to sign in" className="h-56 w-56 sm:h-64 sm:w-64" />
              ) : (
                <div className="flex h-56 w-56 sm:h-64 sm:w-64 items-center justify-center">
                  {qrStatus === "error" ? (
                    <div className="flex flex-col items-center gap-3 px-4 text-center">
                      <span className="text-xs font-medium text-rose-500">
                        {qrError ?? "Could not load QR code"}
                      </span>
                      <Button type="button" size="sm" variant="outline" onClick={() => void startQr()}>
                        Try again
                      </Button>
                    </div>
                  ) : (
                    <Loader2 weight="fill" className="h-6 w-6 animate-spin text-[var(--shell-muted)]" />
                  )}
                </div>
              )}

              {qrStatus === "expired" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm">
                  <span className="text-sm font-bold text-[var(--shell-text)] dark:text-white">QR code expired</span>
                  <Button type="button" size="sm" onClick={() => void startQr()}>
                    Refresh QR
                  </Button>
                </div>
              )}

              {qrStatus === "scanned" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" weight="fill" />
                  <span className="text-sm font-bold text-[var(--shell-text)] dark:text-white">Scanned</span>
                  <p className="px-6 text-center text-xs text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
                    Approve the sign-in on your mobile device to continue.
                  </p>
                </div>
              )}
            </div>


            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-xs text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
                Open <span className="font-semibold text-slate-700 dark:text-slate-200">MurihSpace</span> on your phone, tap{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">Link a device</span>, then scan.
              </p>
              {qrExpiresAt !== null && qrStatus !== "expired" && (
                <span className="text-xs font-semibold text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
                  Expires in {qrCountdown}s
                </span>
              )}
            </div>
          </div>
        )}

        {/* Phone OTP flow */}
        {loginMode === "phone" && phoneLoginEnabled && (
          <>
            {phoneStep === "phone" ? (
              <form onSubmit={(e) => handleRequestPhoneOtp({ e })} className="space-y-4">
                <FieldGroup className="space-y-4">
                  <Field>
                    <FieldLabel htmlFor="login-phone" className="text-xs font-semibold text-slate-700 dark:text-[var(--shell-muted)]">
                      Mobile number
                    </FieldLabel>
                    <PhoneInput
                      countryIso2={DEFAULT_COUNTRY}
                      value={phoneE164}
                      onChange={(e164) => {
                        setPhoneE164(e164);
                        setOtpError(null);
                      }}
                      placeholder="801 234 5678"
                      disabled={loading}
                      className="bg-slate-50 dark:bg-slate-800/60 border-[var(--shell-border)] dark:border-[var(--shell-border)]"
                    />
                    {fieldErrors.phone_e164 && (
                      <p className="text-xs text-rose-500 mt-1">{fieldErrors.phone_e164[0]}</p>
                    )}
                  </Field>
                  <Button
                    id="login-phone-submit"
                    type="submit"
                    disabled={loading || !phoneE164}
                    className="w-full h-12 rounded-lg bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white text-base font-bold shadow-lg shadow-[#2164b6]/25 transition-all duration-200 active:scale-[0.99]"
                  >
                    {loading ? <><Loader2 weight="fill" className="mr-2 h-5 w-5 animate-spin" /> Sending code…</> : "Continue"}
                  </Button>
                </FieldGroup>
              </form>
            ) : (
              <div className="space-y-4">
                {otpChannel === "in_app_active_device" ? (
                  <div className="p-3.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <Smartphone weight="fill" className="h-5 w-5 text-[var(--shell-accent)] dark:text-[var(--shell-accent)] shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-700 dark:text-[var(--shell-muted)] space-y-1">
                        <p className="font-semibold text-[var(--shell-text)] dark:text-white">
                          Sent to your active signed-in device
                        </p>
                        <p>
                          {deliveryMessage || `We pushed your 6-digit verification code to your open MurihSpace app or browser session for ${maskedPhone}.`}
                        </p>
                      </div>
                    </div>
                    <div className="pt-1.5 border-t border-sky-100 dark:border-sky-900/60 flex items-center justify-between text-xs">
                      <span className="text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">Didn't get the code?</span>
                      <button
                        type="button"
                        onClick={() => handleRequestPhoneOtp({ forceSms: true })}
                        disabled={loading}
                        className="font-bold text-[var(--shell-accent)] dark:text-[var(--shell-accent)] hover:underline cursor-pointer disabled:opacity-50"
                      >
                        Send via SMS instead
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-[var(--shell-accent-solid)]/10 border border-[var(--shell-accent)]/20 flex items-center gap-2.5">
                    <CheckCircle2 weight="fill" className="h-4 w-4 text-[var(--shell-accent)] dark:text-[var(--shell-accent)] shrink-0" />
                    <p className="text-xs font-medium text-slate-700 dark:text-[var(--shell-muted)]">
                      We sent a 6-digit code via SMS to <span className="font-bold text-[var(--shell-accent)] dark:text-[var(--shell-accent)]">{maskedPhone}</span>.
                    </p>
                  </div>
                )}

                <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
                  <OtpInput
                    value={code}
                    onChange={(v) => {
                      setCode(v);
                      setOtpError(null);
                    }}
                    disabled={loading}
                  />
                  {(otpError || error) && (
                    <p className="text-xs text-rose-500 text-center font-medium">{otpError || error}</p>
                  )}
                  {noAccount && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center space-y-1.5">
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        No account is linked to this number.
                      </p>
                      <p className="text-xs text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
                        Create one in the MurihSpace mobile app, then sign in here.
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setPhoneStep("phone")}
                      disabled={loading}
                      className="text-sm text-[var(--shell-muted)] dark:text-[var(--shell-muted)]"
                    >
                      <ArrowLeft weight="fill" className="h-4 w-4 mr-1" /> Change number
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setCode("");
                        setOtpError(null);
                        void handleRequestPhoneOtp({ forceSms: otpChannel === "in_app_active_device" });
                      }}
                      disabled={loading || resendIn > 0}
                      className="flex-1 text-sm text-[var(--shell-accent)] dark:text-[var(--shell-accent)]"
                    >
                      <RefreshCw weight="fill" className={cn("h-4 w-4 mr-1", resendIn > 0 && "opacity-50")} />
                      {resendIn > 0 ? `Resend in ${resendIn}s` : (otpChannel === "in_app_active_device" ? "Resend via SMS" : "Resend code")}
                    </Button>
                  </div>
                  <Button
                    id="login-phone-verify"
                    type="submit"
                    disabled={loading || code.length < 6}
                    className="w-full h-12 rounded-lg bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white text-base font-bold shadow-lg shadow-[#2164b6]/25 transition-all duration-200 active:scale-[0.99]"
                  >
                    {loading ? <><Loader2 weight="fill" className="mr-2 h-5 w-5 animate-spin" /> Verifying…</> : "Log in"}
                  </Button>
                </form>
              </div>
            )}
          </>
        )}

        {/* Divider + Social */}
        {socialProviders.length > 0 && (
          <>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--shell-border)] dark:border-[var(--shell-border)]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-900 px-3 text-[var(--shell-muted)] font-semibold tracking-wider">Or</span>
              </div>
            </div>
            <div className="flex gap-2">
              {socialProviders.map((p) => {
                const socialLoadingState = socialLoading === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSocialLogin(p)}
                    disabled={socialLoading !== null}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--shell-border)] dark:border-[var(--shell-border)] bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-[var(--shell-muted)] hover:border-[var(--shell-accent)]/50 transition-all ${
                      socialLoadingState ? "opacity-50" : ""
                    }`}
                  >
                    {socialLoadingState ? <Loader2 weight="fill" className="h-4 w-4 animate-spin" /> : (
                      <span className="font-bold text-base">{p === "google" ? "G" : "A"}</span>
                    )}
                    <span className="hidden sm:inline capitalize">{p}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Registration is mobile-only; point users at the app. */}
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-[var(--shell-border)] dark:border-[var(--shell-border)] bg-slate-50 dark:bg-slate-800/40 px-4 py-3 text-center">
            <p className="text-xs text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
              New to MurihSpace?{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">Create an account in the mobile app.</span>
            </p>
          </div>
        </div>

        {/* Brand Watermark Footer */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-[var(--shell-border)] flex items-center justify-center gap-2 text-xs text-[var(--shell-muted)]">
          <span>Powered by</span>
          <img src="/logos/member-logo-light.png" alt="MurihSpace" className="h-4.5 w-auto object-contain dark:hidden" />
          <img src="/logos/member-logo-dark.png" alt="MurihSpace" className="h-4.5 w-auto object-contain hidden dark:block" />
        </div>
      </div>
    </AuthLayout>
  );
}
