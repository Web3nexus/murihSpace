import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4 | 5;

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, loading, error, fieldErrors } = useAuth();

  // Wizard step state (1 to 5)
  const [step, setStep] = useState<Step>(1);

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  
  const [country, setCountry] = useState("United Kingdom");
  const [county, setCounty] = useState("");
  const [state, setState] = useState("");
  
  const [role, setRole] = useState<"member" | "creator" | "vendor">("member");
  const [kycDocument, setKycDocument] = useState("");

  // Navigation validation handlers
  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !passwordConfirmation) return;
    if (password.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }
    if (password !== passwordConfirmation) {
      alert("Passwords do not match");
      return;
    }
    setStep(3);
  };

  const handleNextStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username) return;
    setStep(4);
  };

  const handleNextStep4 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!country) return;
    setStep(5);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await register({
      name,
      email,
      username,
      role,
      password,
      passwordConfirmation,
      country,
      mobileNumber,
      county,
      state,
      kycDocument: role !== "member" ? kycDocument : undefined,
    });
    if (success) {
      navigate("/app");
    }
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        {/* Brand Header */}
        <Link to="/" className="flex items-center gap-2 self-center font-medium">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            M
          </div>
          MurihSpace
        </Link>

        {/* Wizard Container */}
          <div className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-5">
          
          {/* Pro Segmented Progress Bar Indicators at the top */}
          <div className="grid grid-cols-5 gap-1.5 px-1 mb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  step >= i ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {step === 1 && "Enter your email"}
              {step === 2 && "Choose a password"}
              {step === 3 && "Tell us about yourself"}
              {step === 4 && "Enter your location"}
              {step === 5 && "Select account type"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {step === 1 && "Enter your email to start creating your account."}
              {step === 2 && "Ensure your password is secure and easy to remember."}
              {step === 3 && "Set up your name, username and contact number."}
              {step === 4 && "Your country, county and region details."}
              {step === 5 && "Select your account role — verification only applies to creators and vendors."}
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive text-center" id="register-wizard-error">
              {error}
            </div>
          )}

          {/* STEP 1: EMAIL ONLY */}
          {step === 1 && (
            <form onSubmit={handleNextStep1}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="reg-email">Email Address</FieldLabel>
                  <Input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className={cn(fieldErrors.email && "border-destructive")}
                  />
                  {fieldErrors.email && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.email[0]}</p>
                  )}
                </Field>
                <Field>
                  <Button type="submit" className="w-full gap-2" disabled={!email || !email.includes("@")}>
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          )}

          {/* STEP 2: PASSWORD */}
          {step === 2 && (
            <form onSubmit={handleNextStep2}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="reg-password">Password</FieldLabel>
                  <Input
                    id="reg-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={cn(fieldErrors.password && "border-destructive")}
                  />
                  {fieldErrors.password && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.password[0]}</p>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="reg-confirm">Confirm Password</FieldLabel>
                  <Input
                    id="reg-confirm"
                    type="password"
                    required
                    value={passwordConfirmation}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordConfirmation(e.target.value)}
                    placeholder="••••••••"
                  />
                </Field>
                <div className="flex gap-4">
                  <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button type="submit" className="flex-1 gap-2" disabled={!password || !passwordConfirmation}>
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </FieldGroup>
            </form>
          )}

          {/* STEP 3: NAME, USERNAME, MOBILE */}
          {step === 3 && (
            <form onSubmit={handleNextStep3}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="reg-name">Full Name</FieldLabel>
                  <Input
                    id="reg-name"
                    required
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    placeholder="Vincent Paul"
                    className={cn(fieldErrors.name && "border-destructive")}
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.name[0]}</p>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="reg-username">Username</FieldLabel>
                  <Input
                    id="reg-username"
                    required
                    value={username}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                    placeholder="vincentpaul"
                    className={cn(fieldErrors.username && "border-destructive")}
                  />
                  {fieldErrors.username && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.username[0]}</p>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="reg-mobile">Mobile Number</FieldLabel>
                  <Input
                    id="reg-mobile"
                    type="tel"
                    value={mobileNumber}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMobileNumber(e.target.value)}
                    placeholder="+44 7911 123456"
                  />
                </Field>
                <div className="flex gap-4">
                  <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => setStep(2)}>
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button type="submit" className="flex-1 gap-2" disabled={!name || !username}>
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </FieldGroup>
            </form>
          )}

          {/* STEP 4: LOCATION */}
          {step === 4 && (
            <form onSubmit={handleNextStep4}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="reg-country">Country</FieldLabel>
                  <Input
                    id="reg-country"
                    required
                    value={country}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)}
                    placeholder="United Kingdom"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="reg-county">County</FieldLabel>
                    <Input
                      id="reg-county"
                      value={county}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCounty(e.target.value)}
                      placeholder="Greater London"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="reg-state">State / Region</FieldLabel>
                    <Input
                      id="reg-state"
                      value={state}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setState(e.target.value)}
                      placeholder="England"
                    />
                  </Field>
                </div>
                <div className="flex gap-4">
                  <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => setStep(3)}>
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button type="submit" className="flex-1 gap-2" disabled={!country}>
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </FieldGroup>
            </form>
          )}

          {/* STEP 5: ROLE & KYC */}
          {step === 5 && (
            <form onSubmit={handleRegister}>
              <FieldGroup>
                <div className="space-y-3">
                  <span className="block text-sm font-medium text-foreground">Select Account Role</span>
                  
                  {/* Premium cards for selecting user role */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole("member")}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 border rounded-lg text-center transition-all",
                        role === "member" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted"
                      )}
                    >
                      <span className="font-semibold text-xs text-foreground block">User</span>
                      <span className="text-[10px] text-muted-foreground mt-1">General</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole("creator")}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 border rounded-lg text-center transition-all",
                        role === "creator" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted"
                      )}
                    >
                      <span className="font-semibold text-xs text-foreground block">Creator</span>
                      <span className="text-[10px] text-muted-foreground mt-1">Publish Art</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole("vendor")}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 border rounded-lg text-center transition-all",
                        role === "vendor" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted"
                      )}
                    >
                      <span className="font-semibold text-xs text-foreground block">Vendor</span>
                      <span className="text-[10px] text-muted-foreground mt-1">Sell Prints</span>
                    </button>
                  </div>
                </div>

                {/* Conditional Verification for Creators and Vendors */}
                {role !== "member" && (
                  <div className="mt-4 p-4 rounded-lg border border-amber-500/25 bg-amber-500/5 space-y-3">
                    <span className="block text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Identity Verification (KYC) Required
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      To list products or artwork for sale, please provide your Passport or national ID card number.
                    </p>
                    <Field>
                      <FieldLabel htmlFor="reg-kyc" className="text-xs">ID / Passport Number</FieldLabel>
                      <Input
                        id="reg-kyc"
                        required
                        value={kycDocument}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKycDocument(e.target.value)}
                        placeholder="Passport or ID Reference"
                        className="text-xs h-8"
                      />
                    </Field>
                  </div>
                )}

                {role === "member" && (
                  <div className="mt-4 p-4 rounded-lg border border-border bg-muted/40 text-center text-xs text-muted-foreground leading-relaxed">
                    No verification is needed to browse the site. You can transition to a Creator/Vendor profile at any time in your Settings.
                  </div>
                )}

                <div className="flex gap-4 mt-6">
                  <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => setStep(4)} disabled={loading}>
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 gap-2"
                    disabled={loading || (role !== "member" && !kycDocument)}
                    id="register-submit-btn"
                  >
                    {loading ? (
                      <><Loader2 className="h-4.5 w-4.5 animate-spin" /> Completing...</>
                    ) : "Complete"}
                  </Button>
                </div>
              </FieldGroup>
            </form>
          )}

          <p className="text-center text-xs text-muted-foreground mt-2">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
