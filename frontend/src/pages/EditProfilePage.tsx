import { asApiError } from "@/lib/apiError";
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { AnimatedPage } from "@/components/common/AnimatedPage";
import { useProfile } from "@/hooks/useProfile";
import { apiClient } from "@/lib/api/client";
import { authFetch } from "@/lib/api/authFetch";
import { toast } from "sonner";
import { ArrowLeft, Camera, TickSquare as Check, TickSquare as CheckCircle, Location as MapPin, Edit as PencilSimple, N2User as Users, AddUser as UserPlus, Calendar, Discovery as Globe, TimeCircle as Clock, CloseSquare as X, Download as FloppyDisk } from "@/components/icons";
import { Spinner as Loader2, Buildings, LinkSimple, At } from "@/components/icons/rounded";;
import { cn } from "@/lib/utils";

type FieldKey =
  | "name"
  | "username"
  | "bio"
  | "website"
  | "location"
  | "category"
  | "gender"
  | "birthday"
  | "mobile";

interface MyGroup {
  id: number;
  name: string;
  slug: string;
  avatar_url?: string | null;
  members_count: number;
  privacy: string;
  is_member: boolean;
  pending?: boolean;
}

interface MyCommunity {
  id: number;
  name: string;
  slug?: string;
  avatar?: string | null;
  members_count?: number;
  is_following: boolean;
  pending?: boolean;
}

function roleLabel(role?: string): string {
  switch (role) {
    case "creator":
      return "Creator";
    case "vendor":
      return "Brand / Vendor";
    case "admin":
      return "Admin";
    default:
      return "Member";
  }
}

const inputClass =
  "w-full rounded-lg bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] border border-transparent focus:border-[var(--shell-accent)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--shell-accent)]/30 px-3 py-2 text-sm text-foreground";
const selectClass =
  "w-full rounded-lg bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--shell-accent)]/30 px-3 py-2 text-sm text-foreground appearance-none";

function PencilButton({ active, onClick, title }: { active?: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? "Edit"}
      className={cn(
        "h-8 w-8 inline-flex items-center justify-center rounded-lg transition-colors shrink-0",
        active
          ? "bg-[var(--shell-accent-solid)] text-white"
          : "bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] text-[var(--shell-muted)] dark:text-[var(--shell-muted)] hover:text-[var(--shell-accent)] dark:hover:text-[var(--shell-accent)]"
      )}
    >
      <PencilSimple weight="fill" className="h-4 w-4" />
    </button>
  );
}

