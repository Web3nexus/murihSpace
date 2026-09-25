import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { useProfile } from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Spinner as Loader2,
  CheckCircle as CheckCircle2,
  WarningCircle as AlertCircle,
  ShieldWarning,
  SealCheck as BadgeCheck,
  ShareNetwork as Share2,
  ArrowSquareOut,
  Star,
  User as UserIcon,
  Camera,
  FloppyDisk,
  DeviceMobile as Smartphone,
  Globe,
  MapPin,
  Calendar,
  Sparkle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ShareModal } from "@/components/common/ShareModal";
import { authFetch } from "@/lib/api/authFetch";
import { toast } from "sonner";

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
  const [avatar, setAvatar] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [kycDocInput, setKycDocInput] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setCountry(profile.country || "");
      setCounty(profile.county || "");
      setState(profile.state || "");
      setMobileNumber(profile.mobile_number || profile.phone || "");
      setBirthday(profile.birthday || "");
      setAvatar(profile.avatar || profile.avatar_url || "");
      setBannerUrl(profile.banner_url || "");
    }
  }, [profile]);

  const handleAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await authFetch("/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to upload avatar.");
      }

      const uploadedUrl =
        json.avatar ?? json.avatar_url ?? json.url ?? json.data?.avatar ?? json.data?.url;

      if (uploadedUrl) {
        setAvatar(uploadedUrl);
        try {
          const stored = JSON.parse(localStorage.getItem("user_data") ?? "{}");
          stored.avatar = uploadedUrl;
          stored.avatar_url = uploadedUrl;
          localStorage.setItem("user_data", JSON.stringify(stored));
        } catch {
          // ignore
        }
        toast.success("Profile photo updated successfully!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload avatar.";
      toast.error(msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleBannerFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await authFetch("/profile/banner", {
        method: "POST",
        body: formData,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to upload cover banner.");
      }

      const uploadedUrl =
        json.banner_url ?? json.url ?? json.data?.banner_url ?? json.data?.url;

      if (uploadedUrl) {
        setBannerUrl(uploadedUrl);
        try {
          const stored = JSON.parse(localStorage.getItem("user_data") ?? "{}");
          stored.banner_url = uploadedUrl;
          localStorage.setItem("user_data", JSON.stringify(stored));
        } catch {
          // ignore
        }
        toast.success("Cover banner updated successfully!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload cover banner.";
      toast.error(msg);
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    const ok = await updateProfile({
      name,
      username,
      bio,
      avatar: avatar || undefined,
      banner_url: bannerUrl || undefined,
      country,
      county,
      state,
      mobile_number: mobileNumber,
      birthday: birthday || undefined,
    });
    if (ok) {
      setSuccessMsg("Profile updated successfully!");
      toast.success("Profile updated successfully!");
    }
  };

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    if (!kycDocInput.trim()) return;
    const ok = await submitKyc(kycDocInput.trim());
    if (ok) {
      setSuccessMsg("Identity verification document submitted!");
      toast.success("Identity verification document submitted!");
      setKycDocInput("");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 weight="fill" className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12">
      {/* Hidden File Inputs for Direct Camera/Upload Integration */}
      <input
        type="file"
        ref={avatarInputRef}
        onChange={handleAvatarFileSelected}
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
      />
      <input
        type="file"
        ref={bannerInputRef}
        onChange={handleBannerFileSelected}
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
      />

      {/* ── PROFILE HERO CARD ──────────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        {/* Banner with Edit Cover Button */}
        <div className="h-40 sm:h-48 w-full bg-gradient-to-r from-primary/20 via-primary/10 to-muted/40 border-b border-border/80 relative overflow-hidden group">
          {bannerUrl ? (
            <img src={bannerUrl} alt="Profile Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-muted/30" />
          )}

          {/* Banner Upload Trigger Button */}
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploadingBanner}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md border border-white/10"
          >
            {uploadingBanner ? (
              <Loader2 weight="fill" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera weight="bold" className="h-3.5 w-3.5" />
            )}
            <span>{uploadingBanner ? "Uploading..." : "Edit Cover"}</span>
          </button>
        </div>

        {/* Profile Info Row with Unified Interactive Avatar Knob */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-14 mb-4 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              {/* Interactive Avatar Circle with Integrated Camera Action */}
              <div className="relative group self-start">
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-28 h-28 rounded-full border-4 border-card bg-muted/90 flex items-center justify-center overflow-hidden shrink-0 shadow-lg cursor-pointer relative"
                  title="Click to change profile photo"
                >
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary">
                      <UserIcon weight="fill" className="w-14 h-14" />
                    </div>
                  )}

                  {/* Dark hover overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-1">
                    <Camera weight="bold" className="w-5 h-5" />
                    <span>Change</span>
                  </div>

                  {/* Upload Spinner Overlay */}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                      <Loader2 weight="fill" className="w-6 h-6 animate-spin text-white" />
                    </div>
                  )}
                </div>

                {/* Floating Camera Badge Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    avatarInputRef.current?.click();
                  }}
                  disabled={uploadingAvatar}
                  className="absolute bottom-1 right-1 p-2 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md border-2 border-card transition-transform active:scale-95"
                  title="Upload profile photo"
                >
                  <Camera weight="bold" className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Name, Role & Verification Details */}
              <div className="pb-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    {name || "Your Name"}
                  </h1>
                  {(profile?.has_active_verification_badge || profile?.kyc_status === "verified") && (
                    <BadgeCheck weight="fill" className="h-5 w-5 text-sky-500 fill-sky-500/10 shrink-0" />
                  )}
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider">
                    {profile?.role || "Member"}
                  </span>
                </div>
                <p className="text-xs font-semibold text-muted-foreground">
                  @{username || "username"}
                </p>
              </div>
            </div>

            {/* Top Quick Actions Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              {(username || profile?.username) && (
                <a
                  href={`/u/${username || profile?.username}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 text-xs font-semibold rounded-xl"
                  >
                    <ArrowSquareOut weight="bold" className="h-3.5 w-3.5" />
                    <span>View Public Profile</span>
                  </Button>
                </a>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowShareModal(true)}
                className="h-9 gap-1.5 text-xs font-semibold rounded-xl"
              >
                <Share2 weight="bold" className="h-3.5 w-3.5" />
                <span>Share</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleUpdate}
                disabled={updating}
                className="h-9 gap-1.5 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                {updating ? (
                  <Loader2 weight="fill" className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FloppyDisk weight="bold" className="h-3.5 w-3.5" />
                )}
                <span>Save Changes</span>
              </Button>
            </div>
          </div>

          {bio && (
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed max-w-2xl bg-muted/30 p-3 rounded-xl border border-border/50">
              {bio}
            </p>
          )}

          {/* Quick Statistics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/50 text-center">
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40">
              <span className="font-black text-foreground block text-base">{profile?.communities_count ?? 0}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Communities</span>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40">
              <span className="font-black text-foreground block text-base">{profile?.followers_count ?? 0}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Followers</span>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40">
              <span className="font-black text-foreground block text-base">{profile?.following_count ?? 0}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Following</span>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40">
              <span className="font-black text-foreground block text-base">{profile?.posts_count ?? 0}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Posts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications / Feedback Banners */}
      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
          <CheckCircle2 weight="fill" className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive animate-in fade-in">
          <AlertCircle weight="fill" className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Vendor Store Reviews Shortcut (If Vendor) */}
      {profile?.role === "vendor" && (
        <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Star weight="fill" className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Customer Store Reviews</h3>
              <p className="text-xs text-muted-foreground">
                View customer ratings, review feedback, and manage buyer replies.
              </p>
            </div>
          </div>
          <Link to="/app/store/reviews">
            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold shrink-0 rounded-lg">
              Manage Reviews
            </Button>
          </Link>
        </div>
      )}

      {/* ── MAIN PROFILE EDIT FORM ─────────────────────────────── */}
      <form onSubmit={handleUpdate} className="space-y-6">
        {/* Card 1: Personal Details */}
        <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <Sparkle weight="fill" className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Personal Information</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="profile-name">Full Name</FieldLabel>
              <Input
                id="profile-name"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className={cn("h-11 rounded-xl bg-muted/40", fieldErrors.name && "border-destructive")}
              />
              {fieldErrors.name && <p className="text-xs text-destructive mt-1">{fieldErrors.name[0]}</p>}
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-username">Username</FieldLabel>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  @
                </span>
                <Input
                  id="profile-username"
                  value={username}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                  placeholder="username"
                  className={cn("h-11 rounded-xl bg-muted/40 pl-8 font-mono text-xs", fieldErrors.username && "border-destructive")}
                />
              </div>
              {fieldErrors.username && <p className="text-xs text-destructive mt-1">{fieldErrors.username[0]}</p>}
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-birthday" className="flex items-center gap-1.5">
                <Calendar weight="bold" className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Birthday</span>
              </FieldLabel>
              <Input
                id="profile-birthday"
                type="date"
                value={birthday}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBirthday(e.target.value)}
                className="h-11 rounded-xl bg-muted/40 text-xs"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-mobile" className="flex items-center gap-1.5">
                <Smartphone weight="bold" className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Phone / Mobile</span>
              </FieldLabel>
              <Input
                id="profile-mobile"
                value={mobileNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMobileNumber(e.target.value)}
                placeholder="+234 800 000 0000"
                className="h-11 rounded-xl bg-muted/40 text-xs"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="profile-bio">Bio &amp; About You</FieldLabel>
            <textarea
              id="profile-bio"
              rows={3}
              value={bio}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
              placeholder="Tell community members, buyers, and collaborators about yourself..."
              className="w-full rounded-xl border border-input bg-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary resize-none"
            />
          </Field>
        </div>

        {/* Card 2: Location Details */}
        <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <MapPin weight="fill" className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-foreground">Location &amp; Region</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field>
              <FieldLabel htmlFor="profile-country" className="flex items-center gap-1.5">
                <Globe weight="bold" className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Country</span>
              </FieldLabel>
              <Input
                id="profile-country"
                value={country}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)}
                placeholder="e.g. Nigeria"
                className="h-11 rounded-xl bg-muted/40 text-xs"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-state">State / Region</FieldLabel>
              <Input
                id="profile-state"
                value={state}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setState(e.target.value)}
                placeholder="e.g. Lagos"
                className="h-11 rounded-xl bg-muted/40 text-xs"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-county">County / City</FieldLabel>
              <Input
                id="profile-county"
                value={county}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCounty(e.target.value)}
                placeholder="e.g. Ikeja"
                className="h-11 rounded-xl bg-muted/40 text-xs"
              />
            </Field>
          </div>
        </div>

        {/* Submit Action Bottom Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={updating}
            className="h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-2 shadow-sm"
          >
            {updating ? (
              <Loader2 weight="fill" className="h-4 w-4 animate-spin" />
            ) : (
              <FloppyDisk weight="bold" className="h-4 w-4" />
            )}
            <span>Save Profile</span>
          </Button>
        </div>
      </form>

      {/* ── IDENTITY VERIFICATION (KYC) CARD ─────────────────── */}
      <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <ShieldWarning weight="fill" className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Identity Verification (KYC)</h2>
          </div>
          <div>
            {profile?.kyc_status === "verified" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <CheckCircle2 weight="fill" className="h-3.5 w-3.5" /> Verified
              </span>
            ) : profile?.kyc_status === "pending" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                <Loader2 weight="fill" className="h-3.5 w-3.5 animate-spin" /> Under Review
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold">
                Unverified
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Verification unlocks creator tools, live streaming broadcasts, instant meeting hosting, and creator wallet payouts.
        </p>

        {profile?.kyc_status === "rejected" && profile.kyc_rejection_reason && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
            <span className="font-bold block">Rejection Feedback:</span>
            <p>{profile.kyc_rejection_reason}</p>
          </div>
        )}

        {profile?.kyc_status !== "verified" && (
          <form onSubmit={handleKycSubmit} className="flex flex-col sm:flex-row gap-3 items-end pt-2">
            <Field className="flex-1 w-full">
              <FieldLabel htmlFor="kyc-doc-input" className="text-xs">
                Passport, National ID or Document Reference
              </FieldLabel>
              <Input
                id="kyc-doc-input"
                required
                value={kycDocInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKycDocInput(e.target.value)}
                placeholder="e.g. Passport number or Verification Document ID"
                className="h-11 rounded-xl bg-muted/40 text-xs"
              />
            </Field>
            <Button
              type="submit"
              size="sm"
              className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs font-bold gap-1.5 shrink-0"
              disabled={updating || !kycDocInput.trim()}
            >
              {updating ? <Loader2 weight="fill" className="h-3.5 w-3.5 animate-spin" /> : <ShieldWarning weight="fill" className="h-3.5 w-3.5" />}
              <span>Submit for Verification</span>
            </Button>
          </form>
        )}
      </div>

      {/* Share Profile Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={name || username || "User Profile"}
        description={bio || `Check out ${name || username}'s profile on MurihSpace`}
        url={`${window.location.origin}/u/${username || profile?.username}`}
        type="profile"
        imageUrl={avatar}
        badge={profile?.role}
      />
    </div>
  );
}

