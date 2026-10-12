import * as React from "react";
import { useParams, Link, useNavigate } from "react-router";
import { authFetch } from "@/lib/api/authFetch";
import { useAuth } from "@/hooks/useAuth";
import { SEOHead } from "@/components/common/SEOHead";
import { OpenInAppBanner } from "@/components/common/OpenInAppBanner";
import { AuthPromptModal } from "@/components/auth/AuthPromptModal";
import { ShareModal } from "@/components/common/ShareModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SealCheck as BadgeCheck,
  Calendar,
  MapPin,
  ShareNetwork as Share2,
  Users,
  ChatTeardropText as MessageSquare,
  UserPlus,
  UserCheck,
  Storefront,
  ArrowSquareOut as ExternalLink,
  Lock,
  Spinner as Loader2,
  Warning as AlertTriangle,
  ArrowLeft,
  Star,
  CheckCircle,
  User as UserIcon,
  GridFour,
  FilmReel,
  Broadcast,
  Heart,
  ChatCircle,
  Eye,
  PencilSimple,
  Play,
} from "@phosphor-icons/react";
import { absolute, profileDomain, profileUrl } from "@/lib/deepLinks";
import { Badge3DRenderer } from "@/pages/AdminBadgesPage";

interface PublicBadgeItem {
  id: number;
  slug: string;
  name: string;
  level_label?: string | null;
  description?: string | null;
  icon?: string | null;
  icon_3d?: string | null;
  color?: string | null;
  icon_gradient?: string | null;
  criteria?: any;
  earned_at?: string;
}

interface PublicCommunity {
  id: number;
  name: string;
  slug: string;
  logo_url?: string;
  cover_url?: string;
  description?: string;
  category?: string;
  members_count: number;
  pricing_type: string;
  price_amount?: number;
}

export interface PublicReview {
  id: number;
  rating: number;
  title: string | null;
  body: string | null;
  vendor_reply: string | null;
  vendor_replied_at: string | null;
  created_at: string;
  buyer: {
    id: number;
    name: string;
    username: string;
    avatar_url?: string;
    avatar?: string;
  } | null;
  product: {
    id: number;
    title: string;
    images?: string[];
  } | null;
}

export interface ReviewStats {
  average: number;
  total: number;
  distribution: Record<string, number>;
}

interface PublicUserProfile {
  id: number;
  name: string;
  username: string;
  role: string;
  bio?: string;
  avatar?: string;
  avatar_url?: string;
  banner_url?: string;
  country?: string;
  state?: string;
  county?: string;
  kyc_status?: string;
  has_active_verification_badge?: boolean;
  followers_count: number;
  following_count: number;
  communities_count: number;
  posts_count: number;
  reviews_count?: number;
  average_rating?: number | null;
  has_link_in_bio?: boolean;
  storefront?: {
    short_code: string;
    display_name?: string;
  } | null;
  public_communities: PublicCommunity[];
  badges?: PublicBadgeItem[];
  created_at?: string;
}

interface UserPostItem {
  id: number;
  user_id: number;
  content: string;
  type: string;
  media_urls?: string[];
  likes_count?: number;
  comments_count?: number;
  views_count?: number;
  shares_count?: number;
  reactions_count?: number;
  is_pinned?: boolean;
  created_at: string;
  community?: {
    id: number;
    name: string;
    slug: string;
    logo_url?: string;
  } | null;
}

