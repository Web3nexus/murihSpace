import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Spinner as Loader2,
  ShieldWarning as ShieldWarning,
  DeviceMobile as DeviceMobile,
  ArrowLeft as ArrowLeft
} from "@phosphor-icons/react";

type Step = "credentials" | "second-factor";

/**
 * Administration sign-in is two steps because the server makes it two steps.
 *
 * A correct password only earns a single-use, five-minute challenge; the
 * administration API refuses any session that has not cleared a second factor,
 * so there is no such thing as signing in here and being handed an ordinary
 * token. Presenting the code screen up front is honest about that, and it avoids
 * the alternative — a successful-looking login that 403s on every screen.
 */
export function AdminLoginPage() {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  const {
    adminLogin,
    adminVerifyTwoFactor,
    loading,
    error,
    fieldErrors,
    user,
    isAuthenticated,
  } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      navigate("/app/securegate", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (step === "second-factor") {
      codeRef.current?.focus();
    }
  }, [step]);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const pending = await adminLogin(email, password);
    if (!pending) return;

    setChallenge(pending.challenge);
    setCode("");
    setStep("second-factor");
  };

  const handleSecondFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;

    const signedIn = await adminVerifyTwoFactor(challenge, code);
    if (!signedIn) return;

    // A non-administrator who somehow reached this endpoint should never be
    // left on a screen that implies they are signed in to Securegate.
    if (signedIn.role !== "admin") {
      navigate("/login", { replace: true });
      return;
    }
    navigate("/app/securegate");
  };

  const backToCredentials = () => {
    // The challenge is single-use and its slot is server-side; dropping it here
    // just means the next attempt starts a fresh one.
    setChallenge(null);
    setCode("");
    setStep("credentials");
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col">
      <header className="w-full px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logos/admin-logo-dark.png" alt="MurihSpace" className="h-7 w-auto object-contain" />
        </Link>
        <Link
          to="/login"
          className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          User login
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
              {step === "credentials" ? (
                <ShieldWarning weight="fill" className="h-7 w-7 text-amber-400" />
              ) : (
                <DeviceMobile weight="fill" className="h-7 w-7 text-amber-400" />
              )}
            </div>
            <h1 className="text-xl font-bold text-white">Securegate</h1>
            <p className="text-sm text-slate-400 mt-1">
              {step === "credentials"
                ? "Platform administration portal"
                : "Second factor required"}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            {error && (
              <div className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400 text-center font-medium">
                {error}
              </div>
            )}

            {step === "credentials" ? (
              <form onSubmit={handleCredentials} className="space-y-4">
                <FieldGroup className="space-y-4">
                  <Field>
                    <FieldLabel htmlFor="admin-email" className="text-xs font-semibold text-slate-300">
                      Admin email
                    </FieldLabel>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@murihspace.com"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="h-11 px-4 rounded-lg text-sm bg-slate-800/60 border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-100 placeholder:text-slate-500"
                    />
                    {fieldErrors.email && (
                      <p className="text-xs text-rose-400 mt-1">{fieldErrors.email[0]}</p>
                    )}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="admin-password" className="text-xs font-semibold text-slate-300">
                      Password
                    </FieldLabel>
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="h-11 px-4 rounded-lg text-sm bg-slate-800/60 border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-100 placeholder:text-slate-500"
                    />
                    {fieldErrors.password && (
                      <p className="text-xs text-rose-400 mt-1">{fieldErrors.password[0]}</p>
                    )}
                  </Field>

                  <Field className="pt-1">
                    <Button
                      type="submit"
                      disabled={loading || !email || !password}
                      className="w-full h-11 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition-all duration-200 active:scale-[0.99] disabled:opacity-50"
                    >
                      {loading ? (
                        <><Loader2 weight="fill" className="mr-2 h-4 w-4 animate-spin" /> Checking…</>
                      ) : (
                        "Continue"
                      )}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            ) : (
              <form onSubmit={handleSecondFactor} className="space-y-4">
                <FieldGroup className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Enter the six-digit code from your authenticator app for{" "}
                    <span className="text-slate-200 font-medium">{email}</span>. You can
                    also use one of your recovery codes.
                  </p>

                  <Field>
                    <FieldLabel htmlFor="admin-2fa" className="text-xs font-semibold text-slate-300">
                      Verification code
                    </FieldLabel>
                    <Input
                      id="admin-2fa"
                      ref={codeRef}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      required
                      maxLength={20}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      disabled={loading}
                      className="h-12 px-4 rounded-lg text-center text-lg font-semibold tracking-[0.3em] bg-slate-800/60 border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-100 placeholder:text-slate-600"
                    />
                    {fieldErrors.code && (
                      <p className="text-xs text-rose-400 mt-1">{fieldErrors.code[0]}</p>
                    )}
                    {fieldErrors.challenge && (
                      <p className="text-xs text-rose-400 mt-1">{fieldErrors.challenge[0]}</p>
                    )}
                  </Field>

                  <Field className="pt-1">
                    <Button
                      type="submit"
                      disabled={loading || code.trim().length < 6}
                      className="w-full h-11 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition-all duration-200 active:scale-[0.99] disabled:opacity-50"
                    >
                      {loading ? (
                        <><Loader2 weight="fill" className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>
                      ) : (
                        "Access Securegate"
                      )}
                    </Button>
                  </Field>

                  <button
                    type="button"
                    onClick={backToCredentials}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Use a different account
                  </button>
                </FieldGroup>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-slate-500 mt-6">
            &copy; {new Date().getFullYear()} MurihSpace Ecosystem
          </p>
        </div>
      </main>
    </div>
  );
}
