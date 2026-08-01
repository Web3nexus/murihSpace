import React, { useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { AppDownloadQR } from "@/components/WebLockedPage";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, XCircle, BadgeCheck, Crown, Clock, Smartphone, Download } from "lucide-react";

import { AuthLayout } from "@/components/layout/AuthLayout";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const SOCIAL_PROVIDERS = [
  { id: "google", label: "Google", icon: "G" },
  { id: "facebook", label: "Facebook", icon: "f" },
  { id: "apple", label: "Apple", icon: "A" },
];

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, loading, error } = useAuth();
  const cfg = usePlatformConfig();

  const [step, setStep] = useState<Step>(1);

  // Step 1: Username
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [trialDays, setTrialDays] = useState(7);

  // Steps 2-5: Wizard fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [name, setName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [country, setCountry] = useState("United Kingdom");
  const [county, setCounty] = useState("");
  const [state, _setState] = useState("");
  const [role, setRole] = useState<"member" | "creator" | "vendor">("member");
  const [kycDocument] = useState("");

  // Social login (step 1 also)
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const checkSeqRef = useRef(0);

  // Debounced username availability check
  const checkUsername = useCallback(async (val: string) => {
    if (val.length < 3 || !/^[a-zA-Z0-9_]+$/.test(val)) {
      setUsernameAvailable(null);
      return;
    }
    const seq = ++checkSeqRef.current;
    setUsernameChecking(true);
    try {
      const res = await fetch(`${API_BASE}/auth/check-username/${encodeURIComponent(val)}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      if (seq !== checkSeqRef.current) return;
      setUsernameAvailable(d?.available ?? false);
      if (d?.trial_days) setTrialDays(d.trial_days);
    } catch {
      if (seq === checkSeqRef.current) setUsernameAvailable(null);
    } finally {
      if (seq === checkSeqRef.current) setUsernameChecking(false);
    }
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleUsernameChange = (val: string) => {
    setUsername(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => checkUsername(val), 400);
  };

  const handleSocialLogin = async (provider: string) => {
    setSocialLoading(provider);
    try {
      const res = await fetch(`${API_BASE}/auth/social/${provider}/redirect`, { headers: { Accept: "application/json" } });
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      if (d?.redirect_url) {
        window.location.assign(d.redirect_url);
        return;
      }
      if (d?.manual_register) {
        alert(`${provider} login is not configured yet. Please register with email.`);
      }
    } catch {
      alert(`Failed to initiate ${provider} login.`);
    }
    setSocialLoading(null);
  };

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameAvailable) return;
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setStep(3);
  };

  const handleNextStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !passwordConfirmation) return;
    if (password.length < 8) { alert("Password must be at least 8 characters"); return; }
    if (password !== passwordConfirmation) { alert("Passwords do not match"); return; }
    setStep(4);
  };

  const handleNextStep4 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setStep(5);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await register({
      name, email, username, role, password, passwordConfirmation,
      country, mobileNumber, county, state, kycDocument,
    });
    if (success) {
      const disabled = cfg.web_disabled_roles.includes(role as "member" | "creator" | "vendor");
      if (disabled) {
        setStep(6);
      } else {
        navigate("/app/onboarding", { replace: true });
      }
    }
  };

  const socialBtnClass = (prov: string) =>
    `flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${
      socialLoading === prov ? "opacity-50" : "hover:border-[#38A8D8]/50 hover:bg-muted/50"
    } border-border bg-card text-foreground`;

  return (
    <AuthLayout>
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="text-xl font-black tracking-tight">
            {step === 1 ? "Claim your space" : step === 6 ? "Welcome aboard" : "Create your account"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {step === 1
              ? "Choose your unique username to get started."
              : step === 6
                ? "One last step — grab the app to unlock your dashboard."
                : "Fill in your details to complete registration."}
          </p>
        </div>

        {/* Step Progress */}
        {step !== 6 && (
        <div className="flex items-center justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className={`h-1.5 w-8 rounded-full transition-colors ${s <= step ? 'bg-[#38A8D8]' : 'bg-muted'}`} />
          ))}
        </div>
        )}

        {step === 1 && (
          <form onSubmit={handleNextStep1} className="space-y-5">
            {/* Username Field */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Choose your username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">@</span>
                <input
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="username"
                  className="w-full rounded-xl border border-border bg-card pl-8 pr-10 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#38A8D8]/50"
                  autoFocus
                />
                {usernameChecking && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                {!usernameChecking && usernameAvailable === true && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />}
                {!usernameChecking && usernameAvailable === false && <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />}
              </div>
              {usernameAvailable === true && <p className="text-[10px] text-emerald-500 font-medium">Username is available!</p>}
              {usernameAvailable === false && <p className="text-[10px] text-destructive font-medium">Username is taken. Try another.</p>}
              {username.length > 0 && username.length < 3 && <p className="text-[10px] text-muted-foreground">Minimum 3 characters.</p>}
              {username.length >= 3 && !/^[a-zA-Z0-9_]+$/.test(username) && (
                <p className="text-[10px] text-destructive font-medium">Only letters, numbers and underscores allowed.</p>
              )}
              {username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username) && usernameAvailable === null && !usernameChecking && <p className="text-[10px] text-muted-foreground">Checking availability...</p>}
            </div>

            {/* Premium badge */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
              <Crown className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-500">Your link: <span className="font-mono">murihspace.com/@{username || 'username'}</span></p>
                <p className="text-[10px] text-amber-500/70 mt-0.5">Free for {trialDays} days trial. Upgrade to Premium to keep it forever.</p>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-500/70">
                  <Clock className="h-3 w-3" /> Trial ends in {trialDays} days
                </div>
              </div>
            </div>

            <Button type="submit" disabled={!usernameAvailable || usernameChecking} className="w-full text-sm font-bold">
              Claim Username <ArrowRight className="h-4 w-4 ml-1" />
            </Button>

            {/* Social signup */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center"><span className="bg-card px-2 text-[10px] text-muted-foreground">or sign up with</span></div>
            </div>
            <div className="flex gap-2">
              {SOCIAL_PROVIDERS.map((p) => (
                <button key={p.id} type="button" onClick={() => handleSocialLogin(p.id)} disabled={socialLoading !== null} className={socialBtnClass(p.id)}>
                  {socialLoading === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="font-bold text-base">{p.icon}</span>}
                  <span className="hidden sm:inline">{p.label}</span>
                </button>
              ))}
            </div>

            <p className="text-center text-[10px] text-muted-foreground">
              Already have an account? <Link to="/login" className="text-[#38A8D8] font-bold hover:underline">Sign in</Link>
            </p>
          </form>
        )}

        {step >= 2 && (
          <>
            {/* Step 2: Email */}
            {step === 2 && (
              <form onSubmit={handleNextStep2} className="space-y-4">
                <div className="p-3 rounded-xl bg-[#38A8D8]/10 border border-[#38A8D8]/20 flex items-center gap-2.5">
                  <BadgeCheck className="h-4 w-4 text-[#38A8D8] shrink-0" />
                  <p className="text-xs font-medium text-[#38A8D8]"><span className="font-bold">@{username}</span> is yours to claim</p>
                </div>
                <FieldGroup>
                  <FieldLabel>Email address</FieldLabel>
                  <Field>
                    <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </Field>
                </FieldGroup>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setStep(1)} className="text-sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
                  <Button type="submit" disabled={!email || !email.includes("@")} className="flex-1 text-sm font-bold">
                    Continue <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </form>
            )}

            {/* Step 3: Password */}
            {step === 3 && (
              <form onSubmit={handleNextStep3} className="space-y-4">
                <FieldGroup>
                  <FieldLabel>Password</FieldLabel>
                  <Field>
                    <Input type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </Field>
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Confirm password</FieldLabel>
                  <Field>
                    <Input type="password" placeholder="Re-enter password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} required />
                  </Field>
                </FieldGroup>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setStep(2)} className="text-sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
                  <Button type="submit" disabled={!password || !passwordConfirmation} className="flex-1 text-sm font-bold">
                    Continue <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </form>
            )}

            {/* Step 4: Name & Phone */}
            {step === 4 && (
              <form onSubmit={handleNextStep4} className="space-y-4">
                <FieldGroup>
                  <FieldLabel>Full name</FieldLabel>
                  <Field>
                    <Input placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </Field>
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Mobile number (optional)</FieldLabel>
                  <Field>
                    <Input type="tel" placeholder="+44..." value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} />
                  </Field>
                </FieldGroup>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setStep(3)} className="text-sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
                  <Button type="submit" disabled={!name} className="flex-1 text-sm font-bold">
                    Continue <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </form>
            )}

            {/* Step 5: Role & Location */}
            {step === 5 && (
              <form onSubmit={handleRegister} className="space-y-4">
                <FieldGroup>
                  <FieldLabel>I want to join as</FieldLabel>
                  <div className="flex gap-2">
                    {(["member", "creator", "vendor"] as const).map((r) => {
                      const locked = cfg.web_disabled_roles.includes(r);
                      return (
                        <button key={r} type="button" onClick={() => setRole(r)}
                          className={`relative flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors border ${
                            role === r ? "border-[#38A8D8] bg-[#38A8D8]/10 text-[#38A8D8]" : "border-border bg-card text-muted-foreground hover:text-foreground"
                          }`}>
                          {r === "member" ? "Member" : r === "creator" ? "Creator" : "Vendor"}
                          {locked && <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[8px] font-black uppercase tracking-wide shadow-sm">App only</span>}
                        </button>
                      );
                    })}
                  </div>
                  {role && cfg.web_disabled_roles.includes(role as "member" | "creator" | "vendor") && (
                    <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
                      <Smartphone className="h-3 w-3" /> The {role} dashboard is app-only — you'll get a QR code to download the app after signing up.
                    </p>
                  )}
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Country</FieldLabel>
                  <Field>
                    <Input value={country} onChange={(e) => setCountry(e.target.value)} />
                  </Field>
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>County / Region (optional)</FieldLabel>
                  <Field>
                    <Input value={county} onChange={(e) => setCounty(e.target.value)} />
                  </Field>
                </FieldGroup>
                {error && <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs font-bold text-destructive">{error}</div>}
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setStep(4)} className="text-sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
                  <Button type="submit" disabled={loading} className="flex-1 text-sm font-bold">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create Account
                  </Button>
                </div>
              </form>
            )}

            {/* Step 6: Registered — role locked to app */}
            {step === 6 && (
              <div className="space-y-5 text-center">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-[#38A8D8]/10 flex items-center justify-center">
                  <Smartphone className="h-7 w-7 text-[#38A8D8]" />
                </div>
                <div className="space-y-1.5">
                  <h1 className="text-lg font-black tracking-tight text-foreground">You're in!</h1>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-bold text-foreground">@{username}</span> is yours.
                    Your {role} dashboard is only available in the MurihSpace app. Scan the QR code to download the app and sign in.
                  </p>
                </div>
                <div className="flex justify-center">
                  <AppDownloadQR content={cfg.app_qr_content} size={192} />
                </div>
                <div className="space-y-2">
                  <a
                    href={cfg.app_download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#38A8D8] hover:bg-[#2e94c0] text-white text-xs font-bold transition-colors shadow-xs"
                  >
                    <Download className="h-4 w-4" /> Download the app
                  </a>
                  <p className="text-[10px] text-muted-foreground">
                    Already have the app? Just sign in with your new account.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/login", { replace: true })}
                    className="text-xs font-bold text-[#38A8D8] hover:underline"
                  >
                    Sign in instead
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AuthLayout>
  );
}
