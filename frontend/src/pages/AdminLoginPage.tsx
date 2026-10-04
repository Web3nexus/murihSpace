import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Spinner as Loader2,
  ShieldWarning as ShieldWarning,
  DeviceMobile as DeviceMobile,
  ShieldCheck as ShieldCheck,
  ArrowLeft as ArrowLeft,
  Copy as Copy,
  Check as Check
} from "@phosphor-icons/react";

type Step = "credentials" | "second-factor" | "enroll-secret" | "enroll-confirm";

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
  const [enrollmentChallenge, setEnrollmentChallenge] = useState<string | null>(null);
  const [enrollSecret, setEnrollSecret] = useState<string | null>(null);
  const [enrollProvisionUrl, setEnrollProvisionUrl] = useState<string | null>(null);
  const [enrollRecoveryCodes, setEnrollRecoveryCodes] = useState<string[]>([]);
  const [qr, setQr] = useState<{ source: string; url: string } | null>(null);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [enrollCode, setEnrollCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const enrollCodeRef = useRef<HTMLInputElement>(null);

  const {
    adminLogin,
    adminVerifyTwoFactor,
    adminStartEnrollment,
    adminConfirmEnrollment,
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
    if (step === "enroll-confirm") {
      enrollCodeRef.current?.focus();
    }
  }, [step]);

  // Render the provisioning URI as a QR code. Drawn locally so the shared
  // secret is never sent to a third-party image or chart service.
  useEffect(() => {
    if (!enrollProvisionUrl) return;
    let cancelled = false;
    QRCode.toDataURL(enrollProvisionUrl, { width: 208, margin: 1 })
      .then((url) => {
        if (!cancelled) setQr({ source: enrollProvisionUrl, url });
      })
      .catch(() => {
        // The manual key below the code is the fallback; no QR is not fatal.
      });
    return () => {
      cancelled = true;
    };
  }, [enrollProvisionUrl]);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const outcome = await adminLogin(email, password);
    if (!outcome) return;

    if (outcome.kind === "enroll") {
      // Password accepted, no factor yet. Offer setup instead of refusing.
      const secret = await adminStartEnrollment(outcome.prompt.enrollmentChallenge);
      // Stay on the credentials screen if the secret could not be issued; the
      // hook has already surfaced why. Advancing anyway would strand the
      // operator on a QR panel with nothing to scan.
      if (!secret) {
        setEnrollmentChallenge(null);
        return;
      }

      setEnrollmentChallenge(outcome.prompt.enrollmentChallenge);
      setEnrollSecret(secret.secret);
      setEnrollProvisionUrl(secret.provisionUrl);
      setEnrollRecoveryCodes(secret.recoveryCodes);
      setEnrollCode("");
      setRecoveryCopied(false);
      setStep("enroll-secret");
      return;
    }

    setChallenge(outcome.challenge);
    setCode("");
    setStep("second-factor");
  };

  const handleEnrollConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollmentChallenge) return;

    const enrolled = await adminConfirmEnrollment(enrollmentChallenge, enrollCode.trim());
    if (!enrolled) return;

    // Start over so the operator signs in through the ordinary path rather
    // than being handed a session from the setup screen.
    setEnrollmentChallenge(null);
    setEnrollSecret(null);
    setEnrollProvisionUrl(null);
    setEnrollRecoveryCodes([]);
    setQr(null);
    setEnrollCode("");
    setStep("credentials");
  };

  const copyRecoveryCodes = async () => {
    try {
      await navigator.clipboard.writeText(enrollRecoveryCodes.join("\n"));
      setRecoveryCopied(true);
    } catch {
      setRecoveryCopied(false);
    }
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
    setEnrollmentChallenge(null);
    setEnrollSecret(null);
    setEnrollProvisionUrl(null);
    setEnrollRecoveryCodes([]);
    setQr(null);
    setEnrollCode("");
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
              ) : step === "second-factor" ? (
                <DeviceMobile weight="fill" className="h-7 w-7 text-amber-400" />
              ) : (
                <ShieldCheck weight="fill" className="h-7 w-7 text-amber-400" />
              )}
            </div>
            <h1 className="text-xl font-bold text-white">Securegate</h1>
            <p className="text-sm text-slate-400 mt-1">
              {step === "credentials"
                ? "Platform administration portal"
                : step === "second-factor"
                  ? "Second factor required"
                  : "Set up two-factor authentication"}
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
            ) : step === "enroll-secret" ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your account has no second factor yet. Scan this with your
                  authenticator app (Google Authenticator, 1Password, Authy),
                  keep the recovery codes below somewhere safe, then continue.
                </p>

                {qr && qr.source === enrollProvisionUrl ? (
                  <div className="flex justify-center py-1">
                    <img
                      src={qr.url}
                      alt="Authenticator setup QR code"
                      className="h-52 w-52 rounded-lg bg-white p-2"
                    />
                  </div>
                ) : (
                  <div className="flex justify-center py-1">
                    <div className="h-52 w-52 rounded-lg border border-slate-700 bg-slate-800/60 flex items-center justify-center text-[10px] text-slate-500">
                      Generating code…
                    </div>
                  </div>
                )}

                {enrollSecret && (
                  <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                      Can&apos;t scan? Enter this key manually
                    </p>
                    <p className="font-mono text-xs text-slate-200 break-all">{enrollSecret}</p>
                  </div>
                )}

                {enrollRecoveryCodes.length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">
                        Recovery codes
                      </p>
                      <button
                        type="button"
                        onClick={copyRecoveryCodes}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-300 hover:text-white transition-colors"
                      >
                        {recoveryCopied ? (
                          <><Check weight="bold" className="h-3 w-3" /> Copied</>
                        ) : (
                          <><Copy weight="fill" className="h-3 w-3" /> Copy</>
                        )}
                      </button>
                    </div>
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-slate-300">
                      {enrollRecoveryCodes.map((rc) => (
                        <li key={rc}>{rc}</li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                      Each code signs you in once if you lose your phone. They are
                      shown once and cannot be retrieved later.
                    </p>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={() => setStep("enroll-confirm")}
                  disabled={!enrollSecret}
                  className="w-full h-11 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition-all duration-200 active:scale-[0.99] disabled:opacity-50"
                >
                  Continue
                </Button>

                <button
                  type="button"
                  onClick={backToCredentials}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Use a different account
                </button>
              </div>
            ) : step === "enroll-confirm" ? (
              <form onSubmit={handleEnrollConfirm} className="space-y-4">
                <FieldGroup className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Enter the six-digit code your authenticator app is showing for{" "}
                    <span className="text-slate-200 font-medium">{email}</span> to
                    finish setup.
                  </p>

                  <Field>
                    <FieldLabel htmlFor="admin-enroll-code" className="text-xs font-semibold text-slate-300">
                      Verification code
                    </FieldLabel>
                    <Input
                      id="admin-enroll-code"
                      ref={enrollCodeRef}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      required
                      maxLength={6}
                      value={enrollCode}
                      onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, ""))}
                      disabled={loading}
                      className="h-12 px-4 rounded-lg text-center text-lg font-semibold tracking-[0.3em] bg-slate-800/60 border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-100 placeholder:text-slate-600"
                    />
                    {fieldErrors.code && (
                      <p className="text-xs text-rose-400 mt-1">{fieldErrors.code[0]}</p>
                    )}
                  </Field>

                  <Field className="pt-1">
                    <Button
                      type="submit"
                      disabled={loading || enrollCode.length < 6}
                      className="w-full h-11 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition-all duration-200 active:scale-[0.99] disabled:opacity-50"
                    >
                      {loading ? (
                        <><Loader2 weight="fill" className="mr-2 h-4 w-4 animate-spin" /> Confirming…</>
                      ) : (
                        "Finish setup"
                      )}
                    </Button>
                  </Field>

                  <button
                    type="button"
                    onClick={() => setStep("enroll-secret")}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to the QR code
                  </button>
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
