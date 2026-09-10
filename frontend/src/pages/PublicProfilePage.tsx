import * as React from "react";
import { useParams, Link } from "react-router";
import { authFetch } from "@/lib/api/authFetch";
import { useAuth } from "@/hooks/useAuth";
import { SEOHead } from "@/components/common/SEOHead";
import { OpenInAppBanner } from "@/components/common/OpenInAppBanner";
import { AuthPromptModal } from "@/components/auth/AuthPromptModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SealCheck as BadgeCheck,
  Calendar as Calendar,
  MapPin as MapPin,
  ShareNetwork as Share2,
  Users as Users,
  ChatTeardropText as MessageSquare,
  UserPlus as UserPlus,
  UserCheck as UserCheck,
  Storefront,
  ArrowSquareOut as ExternalLink,
  Lock as Lock,
  Spinner as Loader2,
  Warning as AlertTriangle,
  ArrowLeft as ArrowLeft,
  Check as Check,
  Star as Star,
  CheckCircle as CheckCircle
} from "@phosphor-icons/react";

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
  created_at?: string;
}

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const cleanUsername = (username ?? "").replace(/^@/, "");

  const { isAuthenticated, user: currentUser } = useAuth();
  const [profile, setProfile] = React.useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

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

  const isSelf = isAuthenticated && currentUser?.username === cleanUsername;

  const loadProfile = React.useCallback(async () => {
    if (!cleanUsername) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await authFetch(`/users/${encodeURIComponent(cleanUsername)}/public`);
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

  React.useEffect(() => {
    loadProfile();
    loadReviews();
  }, [loadProfile, loadReviews]);

  const handleShare = async () => {
    const url = `${window.location.origin}/u/${cleanUsername}`;
    const shareData = {
      title: `${profile?.name || cleanUsername} on MurihSpace`,
      text: `Check out ${profile?.name || cleanUsername}'s profile on MurihSpace`,
      url,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore
    }
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
        desc: "Log in or create a free account to send direct messages and connect on MurihSpace.",
      });
      setIsAuthModalOpen(true);
      return;
    }
    window.location.href = `/app/messages?user=${profile?.id}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 weight="fill" className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle weight="fill" className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">User Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          The user @{cleanUsername} does not exist or may have changed their username.
        </p>
        <Link
          to={isAuthenticated ? "/app" : "/"}
          className="text-xs font-bold text-secondary hover:underline inline-flex items-center gap-1.5"
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

      {/* Top Navbar */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
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
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 weight="fill" className="h-3.5 w-3.5" />}
              {copied ? "Link Copied!" : "Share"}
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
                className="h-8 text-xs font-bold bg-secondary text-secondary-foreground hover:bg-secondary/90"
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
        <div className="overflow-hidden rounded-3xl border-none bg-card ">
          {/* Banner */}
          <div className="h-40 sm:h-52 w-full bg-gradient-to-r from-[#102840] via-[#173852] to-[#2164b6]/40 relative overflow-hidden">
            {profile.banner_url && (
              <img src={profile.banner_url} alt="" className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>

          {/* Profile Meta Area */}
          <div className="px-6 pb-6 pt-0 relative">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-16 sm:-mt-20 mb-4 gap-4">
              {/* Avatar + Basic Names */}
              <div className="flex items-end gap-4">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-4 border-card bg-primary text-primary-foreground flex items-center justify-center overflow-hidden text-xl font-black shadow-xl shrink-0">
                  {profile.avatar_url || profile.avatar ? (
                    <img
                      src={profile.avatar_url || profile.avatar}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (profile.name || "U").charAt(0).toUpperCase()
                  )}
                </div>

                <div className="pb-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-xl font-extrabold text-foreground tracking-tight">
                      {profile.name}
                    </h1>
                    {(profile.has_active_verification_badge || profile.kyc_status === "verified") && (
                      <BadgeCheck weight="fill" className="h-5 w-5 text-secondary fill-secondary/20 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">@{profile.username}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pb-1">
                {isSelf ? (
                  <Link to="/app/settings/profile">
                    <Button size="sm" variant="outline" className="h-9 text-xs font-semibold gap-1.5">
                      Edit Profile
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={handleFollowClick}
                      disabled={followLoading}
                      className={`h-9 text-xs font-bold gap-1.5 ${
                        isFollowing
                          ? "bg-muted text-foreground hover:bg-muted/80 border-none"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck weight="fill" className="h-3.5 w-3.5" /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus weight="fill" className="h-3.5 w-3.5" /> Follow
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleMessageClick}
                      className="h-9 text-xs font-semibold gap-1.5 border-border hover:bg-muted"
                    >
                      <MessageSquare weight="fill" className="h-3.5 w-3.5 text-secondary" /> Message
                    </Button>
                  </>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShare}
                  className="h-9 text-xs font-semibold gap-1.5 border-border hover:bg-muted"
                >
                  <Share2 weight="fill" className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Role & Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary text-[11px] font-bold capitalize">
                {profile.role || "Member"}
              </span>
              {(profile.average_rating || (reviewStats?.total ?? 0) > 0) && (
                <span className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                  <Star weight="fill" className="h-3.5 w-3.5 fill-amber-500" />
                  <span>{profile.average_rating ?? reviewStats?.average}</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    ({profile.reviews_count ?? reviewStats?.total} {(profile.reviews_count ?? reviewStats?.total) === 1 ? "review" : "reviews"})
                  </span>
                </span>
              )}
              {profile.country && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin weight="fill" className="h-3.5 w-3.5" /> {profile.country}
                </span>
              )}
              {joinDate && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar weight="fill" className="h-3.5 w-3.5" /> Joined {joinDate}
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
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 p-4 rounded-xl bg-muted/40 border-none/80">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Followers</p>
                <p className="text-lg font-extrabold text-foreground mt-0.5">{followersCount}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Following</p>
                <p className="text-lg font-extrabold text-foreground mt-0.5">{profile.following_count ?? 0}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Communities</p>
                <p className="text-lg font-extrabold text-foreground mt-0.5">{profile.communities_count ?? 0}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Posts</p>
                <p className="text-lg font-extrabold text-foreground mt-0.5">{profile.posts_count ?? 0}</p>
              </div>
              {(profile.role === "vendor" || (profile.reviews_count ?? 0) > 0 || (reviewStats?.total ?? 0) > 0) && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Rating</p>
                  <p className="text-lg font-extrabold text-amber-500 mt-0.5 flex items-center gap-1">
                    {(profile.average_rating || (reviewStats?.total ?? 0) > 0) ? (
                      <>
                        <Star weight="fill" className="h-4 w-4 fill-amber-500" />
                        <span>{profile.average_rating ?? reviewStats?.average}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          ({profile.reviews_count ?? reviewStats?.total})
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground font-medium">New seller</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Link-in-Bio & Storefront Shortcuts */}
            {(profile.has_link_in_bio || profile.storefront) && (
              <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-border/60 mt-5">
                {profile.has_link_in_bio && (
                  <Link to={`/l/${profile.username}`}>
                    <Button variant="outline" size="sm" className="gap-2 h-9 text-xs font-bold border-secondary/30 text-secondary hover:bg-secondary/10">
                      <ExternalLink weight="fill" className="h-3.5 w-3.5" />
                      View Link in Bio
                    </Button>
                  </Link>
                )}

                {profile.storefront && (
                  <Link to={`/store/${profile.storefront.short_code}`}>
                    <Button variant="outline" size="sm" className="gap-2 h-9 text-xs font-bold border-border hover:bg-muted">
                      <Storefront weight="fill" className="h-3.5 w-3.5 text-secondary" />
                      Visit {profile.storefront.display_name || "Storefront"}
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Public Communities */}
        {profile.public_communities && profile.public_communities.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Users weight="fill" className="h-4 w-4 text-secondary" />
                Communities
              </h2>
              <span className="text-xs text-muted-foreground">
                {profile.public_communities.length} public space{profile.public_communities.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profile.public_communities.map((comm) => (
                <Link
                  key={comm.id}
                  to={`/c/${comm.slug}`}
                  className="group rounded-lg border-none bg-card p-4 hover:border-secondary/50 hover: transition flex items-center gap-3.5"
                >
                  <div className="h-14 w-14 rounded-lg bg-primary text-primary-foreground font-bold flex items-center justify-center overflow-hidden shrink-0">
                    {comm.logo_url ? (
                      <img src={comm.logo_url} alt={comm.name} className="w-full h-full object-cover" />
                    ) : (
                      comm.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-foreground group-hover:text-secondary transition truncate">
                      {comm.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {comm.description || "Active community on MurihSpace."}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0">
                        {comm.members_count} member{comm.members_count === 1 ? "" : "s"}
                      </Badge>
                      <span className="text-[11px] font-bold text-secondary">
                        {comm.pricing_type === "paid" ? `$${comm.price_amount}` : "Free"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Customer Reviews & Store Feedback */}
        {(profile.role === "vendor" || profile.storefront || reviews.length > 0 || (reviewStats?.total ?? 0) > 0) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Star weight="fill" className="h-4 w-4 text-amber-400 fill-amber-400" />
                Customer Reviews & Ratings
              </h2>
              <span className="text-xs text-muted-foreground">
                {(reviewStats?.total ?? reviews.length)} {((reviewStats?.total ?? reviews.length) === 1) ? "review" : "reviews"}
              </span>
            </div>

            {/* Rating Summary Card if ratings exist */}
            {reviewStats && reviewStats.total > 0 && (
              <div className="rounded-2xl bg-card border border-border/70 p-5 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
                <div className="flex flex-col items-center justify-center text-center sm:border-r border-border/60 sm:pr-6">
                  <span className="text-4xl font-extrabold text-foreground tracking-tight">
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
              <div className="p-8 text-center bg-card rounded-2xl border border-border/60">
                <Loader2 weight="fill" className="h-6 w-6 animate-spin text-secondary mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading reviews...</p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-card p-6 text-center space-y-2">
                <Star weight="regular" className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <h3 className="text-sm font-bold text-foreground">No customer reviews yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Verified customer purchases and ratings for products sold by {profile.name} will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((rev) => (
                  <div key={rev.id} className="rounded-2xl bg-card border border-border/60 p-4 sm:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                          {rev.buyer?.avatar_url || rev.buyer?.avatar ? (
                            <img
                              src={rev.buyer.avatar_url || rev.buyer.avatar}
                              alt={rev.buyer.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (rev.buyer?.name || "B").charAt(0).toUpperCase()
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

                    {/* Product Tag */}
                    {rev.product && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 text-[11px] font-medium text-muted-foreground">
                        <span>Reviewed:</span>
                        <span className="font-semibold text-foreground truncate max-w-xs">{rev.product.title}</span>
                      </div>
                    )}

                    {/* Review content */}
                    {rev.title && (
                      <h4 className="text-sm font-bold text-foreground">{rev.title}</h4>
                    )}
                    {rev.body && (
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{rev.body}</p>
                    )}

                    {/* Vendor official reply */}
                    {rev.vendor_reply && (
                      <div className="mt-3 pl-3.5 border-l-2 border-secondary bg-secondary/5 dark:bg-secondary/10 rounded-r-xl p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-secondary flex items-center gap-1.5">
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
          <div className="rounded-3xl border border-dashed border-border/90 bg-muted/20 p-5 text-center space-y-4">
            <div className="h-12 w-12 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center mx-auto">
              <Lock weight="fill" className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                Join MurihSpace to interact with {profile.name}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed text-center">
                Connect with creators, participate in live audio rooms, access digital products, and join discussions in member communities.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                onClick={() => {
                  setAuthModalReason({
                    title: `Connect with ${profile.name}`,
                    desc: "Create a free account or log in to start following and chatting.",
                  });
                  setIsAuthModalOpen(true);
                }}
                className="h-9 px-5 font-bold text-xs bg-secondary text-secondary-foreground hover:bg-secondary/90 "
              >
                Sign Up Free
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAuthModalReason({
                    title: "Welcome Back",
                    desc: "Log in to your MurihSpace account.",
                  });
                  setIsAuthModalOpen(true);
                }}
                className="h-9 px-5 font-semibold text-xs border-border hover:bg-muted"
              >
                Log In
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
    </div>
  );
}
