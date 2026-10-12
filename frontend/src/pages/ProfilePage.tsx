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
  Camera,
  FloppyDisk,
  DeviceMobile as Smartphone,
  Globe,
  MapPin,
  Calendar,
  User,
  Copy,
  Link as LinkIcon,
  Eye,
  ArrowCounterClockwise,
  ArrowLeft,
  Handshake,
  VideoCamera as Video,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ShareModal } from "@/components/common/ShareModal";
import { authFetch } from "@/lib/api/authFetch";
import { toast } from "sonner";
import { absolute, profileUrl } from "@/lib/deepLinks";

function getInitials(nameStr: string): string {
  const parts = nameStr.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length > 0) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return "U";
}

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
  const [website, setWebsite] = useState("");
  const [category, setCategory] = useState("");
  const [gender, setGender] = useState("");
  const [avatar, setAvatar] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [kycDocInput, setKycDocInput] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Sync state from profile
  const populateFromProfile = React.useCallback(() => {
    if (profile) {
      setName(profile.name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setCountry(profile.country || "");
      setCounty(profile.county || "");
      setState(profile.state || "");
      setMobileNumber(profile.mobile_number || profile.phone || "");
      setBirthday(profile.birthday || "");
      setWebsite(profile.website || "");
      setCategory(profile.category || "");
      setGender(profile.gender || "");
      setAvatar(profile.avatar || profile.avatar_url || "");
      setBannerUrl(profile.banner_url || "");
    }
  }, [profile]);

  useEffect(() => {
    populateFromProfile();
  }, [populateFromProfile]);

  // Track whether there are unsaved changes
  const isDirty = React.useMemo(() => {
    if (!profile) return false;
    return (
      name !== (profile.name || "") ||
      username !== (profile.username || "") ||
      bio !== (profile.bio || "") ||
      website !== (profile.website || "") ||
      category !== (profile.category || "") ||
      gender !== (profile.gender || "") ||
      country !== (profile.country || "") ||
      county !== (profile.county || "") ||
      state !== (profile.state || "") ||
      mobileNumber !== (profile.mobile_number || profile.phone || "") ||
      birthday !== (profile.birthday || "")
    );
  }, [profile, name, username, bio, website, category, gender, country, county, state, mobileNumber, birthday]);

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

  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSuccessMsg(null);
    const ok = await updateProfile({
      name,
      username: username.trim().toLowerCase(),
      bio,
      website: website ? website.trim() : null,
      category: category ? category.trim() : null,
      gender: gender ? gender.trim() : null,
      avatar: avatar || undefined,
      banner_url: bannerUrl || undefined,
      country,
      county,
      state,
      mobile_number: mobileNumber,
      birthday: birthday ? birthday.trim() : null,
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

  const copyLinkInBio = () => {
    const link = `https://murihspace.com/l/${username || profile?.username || ""}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast.success("Copied Link-in-Bio URL to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 weight="fill" className="h-7 w-7 animate-spin text-[#1A68D4]" />
      </div>
    );
  }

  const cleanHandle = (username || profile?.username || "").toLowerCase();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-20">
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

      {/* ── TOP HEADER BAR ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/app/settings"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              <ArrowLeft weight="bold" className="h-3.5 w-3.5" /> Settings
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-xs font-bold text-foreground">Edit Profile</span>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Edit Profile</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your public presence, personal information, and profile appearance.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {cleanHandle && (
            <Link to={`/u/${cleanHandle}`} target="_blank" rel="noreferrer">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs font-bold rounded-xl border-border hover:bg-muted"
              >
                <Eye weight="bold" className="h-4 w-4 text-[#1A68D4]" />
                <span>Public Profile Preview</span>
              </Button>
            </Link>
          )}

          <Link to="/app/studio">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-bold rounded-xl border-border hover:bg-muted"
            >
              <Video weight="bold" className="h-4 w-4 text-[#1A68D4]" />
              <span>Creator Studio</span>
            </Button>
          </Link>

          <Link to="/app/brand-deals">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-bold rounded-xl border-border hover:bg-muted"
            >
              <Handshake weight="bold" className="h-4 w-4 text-amber-500" />
              <span>Brand Studio</span>
            </Button>
          </Link>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowShareModal(true)}
            className="h-9 gap-1.5 text-xs font-semibold rounded-xl border-border hover:bg-muted"
          >
            <Share2 weight="bold" className="h-3.5 w-3.5" />
            <span>Share</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleUpdate()}
            disabled={updating}
            className="h-9 gap-1.5 text-xs font-bold rounded-xl bg-[#1A68D4] hover:bg-[#1A68D4]/90 text-white shadow-sm"
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

      {/* ── PROFILE HERO VISUALS CARD ──────────────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        {/* Cover Banner with Live Upload */}
        <div className="h-44 sm:h-52 w-full bg-[#131b26] dark:bg-[#0d131d] border-b border-border/80 relative overflow-hidden group">
          {bannerUrl ? (
            <img src={bannerUrl} alt="Profile Cover Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[#131b26] dark:bg-[#0d131d] flex items-center justify-end pr-8">
              {/* Subtle geometric dot pattern */}
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
                  backgroundSize: "24px 24px",
                }}
              />
              <div className="relative text-right hidden sm:block select-none opacity-20 pointer-events-none">
                <span className="text-3xl font-black text-white/50 tracking-widest uppercase">MURIH</span>
              </div>
            </div>
          )}

          {/* Banner Upload Button */}
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploadingBanner}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md border border-white/10 active:scale-95"
            title="Upload profile cover banner"
          >
            {uploadingBanner ? (
              <Loader2 weight="fill" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera weight="bold" className="h-3.5 w-3.5" />
            )}
            <span>{uploadingBanner ? "Uploading..." : "Edit Cover Banner"}</span>
          </button>

          {/* Cover Banner Descriptor */}
          <div className="absolute bottom-2 left-4 text-[10px] font-semibold text-white/70 bg-black/40 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white/10">
            Profile Cover Banner
          </div>
        </div>

        {/* Profile Info Row with Interactive Avatar */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-14 mb-4 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              {/* Interactive Avatar Circle with Integrated Camera Action */}
              <div className="relative group self-start">
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-28 h-28 rounded-full border-4 border-card bg-slate-800 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-lg cursor-pointer relative"
                  title="Click to change profile photo"
                >
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-black text-2xl tracking-wider select-none">
                      {getInitials(name || username || "User")}
                    </div>
                  )}

                  {/* Dark hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-1">
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
                  className="absolute bottom-1 right-1 p-2 rounded-full bg-[#1A68D4] hover:bg-[#1A68D4]/90 text-white shadow-md border-2 border-card transition-transform active:scale-95"
                  title="Upload profile photo"
                >
                  <Camera weight="bold" className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Name, Role & Verification Details */}
              <div className="pb-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    {name || "Your Name"}
                  </h2>
                  {(profile?.has_active_verification_badge || profile?.kyc_status === "verified") && (
                    <BadgeCheck weight="fill" className="h-5 w-5 text-[#1A68D4] fill-[#1A68D4] shrink-0" />
                  )}
                  {profile?.role === "admin" ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-[11px] font-bold tracking-wide">
                      Platform Admin
                    </span>
                  ) : profile?.role === "creator" ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-bold tracking-wide">
                      Creator
                    </span>
                  ) : profile?.role === "vendor" ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-bold tracking-wide">
                      Storefront Owner
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#1A68D4]/10 text-[#1A68D4] border border-[#1A68D4]/30 text-[11px] font-bold tracking-wide">
                      Member
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-muted-foreground font-mono">
                  @{cleanHandle || "username"}
                </p>
              </div>
            </div>
          </div>

          {bio && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-2xl bg-muted/30 p-3 rounded-xl border border-border/50">
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

      {/* ── NATIVE LINK-IN-BIO SHORTCUT CARD ─────────────────────── */}
      <div className="rounded-3xl border border-[#1A68D4]/30 bg-gradient-to-r from-[#1A68D4]/5 via-background to-background p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-[#1A68D4]/10 text-[#1A68D4] flex items-center justify-center shrink-0">
              <LinkIcon weight="bold" className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Native Link-in-Bio Experience</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1A68D4]/15 text-[#1A68D4]">
                  Built-in
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Share all your content, storefront, and socials using your official MurihSpace link.
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs font-mono font-bold text-[#1A68D4] bg-[#1A68D4]/10 px-3 py-1.5 rounded-xl border border-[#1A68D4]/20 w-fit">
                <span>https://murihspace.com/l/{cleanHandle}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyLinkInBio}
              className="h-9 gap-1.5 text-xs font-semibold rounded-xl border-border hover:bg-muted"
            >
              {copiedLink ? <CheckCircle2 weight="fill" className="h-4 w-4 text-emerald-500" /> : <Copy weight="bold" className="h-4 w-4" />}
              <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
            </Button>
            <a href={`/l/${cleanHandle}`} target="_blank" rel="noreferrer">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs font-semibold rounded-xl border-border hover:bg-muted"
              >
                <ArrowSquareOut weight="bold" className="h-3.5 w-3.5 text-[#1A68D4]" />
                <span>Preview</span>
              </Button>
            </a>
            <Link to="/app/link-in-bio">
              <Button
                type="button"
                size="sm"
                className="h-9 text-xs font-bold rounded-xl bg-[#1A68D4] hover:bg-[#1A68D4]/90 text-white"
              >
                Manage Link-in-Bio
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── MAIN PROFILE EDIT FORM ─────────────────────────────── */}
      <form onSubmit={handleUpdate} className="space-y-6">
        {/* Card 1: Personal Details */}
        <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <User weight="bold" className="h-4 w-4 text-[#1A68D4]" />
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                  }
                  placeholder="username"
                  className={cn(
                    "h-11 rounded-xl bg-muted/40 pl-8 font-mono text-xs",
                    fieldErrors.username && "border-destructive"
                  )}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Public URL: murihspace.com/u/{cleanHandle}
              </p>
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

            <Field>
              <FieldLabel htmlFor="profile-website" className="flex items-center gap-1.5">
                <Globe weight="bold" className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Website</span>
              </FieldLabel>
              <Input
                id="profile-website"
                value={website}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWebsite(e.target.value)}
                placeholder="https://linktr.ee/lorduzih"
                className="h-11 rounded-xl bg-muted/40 text-xs text-[#1A68D4] font-medium"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-category" className="flex items-center gap-1.5">
                <Camera weight="bold" className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Category</span>
              </FieldLabel>
              <Input
                id="profile-category"
                value={category}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCategory(e.target.value)}
                placeholder="e.g. Content Creator"
                className="h-11 rounded-xl bg-muted/40 text-xs font-medium"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-gender" className="flex items-center gap-1.5">
                <User weight="bold" className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Gender</span>
              </FieldLabel>
              <select
                id="profile-gender"
                value={gender}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGender(e.target.value)}
                className="h-11 w-full rounded-xl bg-muted/40 border border-input px-3 text-xs font-medium text-foreground"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </Field>
          </div>

          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="profile-bio">Bio &amp; About You</FieldLabel>
              <span className={cn("text-[11px] font-mono", bio.length > 500 ? "text-destructive font-bold" : "text-muted-foreground")}>
                {bio.length} / 500
              </span>
            </div>
            <textarea
              id="profile-bio"
              rows={3}
              maxLength={500}
              value={bio}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
              placeholder="Tell community members, buyers, and collaborators about yourself..."
              className="w-full rounded-xl border border-input bg-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1A68D4] resize-none"
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
          {isDirty && (
            <Button
              type="button"
              variant="outline"
              onClick={populateFromProfile}
              className="h-11 px-5 rounded-xl text-xs font-semibold gap-1.5"
            >
              <ArrowCounterClockwise weight="bold" className="h-4 w-4" />
              <span>Discard Changes</span>
            </Button>
          )}
          <Button
            type="submit"
            disabled={updating}
            className="h-11 px-6 rounded-xl bg-[#1A68D4] hover:bg-[#1A68D4]/90 text-white font-bold text-xs gap-2 shadow-sm"
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

      {/* ── FLOATING UNSAVED CHANGES BAR ────────────────────────── */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-xl bg-slate-900 text-white dark:bg-card dark:text-foreground border border-white/10 dark:border-border rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-[#1A68D4] animate-pulse" />
            <span className="text-xs font-bold">You have unsaved changes</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={populateFromProfile}
              className="h-8 text-xs font-semibold text-white/80 hover:text-white dark:text-muted-foreground dark:hover:text-foreground"
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleUpdate()}
              disabled={updating}
              className="h-8 text-xs font-bold bg-[#1A68D4] hover:bg-[#1A68D4]/90 text-white rounded-lg px-4"
            >
              {updating ? <Loader2 weight="fill" className="h-3.5 w-3.5 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* ── IDENTITY VERIFICATION (KYC) CARD ─────────────────── */}
      <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <ShieldWarning weight="fill" className="h-4 w-4 text-[#1A68D4]" />
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
          Verification unlocks creator monetization, verified badges, live broadcasting, audio room hosting, and creator wallet payouts.
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
              className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs font-bold gap-1.5 shrink-0 bg-[#1A68D4] hover:bg-[#1A68D4]/90 text-white"
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
        url={absolute(profileUrl(cleanHandle))}
        type="profile"
        imageUrl={avatar}
        badge={profile?.role}
      />
    </div>
  );
}
export default ProfilePage;
