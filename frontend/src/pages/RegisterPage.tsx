import { authFetch } from "@/lib/api/authFetch";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, XCircle, BadgeCheck, Crown, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { PASSWORD_RULES, validatePassword } from "@/lib/auth/passwordRules";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { PhoneInput } from "@/components/forms/PhoneInput";
import { OtpInput } from "@/components/forms/OtpInput";
import { InlineFieldError } from "@/components/ui/InlineFieldError";
import { toast } from "sonner";



type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const SOCIAL_PROVIDERS = [
  { id: "google", label: "Google", icon: "G" },
  { id: "apple", label: "Apple", icon: "A" },
];

interface LocationState {
  phoneE164?: string;
  countryIso2?: string;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialState = (location.state ?? {}) as LocationState;
  const { register, requestOtp, verifyOtp, loading, error } = useAuth();
  const cfg = usePlatformConfig();

  const [step, setStep] = useState<Step>(1);

  // Step 1-2: Phone + OTP
  const countryIso2 = initialState.countryIso2 || "NG";
  const [phoneE164, setPhoneE164] = useState(initialState.phoneE164 || "");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [registrationSessionId, setRegistrationSessionId] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3: Username
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameCheckError, setUsernameCheckError] = useState(false);

  // Step 4: Name
  const [name, setName] = useState("");

  // Step 5: Password
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [passwordFieldError, setPasswordFieldError] = useState("");
  const [passwordConfirmError, setPasswordConfirmError] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);

  // Step 6: Role
  const [_role, _setRole] = useState<"member" | "creator" | "vendor">("member");

  // Social
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const checkSeqRef = useRef(0);

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

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    if (!phoneE164) return;
    const result = await requestOtp({ intent: "register", phoneE164 });
    if (!result) return;
    setMaskedPhone(result.masked_phone);
    setCode("");
    setStep(2);
    startResendCooldown(result.resend_after_seconds ?? 60);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    if (code.length < 6) return;
    const result = await verifyOtp({ intent: "register", phoneE164, code });
    if (!result) return;
    if (!result.registration_session_id) {
      setOtpError("Unable to continue registration. Please try again.");
      return;
    }
    setRegistrationSessionId(result.registration_session_id);
    setVerifiedPhone(result.phone_e164 || phoneE164);
    setStep(3);
    toast.success("Phone number verified!");
  };

  const resend = async () => {
    setCode("");
    setOtpError(null);
    if (!phoneE164) {
      setStep(1);
      return;
    }
    const result = await requestOtp({ intent: "register", phoneE164 });
    if (!result) return;
    setMaskedPhone(result.masked_phone);
    startResendCooldown(result.resend_after_seconds ?? 60);
  };

  // Debounced username availability check
  const checkUsername = useCallback(async (val: string) => {
    if (val.length < 3 || !/^[a-zA-Z0-9_]+$/.test(val)) {
      setUsernameAvailable(null);
      return;
    }
    const seq = ++checkSeqRef.current;
    setUsernameChecking(true);
    setUsernameCheckError(false);
    try {
      const res = await authFetch(`/auth/check-username/${encodeURIComponent(val)}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      if (seq !== checkSeqRef.current) return;
      setUsernameAvailable(d?.available ?? false);
    } catch {
      if (seq === checkSeqRef.current) {
        setUsernameAvailable(null);
        setUsernameCheckError(true);
      }
    } finally {
      if (seq === checkSeqRef.current) setUsernameChecking(false);
    }
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleUsernameChange = (val: string) => {
    setUsername(val);
    setUsernameCheckError(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => checkUsername(val), 400);
  };

  const handleNextUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameAvailable) return;
    setStep(4);
  };

  const handleNextName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setStep(5);
  };

  const handleNextPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFieldError("");
    setPasswordConfirmError("");
    if (!password || !passwordConfirmation) return;
    
    const isValid = validatePassword(password);

    if (!isValid) {
      setPasswordFieldError("Please ensure your password meets all requirements");
      passwordRef.current?.focus();
      return;
    }
    
    if (password !== passwordConfirmation) {
      setPasswordConfirmError("Passwords do not match");
      passwordConfirmRef.current?.focus();
      return;
    }
    await handleRegister();
  };

  const handleRegister = async () => {
    const success = await register({
      name, email: "", username, role: "member", password, passwordConfirmation,
      registrationSessionId,
    });
    if (success) {
      navigate("/app/onboarding", { replace: true });
    }
  };

  const handleSocialLogin = async (provider: string) => {
    setSocialLoading(provider);
    try {
      const res = await authFetch(`/auth/social/${provider}/redirect`, { headers: { Accept: "application/json" } });
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      if (d?.redirect_url) {
        window.location.assign(d.redirect_url);
        return;
      }
      if (d?.manual_register) {
        toast.error(`${provider} login is not configured yet. Please register with email.`);
      }
    } catch {
      toast.error(`Failed to initiate ${provider} login.`);
    }
    setSocialLoading(null);
  };

  const socialBtnClass = (prov: string) =>
    `flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${
      socialLoading === prov ? "opacity-50" : "hover:border-[#2164b6]/50 hover:bg-muted/50"
    } border-border bg-card text-foreground`;

  const title =
    step === 1 ? "Verify your number"
    : step === 2 ? "Enter the code"
    : step === 3 ? "Claim your space"
    : step === 7 ? "Welcome aboard"
    : "Create your account";

  const subtitle =
    step === 1 ? "We'll text you a code to verify your number."
    : step === 2 ? `We sent a 6-digit code to ${maskedPhone}.`
    : step === 3 ? "Choose your unique username to get started."
    : step === 7 ? "One last step — grab the app to unlock your dashboard."
    : "Fill in your details to complete registration.";

  return (
    <AuthLayout>
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="text-xl font-black tracking-tight">{title}</h1>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className={`h-1.5 w-7 rounded-full transition-colors ${s <= step ? "bg-[#2164b6]" : "bg-muted"}`} />
          ))}
        </div>

        {/* Step 1: Phone */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <FieldGroup>
              <FieldLabel>Mobile number</FieldLabel>
              <Field>
                <PhoneInput
                  countryIso2={countryIso2}
                  value={phoneE164}
                  onChange={(e164) => {
                    setPhoneE164(e164);
                    setOtpError(null);
                  }}
                  placeholder="801 234 5678"
                />
              </Field>
            </FieldGroup>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              By continuing you agree to receive an SMS verification code. Standard message and data rates may apply.
            </p>
            {otpError && <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs font-bold text-destructive">{otpError}</div>}
            {error && !otpError && <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs font-bold text-destructive">{error}</div>}
            <Button type="submit" disabled={loading || !phoneE164} className="w-full text-sm font-bold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send verification code <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <p className="text-center text-[10px] text-muted-foreground">
              Already have an account? <Link to="/login" className="text-[#2164b6] dark:text-[#7ab0ff] font-bold hover:underline">Sign in</Link>
            </p>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-3 rounded-xl bg-[#2164b6]/10 border border-[#2164b6]/20 flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff] shrink-0" />
              <p className="text-xs font-medium text-[#2164b6] dark:text-[#7ab0ff]">Code sent to <span className="font-bold">{maskedPhone}</span></p>
            </div>
            <OtpInput value={code} onChange={(v) => { setCode(v); setOtpError(null); }} />
            {(otpError || error) && (
              <p className="text-xs text-destructive text-center font-medium">{otpError || error}</p>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={loading} className="text-sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Change number
              </Button>
              <Button type="button" variant="ghost" onClick={resend} disabled={loading || resendIn > 0} className="flex-1 text-sm text-[#2164b6] dark:text-[#7ab0ff]">
                <ArrowRight className="h-4 w-4 mr-1" />
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </Button>
            </div>
            <Button type="submit" disabled={loading || code.length < 6} className="w-full text-sm font-bold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Verify number
            </Button>
          </form>
        )}

        {/* Step 3: Username */}
        {step === 3 && (
          <form onSubmit={handleNextUsername} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="reg-username" className="text-xs font-bold text-muted-foreground">Choose your username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">@</span>
                <input
                  id="reg-username"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="username"
                  className="w-full rounded-xl border border-border bg-card pl-8 pr-10 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#2164b6]/50"
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
              {username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username) && usernameAvailable === null && !usernameChecking && !usernameCheckError && <p className="text-[10px] text-muted-foreground">Checking availability...</p>}
              {usernameCheckError && (
                <p className="text-[10px] text-destructive font-medium">Couldn't check availability. Please try again.</p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
              <Crown className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-500">Your link: <span className="font-mono">murihspace.com/@{username || "username"}</span></p>
                <p className="text-[10px] text-emerald-500/70 mt-0.5">Usernames are free — yours to keep.</p>
              </div>
            </div>

            <Button type="submit" disabled={!usernameAvailable || usernameChecking} className="w-full text-sm font-bold">
              Claim Username <ArrowRight className="h-4 w-4 ml-1" />
            </Button>

            {SOCIAL_PROVIDERS.filter((p) => cfg.auth_methods?.methods?.[p.id as "google" | "apple"]?.registration).length > 0 && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center"><span className="bg-card px-2 text-[10px] text-muted-foreground">or sign up with</span></div>
                </div>
                <div className="flex gap-2">
                  {SOCIAL_PROVIDERS.filter(
                    (p) => cfg.auth_methods.methods[p.id as "google" | "apple"].registration
                  ).map((p) => (
                    <button key={p.id} type="button" onClick={() => handleSocialLogin(p.id)} disabled={socialLoading !== null} className={socialBtnClass(p.id)}>
                      {socialLoading === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="font-bold text-base">{p.icon}</span>}
                      <span className="hidden sm:inline">{p.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(2)} className="text-sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
            </div>
          </form>
        )}

        {/* Step 4: Name */}
        {step === 4 && (
          <form onSubmit={handleNextName} className="space-y-4">
            <div className="p-3 rounded-xl bg-[#2164b6]/10 border border-[#2164b6]/20 flex items-center gap-2.5">
              <BadgeCheck className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff] shrink-0" />
              <p className="text-xs font-medium text-[#2164b6] dark:text-[#7ab0ff]"><span className="font-bold">{verifiedPhone}</span> verified <span className="font-bold">✓</span></p>
            </div>
            <FieldGroup>
              <FieldLabel>Full name</FieldLabel>
              <Field>
                <Input placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} required />
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

        {/* Step 5: Password */}
        {step === 5 && (
          <form onSubmit={handleNextPassword} className="space-y-4">
            <FieldGroup>
              <FieldLabel>Password</FieldLabel>
              <Field>
                <div className="relative">
                  <Input
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordFieldError(""); }}
                    aria-invalid={Boolean(passwordFieldError)}
                    aria-describedby={passwordFieldError ? "password-field-error" : undefined}
                    className={passwordFieldError ? "border-rose-500 focus-visible:ring-rose-500" : "focus-visible:border-[#2164b6] focus-visible:ring-[#2164b6]"}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="mt-3 space-y-1.5 p-3 rounded-xl bg-muted/50 border border-border/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Password Requirements</p>
                  {PASSWORD_RULES.map((rule, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs font-medium">
                      {rule.check(password) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                      <span className={rule.check(password) ? "text-foreground" : "text-muted-foreground"}>{rule.label}</span>
                    </div>
                  ))}
                </div>
                <InlineFieldError id="password-field-error" error={passwordFieldError} />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>Confirm password</FieldLabel>
              <Field>
                <div className="relative">
                  <Input
                    ref={passwordConfirmRef}
                    type={showPasswordConfirm ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={passwordConfirmation}
                    onChange={(e) => { setPasswordConfirmation(e.target.value); setPasswordConfirmError(""); }}
                    aria-invalid={Boolean(passwordConfirmError)}
                    aria-describedby={passwordConfirmError ? "password-confirm-error" : undefined}
                    className={passwordConfirmError ? "border-rose-500 focus-visible:ring-rose-500" : "focus-visible:border-[#2164b6] focus-visible:ring-[#2164b6]"}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                  >
                    {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                {passwordConfirmation && (
                  <div className="flex items-center gap-2 mt-3 pl-1">
                    {password === passwordConfirmation
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span className={`text-[11px] font-medium ${password === passwordConfirmation ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      Passwords match
                    </span>
                  </div>
                )}

                <InlineFieldError id="password-confirm-error" error={passwordConfirmError} />
              </Field>
            </FieldGroup>
            {error && <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs font-bold text-destructive">{error}</div>}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(4)} className="text-sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button type="submit" disabled={loading || !password || !passwordConfirmation} className="flex-1 text-sm font-bold">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Account
              </Button>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
