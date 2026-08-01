import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { apiClient } from "@/lib/api/client";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertCircle, Eye, EyeOff } from "lucide-react";

export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const emailFromUrl = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reset, setReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      await apiClient.post("/auth/reset-password", {
        token,
        email,
        password,
        password_confirmation: confirmPassword,
      });
      setReset(true);
    } catch (err: unknown) {
      const apiErr = err as { message?: string; errors?: Record<string, string[]> };
      setError(apiErr.message || "Failed to reset password. The link may have expired.");
      setFieldErrors(apiErr.errors || {});
    } finally {
      setLoading(false);
    }
  };

  const strengthColor = (pw: string) => {
    if (!pw) return "";
    const score = [pw.length >= 8, /[A-Z]/.test(pw), /[a-z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
    if (score <= 2) return "bg-red-500";
    if (score <= 3) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <AuthLayout
      headlineText="Set a new"
      accentText="password."
      subText="Choose a strong password that you haven't used before."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 text-left">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Reset password
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {reset ? "Your password has been reset." : "Enter your new password below."}
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs sm:text-sm text-rose-500 text-center font-medium">
            <AlertCircle className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
            {error}
          </div>
        )}

        {reset ? (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-6 text-center space-y-4">
            <Check className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              Password reset successful!
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full h-12 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white text-base font-bold shadow-lg shadow-[#2164b6]/25 transition-all duration-200"
            >
              Log in with new password
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FieldGroup className="space-y-4">
              <Field>
                <FieldLabel htmlFor="reset-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Email address
                </FieldLabel>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || !!emailFromUrl}
                  className="h-12 px-4 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/20"
                />
                {fieldErrors.email && (
                  <p className="text-xs text-rose-500 mt-1">{fieldErrors.email[0]}</p>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="reset-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  New password
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="reset-password"
                    type={showPasswords ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="h-12 px-4 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/20 pr-10"
                  />
                </div>
                {password && (
                  <div className="mt-1.5 space-y-1">
                    <div className="h-1 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${strengthColor(password)}`}
                        style={{ width: `${([password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length / 5) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {["Weak", "Moderate", "Strong"][Math.min(2, Math.floor(([password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length - 1) / 1.5))]}
                    </p>
                  </div>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="reset-confirm" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Confirm new password
                </FieldLabel>
                <Input
                  id="reset-confirm"
                  type={showPasswords ? "text" : "password"}
                  placeholder="Repeat new password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="h-12 px-4 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/20"
                />
              </Field>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={() => setShowPasswords(!showPasswords)}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  {showPasswords ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  Show passwords
                </span>
              </label>

              <Field className="pt-2">
                <Button
                  type="submit"
                  disabled={loading || !email || !password || !confirmPassword}
                  className="w-full h-12 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white text-base font-bold shadow-lg shadow-[#2164b6]/25 transition-all duration-200 active:scale-[0.99]"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Resetting…</>
                  ) : (
                    "Reset password"
                  )}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        )}

        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2164b6] hover:underline underline-offset-4"
          >
            Back to login
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
