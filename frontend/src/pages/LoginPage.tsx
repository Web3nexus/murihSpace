import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthLayout } from "@/components/layout/AuthLayout";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, logout, loading, error, fieldErrors } = useAuth();
  const navigate = useNavigate();
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [adminBlocked, setAdminBlocked] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminBlocked(false);
    const user = await login(email, password);
    if (user) {
      if (user.role === "admin") {
        await logout();
        setAdminBlocked(true);
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
      if (d?.redirect_url) { window.location.assign(d.redirect_url); return; }
      throw new Error("Missing redirect_url");
    } catch (e) {
      setSocialError(`Could not start ${provider} sign-in. Please try again.`);
    }
    setSocialLoading(null);
  };

  return (
    <AuthLayout
      headlineText="Explore the things you"
      accentText="love."
      subText="Connect with communities, sell digital & physical products, host live audio rooms, and grow your audience."
    >
      <div className="flex flex-col gap-5">
        {/* Form Title & Subheader */}
        <div className="flex flex-col gap-1 text-left">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Log in to MurihSpace
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Enter your credentials to access your creator account.
          </p>
        </div>

        {/* Admin login blocked banner */}
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

        {/* Social login error banner */}
        {socialError && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs sm:text-sm text-rose-500 text-center font-medium">
            {socialError}
          </div>
        )}

        {/* Server error banner */}
        {!adminBlocked && error && (
          <div
            id="login-error"
            className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs sm:text-sm text-rose-500 text-center font-medium"
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup className="space-y-4">
            <Field>
              <FieldLabel htmlFor="login-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email address or mobile number
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
              {fieldErrors.email && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.email[0]}</p>
              )}
            </Field>

            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="login-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </FieldLabel>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-[#2164b6] hover:underline underline-offset-4"
                >
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
              {fieldErrors.password && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.password[0]}</p>
              )}
            </Field>

            <Field className="pt-2">
              <Button
                id="login-submit"
                type="submit"
                disabled={loading || !email || !password}
                className="w-full h-12 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white text-base font-bold shadow-lg shadow-[#2164b6]/25 transition-all duration-200 active:scale-[0.99]"
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Logging in…</>
                ) : (
                  "Log in"
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>

        {/* Divider (Facebook Style) */}
        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 font-semibold tracking-wider">
              Or
            </span>
          </div>
        </div>

        {/* Social Login Buttons */}
        <div className="flex gap-2">
          {["google", "facebook", "apple"].map((p) => {
            const loading = socialLoading === p;
            return (
              <button key={p} type="button" onClick={() => handleSocialLogin(p)} disabled={socialLoading !== null}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-[#2164b6]/50 transition-all ${
                  loading ? "opacity-50" : ""
                }`}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <span className="font-bold text-base">{p === "google" ? "G" : p === "facebook" ? "f" : "A"}</span>
                )}
                <span className="hidden sm:inline capitalize">{p}</span>
              </button>
            );
          })}
        </div>

        {/* Create New Account Button (Facebook Style) */}
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
          <img src="/logo_blue.png" alt="MurihSpace" className="h-4.5 w-auto object-contain dark:hidden" />
          <img src="/logo_white.png" alt="MurihSpace" className="h-4.5 w-auto object-contain hidden dark:block" />
        </div>
      </div>
    </AuthLayout>
  );
}
