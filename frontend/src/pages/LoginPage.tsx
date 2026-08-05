import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/forms/PhoneInput";
import { OtpInput } from "@/components/forms/OtpInput";
import { Loader2, ShieldAlert, ArrowLeft, RefreshCw, CheckCircle2, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthLayout } from "@/components/layout/AuthLayout";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";
const DEFAULT_COUNTRY = "NG";

type Tab = "phone" | "email";

export function LoginPage() {
  const { login, requestOtp, verifyOtp, logout, loading, error, fieldErrors } = useAuth();
  const cfg = usePlatformConfig();
  const navigate = useNavigate();

  const methods = cfg.auth_methods.methods;
  const phoneLoginEnabled = methods.phone_otp.login;
  const emailLoginEnabled = methods.email_password.login;
  const socialProviders = (["google", "apple"] as const).filter((p) => methods[p].login);

  const [tab, setTab] = useState<Tab>(phoneLoginEnabled ? "phone" : "email");

  // Re-sync selected tab when platform config loads
  useEffect(() => {
    if (cfg.loading) return;
    if (tab === "phone" && !phoneLoginEnabled && emailLoginEnabled) setTab("email");
    if (tab === "email" && !emailLoginEnabled && phoneLoginEnabled) setTab("phone");
  }, [cfg.loading, phoneLoginEnabled, emailLoginEnabled, tab]);

  // Phone OTP flow
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">("phone");
  const [phoneE164, setPhoneE164] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Email flow
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [adminBlocked, setAdminBlocked] = useState(false);
  const [memberBlocked, setMemberBlocked] = useState(false);

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

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

  const handleRequestPhoneOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setOtpError(null);
    setNoAccount(false);
    if (!phoneE164) return;
    const result = await requestOtp({ intent: "login", phoneE164 });
    if (!result) return;
    setMaskedPhone(result.masked_phone);
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
    navigate("/app");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminBlocked(false);
    const user = await login(email, password);
    if (user) {
      if (user.role === "admin") {
        await logout();
        setAdminBlocked(true);
      } else if (user.role === "member") {
        await logout();
        setMemberBlocked(true);
      } else {
        navigate("/app");
      }
    }
  };

  const handleSocialLogin = async (provider: string) => {
    setSocialLoading(provider);
    setSocialError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/social/${provider}/redirect`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      if (d?.redirect_url) {
        window.location.assign(d.redirect_url);
        return;
      }
      throw new Error("Missing redirect_url");
    } catch {
      setSocialError(`Could not start ${provider} sign-in. Please try again.`);
    }
    setSocialLoading(null);
  };

  const goToRegister = () => {
    navigate("/register", { state: phoneE164 ? { phoneE164, countryIso2: DEFAULT_COUNTRY } : undefined });
  };

  const resend = () => {
    setCode("");
    setOtpError(null);
    void handleRequestPhoneOtp();
  };

  return (
    <AuthLayout
      headlineText="Better connection"
      accentText="with safety."
      subText="Connect with communities, sell digital & physical products, host live audio rooms, and grow your audience."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 text-left">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Log in to MurihSpace
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {tab === "phone" ? "We'll text you a code to verify it's you." : "Enter your credentials to access your account."}
          </p>
        </div>

        {adminBlocked && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
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
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-6 text-center shadow-sm">
            <div className="flex items-center justify-center mb-3">
              <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-full text-blue-600 dark:text-blue-400">
                <Smartphone className="h-6 w-6" />
              </div>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Download the App</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
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
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs sm:text-sm text-rose-500 text-center font-medium">
            {socialError}
          </div>
        )}

        {/* Method tabs */}
        {(phoneLoginEnabled && emailLoginEnabled) && (
          <div className="flex rounded-xl border border-border bg-muted/30 p-1">
            {phoneLoginEnabled && (
              <button
                type="button"
                onClick={() => setTab("phone")}
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-bold transition-colors",
                  tab === "phone" ? "bg-[#2164b6] text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-foreground"
                )}
              >
                Phone
              </button>
            )}
            {emailLoginEnabled && (
              <button
                type="button"
                onClick={() => setTab("email")}
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-bold transition-colors",
                  tab === "email" ? "bg-[#2164b6] text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-foreground"
                )}
              >
                Email & password
              </button>
            )}
          </div>
        )}

        {/* Phone OTP flow */}
        {tab === "phone" && (
          <>
            {phoneStep === "phone" ? (
              <form onSubmit={handleRequestPhoneOtp} className="space-y-4">
                <FieldGroup className="space-y-4">
                  <Field>
                    <FieldLabel htmlFor="login-phone" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                      className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800"
                    />
                    {fieldErrors.phone_e164 && (
                      <p className="text-xs text-rose-500 mt-1">{fieldErrors.phone_e164[0]}</p>
                    )}
                  </Field>
                  <Button
                    id="login-phone-submit"
                    type="submit"
                    disabled={loading || !phoneE164}
                    className="w-full h-12 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white text-base font-bold shadow-lg shadow-[#2164b6]/25 transition-all duration-200 active:scale-[0.99]"
                  >
                    {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sending code…</> : "Continue"}
                  </Button>
                </FieldGroup>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-[#2164b6]/10 border border-[#2164b6]/20 flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#2164b6] shrink-0" />
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    We sent a 6-digit code to <span className="font-bold text-[#2164b6]">{maskedPhone}</span>.
                  </p>
                </div>

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
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-2">
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        No account is linked to this number.
                      </p>
                      <Button
                        type="button"
                        onClick={goToRegister}
                        className="w-full h-10 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white text-sm font-bold"
                      >
                        Create an account with this number
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setPhoneStep("phone")}
                      disabled={loading}
                      className="text-sm text-slate-600 dark:text-slate-400"
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" /> Change number
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={resend}
                      disabled={loading || resendIn > 0}
                      className="flex-1 text-sm text-[#2164b6]"
                    >
                      <RefreshCw className={cn("h-4 w-4 mr-1", resendIn > 0 && "opacity-50")} />
                      {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                    </Button>
                  </div>
                  <Button
                    id="login-phone-verify"
                    type="submit"
                    disabled={loading || code.length < 6}
                    className="w-full h-12 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white text-base font-bold shadow-lg shadow-[#2164b6]/25 transition-all duration-200 active:scale-[0.99]"
                  >
                    {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verifying…</> : "Log in"}
                  </Button>
                </form>
              </div>
            )}
          </>
        )}

        {/* Email flow */}
        {tab === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <FieldGroup className="space-y-4">
              <Field>
                <FieldLabel htmlFor="login-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Email address
                </FieldLabel>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  disabled={loading}
                  className={cn(
                    "h-12 px-4 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/20",
                    fieldErrors.email && "border-rose-500 focus-visible:ring-rose-500"
                  )}
                />
                {fieldErrors.email && <p className="text-xs text-rose-500 mt-1">{fieldErrors.email[0]}</p>}
              </Field>

              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="login-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Password
                  </FieldLabel>
                  <Link to="/forgot-password" className="text-xs font-medium text-[#2164b6] hover:underline underline-offset-4">
                    Forgotten password?
                  </Link>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  disabled={loading}
                  className={cn(
                    "h-12 px-4 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/20",
                    fieldErrors.password && "border-rose-500 focus-visible:ring-rose-500"
                  )}
                />
                {fieldErrors.password && <p className="text-xs text-rose-500 mt-1">{fieldErrors.password[0]}</p>}
              </Field>

              {!adminBlocked && error && (
                <div id="login-error" className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs sm:text-sm text-rose-500 text-center font-medium">
                  {error}
                </div>
              )}

              <Field className="pt-2">
                <Button
                  id="login-submit"
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full h-12 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white text-base font-bold shadow-lg shadow-[#2164b6]/25 transition-all duration-200 active:scale-[0.99]"
                >
                  {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Logging in…</> : "Log in"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        )}

        {/* Divider + Social */}
        {socialProviders.length > 0 && (
          <>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 font-semibold tracking-wider">Or</span>
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
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-[#2164b6]/50 transition-all ${
                      socialLoadingState ? "opacity-50" : ""
                    }`}
                  >
                    {socialLoadingState ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <span className="font-bold text-base">{p === "google" ? "G" : "A"}</span>
                    )}
                    <span className="hidden sm:inline capitalize">{p}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Create account */}
        <div className="flex flex-col gap-3">
          <Link
            to="/register"
            id="login-create-account-btn"
            className="w-full h-12 rounded-xl border-2 border-[#2164b6] text-[#2164b6] hover:bg-[#2164b6]/10 font-bold text-sm sm:text-base flex items-center justify-center transition-all duration-200 active:scale-[0.99]"
          >
            Create new account
          </Link>
        </div>

        {/* Brand Watermark Footer */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-400">
          <span>Powered by</span>
          <img src="/logos/member-logo-light.png" alt="MurihSpace" className="h-4.5 w-auto object-contain dark:hidden" />
          <img src="/logos/member-logo-dark.png" alt="MurihSpace" className="h-4.5 w-auto object-contain hidden dark:block" />
        </div>
      </div>
    </AuthLayout>
  );
}
