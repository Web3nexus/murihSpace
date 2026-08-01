import { useState } from "react";
import { Link } from "react-router";
import { apiClient } from "@/lib/api/client";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertCircle, ArrowLeft } from "lucide-react";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiClient.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object"
          ? (err as { message?: string }).message || "Failed to send reset link."
          : "Failed to send reset link.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      headlineText="Reset your"
      accentText="password."
      subText="Enter your email and we'll send you a link to reset your password."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 text-left">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Forgot password
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {sent
              ? "Check your email for the reset link."
              : "Enter your email address to receive a reset link."}
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs sm:text-sm text-rose-500 text-center font-medium">
            <AlertCircle className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
            {error}
          </div>
        )}

        {sent ? (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-6 text-center space-y-3">
            <Check className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              Reset link sent!
            </p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
              If an account with that email exists, you will receive a password reset link shortly.
            </p>
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
                  disabled={loading}
                  className="h-12 px-4 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/20"
                />
              </Field>

              <Field className="pt-2">
                <Button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full h-12 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white text-base font-bold shadow-lg shadow-[#2164b6]/25 transition-all duration-200 active:scale-[0.99]"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sending…</>
                  ) : (
                    "Send reset link"
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
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