type TabType = "posts" | "reels" | "live" | "communities" | "reviews";

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const cleanUsername = (username ?? "").replace(/^@/, "").toLowerCase();

  const { isAuthenticated, user: currentUser } = useAuth();
  const [profile, setProfile] = React.useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [showShareModal, setShowShareModal] = React.useState(false);

  // Active tab state
  const [activeTab, setActiveTab] = React.useState<TabType>("posts");
  const [tabPosts, setTabPosts] = React.useState<UserPostItem[]>([]);
  const [postsLoading, setPostsLoading] = React.useState(false);

  // Reviews & ratings
  const [reviews, setReviews] = React.useState<PublicReview[]>([]);
  const [reviewStats, setReviewStats] = React.useState<ReviewStats | null>(null);
  const [reviewsLoading, setReviewsLoading] = React.useState(false);

  // Social actions
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [followLoading, setFollowLoading] = React.useState(false);
  const [followersCount, setFollowersCount] = React.useState(0);

  // Auth prompt
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  const [authModalReason, setAuthModalReason] = React.useState<{ title: string; desc: string }>({
    title: "Join the Conversation on MurihSpace",
    desc: "Log in or create a free account to follow creators, send messages, and join communities.",
  });

  const isSelf = isAuthenticated && currentUser?.username?.toLowerCase() === cleanUsername;

  const loadProfile = React.useCallback(async () => {
    if (!cleanUsername) return;
    setLoading(true);
    setNotFound(false);
    try {
      // Use ?refresh=1 and Cache-Control: no-cache to guarantee fresh live data for profile owners & visitors
      const res = await authFetch(`/users/${encodeURIComponent(cleanUsername)}/public?refresh=1`, {
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const json = await res.json();
      const data: PublicUserProfile = json?.data?.data ?? json?.data ?? json;
      if (!data || !data.id) {
        setNotFound(true);
        return;
      }
      setProfile(data);
      setFollowersCount(data.followers_count ?? 0);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [cleanUsername]);

  const loadReviews = React.useCallback(async () => {
    if (!cleanUsername) return;
    setReviewsLoading(true);
    try {
      const res = await authFetch(`/users/${encodeURIComponent(cleanUsername)}/reviews`);
      if (res.ok) {
        const json = await res.json();
        const payload = json?.data?.data ?? json?.data ?? [];
        const stats = json?.data?.stats ?? json?.stats ?? null;
        setReviews(Array.isArray(payload) ? payload : []);
        if (stats) setReviewStats(stats);
      }
    } catch {
      // Ignore
    } finally {
      setReviewsLoading(false);
    }
  }, [cleanUsername]);

  const loadTabPosts = React.useCallback(async (userId: number, tab: TabType) => {
    if (tab === "communities" || tab === "reviews") return;
    setPostsLoading(true);
    try {
      let queryType = "all";
      if (tab === "reels") queryType = "reels";
      if (tab === "live") queryType = "live";

      const res = await authFetch(`/users/${userId}/posts?type=${queryType}`);
      if (res.ok) {
        const json = await res.json();
        const raw = json?.data ?? json;
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
        setTabPosts(list);
      } else {
        setTabPosts([]);
      }
    } catch {
      setTabPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadProfile();
    loadReviews();
  }, [loadProfile, loadReviews]);

  React.useEffect(() => {
    if (profile?.id) {
      loadTabPosts(profile.id, activeTab);
    }
  }, [profile?.id, activeTab, loadTabPosts]);

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleFollowClick = async () => {
    if (!isAuthenticated) {
      setAuthModalReason({
        title: `Follow @${cleanUsername}`,
        desc: "Log in or create a free account to follow this creator and see their posts in your feed.",
      });
      setIsAuthModalOpen(true);
      return;
    }

    if (!profile) return;
    setFollowLoading(true);
    try {
      const res = await authFetch(`/users/${profile.id}/follow`, { method: "POST" });
      if (res.ok) {
        setIsFollowing((prev) => !prev);
        setFollowersCount((prev) => (isFollowing ? Math.max(0, prev - 1) : prev + 1));
      }
    } catch {
      // Ignore
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessageClick = () => {
    if (!isAuthenticated) {
      setAuthModalReason({
        title: `Message @${cleanUsername}`,
        desc: "Log in or create a free account to send direct messages to this user.",
      });
      setIsAuthModalOpen(true);
      return;
    }
    navigate(`/app/chat?user=${cleanUsername}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 weight="fill" className="h-8 w-8 animate-spin text-[#1A68D4]" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle weight="fill" className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">User Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          The user @{cleanUsername} does not exist or may have changed their username.
        </p>
        <Link
          to={isAuthenticated ? "/app" : "/"}
          className="text-xs font-bold text-[#1A68D4] hover:underline inline-flex items-center gap-1.5"
        >
          <ArrowLeft weight="fill" className="h-3.5 w-3.5" /> Go to MurihSpace
        </Link>
      </div>
    );
  }

  const joinDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEOHead
        title={`${profile.name} (@${profile.username})`}
        description={profile.bio || `Check out ${profile.name}'s profile on MurihSpace.`}
        image={profile.avatar_url || profile.avatar}
      />

      {/* Mobile Deep Link Smart Banner */}
      <OpenInAppBanner
        scheme={`murihspace://u/${cleanUsername}`}
        title={`@${profile.username} on MurihSpace`}
        subtitle="Open in app for full profile, messaging, and community audio"
      />

      {/* ── Profile Preview Banner for Self ── */}
      {isSelf && (
        <div className="sticky top-0 z-50 bg-[#1A68D4]/10 text-[#1A68D4] border-b border-[#1A68D4]/20 px-4 py-2.5 backdrop-blur-md flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#1A68D4] animate-pulse" />
            <span>
              <strong>Profile Preview Mode</strong> — You are viewing your public profile as visitors see it.
            </span>
          </div>
          <Link to="/app/settings/profile">
            <Button size="sm" className="h-7 text-xs font-bold rounded-lg bg-[#1A68D4] text-white hover:bg-[#1A68D4]/90 gap-1.5 shadow-sm">
              <PencilSimple weight="bold" className="h-3.5 w-3.5" />
              Edit Profile
            </Button>
          </Link>
        </div>
      )}

      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to={isAuthenticated ? "/app" : "/"}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft weight="fill" className="h-4 w-4" />
            <span>{isAuthenticated ? "Dashboard" : "MurihSpace"}</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="h-8 gap-1.5 text-xs font-semibold rounded-xl border-border"
            >
              <Share2 weight="bold" className="h-3.5 w-3.5" />
              Share
            </Button>

            {!isAuthenticated && (
              <Button
                size="sm"
                onClick={() => {
                  setAuthModalReason({
                    title: "Welcome to MurihSpace",
                    desc: "Sign in to access your feed, join communities, and connect with creators.",
                  });
                  setIsAuthModalOpen(true);
                }}
                className="h-8 text-xs font-bold bg-[#1A68D4] text-white hover:bg-[#1A68D4]/90 rounded-xl"
              >
                Log In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Profile Header Card */}
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {/* Banner Surface */}
          <div className="h-44 sm:h-56 w-full bg-[#131b26] dark:bg-[#0d131d] relative overflow-hidden">
            {profile.banner_url ? (
              <img src={profile.banner_url} alt="Cover Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-[#131b26] dark:bg-[#0d131d] flex items-center justify-end pr-8">
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Profile Meta Area */}
          <div className="px-6 pb-6 pt-0 relative">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-16 sm:-mt-20 mb-4 gap-4">
              {/* Avatar + Basic Names */}
              <div className="flex items-end gap-4">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-4 border-card bg-slate-800 dark:bg-slate-700 flex items-center justify-center overflow-hidden shadow-xl shrink-0">
                  {profile.avatar_url || profile.avatar ? (
                    <img
                      src={profile.avatar_url || profile.avatar}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon weight="fill" className="text-white/90" style={{ width: 60, height: 60 }} />
                  )}
                </div>

                <div className="pb-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                      {profile.name}
                    </h1>
                    {(profile.has_active_verification_badge || profile.kyc_status === "verified") && (
                      <BadgeCheck weight="fill" className="h-5 w-5 text-[#1A68D4] fill-[#1A68D4] shrink-0" />
                    )}
                  </div>
                  <p className="text-xs font-bold text-muted-foreground font-mono">
                    @{profile.username}
                  </p>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center gap-2 flex-wrap">
                {isSelf ? (
                  <>
                    <Link to="/app/settings/profile">
                      <Button
                        size="sm"
                        className="h-9 text-xs font-bold gap-1.5 bg-[#1A68D4] hover:bg-[#1A68D4]/90 text-white rounded-xl shadow-sm"
                      >
                        <PencilSimple weight="bold" className="h-3.5 w-3.5" /> Edit Profile
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleShare}
                      className="h-9 text-xs font-semibold gap-1.5 border-border rounded-xl hover:bg-muted"
                    >
                      <Share2 weight="bold" className="h-3.5 w-3.5" /> Share
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={handleFollowClick}
                      disabled={followLoading}
                      className={`h-9 text-xs font-bold gap-1.5 rounded-xl ${
                        isFollowing
                          ? "bg-muted text-foreground hover:bg-muted/80 border border-border"
                          : "bg-[#1A68D4] text-white hover:bg-[#1A68D4]/90 shadow-sm"
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck weight="bold" className="h-3.5 w-3.5" /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus weight="bold" className="h-3.5 w-3.5" /> Follow
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleMessageClick}
                      className="h-9 text-xs font-semibold gap-1.5 border-border rounded-xl hover:bg-muted"
                    >
                      <MessageSquare weight="bold" className="h-3.5 w-3.5 text-[#1A68D4]" /> Message
                    </Button>

                    {profile.storefront && (
                      <Link to={`/store/${profile.storefront.short_code}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs font-bold gap-1.5 border-border rounded-xl hover:bg-muted"
                        >
                          <Storefront weight="bold" className="h-3.5 w-3.5 text-[#1A68D4]" /> Store
                        </Button>
                      </Link>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleShare}
                      className="h-9 text-xs font-semibold gap-1.5 border-border rounded-xl hover:bg-muted"
                    >
                      <Share2 weight="bold" className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Role & Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-2.5 py-0.5 rounded-full bg-[#1A68D4]/10 text-[#1A68D4] text-[11px] font-bold capitalize">
                {profile.role || "Member"}
              </span>
              {(profile.average_rating || (reviewStats?.total ?? 0) > 0) && (
                <span className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                  <Star weight="fill" className="h-3.5 w-3.5 fill-amber-500" />
                  <span>{profile.average_rating ?? reviewStats?.average}</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    ({profile.reviews_count ?? reviewStats?.total})
                  </span>
                </span>
              )}
              {profile.country && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin weight="bold" className="h-3.5 w-3.5" /> {profile.country}
                </span>
              )}
              {joinDate && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar weight="bold" className="h-3.5 w-3.5" /> Joined {joinDate}
                </span>
              )}
            </div>

            {/* Bio */}
            {profile.bio ? (
              <p className="text-sm text-foreground/90 leading-relaxed max-w-2xl whitespace-pre-line mb-5">
                {profile.bio}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic mb-5">
                No bio provided yet.
              </p>
            )}

            {/* Follower Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 p-4 rounded-2xl bg-muted/40 border border-border/50">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Followers</p>
                <p className="text-lg font-black text-foreground mt-0.5">{followersCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Following</p>
                <p className="text-lg font-black text-foreground mt-0.5">{profile.following_count ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Communities</p>
                <p className="text-lg font-black text-foreground mt-0.5">{profile.communities_count ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Posts</p>
                <p className="text-lg font-black text-foreground mt-0.5">{profile.posts_count ?? 0}</p>
              </div>
              {(profile.role === "vendor" || (profile.reviews_count ?? 0) > 0 || (reviewStats?.total ?? 0) > 0) && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Rating</p>
                  <p className="text-lg font-black text-amber-500 mt-0.5 flex items-center gap-1">
                    {(profile.average_rating || (reviewStats?.total ?? 0) > 0) ? (
                      <>
                        <Star weight="fill" className="h-4 w-4 fill-amber-500" />
                        <span>{profile.average_rating ?? reviewStats?.average}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground font-medium">New seller</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Dynamic Activity Badges (Compact 3D Tokens, shown only if earned) */}
            {Array.isArray(profile.badges) && profile.badges.length > 0 && (
              <div className="pt-4 border-t border-border/60 mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground">Activity Badges</h3>
                </div>
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
                  {profile.badges.map((b) => (
                    <div
                      key={b.id || b.slug}
                      title={`${b.name} (${b.level_label || "Earned"}) - ${b.description || ""}`}
                      className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer transition-transform hover:scale-105"
                    >
                      <Badge3DRenderer type={b.icon_3d} size={38} />
                      <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground tracking-tight max-w-[56px] truncate text-center">
                        {b.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Native Link-in-Bio Shortcut */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border/60 mt-4">
              <a
                href={`/l/${profile.username}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A68D4]/10 text-[#1A68D4] text-xs font-bold hover:bg-[#1A68D4]/15 transition-colors border border-[#1A68D4]/20"
              >
                <ExternalLink weight="bold" className="h-3.5 w-3.5" />
                <span>{profileDomain()}/l/{profile.username}</span>
              </a>

              {profile.storefront && (
                <Link
                  to={`/store/${profile.storefront.short_code}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-foreground text-xs font-semibold hover:bg-muted/80 transition-colors border border-border"
                >
                  <Storefront weight="bold" className="h-3.5 w-3.5 text-[#1A68D4]" />
                  <span>{profile.storefront.display_name || "Official Storefront"}</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── CONTENT TABS NAVIGATION ────────────────────────────── */}
        <div className="flex items-center border-b border-border/80 gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("posts")}
            className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === "posts"
                ? "border-[#1A68D4] text-[#1A68D4]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <GridFour weight={activeTab === "posts" ? "bold" : "regular"} className="h-4 w-4" />
            <span>Posts</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono">{profile.posts_count ?? 0}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reels")}
            className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === "reels"
                ? "border-[#1A68D4] text-[#1A68D4]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FilmReel weight={activeTab === "reels" ? "bold" : "regular"} className="h-4 w-4" />
            <span>Reels &amp; Media</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("live")}
            className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === "live"
                ? "border-[#1A68D4] text-[#1A68D4]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Broadcast weight={activeTab === "live" ? "bold" : "regular"} className="h-4 w-4" />
            <span>Live</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("communities")}
            className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === "communities"
                ? "border-[#1A68D4] text-[#1A68D4]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users weight={activeTab === "communities" ? "bold" : "regular"} className="h-4 w-4" />
            <span>Communities</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono">
              {profile.public_communities?.length ?? 0}
            </span>
          </button>

          {(profile.role === "vendor" || (profile.reviews_count ?? 0) > 0 || (reviewStats?.total ?? 0) > 0) && (
            <button
              type="button"
              onClick={() => setActiveTab("reviews")}
              className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === "reviews"
                  ? "border-[#1A68D4] text-[#1A68D4]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Star weight={activeTab === "reviews" ? "fill" : "regular"} className="h-4 w-4 text-amber-500" />
              <span>Reviews</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono">
                {reviewStats?.total ?? profile.reviews_count ?? 0}
              </span>
            </button>
          )}
        </div>

        {/* ── TAB CONTENT: POSTS ─────────────────────────────────── */}
        {activeTab === "posts" && (
          <div>
            {postsLoading ? (
              <div className="py-16 text-center">
                <Loader2 weight="fill" className="h-7 w-7 animate-spin text-[#1A68D4] mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading posts...</p>
              </div>
            ) : tabPosts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/80 bg-card p-10 text-center space-y-3">
                <GridFour weight="regular" className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <h3 className="text-sm font-bold text-foreground">No posts published yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {isSelf
                    ? "You haven't published any posts yet. Head to your Feed or Creator Studio to share your first update."
                    : `@${profile.username} hasn't posted anything to their wall yet.`}
                </p>
                {isSelf && (
                  <Link to="/app">
                    <Button size="sm" className="h-8 text-xs font-bold bg-[#1A68D4] text-white hover:bg-[#1A68D4]/90 rounded-xl mt-2">
                      Create Post
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tabPosts.map((post) => (
                  <div
                    key={post.id}
                    className="group rounded-2xl bg-card border border-border/70 overflow-hidden shadow-sm hover:border-[#1A68D4]/50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {post.media_urls && post.media_urls.length > 0 && (
                        <div className="aspect-video w-full bg-slate-900 overflow-hidden relative">
                          <img
                            src={post.media_urls[0]}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {post.media_urls.length > 1 && (
                            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[10px] font-bold text-white">
                              +{post.media_urls.length - 1}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="p-4 space-y-2">
                        {post.community && (
                          <span className="text-[10px] font-bold text-[#1A68D4] bg-[#1A68D4]/10 px-2 py-0.5 rounded-full inline-block">
                            {post.community.name}
                          </span>
                        )}
                        <p className="text-xs text-foreground/90 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                          {post.content}
                        </p>
                      </div>
                    </div>

                    <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-semibold">
                          <Heart weight="bold" className="h-3.5 w-3.5 text-rose-500" />
                          {post.likes_count ?? post.reactions_count ?? 0}
                        </span>
                        <span className="flex items-center gap-1 font-semibold">
                          <ChatCircle weight="bold" className="h-3.5 w-3.5" />
                          {post.comments_count ?? 0}
                        </span>
                        {(post.views_count ?? 0) > 0 && (
                          <span className="flex items-center gap-1 font-semibold">
                            <Eye weight="bold" className="h-3.5 w-3.5" />
                            {post.views_count}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px]">
                        {new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT: REELS & MEDIA ─────────────────────────── */}
        {activeTab === "reels" && (
          <div>
            {postsLoading ? (
              <div className="py-16 text-center">
                <Loader2 weight="fill" className="h-7 w-7 animate-spin text-[#1A68D4] mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading media...</p>
              </div>
            ) : tabPosts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/80 bg-card p-10 text-center space-y-3">
                <FilmReel weight="regular" className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <h3 className="text-sm font-bold text-foreground">No reels or media published yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {isSelf
                    ? "You haven't uploaded any media or reels yet. Publish video content to engage your audience."
                    : `@${profile.username} hasn't posted any reels or media content.`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {tabPosts.map((reel) => (
                  <div
                    key={reel.id}
                    className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 border border-border shadow-sm cursor-pointer"
                  >
                    {reel.media_urls && reel.media_urls[0] && (
                      <img
                        src={reel.media_urls[0]}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-between p-3">
                      <div className="self-end">
                        <span className="p-1 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center">
                          <Play weight="fill" className="h-3 w-3" />
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-white line-clamp-2 font-medium drop-shadow-sm">
                          {reel.content}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-white/80 font-bold">
                          <span className="flex items-center gap-1">
                            <Heart weight="fill" className="h-3 w-3 text-rose-400" />
                            {reel.likes_count ?? 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <ChatCircle weight="fill" className="h-3 w-3" />
                            {reel.comments_count ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT: LIVE BROADCASTS ───────────────────────── */}
        {activeTab === "live" && (
          <div>
            {postsLoading ? (
              <div className="py-16 text-center">
                <Loader2 weight="fill" className="h-7 w-7 animate-spin text-[#1A68D4] mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading streams...</p>
              </div>
            ) : tabPosts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/80 bg-card p-10 text-center space-y-3">
                <Broadcast weight="regular" className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <h3 className="text-sm font-bold text-foreground">No active or recorded live streams</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {isSelf
                    ? "You haven't hosted any live stream broadcasts yet. Go live from the mobile app or web studio."
                    : `@${profile.username} has no recorded or active live streams at this time.`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tabPosts.map((live) => (
                  <div
                    key={live.id}
                    className="rounded-2xl bg-card border border-border p-4 space-y-3 shadow-sm flex items-start gap-3.5"
                  >
                    <div className="h-12 w-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                      <Broadcast weight="fill" className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-foreground truncate">{live.content || "Live Broadcast"}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Streamed on {new Date(live.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] font-semibold text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye weight="bold" className="h-3 w-3" /> {live.views_count ?? 0} views
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart weight="bold" className="h-3 w-3 text-rose-500" /> {live.likes_count ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT: COMMUNITIES ───────────────────────────── */}
        {activeTab === "communities" && (
          <div className="space-y-4">
            {(!profile.public_communities || profile.public_communities.length === 0) ? (
              <div className="rounded-3xl border border-dashed border-border/80 bg-card p-10 text-center space-y-3">
                <Users weight="regular" className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <h3 className="text-sm font-bold text-foreground">No public communities</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  @{profile.username} has not joined or created any public communities yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.public_communities.map((comm) => (
                  <Link
                    key={comm.id}
                    to={`/c/${comm.slug}`}
                    className="group rounded-2xl border border-border bg-card p-4 hover:border-[#1A68D4]/50 transition flex items-center gap-3.5 shadow-sm"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                      {comm.logo_url ? (
                        <img src={comm.logo_url} alt={comm.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users weight="fill" className="text-white/80 h-7 w-7" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-foreground group-hover:text-[#1A68D4] transition truncate">
                        {comm.name}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {comm.description || "Active community on MurihSpace."}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0">
                          {comm.members_count} member{comm.members_count === 1 ? "" : "s"}
                        </Badge>
                        <span className="text-[11px] font-bold text-[#1A68D4]">
                          {comm.pricing_type === "paid" ? `$${comm.price_amount}` : "Free"}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT: REVIEWS ───────────────────────────────── */}
        {activeTab === "reviews" && (
          <div className="space-y-6">
            {/* Rating Summary Card */}
            {reviewStats && reviewStats.total > 0 && (
              <div className="rounded-2xl bg-card border border-border p-5 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center shadow-sm">
                <div className="flex flex-col items-center justify-center text-center sm:border-r border-border/60 sm:pr-6">
                  <span className="text-4xl font-black text-foreground tracking-tight">
                    {reviewStats.average.toFixed(1)}
                  </span>
                  <div className="flex items-center gap-1 mt-1.5 text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        weight={s <= Math.round(reviewStats.average) ? "fill" : "regular"}
                        className={`h-4 w-4 ${s <= Math.round(reviewStats.average) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">
                    Based on {reviewStats.total} customer {reviewStats.total === 1 ? "review" : "reviews"}
                  </span>
                </div>

                {/* Rating Distribution Bars */}
                <div className="sm:col-span-2 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = reviewStats.distribution[String(stars)] || 0;
                    const pct = reviewStats.total > 0 ? (count / reviewStats.total) * 100 : 0;
                    return (
                      <div key={stars} className="flex items-center gap-3 text-xs">
                        <span className="w-12 text-muted-foreground font-semibold flex items-center gap-1">
                          {stars} <Star weight="fill" className="h-3 w-3 fill-amber-400 text-amber-400" />
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-mono text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reviews List */}
            {reviewsLoading ? (
              <div className="py-12 text-center bg-card rounded-2xl border border-border">
                <Loader2 weight="fill" className="h-6 w-6 animate-spin text-[#1A68D4] mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading reviews...</p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-card p-8 text-center space-y-2">
                <Star weight="regular" className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <h3 className="text-sm font-bold text-foreground">No customer reviews yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Verified customer purchases and ratings for products sold by {profile.name} will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((rev) => (
                  <div key={rev.id} className="rounded-2xl bg-card border border-border p-4 sm:p-5 space-y-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-[#1A68D4] flex items-center justify-center overflow-hidden shrink-0">
                          {rev.buyer?.avatar_url || rev.buyer?.avatar ? (
                            <img
                              src={rev.buyer.avatar_url || rev.buyer.avatar}
                              alt={rev.buyer.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <UserIcon weight="fill" className="text-white/90" style={{ width: 18, height: 18 }} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground">{rev.buyer?.name || "Verified Customer"}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <CheckCircle weight="fill" className="h-3 w-3" />
                              Verified Purchase
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {rev.buyer?.username ? `@${rev.buyer.username} • ` : ""}
                            {new Date(rev.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-0.5 text-amber-400 shrink-0">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            weight={s <= rev.rating ? "fill" : "regular"}
                            className={`h-3.5 w-3.5 ${s <= rev.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                    </div>

                    {rev.product && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 text-[11px] font-medium text-muted-foreground">
                        <span>Reviewed:</span>
                        <span className="font-semibold text-foreground truncate max-w-xs">{rev.product.title}</span>
                      </div>
                    )}

                    {rev.title && (
                      <h4 className="text-sm font-bold text-foreground">{rev.title}</h4>
                    )}
                    {rev.body && (
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{rev.body}</p>
                    )}

                    {rev.vendor_reply && (
                      <div className="mt-3 pl-3.5 border-l-2 border-[#1A68D4] bg-[#1A68D4]/5 dark:bg-[#1A68D4]/10 rounded-r-xl p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#1A68D4] flex items-center gap-1.5">
                            <Storefront weight="fill" className="h-3.5 w-3.5" />
                            Response from seller ({profile.name})
                          </span>
                          {rev.vendor_replied_at && (
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(rev.vendor_replied_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {rev.vendor_reply}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Guest Preview Gating Card */}
        {!isAuthenticated && (
          <div className="rounded-3xl border border-dashed border-border bg-muted/20 p-6 text-center space-y-3 mt-6">
            <div className="h-12 w-12 rounded-2xl bg-[#1A68D4]/10 text-[#1A68D4] flex items-center justify-center mx-auto">
              <Lock weight="fill" className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                Join MurihSpace to interact with {profile.name}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                Connect with creators, follow discussions, participate in live audio rooms, and access member storefronts.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-1">
              <Button
                onClick={() => {
                  setAuthModalReason({
                    title: `Connect with ${profile.name}`,
                    desc: "Create an account or sign in to start chatting, sharing content, and following.",
                  });
                  setIsAuthModalOpen(true);
                }}
                className="h-9 px-5 rounded-xl text-xs font-bold bg-[#1A68D4] text-white hover:bg-[#1A68D4]/90"
              >
                Create Account
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Auth Prompt Modal */}
      <AuthPromptModal
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        title={authModalReason.title}
        description={authModalReason.desc}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={profile.name}
        description={profile.bio || `Check out ${profile.name}'s profile on MurihSpace`}
        url={absolute(profileUrl(cleanUsername))}
        type="profile"
        imageUrl={profile.avatar_url || profile.avatar}
        badge={profile.role}
      />
    </div>
  );
}
