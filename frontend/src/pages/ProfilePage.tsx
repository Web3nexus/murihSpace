import React, { useState, useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Loader2, CheckCircle2, AlertCircle, ShieldAlert, Upload, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/components/upload/ImageUploader";

export function ProfilePage() {
  const { profile, loading, updating, error, fieldErrors, updateProfile, submitKyc } = useProfile();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [county, setCounty] = useState("");
  const [state, setState] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [birthday, setBirthday] = useState("");

  const [kycDocInput, setKycDocInput] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [avatar, setAvatar] = useState("");

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(profile.name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setCountry(profile.country || "");
      setCounty(profile.county || "");
      setState(profile.state || "");
      setMobileNumber(profile.mobile_number || profile.phone || "");
      setBirthday(profile.birthday || "");
      setAvatar(profile.avatar || "");
    }
  }, [profile]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    const ok = await updateProfile({
      name,
      username,
      bio,
      avatar: avatar || undefined,
      country,
      county,
      state,
      mobile_number: mobileNumber,
      birthday: birthday || undefined,
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
    <div className="w-full max-w-3xl mx-auto space-y-8">
      {/* ── PROFILE HEADER CARD ── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="h-32 w-full bg-[#1877f2]/15 dark:bg-[#242526] border-b border-border relative overflow-hidden">
          {profile?.banner_url ? (
            <img src={profile.banner_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-[#1877f2]/20 to-transparent" />
          )}
        </div>
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-12 mb-4 gap-4">
            <div className="flex items-end gap-4">
              <div className="w-24 h-24 rounded-full border-4 border-card bg-muted flex items-center justify-center overflow-hidden text-2xl font-black text-foreground shadow-md shrink-0">
                {avatar ? (
                  <img src={avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  (name || "U").charAt(0).toUpperCase()
                )}
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-foreground">{name || "Your Name"}</h2>
                  {(profile?.has_active_verification_badge || profile?.kyc_status === "verified") && (
                    <BadgeCheck className="h-5 w-5 text-[#2164b6] fill-[#2164b6]/10" />
                  )}
                </div>
                <p className="text-xs font-medium text-muted-foreground">@{username || "username"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <span className="px-3 py-1 rounded-full bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-bold capitalize">
                {profile?.role || "Member"} Mode
              </span>
            </div>
          </div>

          {bio && (
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed max-w-xl">
              {bio}
            </p>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-5 gap-2 py-3 px-4 rounded-xl bg-muted/40 border border-border text-center text-xs">
            <div>
              <span className="font-extrabold text-foreground block text-sm">{profile?.posts_count ?? 0}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Posts</span>
            </div>
            <div>
              <span className="font-extrabold text-foreground block text-sm">{profile?.followers_count ?? 0}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Followers</span>
            </div>
            <div>
              <span className="font-extrabold text-foreground block text-sm">{profile?.following_count ?? 0}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Following</span>
            </div>
            <div>
              <span className="font-extrabold text-foreground block text-sm">{profile?.communities_count ?? 0}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Communities</span>
            </div>
            <div>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block text-sm">{profile?.coins ?? 0}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Coins</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold tracking-tight">Profile Details & Settings</h2>
        <p className="text-xs text-muted-foreground">
          Manage your account profile details, avatar, and verification status.
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
          {profile?.has_active_verification_badge && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-semibold">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified Badge
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
          <div className="mb-4 max-w-xs">
            <ImageUploader
              value={avatar}
              onChange={setAvatar}
              folder="avatars"
              label="Profile Avatar"
            />
          </div>
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

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="profile-mobile">Mobile Number</FieldLabel>
              <Input
                id="profile-mobile"
                value={mobileNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMobileNumber(e.target.value)}
                placeholder="+44 7911 123456"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-birthday">Birthday</FieldLabel>
              <Input
                id="profile-birthday"
                type="date"
                value={birthday}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBirthday(e.target.value)}
              />
            </Field>
          </div>

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
