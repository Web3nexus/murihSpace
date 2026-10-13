import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { AnimatedPage } from "@/components/common/AnimatedPage";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, type UserProfileData } from "@/hooks/useProfile";
import { apiClient } from "@/lib/api/client";
import { mapApiPost, type FeedPost } from "@/lib/feed";
import { profileUrl } from "@/lib/deepLinks";
import { toast } from "sonner";
import { Edit as PencilSimple, Location as MapPin, Calendar as CalendarBlank, N2User as Users, AddUser as UserPlus, Image as ImageIcon, Video as VideoCamera, Heart, Chat as ChatCircle, Plus, ShieldDone as BadgeCheck, Send, TickSquare as Check, Discovery as Globe } from "@/components/icons";
import { Storefront, LinkSimple, Broadcast, At, ShareNetwork, Spinner as Loader2 } from "@/components/icons/rounded";;

type TabKey = "posts" | "reels" | "live" | "mentions";

const TABS: { key: TabKey; label: string; type: string; icon: typeof ImageIcon }[] = [
  { key: "posts", label: "Posts", type: "post", icon: ImageIcon },
  { key: "reels", label: "Reels", type: "reels", icon: VideoCamera },
  { key: "live", label: "Live", type: "live", icon: Broadcast },
  { key: "mentions", label: "Mentions", type: "mentions", icon: At },
];

interface FriendItem {
  id: number;
  name?: string;
  username?: string;
  avatar?: string;
  avatar_url?: string;
}