export default function EditProfilePage() {
  const navigate = useNavigate();
  const { profile, loading, updating, updateProfile } = useProfile();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [website, setWebsite] = useState("");
  const [category, setCategory] = useState("");
  const [gender, setGender] = useState("");
  const [birthday, setBirthday] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [avatar, setAvatar] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [editing, setEditing] = useState<FieldKey | null>(null);

  // Opening a detail editor moves focus into its field, so keyboard users can
  // type straight away instead of tabbing back past the pencil button.
  useEffect(() => {
    if (!editing) return;
    document.getElementById(`profile-edit-${editing}`)?.focus();
  }, [editing]);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [communities, setCommunities] = useState<MyCommunity[]>([]);
  const [busyId, setBusyId] = useState<{ type: "group" | "community"; id: number } | null>(null);

  const hydratedProfileId = useRef<number | null>(null);

  const normalizeDate = (d?: string | null) => {
    if (!d) return "";
    const match = d.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : d;
  };

  const populateFromProfile = React.useCallback(() => {
    if (profile) {
      if (hydratedProfileId.current === profile.id) return;
      hydratedProfileId.current = profile.id;
      setName(profile.name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setCountry(profile.country || "");
      setState(profile.state || "");
      setWebsite(profile.website || "");
      setCategory(profile.category || "");
      setGender(profile.gender || "");
      setBirthday(normalizeDate(profile.birthday));
      setMobileNumber(profile.mobile_number || profile.phone || "");
      setAvatar(profile.avatar || profile.avatar_url || "");
      setBannerUrl(profile.banner_url || "");
    }
  }, [profile]);

  useEffect(() => {
    populateFromProfile();
  }, [populateFromProfile]);

  const isDirty = React.useMemo(() => {
    if (!profile) return false;
    return (
      name !== (profile.name || "") ||
      username !== (profile.username || "") ||
      bio !== (profile.bio || "") ||
      country !== (profile.country || "") ||
      state !== (profile.state || "") ||
      website !== (profile.website || "") ||
      category !== (profile.category || "") ||
      gender !== (profile.gender || "") ||
      birthday !== normalizeDate(profile.birthday) ||
      mobileNumber !== (profile.mobile_number || profile.phone || "") ||
      avatar !== (profile.avatar || profile.avatar_url || "") ||
      bannerUrl !== (profile.banner_url || "")
    );
  }, [profile, name, username, bio, country, state, website, category, gender, birthday, mobileNumber, avatar, bannerUrl]);

  const location = [country, state].filter(Boolean).join(", ");



  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get("/groups/mine");
        const raw = res.data?.data ?? res.data;
        const list = Array.isArray(raw) ? raw : [];
        setGroups(
          list.map((g) => ({
            id: g.id,
            name: g.name,
            slug: g.slug,
            avatar_url: g.avatar_url ?? g.avatar ?? null,
            members_count: g.members_count ?? 0,
            privacy: g.privacy ?? "public",
            is_member: true,
          }))
        );
      } catch {
        setGroups([]);
      }
    })();
    (async () => {
      try {
        const res = await apiClient.get("/my-communities");
        const raw = res.data?.communities ?? res.data?.data ?? [];
        const list = Array.isArray(raw) ? raw : [];
        setCommunities(
          list.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            avatar: c.avatar_url ?? c.avatar ?? null,
            members_count: c.members_count ?? 0,
            is_following: true,
          }))
        );
      } catch {
        setCommunities([]);
      }
    })();
  }, []);

  const toggleGroup = async (group: MyGroup) => {
    if (busyId) return;
    if (group.is_member) {
      const confirmed = window.confirm(`Leave ${group.name}? You’ll lose access to group content and notifications.`);
      if (!confirmed) return;
    }
    setBusyId({ type: "group", id: group.id });
    try {
      const res = await apiClient.post(`/groups/${group.id}/${group.is_member ? "leave" : "join"}`);
      const payload = (res.data ?? {}) as { status?: string };
      if (group.is_member) {
        setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, is_member: false, pending: false } : g)));
        toast.success(`Left ${group.name}`);
      } else if (payload.status === "pending_approval") {
        setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, is_member: false, pending: true } : g)));
        toast.success("Join request sent — an admin will review it.");
      } else {
        setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, is_member: true, pending: false } : g)));
        toast.success(`Joined ${group.name}`);
      }
    } catch {
      toast.error("Couldn't update group membership.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleCommunity = async (community: MyCommunity) => {
    if (busyId) return;
    setBusyId({ type: "community", id: community.id });
    try {
      const res = await apiClient.post(`/communities/${community.id}/${community.is_following ? "leave" : "join"}`);
      const payload = (res.data ?? {}) as { status?: string; is_pending?: boolean };
      const isPending = payload.is_pending === true || payload.status === "pending";
      if (community.is_following) {
        setCommunities((prev) => prev.map((c) => (c.id === community.id ? { ...c, is_following: false, pending: false } : c)));
        toast.success(`Unfollowed ${community.name}`);
      } else if (isPending) {
        setCommunities((prev) => prev.map((c) => (c.id === community.id ? { ...c, is_following: false, pending: true } : c)));
        toast.success(`${community.name} follow request sent — pending approval.`);
      } else {
        setCommunities((prev) => prev.map((c) => (c.id === community.id ? { ...c, is_following: true, pending: false } : c)));
        toast.success(`Following ${community.name}`);
      }
    } catch {
      toast.error("Couldn't update community follow.");
    } finally {
      setBusyId(null);
    }
  };

  const handleAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authFetch("/profile/avatar", { method: "POST", body: formData });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to upload avatar.");
      const uploadedUrl = json.avatar ?? json.avatar_url ?? json.url ?? json.data?.avatar ?? json.data?.url;
      if (uploadedUrl) {
        setAvatar(uploadedUrl);
        toast.success("Profile photo updated. Tap Save to apply.");
      }
    } catch (err: unknown) {
      const apiErr = asApiError(err);
      toast.error(err instanceof Error ? apiErr.message : "Failed to upload avatar.");
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
      const res = await authFetch("/profile/banner", { method: "POST", body: formData });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to upload cover.");
      const uploadedUrl = json.banner_url ?? json.url ?? json.data?.banner_url ?? json.data?.url;
      if (uploadedUrl) {
        setBannerUrl(uploadedUrl);
        toast.success("Cover updated. Tap Save to apply.");
      }
    } catch (err: unknown) {
      const apiErr = asApiError(err);
      toast.error(err instanceof Error ? apiErr.message : "Failed to upload cover.");
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSave = async () => {
    const ok = await updateProfile({
      name,
      username: username.trim().toLowerCase(),
      bio,
      website: website ? website.trim() : null,
      category: category ? category.trim() : null,
      gender: gender ? gender.trim() : null,
      avatar: avatar || null,
      banner_url: bannerUrl || null,
      country: country || null,
      state: state || null,
      mobile_number: mobileNumber || null,
      birthday: birthday ? birthday.trim() : null,
    });
    if (ok) {
      try {
        const stored = JSON.parse(localStorage.getItem("user_data") ?? "{}");
        stored.avatar = avatar || null;
        stored.avatar_url = avatar || null;
        stored.banner_url = bannerUrl || null;
        localStorage.setItem("user_data", JSON.stringify(stored));
      } catch {
        // ignore
      }
      toast.success("Profile updated!");
      navigate("/app/profile");
    } else {
      toast.error("Couldn't save changes. Check the fields and try again.");
    }
  };

  const stats = [
    { label: "Posts", value: profile?.posts_count ?? 0 },
    { label: "Followers", value: profile?.followers_count ?? 0 },
    { label: "Following", value: profile?.following_count ?? 0 },
    { label: "Communities", value: profile?.communities_count ?? 0 },
  ];

  if (loading || (!profile && uploadingAvatar) || (!profile && uploadingBanner)) {
    return (
      <AnimatedPage className="w-full min-h-screen bg-[var(--shell-canvas)] dark:bg-[var(--shell-canvas)] flex items-center justify-center">
        <Loader2 weight="fill" className="h-6 w-6 animate-spin text-[var(--shell-accent)]" />
      </AnimatedPage>
    );
  }

  if (!profile) {
    return (
      <AnimatedPage className="w-full min-h-screen bg-[var(--shell-canvas)] dark:bg-[var(--shell-canvas)] flex items-center justify-center">
        <div className="text-center space-y-3 px-6">
          <Users weight="fill" className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <h1 className="text-lg font-black text-foreground">Couldn't load your profile</h1>
          <Link to="/app/feed" className="inline-block mt-2 px-4 py-2 rounded-xl bg-[var(--shell-accent-solid)] text-white text-sm font-bold">
            Back to feed
          </Link>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="w-full min-h-screen bg-[var(--shell-canvas)] dark:bg-[var(--shell-canvas)]">
      {/* ── Banner ── */}
      <div className="relative">
        <div className="h-44 sm:h-60 w-full rounded-b-[32px] overflow-hidden bg-gradient-to-r from-[var(--shell-accent-solid)] via-[#1a5091] to-[#0d2f5e]">
          {bannerUrl ? (
            <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.25),transparent_40%)]" />
          )}
        </div>

        {/* Back to profile */}
        <Link
          to="/app/profile"
          className="absolute left-4 top-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/90 dark:bg-[var(--shell-surface)]/90 text-[#0d2f5e] dark:text-white text-xs font-bold shadow-lg backdrop-blur hover:bg-white dark:hover:bg-[#0d1117] transition-colors"
        >
          <ArrowLeft weight="bold" className="h-4 w-4" /> Profile
        </Link>

        {/* Change cover */}
        <button
          type="button"
          onClick={() => bannerInputRef.current?.click()}
          disabled={uploadingBanner}
          className="absolute right-4 bottom-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/90 dark:bg-[var(--shell-surface)]/90 text-[#0d2f5e] dark:text-white text-sm font-bold shadow-lg backdrop-blur hover:bg-white dark:hover:bg-[#0d1117] transition-colors disabled:opacity-60"
        >
          {uploadingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera weight="fill" className="h-4 w-4" />}
          Change cover
        </button>
        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerFileSelected} />

        {/* Save (mobile) */}
        <button
          type="button"
          onClick={handleSave}
          disabled={updating || !isDirty}
          className="lg:hidden absolute right-4 top-16 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white text-sm font-bold shadow-lg disabled:opacity-50 transition-colors"
        >
          {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FloppyDisk weight="fill" className="h-4 w-4" />}
          Save
        </button>
      </div>

      {/* ── Header card ── */}
      <div className="max-w-[1240px] mx-auto px-4 -mt-16 sm:-mt-20 relative z-10">
        <div className="rounded-2xl bg-white dark:bg-[var(--shell-surface)] shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-[var(--shell-accent-solid)] to-[#7ab0ff]" />
          <div className="p-5 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-full ring-4 ring-white dark:ring-[#0f1b30] bg-[var(--shell-accent-solid)] flex items-center justify-center overflow-hidden">
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl font-black text-white">{name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title="Change photo"
                  className="absolute bottom-1 right-1 h-9 w-9 rounded-full bg-white dark:bg-[var(--shell-surface)] shadow-lg ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center text-[#0d2f5e] dark:text-white hover:text-[var(--shell-accent)] dark:hover:text-[var(--shell-accent)] transition-colors disabled:opacity-60"
                >
                  {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera weight="fill" className="h-4 w-4" />}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileSelected} />
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0 sm:pb-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {editing === "name" ? (
                    <input
                      id="profile-edit-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && setEditing(null)}
                      className="text-2xl sm:text-3xl font-black text-foreground tracking-tight rounded-lg px-2 bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--shell-accent)]/40"
                    />
                  ) : (
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{name}</h1>
                  )}
                  <span className="px-2 py-0.5 rounded-md bg-[var(--shell-accent-solid)]/10 text-[var(--shell-accent)] dark:text-[var(--shell-accent)] text-[11px] font-bold uppercase tracking-wide">
                    {roleLabel(profile.role)}
                  </span>
                  <PencilButton active={editing === "name"} onClick={() => setEditing(editing === "name" ? null : "name")} title="Edit name" />
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {editing === "username" ? (
                    <input
                      id="profile-edit-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/\s+/g, "").toLowerCase())}
                      onKeyDown={(e) => e.key === "Enter" && setEditing(null)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--shell-accent)]/40"
                      placeholder="username"
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <At weight="fill" className="h-3.5 w-3.5" />@{username}
                    </span>
                  )}
                  <PencilButton active={editing === "username"} onClick={() => setEditing(editing === "username" ? null : "username")} title="Edit username" />

                  {editing === "location" ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="Country"
                        className="rounded-lg px-2 py-1 bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-[var(--shell-accent)]/40"
                      />
                      <input
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="State / City"
                        className="rounded-lg px-2 py-1 bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-[var(--shell-accent)]/40"
                      />
                      <button onClick={() => setEditing(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-[var(--shell-accent-solid)] text-white">
                        <Check weight="bold" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <MapPin weight="fill" className="h-3.5 w-3.5" /> {location || "Add location"}
                    </span>
                  )}
                  <PencilButton active={editing === "location"} onClick={() => setEditing(editing === "location" ? null : "location")} title="Edit location" />

                  {editing === "website" ? (
                    <input
                      id="profile-edit-website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && setEditing(null)}
                      placeholder="https://…"
                      className="inline-flex rounded-lg px-2 py-1 bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] text-[var(--shell-accent)] dark:text-[var(--shell-accent)] font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--shell-accent)]/40"
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--shell-accent)] dark:text-[var(--shell-accent)]">
                      <LinkSimple weight="fill" className="h-3.5 w-3.5" /> {website || "Add website"}
                    </span>
                  )}
                  <PencilButton active={editing === "website"} onClick={() => setEditing(editing === "website" ? null : "website")} title="Edit website" />
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="mt-5 flex items-start gap-2 max-w-3xl">
              {editing === "bio" ? (
                <div className="flex-1">
                  <textarea
                    id="profile-edit-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    maxLength={200}
                    placeholder="Tell people about yourself…"
                    className="w-full rounded-xl bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-[var(--shell-accent)]/40"
                  />
                  <div className="flex items-center justify-end mt-1 gap-2">
                    <span className="text-[11px] text-muted-foreground font-semibold">{bio.length}/200</span>
                    <button
                      onClick={() => setEditing(null)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--shell-accent-solid)] text-white text-xs font-bold"
                    >
                      <Check weight="bold" className="h-3.5 w-3.5" /> Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1">
                  {bio ? (
                    <p className="text-sm text-foreground/90 leading-relaxed">{bio}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground/70 italic">No bio yet — add one.</p>
                  )}
                </div>
              )}
              <PencilButton active={editing === "bio"} onClick={() => setEditing(editing === "bio" ? null : "bio")} title="Edit bio" />
            </div>

            {/* Stats */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] px-3 py-3 text-center">
                  <p className="text-lg font-black text-foreground">{s.value.toLocaleString()}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleSave}
                disabled={updating || !isDirty}
                className="hidden lg:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FloppyDisk weight="fill" className="h-4 w-4" />}
                Save Changes
              </button>
              <Link
                to="/app/profile"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--shell-accent-solid)]/10 text-[var(--shell-accent)] dark:text-[var(--shell-accent)] hover:bg-[var(--shell-accent-solid)]/20 text-sm font-bold transition-colors"
              >
                <CheckCircle weight="fill" className="h-4 w-4" /> View Profile
              </Link>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 mt-5 pb-10">
          {/* LEFT COLUMN */}
          <div className="space-y-4 order-2 lg:order-1">
            {/* Groups */}
            <div className="rounded-2xl bg-white dark:bg-[var(--shell-surface)] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black text-foreground flex items-center gap-1.5">
                  <Users weight="fill" className="h-4 w-4 text-[var(--shell-accent)] dark:text-[var(--shell-accent)]" /> Groups you're in
                </h2>
                <Link to="/app/groups" className="text-[11px] font-bold text-[var(--shell-accent)] dark:text-[var(--shell-accent)] hover:underline">
                  Find groups
                </Link>
              </div>
              {groups.length > 0 ? (
                <div className="space-y-2">
                  {groups.map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg py-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-9 w-9 rounded-lg overflow-hidden bg-[var(--shell-accent-solid)] flex items-center justify-center shrink-0">
                          {g.avatar_url ? (
                            <img src={g.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Users weight="fill" className="h-4 w-4 text-white" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <Link
                            to={`/app/groups/${g.slug}`}
                            className="text-[13px] font-bold text-foreground truncate block hover:underline"
                          >
                            {g.name}
                          </Link>
                          <p className="text-[11px] text-muted-foreground capitalize">{g.members_count} members · {g.privacy}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGroup(g)}
                        disabled={busyId?.type === "group" || Boolean(g.pending)}
                        className={cn(
                          "shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50",
                          g.is_member || g.pending
                            ? "bg-[var(--shell-accent-solid)]/10 text-[var(--shell-accent)] dark:text-[var(--shell-accent)] hover:bg-[var(--shell-accent-solid)]/20"
                            : "bg-[var(--shell-accent-solid)] text-white hover:bg-[var(--shell-accent-hover)]"
                        )}
                      >
                        {busyId?.type === "group" && busyId.id === g.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : g.pending ? (
                          <Clock weight="fill" className="h-3 w-3" />
                        ) : g.is_member ? (
                          <X weight="bold" className="h-3 w-3" />
                        ) : (
                          <UserPlus weight="fill" className="h-3 w-3" />
                        )}
                        {g.pending ? "Pending" : g.is_member ? "Leave" : "Join"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">You're not in any groups yet.</p>
                  <Link to="/app/groups" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--shell-accent)] dark:text-[var(--shell-accent)] hover:underline">
                    <UserPlus weight="fill" className="h-3.5 w-3.5" /> Join
                  </Link>
                </div>
              )}
            </div>

            {/* Communities */}
            <div className="rounded-2xl bg-white dark:bg-[var(--shell-surface)] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black text-foreground flex items-center gap-1.5">
                  <Buildings weight="fill" className="h-4 w-4 text-[var(--shell-accent)] dark:text-[var(--shell-accent)]" /> Communities you follow
                </h2>
                <Link to="/app/communities" className="text-[11px] font-bold text-[var(--shell-accent)] dark:text-[var(--shell-accent)] hover:underline">
                  Discover
                </Link>
              </div>
              {communities.length > 0 ? (
                <div className="space-y-2">
                  {communities.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg py-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-9 w-9 rounded-lg overflow-hidden bg-[var(--shell-accent-solid)] flex items-center justify-center shrink-0">
                          {c.avatar ? (
                            <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Buildings weight="fill" className="h-4 w-4 text-white" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <Link
                            to={c.slug ? `/app/communities/${c.slug}` : `/app/communities/${c.id}`}
                            className="text-[13px] font-bold text-foreground truncate block hover:underline"
                          >
                            {c.name}
                          </Link>
                          {c.members_count != null && (
                            <p className="text-[11px] text-muted-foreground">{c.members_count} members</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCommunity(c)}
                        disabled={busyId?.type === "community" || Boolean(c.pending)}
                        className={cn(
                          "shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50",
                          c.is_following || c.pending
                            ? "bg-[var(--shell-accent-solid)]/10 text-[var(--shell-accent)] dark:text-[var(--shell-accent)] hover:bg-[var(--shell-accent-solid)]/20"
                            : "bg-[var(--shell-accent-solid)] text-white hover:bg-[var(--shell-accent-hover)]"
                        )}
                      >
                        {busyId?.type === "community" && busyId.id === c.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : c.pending ? (
                          <Clock weight="fill" className="h-3 w-3" />
                        ) : c.is_following ? (
                          <Globe weight="bold" className="h-3 w-3" />
                        ) : (
                          <UserPlus weight="fill" className="h-3 w-3" />
                        )}
                        {c.pending ? "Pending" : c.is_following ? "Unfollow" : "Follow"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">You haven't joined any communities.</p>
                  <Link to="/app/communities" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--shell-accent)] dark:text-[var(--shell-accent)] hover:underline">
                    <UserPlus weight="fill" className="h-3.5 w-3.5" /> Follow
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4 order-1 lg:order-2 min-w-0">
            {/* Edit details */}
            <div className="rounded-2xl bg-white dark:bg-[var(--shell-surface)] p-5 sm:p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-foreground">Profile details</h2>
                <span className="text-[11px] text-muted-foreground font-semibold">Tap the pencil to edit</span>
              </div>

              <div className="divide-y divide-black/5 dark:divide-white/10">
                {/* Category */}
                <div className="flex items-center justify-between gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Category</p>
                    {editing === "category" ? (
                      <select id="profile-edit-category" value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                        <option value="">Select category</option>
                        {["Creator", "Brand / Vendor", "Influencer", "Tech", "Lifestyle", "Fashion", "Education", "Entertainment"].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-foreground font-medium mt-0.5">{category || <span className="text-muted-foreground/70">Not set</span>}</p>
                    )}
                  </div>
                  <PencilButton active={editing === "category"} onClick={() => setEditing(editing === "category" ? null : "category")} title="Edit category" />
                </div>

                {/* Gender */}
                <div className="flex items-center justify-between gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Gender</p>
                    {editing === "gender" ? (
                      <select id="profile-edit-gender" value={gender} onChange={(e) => setGender(e.target.value)} className={selectClass}>
                        <option value="">Prefer not to say</option>
                        {["Male", "Female", "Non-binary"].map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-foreground font-medium mt-0.5">{gender || <span className="text-muted-foreground/70">Not set</span>}</p>
                    )}
                  </div>
                  <PencilButton active={editing === "gender"} onClick={() => setEditing(editing === "gender" ? null : "gender")} title="Edit gender" />
                </div>

                {/* Birthday */}
                <div className="flex items-center justify-between gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                      <Calendar weight="fill" className="h-3 w-3" /> Birthday
                    </p>
                    {editing === "birthday" ? (
                      <input id="profile-edit-birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className={inputClass} />
                    ) : (
                      <p className="text-sm text-foreground font-medium mt-0.5">{birthday || <span className="text-muted-foreground/70">Not set</span>}</p>
                    )}
                  </div>
                  <PencilButton active={editing === "birthday"} onClick={() => setEditing(editing === "birthday" ? null : "birthday")} title="Edit birthday" />
                </div>

                {/* Mobile number */}
                <div className="flex items-center justify-between gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Mobile number</p>
                    {editing === "mobile" ? (
                      <input id="profile-edit-mobile" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} placeholder="+1 234 567 8900" className={inputClass} />
                    ) : (
                      <p className="text-sm text-foreground font-medium mt-0.5">{mobileNumber || <span className="text-muted-foreground/70">Not set</span>}</p>
                    )}
                  </div>
                  <PencilButton active={editing === "mobile"} onClick={() => setEditing(editing === "mobile" ? null : "mobile")} title="Edit mobile number" />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs text-muted-foreground">
                  {isDirty ? "You have unsaved changes." : "All changes are saved."}
                </p>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={updating || !isDirty}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FloppyDisk weight="fill" className="h-4 w-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}