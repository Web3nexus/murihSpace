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
  BadgeCheck,
  Calendar,
  MapPin,
  Share2,
  Users,
  MessageSquare,
  UserPlus,
  UserCheck,
  Store,
  ExternalLink,
  Lock,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Check,
} from "lucide-react";

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
      const data: PublicUserProfile = json?.data ?? json;
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

  React.useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">User Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          The user @{cleanUsername} does not exist or may have changed their username.
        </p>
        <Link
          to={isAuthenticated ? "/app" : "/"}
          className="text-xs font-bold text-secondary hover:underline inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Go to MurihSpace
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
            <ArrowLeft className="h-4 w-4" />
            <span>{isAuthenticated ? "Dashboard" : "MurihSpace"}</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5" />}
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
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
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
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-4 border-card bg-primary text-primary-foreground flex items-center justify-center overflow-hidden text-3xl font-black shadow-xl shrink-0">
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
                    <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                      {profile.name}
                    </h1>
                    {(profile.has_active_verification_badge || profile.kyc_status === "verified") && (
                      <BadgeCheck className="h-5 w-5 text-secondary fill-secondary/20 shrink-0" />
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
                          ? "bg-muted text-foreground hover:bg-muted/80 border border-border"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="h-3.5 w-3.5" /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5" /> Follow
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleMessageClick}
                      className="h-9 text-xs font-semibold gap-1.5 border-border hover:bg-muted"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-secondary" /> Message
                    </Button>
                  </>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShare}
                  className="h-9 text-xs font-semibold gap-1.5 border-border hover:bg-muted"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Role & Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary text-[11px] font-bold capitalize">
                {profile.role || "Member"}
              </span>
              {profile.country && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {profile.country}
                </span>
              )}
              {joinDate && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" /> Joined {joinDate}
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
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-muted/40 border border-border/80">
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
              <div className="hidden sm:block">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Posts</p>
                <p className="text-lg font-extrabold text-foreground mt-0.5">{profile.posts_count ?? 0}</p>
              </div>
            </div>

            {/* Quick Link-in-Bio & Store Shortcuts */}
            {(profile.has_link_in_bio || profile.storefront) && (
              <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-border/60 mt-5">
                {profile.has_link_in_bio && (
                  <Link to={`/l/${profile.username}`}>
                    <Button variant="outline" size="sm" className="gap-2 h-9 text-xs font-bold border-secondary/30 text-secondary hover:bg-secondary/10">
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Link in Bio
                    </Button>
                  </Link>
                )}

                {profile.storefront && (
                  <Link to={`/store/${profile.storefront.short_code}`}>
                    <Button variant="outline" size="sm" className="gap-2 h-9 text-xs font-bold border-border hover:bg-muted">
                      <Store className="h-3.5 w-3.5 text-secondary" />
                      Visit {profile.storefront.display_name || "Store"}
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
                <Users className="h-4 w-4 text-secondary" />
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
                  className="group rounded-2xl border border-border bg-card p-4 hover:border-secondary/50 hover:shadow-sm transition flex items-center gap-3.5"
                >
                  <div className="h-14 w-14 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center overflow-hidden shrink-0">
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

        {/* Guest Preview Gating Card */}
        {!isAuthenticated && (
          <div className="rounded-3xl border border-dashed border-border/90 bg-muted/20 p-8 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center mx-auto">
              <Lock className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                Join MurihSpace to interact with {profile.name}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
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
                className="h-9 px-5 font-bold text-xs bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-sm"
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