interface HighlightItem {
  id: number;
  media_url?: string;
  caption?: string;
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

export default function UserProfilePage() {
  const { user } = useAuth();
  const { profile: selfProfile, loading: selfLoading } = useProfile();
  const { id: routeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const isSelf = !routeId || (user?.id != null && String(user.id) === String(routeId));

  const [otherProfile, setOtherProfile] = useState<UserProfileData | null>(null);
  const [otherLoading, setOtherLoading] = useState(false);
  const [otherError, setOtherError] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [copied, setCopied] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("posts");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const [photos, setPhotos] = useState<string[]>([]);

  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userCommunities, setUserCommunities] = useState<{ id: number; name: string }[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);

  const display = isSelf ? selfProfile : otherProfile;
  const loading = isSelf ? selfLoading : otherLoading;
  const name = display?.name ?? (isSelf ? user?.name : undefined) ?? "User";
  const username = display?.username ?? (isSelf ? user?.username : undefined) ?? "user";
  const role = display?.role ?? (isSelf ? user?.role : undefined) ?? "member";
  const canUseStudio = role === "creator" || role === "vendor" || role === "admin";
  const avatar = display?.avatar_url ?? display?.avatar ?? (isSelf ? (user?.avatar_url ?? user?.avatar) : undefined) ?? "";
  const banner = display?.banner_url ?? "";
  const bio = display?.bio ?? "";
  const location = [display?.state, display?.country].filter(Boolean).join(", ");
  const joinedYear = display?.created_at
    ? new Date(display.created_at).getFullYear()
    : new Date().getFullYear();
  const verified = Boolean(display?.has_active_verification_badge);

  const userId = isSelf ? (selfProfile?.id ?? user?.id) : otherProfile?.id;
  const notFound = !isSelf && otherError;

  const activeRequestRef = useRef(0);

  const loadTab = useCallback(
    async (tab: TabKey) => {
      if (!userId) return;
      const requestId = ++activeRequestRef.current;
      const type = TABS.find((t) => t.key === tab)?.type ?? "post";
      setPostsLoading(true);
      try {
        const res = await apiClient.get(`/users/${userId}/posts?type=${type}`);
        if (requestId !== activeRequestRef.current) return;
        const data = res.data?.data ?? res.data;
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setPosts(list.map((p: any) => mapApiPost(p, userId)));
      } catch {
        if (requestId !== activeRequestRef.current) return;
        setPosts([]);
      }
      if (requestId === activeRequestRef.current) setPostsLoading(false);
    },
    [userId]
  );

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  // Load the viewed user's public profile when this is not the signed-in user.
  useEffect(() => {
    if (isSelf || !routeId) {
      setOtherProfile(null);
      setOtherError(false);
      return;
    }
    let cancelled = false;
    setOtherLoading(true);
    setOtherError(false);
    apiClient
      .get(`/users/${encodeURIComponent(routeId)}`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data ?? res.data;
        if (data && data.id) {
          setOtherProfile(data as UserProfileData);
        } else {
          setOtherProfile(null);
          setOtherError(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setOtherProfile(null);
        setOtherError(true);
      })
      .finally(() => {
        if (!cancelled) setOtherLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSelf, routeId]);

  // Follow state for the viewed user (self has none).
  useEffect(() => {
    if (isSelf || !userId) {
      setIsFollowing(false);
      return;
    }
    let cancelled = false;
    apiClient
      .get(`/users/${userId}/follow-status`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data ?? res.data;
        setIsFollowing(Boolean(data?.is_following));
      })
      .catch(() => {
        if (!cancelled) setIsFollowing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSelf, userId]);

  useEffect(() => {
    if (!userId) return;

    apiClient
      .get(`/users/${userId}/stories`)
      .then((res) => {
        const raw = res.data?.data ?? res.data ?? [];
        setHighlights(Array.isArray(raw) ? raw.slice(0, 12) : []);
      })
      .catch(() => setHighlights([]));

    apiClient
      .get(`/users/${userId}/posts?type=media`)
      .then((res) => {
        const data = res.data?.data ?? res.data;
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        const urls: string[] = [];
        list.forEach((p: any) => {
          (p.media_urls ?? []).forEach((u: string) => urls.push(u));
        });
        setPhotos(urls.slice(0, 9));
      })
      .catch(() => setPhotos([]));

    if (!isSelf) {
      setFriends([]);
      setUserCommunities([]);
      setSelectedCommunityId(null);
      return;
    }

    apiClient
      .get("/friends")
      .then((res) => {
        const raw = res.data?.data ?? res.data ?? [];
        const list = Array.isArray(raw) ? raw : [];
        setFriends(
          list
            .map((f: any) => f.friend ?? f)
            .filter((f: any) => f && f.id)
            .map((f: any) => ({
              id: f.id,
              name: f.name,
              username: f.username,
              avatar: f.avatar_url ?? f.avatar,
            }))
        );
      })
      .catch(() => setFriends([]));

    apiClient
      .get("/my-communities")
      .then((res) => {
        const raw = res.data?.communities ?? res.data?.data ?? [];
        const list = Array.isArray(raw) ? raw.map((c: any) => ({ id: c.id, name: c.name })) : [];
        setUserCommunities(list);
        if (list.length > 0) setSelectedCommunityId(list[0].id);
      })
      .catch(() => setUserCommunities([]));
  }, [userId, isSelf]);

  async function handleCreatePost() {
    if (!postText.trim() || !selectedCommunityId) {
      toast.error("Select a community and write something first.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.post("/posts", {
        community_id: selectedCommunityId,
        type: "post",
        content: postText,
      });
      const created = res.data?.post ?? res.data?.data ?? res.data;
      if (created?.id && activeTab === "posts") {
        const newPost: FeedPost = {
          id: created.id,
          author: name,
          avatar,
          badge: "Community",
          time: "Just now",
          content: postText,
          likes: 0,
          comments: 0,
          shares: 0,
          isLiked: false,
          embedType: null,
          commentList: [],
        };
        setPosts((prev) => [newPost, ...prev]);
      }
      setPostText("");
      setComposerOpen(false);
      toast.success("Post published");
    } catch {
      toast.error("Failed to publish post.");
    }
    setSubmitting(false);
  }

  async function toggleLike(id: number) {
    const previous = posts.find((p) => p.id === id);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 } : p
      )
    );
    try {
      const res = await apiClient.post(`/posts/${id}/reactions/toggle`, { type: "like" });
      const likesCount = res.data?.likes_count;
      if (typeof likesCount === "number") {
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, likes: likesCount } : p)));
      }
    } catch {
      if (previous) {
        setPosts((prev) => prev.map((p) => (p.id === id ? previous : p)));
      }
    }
  }

  async function copyProfileLink() {
    try {
      await navigator.clipboard.writeText(profileUrl(username));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  async function toggleFollow() {
    if (!userId || followBusy || isSelf) return;
    setFollowBusy(true);
    const next = !isFollowing;
    setIsFollowing(next);
    try {
      await apiClient.post(`/users/${userId}/follow`, {});
      toast.success(next ? `Following @${username}` : `Unfollowed @${username}`);
    } catch {
      setIsFollowing(!next);
      toast.error("Couldn't update follow.");
    } finally {
      setFollowBusy(false);
    }
  }

  const ActiveTabIcon = TABS.find((t) => t.key === activeTab)?.icon ?? ImageIcon;

  const stats = [
    { label: "Posts", value: display?.posts_count ?? 0 },
    { label: "Followers", value: display?.followers_count ?? 0 },
    { label: "Following", value: display?.following_count ?? 0 },
    ...(isSelf ? [{ label: "Friends", value: friends.length }] : []),
    { label: "Communities", value: display?.communities_count ?? 0 },
  ];

  if (notFound) {
    return (
      <AnimatedPage className="w-full min-h-screen bg-[#F1F5F9] dark:bg-black flex items-center justify-center">
        <div className="text-center space-y-3 px-6">
          <Users weight="fill" className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <h1 className="text-lg font-black text-foreground">User not found</h1>
          <p className="text-sm text-muted-foreground">This account doesn&apos;t exist or is unavailable.</p>
          <Link to="/app/feed" className="inline-block mt-2 px-4 py-2 rounded-xl bg-[#2164b6] text-white text-sm font-bold">
            Back to feed
          </Link>
        </div>
      </AnimatedPage>
    );
  }

  if (!isSelf && !display) {
    return (
      <AnimatedPage className="w-full min-h-screen bg-[#F1F5F9] dark:bg-black flex items-center justify-center">
        <Loader2 weight="fill" className="h-6 w-6 animate-spin text-[#2164b6]" />
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="w-full min-h-screen bg-[#F1F5F9] dark:bg-black">
      {/* ── Banner ── */}
      <div className="relative">
        <div className="h-44 sm:h-60 w-full rounded-b-[32px] overflow-hidden bg-gradient-to-r from-[#2164b6] via-[#1a5091] to-[#0d2f5e]">
          {banner ? (
            <img src={banner} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.25),transparent_40%)]" />
          )}
        </div>
      </div>

      {/* ── Profile Header Section ── */}
      <div className="max-w-[1240px] mx-auto px-4 -mt-16 sm:-mt-20 relative z-10">
        <div className="rounded-2xl bg-white dark:bg-[#0f1b30] shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#2164b6] to-[#7ab0ff]" />
          <div className="p-5 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-full ring-4 ring-white dark:ring-[#0f1b30] bg-[#2164b6] flex items-center justify-center overflow-hidden">
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl font-black text-white">{name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0 sm:pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{name}</h1>
                  {verified && <BadgeCheck weight="fill" className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" />}
                  <span className="px-2 py-0.5 rounded-md bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] text-[11px] font-bold uppercase tracking-wide">
                    {roleLabel(role)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-medium mt-0.5">@{username}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                  {location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin weight="fill" className="h-3.5 w-3.5" /> {location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <CalendarBlank weight="fill" className="h-3.5 w-3.5" /> Joined {joinedYear}
                  </span>
                  <button
                    onClick={copyProfileLink}
                    className="inline-flex items-center gap-1 text-[#2164b6] dark:text-[#7ab0ff] font-semibold hover:underline"
                  >
                    {copied ? <Check weight="bold" className="h-3.5 w-3.5" /> : <LinkSimple weight="fill" className="h-3.5 w-3.5" />}
                    {copied ? "Copied!" : `murihspace.com/@${username}`}
                  </button>
                </div>
              </div>
            </div>

            {/* Bio */}
            {bio && <p className="mt-5 text-sm text-foreground/90 leading-relaxed max-w-3xl">{bio}</p>}

            {/* Stats */}
            <div className={`mt-5 grid grid-cols-2 ${isSelf ? "sm:grid-cols-5" : "sm:grid-cols-4"} gap-3`}>
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl bg-[#F1F5F9] dark:bg-[#0b1324] px-3 py-3 text-center"
                >
                  <p className="text-lg font-black text-foreground">
                    {loading ? "—" : s.value.toLocaleString()}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {isSelf ? (
                <>
                  <Link
                    to="/app/settings/profile"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white text-sm font-bold transition-colors"
                  >
                    <PencilSimple weight="fill" className="h-4 w-4" /> Edit Profile
                  </Link>

                  {canUseStudio && (
                    <>
                      <Link
                        to="/app/studio"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] hover:bg-[#2164b6]/20 text-sm font-bold transition-colors"
                      >
                        <VideoCamera weight="fill" className="h-4 w-4" /> Creator Studio
                      </Link>
                      <Link
                        to="/app/brand-deals"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] hover:bg-[#2164b6]/20 text-sm font-bold transition-colors"
                      >
                        <Storefront weight="fill" className="h-4 w-4" /> Brand Studio
                      </Link>
                    </>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={toggleFollow}
                    disabled={followBusy}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 ${
                      isFollowing
                        ? "bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] hover:bg-[#2164b6]/20"
                        : "bg-[#2164b6] hover:bg-[#1a5091] text-white"
                    }`}
                  >
                    {isFollowing ? <Check weight="bold" className="h-4 w-4" /> : <UserPlus weight="fill" className="h-4 w-4" />}
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                  <button
                    onClick={() => navigate(`/app/messages?user=${userId}`)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] hover:bg-[#2164b6]/20 text-sm font-bold transition-colors"
                  >
                    <ChatCircle weight="fill" className="h-4 w-4" /> Message
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Two-column body ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 mt-5 pb-10">
          {/* LEFT COLUMN */}
          <div className="space-y-4 order-2 lg:order-1">
            {/* Story Highlights */}
            <div className="rounded-2xl bg-white dark:bg-[#0d1117] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black text-foreground">Story Highlights</h2>
                <span className="text-[11px] text-muted-foreground font-semibold">{highlights.length}</span>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {isSelf && (
                  <button
                    onClick={() => toast.info("Create a story from the feed.")}
                    className="flex flex-col items-center gap-1.5 shrink-0"
                  >
                    <span className="h-16 w-16 rounded-full border-2 border-dashed border-[#2164b6]/50 flex items-center justify-center text-[#2164b6] dark:text-[#7ab0ff]">
                      <Plus weight="bold" className="h-6 w-6" />
                    </span>
                    <span className="text-[11px] font-semibold text-foreground">New</span>
                  </button>
                )}
                {highlights.map((h) => (
                  <div key={h.id} className="flex flex-col items-center gap-1.5 shrink-0">
                    <span className="h-16 w-16 rounded-full p-[2px] bg-gradient-to-tr from-[#2164b6] to-[#7ab0ff]">
                      <span className="block h-full w-full rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                        {h.media_url ? (
                          <img src={h.media_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-[#2164b6]">
                            <ImageIcon weight="fill" className="h-5 w-5" />
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold text-foreground max-w-[64px] truncate">
                      {h.caption || "Highlight"}
                    </span>
                  </div>
                ))}
                {highlights.length === 0 && (
                  <p className="text-xs text-muted-foreground self-center">No highlights yet.</p>
                )}
              </div>
            </div>

            {/* Friends (own profile only) */}
            {isSelf && (
              <div className="rounded-2xl bg-white dark:bg-[#0d1117] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-black text-foreground">Friends</h2>
                  <Link to="/app/friends" className="text-[11px] font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline">
                    {friends.length} total
                  </Link>
                </div>
                {friends.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {friends.slice(0, 6).map((f) => (
                      <div key={f.id} className="flex flex-col items-center gap-1.5">
                        <span className="h-16 w-16 rounded-xl overflow-hidden bg-[#2164b6] flex items-center justify-center">
                          {f.avatar ? (
                            <img src={f.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg font-bold text-white">{(f.name ?? "U").charAt(0).toUpperCase()}</span>
                          )}
                        </span>
                        <span className="text-[11px] font-semibold text-foreground text-center leading-tight line-clamp-2">
                          {f.name ?? f.username ?? "User"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users weight="fill" className="h-4 w-4" /> No friends yet.
                  </div>
                )}
                <Link
                  to="/app/friends/suggestions"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline"
                >
                  <UserPlus weight="fill" className="h-4 w-4" /> Find friends
                </Link>
              </div>
            )}

            {/* Photos */}
            <div className="rounded-2xl bg-white dark:bg-[#0d1117] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black text-foreground">Photos</h2>
              </div>
              {photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {photos.map((url, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ImageIcon weight="fill" className="h-4 w-4" /> No photos yet.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4 order-1 lg:order-2 min-w-0">
            {/* Composer (own profile only) */}
            {isSelf && (
            <div className="rounded-2xl bg-white dark:bg-[#0d1117] p-4 sm:p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-full bg-[#2164b6] flex items-center justify-center text-white overflow-hidden shrink-0">
                  {avatar ? (
                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold">{name.charAt(0).toUpperCase()}</span>
                  )}
                </span>
                {!composerOpen ? (
                  <button
                    onClick={() => setComposerOpen(true)}
                    className="flex-1 text-left rounded-full bg-[#F1F5F9] dark:bg-[#1a2233] hover:bg-[#e6ebf2] dark:hover:bg-[#232d42] transition-colors px-5 py-3 text-sm text-muted-foreground"
                  >
                    What's on your mind, {name.split(" ")[0]}?
                  </button>
                ) : (
                  <span className="text-sm font-semibold text-foreground">Create a post</span>
                )}
              </div>

              {composerOpen && (
                <div className="mt-3 space-y-3">
                  <textarea
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="Write your post here..."
                    autoFocus
                    className="w-full h-28 p-3.5 text-sm rounded-xl bg-[#F1F5F9] dark:bg-[#1a2233] focus:outline-none focus:ring-2 focus:ring-[#2164b6]/40 resize-none text-foreground"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <select
                      value={selectedCommunityId ?? ""}
                      onChange={(e) => setSelectedCommunityId(Number(e.target.value))}
                      className="h-9 px-3 rounded-lg bg-[#F1F5F9] dark:bg-[#1a2233] text-xs font-semibold text-foreground focus:outline-none"
                    >
                      {userCommunities.length === 0 && <option value="">No communities</option>}
                      {userCommunities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setComposerOpen(false);
                          setPostText("");
                        }}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreatePost}
                        disabled={submitting || !postText.trim() || !selectedCommunityId}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2164b6] hover:bg-[#1a5091] disabled:opacity-50 text-white font-bold text-xs transition-colors"
                      >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send weight="fill" className="h-3.5 w-3.5" />}
                        Publish
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Tabs + Posts */}
            <div className="rounded-2xl bg-white dark:bg-[#0d1117] shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
              <div className="flex items-center border-b border-black/5 dark:border-white/10">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const active = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-3.5 text-xs sm:text-sm font-bold transition-colors border-b-2 ${
                        active
                          ? "text-[#2164b6] dark:text-[#7ab0ff] border-[#2164b6] dark:border-[#7ab0ff]"
                          : "text-muted-foreground border-transparent hover:text-foreground"
                      }`}
                    >
                      <Icon weight={active ? "fill" : "regular"} className="h-4 w-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                {postsLoading && (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 weight="fill" className="h-5 w-5 animate-spin mr-2" />
                    <span className="text-xs font-semibold">Loading posts…</span>
                  </div>
                )}

                {!postsLoading && posts.length === 0 && (
                  <div className="text-center py-14 text-muted-foreground space-y-1">
                    <ActiveTabIcon weight="fill" className="h-8 w-8 mx-auto opacity-40" />
                    <p className="text-sm font-bold text-foreground mt-2">Nothing here yet</p>
                    <p className="text-xs">Posts you share will appear in this tab.</p>
                  </div>
                )}

                {!postsLoading &&
                  posts.map((post) => (
                    <article
                      key={post.id}
                      className="rounded-xl ring-1 ring-black/5 dark:ring-white/10 p-4 space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-10 w-10 rounded-full bg-[#2164b6] overflow-hidden">
                          {post.avatar ? (
                            <img src={post.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-white font-bold">
                              {post.author.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-foreground">{post.author}</span>
                            {post.authorVerified && <BadgeCheck weight="fill" className="h-3.5 w-3.5 text-sky-500" />}
                          </div>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            {post.badge} · {post.time} · <Globe weight="fill" className="h-3 w-3" />
                          </p>
                        </div>
                      </div>

                      {post.content && (
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{post.content}</p>
                      )}

                      {post.embedType === "media" && post.embedBg && (
                        <div className="rounded-lg overflow-hidden bg-slate-800">
                          <img src={post.embedBg} alt="" className="w-full max-h-96 object-cover" />
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-black/5 dark:border-white/10 pt-2 text-xs">
                        <button
                          onClick={() => toggleLike(post.id)}
                          className={`inline-flex items-center gap-1.5 font-semibold transition-colors ${
                            post.isLiked ? "text-[#2164b6] dark:text-[#7ab0ff]" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Heart weight="fill" className="h-4 w-4" /> {post.likes}
                        </button>
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground font-semibold">
                          <ChatCircle weight="fill" className="h-4 w-4" /> {post.comments}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground font-semibold">
                          <ShareNetwork weight="fill" className="h-4 w-4" /> {post.shares}
                        </span>
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
