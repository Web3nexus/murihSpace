import React, { useState, useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Loader2, CheckCircle2, AlertCircle, ShieldAlert, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProfilePage() {
  const { profile, loading, updating, error, fieldErrors, updateProfile, submitKyc } = useProfile();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [county, setCounty] = useState("");
  const [state, setState] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  const [kycDocInput, setKycDocInput] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setCountry(profile.country || "");
      setCounty(profile.county || "");
      setState(profile.state || "");
      setMobileNumber(profile.mobile_number || "");
    }
  }, [profile]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    const ok = await updateProfile({
      name,
      username,
      bio,
      country,
      county,
      state,
      mobile_number: mobileNumber,
    });
    if (ok) {
      setSuccessMsg("Profile updated successfully!");
    }
  };

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    if (!kycDocInput) return;
    const ok = await submitKyc(kycDocInput);
    if (ok) {
      setSuccessMsg("Identity verification document submitted!");
      setKycDocInput("");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Public Profile</h2>
        <p className="text-sm text-muted-foreground">
          Manage your account profile details and verification status.
        </p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KYC Status Badge */}
      <div className="rounded-xl border border-border bg-muted/40 p-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Account Role & Verification</span>
          <span className="text-sm font-semibold capitalize text-foreground mt-0.5 block">
            {profile?.role || "Member"} Profile
          </span>
        </div>
        <div className="flex items-center gap-2">
          {profile?.kyc_status === "verified" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Verified
            </span>
          )}
          {profile?.kyc_status === "pending" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pending Review
            </span>
          )}
          {profile?.kyc_status === "rejected" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
              <ShieldAlert className="h-3.5 w-3.5" /> Rejected
            </span>
          )}
        </div>
      </div>

      {profile?.kyc_status === "rejected" && profile.kyc_rejection_reason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive space-y-1">
          <span className="font-semibold block">Rejection Reason:</span>
          <p>{profile.kyc_rejection_reason}</p>
        </div>
      )}

      {/* Main Profile Form */}
      <form onSubmit={handleUpdate} className="space-y-6">
        <FieldGroup>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="profile-name">Full Name</FieldLabel>
              <Input
                id="profile-name"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                className={cn(fieldErrors.name && "border-destructive")}
              />
              {fieldErrors.name && <p className="text-xs text-destructive mt-1">{fieldErrors.name[0]}</p>}
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-username">Username</FieldLabel>
              <Input
                id="profile-username"
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                className={cn(fieldErrors.username && "border-destructive")}
              />
              {fieldErrors.username && <p className="text-xs text-destructive mt-1">{fieldErrors.username[0]}</p>}
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="profile-bio">Bio</FieldLabel>
            <textarea
              id="profile-bio"
              rows={3}
              value={bio}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
              placeholder="Tell the community about yourself or your creative projects..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field>
              <FieldLabel htmlFor="profile-country">Country</FieldLabel>
              <Input
                id="profile-country"
                value={country}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-county">County</FieldLabel>
              <Input
                id="profile-county"
                value={county}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCounty(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-state">State / Region</FieldLabel>
              <Input
                id="profile-state"
                value={state}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setState(e.target.value)}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="profile-mobile">Mobile Number</FieldLabel>
            <Input
              id="profile-mobile"
              value={mobileNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMobileNumber(e.target.value)}
              placeholder="+44 7911 123456"
            />
          </Field>

          <Button type="submit" disabled={updating} id="save-profile-btn">
            {updating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Profile"}
          </Button>
        </FieldGroup>
      </form>

      {/* KYC Resubmission block for Creators / Vendors or Rejected status */}
      {(profile?.role !== "member" || profile?.kyc_status === "rejected") && profile?.kyc_status !== "verified" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Identity Verification (KYC) Submission</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Submit your state ID, passport number, or document reference to verify your account.
            </p>
          </div>

          <form onSubmit={handleKycSubmit} className="flex gap-3 items-end">
            <Field className="flex-1">
              <FieldLabel htmlFor="kyc-doc-input" className="text-xs">Passport / National ID Reference</FieldLabel>
              <Input
                id="kyc-doc-input"
                required
                value={kycDocInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKycDocInput(e.target.value)}
                placeholder="e.g. Passport code or Document Reference"
                className="h-9 text-xs"
              />
            </Field>
            <Button type="submit" size="sm" className="gap-1.5" disabled={updating || !kycDocInput}>
              <Upload className="h-3.5 w-3.5" /> Submit Verification
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
