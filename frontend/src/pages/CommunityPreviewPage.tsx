import { authFetch } from "@/lib/api/authFetch";
import * as React from "react";
import { useParams, Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, NotFoundState } from "@/components/common/UIStateComponents";
import { JoinCommunityButton } from "@/components/community/JoinCommunityButton";
import { JoinRequestsModal } from "@/components/community/JoinRequestsModal";
import { RoleManagementModal } from "@/components/community/RoleManagementModal";
import { SEOHead } from "@/components/common/SEOHead";
import { OpenInAppBanner } from "@/components/common/OpenInAppBanner";
import { AuthPromptModal } from "@/components/auth/AuthPromptModal";
import { useAuth } from "@/hooks/useAuth";
import {
  Users as Users,
  Globe as Globe,
  Lock as Lock,
  CheckCircle as CheckCircle2,
  ShieldWarning as ShieldWarning,
  ArrowLeft as ArrowLeft,
  ShareNetwork as Share2,
  ChatTeardropText as MessageSquare,
  Info as Info,
  CurrencyDollar as DollarSign,
  Clock as Clock,
  Key as Key,
  UserPlus as UserPlus,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  Spinner as Loader2,
  BookOpen as BookOpen,
  Check as Check
} from "@phosphor-icons/react";
import type { Community, CommunityMembership } from "@/types/community";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const MEMBER_ROLE_STYLES: Record<string, string> = {
  owner: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  admin: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  moderator: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  member: "bg-muted text-muted-foreground border-border",
};

export function CommunityPreviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user: currentUser } = useAuth();
  const [community, setCommunity] = React.useState<Community | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Auth prompt
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  const [authModalReason, setAuthModalReason] = React.useState<{ title: string; desc: string }>({
    title: "Join this Community on MurihSpace",
    desc: "Log in or create a free account to join communities, access exclusive feeds, courses, and participate in events.",
  });

  // Dynamic live member count
  const [membersCount, setMembersCount] = React.useState<number>(0);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = React.useState(false);
  const [isRolesModalOpen, setIsRolesModalOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"about" | "courses" | "members">("about");

  // Courses and Digital Goods
  interface CourseGoodItem {
    id: number | string;
    title: string;
    type: "COURSE" | "DIGITAL ASSET";
    lessons: string | number;
    price: string;
    access: string;
    image: string;
  }
  const [coursesGoods, setCoursesGoods] = React.useState<CourseGoodItem[]>([]);
  const [coursesGoodsLoading, setCoursesGoodsLoading] = React.useState(false);

  // Members directory
  const [members, setMembers] = React.useState<CommunityMembership[]>([]);
  const [membersLoading, setMembersLoading] = React.useState(false);
  const [membersError, setMembersError] = React.useState<string | null>(null);
  const [membersPage, setMembersPage] = React.useState(1);
  const [membersLastPage, setMembersLastPage] = React.useState(1);
  const [membersTotal, setMembersTotal] = React.useState(0);

  const loadCommunity = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/communities/${slug}`);
      if (res.ok) {
        const data = await res.json();
        const comm = data.data?.community || data.community || data.data;
        if (comm && comm.id) {
          setCommunity(comm);
          setMembersCount(comm.active_members_count ?? comm.members_count ?? 1);
          return;
        }
      }
      setError("Community not found.");
    } catch (e) {
      console.error('Failed to load community', e);
      setError("Unable to connect to the server. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  const handleShare = async () => {
    if (!community) return;
    const shareUrl = `${window.location.origin}/c/${community.slug}`;
    const shareData = {
      title: community.name,
      text: community.description || `Join ${community.name} on MurihSpace`,
      url: shareUrl,
    };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fallback
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleViewFeed = () => {
    if (!isAuthenticated) {
      setAuthModalReason({
        title: `Join ${community?.name}`,
        desc: "Log in or create a free account to view discussions, posts, and connect with members in this community.",
      });
      setIsAuthModalOpen(true);
      return;
    }
    navigate(`/app/communities/${community?.slug}/feed`);
  };

  React.useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  const loadMembers = React.useCallback(async () => {
    if (!community) return;
    setMembersLoading(true);
    setMembersError(null);
    try {
      const res = await authFetch(`/communities/${community.id}/members?page=${membersPage}`);
      if (res.ok) {
        const data = await res.json();
        const paginator = data?.data ?? data;
        setMembers(paginator?.data ?? []);
        setMembersLastPage(paginator?.last_page ?? 1);
        setMembersTotal(paginator?.total ?? 0);
        return;
      }
      setMembersError("Failed to load members.");
    } catch (e) {
      console.error('Failed to load members', e);
      setMembersError("Unable to load members.");
    } finally {
      setMembersLoading(false);
    }
  }, [community, membersPage]);

  const loadCoursesGoods = React.useCallback(async () => {
    setCoursesGoodsLoading(true);
    try {
      const items: CourseGoodItem[] = [];

      // Fetch Courses
      try {
        const res = await authFetch('/courses');
        if (res.ok) {
          const data = await res.json();
          const list = data?.data ?? [];
          for (const c of list) {
            const price = Number(c.price) || 0;
            const currency = c.currency || 'USD';
            items.push({
              id: `c-${c.id}`,
              title: c.title || 'Masterclass',
              type: 'COURSE',
              lessons: c.lessons_count || 0,
              price: price <= 0 ? 'FREE' : currency === 'USD' ? `$${price}` : `${currency} ${price}`,
              access: 'PUBLIC MARKETPLACE',
              image: c.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500',
            });
          }
        }
      } catch (_) {}

      // Fetch Digital Products
      try {
        const res = await authFetch('/digital/products');
        if (res.ok) {
          const data = await res.json();
          const list = data?.data ?? [];
          for (const p of list) {
            const price = Number(p.price) || 0;
            const currency = p.currency || 'USD';
            items.push({
              id: `p-${p.id}`,
              title: p.title || 'Digital Asset',
              type: 'DIGITAL ASSET',
              lessons: `${p.category || 'Digital'} Download`,
              price: p.is_free || price <= 0 ? 'FREE' : currency === 'USD' ? `$${price}` : `${currency} ${price}`,
              access: 'PUBLIC MARKETPLACE',
              image: p.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500',
            });
          }
        }
      } catch (_) {}

      setCoursesGoods(items);
    } catch (_) {
    } finally {
      setCoursesGoodsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (activeTab === "courses") {
      loadCoursesGoods();
    }
  }, [activeTab, loadCoursesGoods]);

  React.useEffect(() => {
    if (activeTab === "members" && community) {
      loadMembers();
    }
  }, [activeTab, community, loadMembers]);

  const handleStatusChange = (_newStatus: "active" | "pending" | "none", newCount: number) => {
    setMembersCount(newCount);
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-4 lg:p-5">
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
        <div className="h-32 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-4">
        <ErrorState
          title="Failed to load community"
          description={error}
          onRetry={loadCommunity}
        />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-4">
        <NotFoundState
          title="Community not found"
          description="The community you're looking for doesn't exist or may have been removed."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <SEOHead
        title={community.name}
        description={community.description || `Join ${community.name} on MurihSpace. Connect with creators, access exclusive courses, live streams, and digital goods.`}
        image={community.cover_url || community.logo_url}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": community.name,
          "description": community.description,
          "url": window.location.href,
          "logo": community.logo_url,
          "image": community.cover_url,
          "member": {
            "@type": "QuantitativeValue",
            "value": membersCount,
          },
        }}
      />

      {/* Mobile Open-In-App Smart Banner */}
      <OpenInAppBanner
        scheme={`murihspace://c/${community.slug}`}
        title={community.name}
        subtitle="Open in app to chat, join live audio, and access courses"
      />

      {/* Top Header / Back navigation */}
      <div className="flex items-center justify-between">
        <Link
          to={isAuthenticated ? "/app/communities" : "/communities"}
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft weight="fill" className="h-4 w-4" />
          Back to Communities Hub
        </Link>

        {/* Creator Control Actions (only for community owner or platform admin) */}
        {isAuthenticated && (currentUser?.id === community.user_id || currentUser?.role === "admin") && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRolesModalOpen(true)}
              className="gap-2 h-9 text-xs font-semibold border-border hover:bg-muted"
            >
              <Key weight="fill" className="h-3.5 w-3.5 text-secondary" />
              Roles & Permissions
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRequestsModalOpen(true)}
              className="gap-2 h-9 text-xs font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
            >
              <Clock weight="fill" className="h-3.5 w-3.5" />
              Join Requests Queue
            </Button>
          </div>
        )}
      </div>

      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden border-none bg-card ">
        {/* Cover Photo */}
        <div className="h-64 sm:h-80 w-full relative bg-gradient-to-r from-[#102840] via-[#173852] to-[#2164b6]/50">
          {community.cover_url && (
            <img
              src={community.cover_url}
              alt={community.name}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#102840] via-transparent to-transparent opacity-80" />

          {/* Visibility & Category Pills */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <Badge className="bg-background/90 text-foreground backdrop-blur-md font-bold px-3 py-1 text-xs">
              {community.visibility === "public" ? (
                <span className="flex items-center gap-1">
                  <Globe weight="fill" className="h-3.5 w-3.5 text-secondary" /> Public
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Lock weight="fill" className="h-3.5 w-3.5 text-warning" /> Private
                </span>
              )}
            </Badge>

            <Badge className="bg-[#2164b6] text-white font-bold px-3 py-1 text-xs">
              {community.pricing_type === "paid"
                ? `$${community.price_amount}`
                : "FREE ACCESS"}
            </Badge>
          </div>
        </div>

        {/* Community Info Header */}
        <div className="p-4 sm:p-5 pt-0 relative -mt-16 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            {/* Logo Avatar */}
            <div className="flex items-end gap-4">
              <div className="h-24 w-24 rounded-lg border-4 border-card bg-primary text-primary-foreground text-xl font-extrabold flex items-center justify-center shadow-xl overflow-hidden shrink-0">
                {community.logo_url ? (
                  <img
                    src={community.logo_url}
                    alt={community.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  community.name.charAt(0).toUpperCase()
                )}
              </div>

              <div className="space-y-1 pb-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-semibold">
                    {community.category}
                  </Badge>
                  <span className="text-xs text-white/70 font-mono">
                    /c/{community.slug}
                  </span>
                </div>
                <h1 className="text-xl sm:text-xl font-extrabold text-foreground tracking-tight">
                  {community.name}
                </h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>Created by {community.creator?.name || "Community Host"}</span>
                  <CheckCircle2 weight="fill" className="h-3.5 w-3.5 text-secondary fill-secondary/20" />
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 self-start sm:self-auto pt-2 sm:pt-0">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-11 px-4 text-xs font-semibold"
                onClick={handleShare}
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 weight="fill" className="h-4 w-4" />}
                {copied ? "Link Copied!" : "Share"}
              </Button>

              {/* Go to Feed */}
              <Button
                size="sm"
                onClick={handleViewFeed}
                className="gap-2 h-11 px-4 text-xs font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground"
              >
                <MessageSquare weight="fill" className="h-4 w-4" />
                View Feed
              </Button>

              {/* Dynamic Stateful Join/Leave Button */}
              <JoinCommunityButton
                community={community}
                onStatusChange={handleStatusChange}
                onGuestJoin={() => {
                  setAuthModalReason({
                    title: `Join ${community.name}`,
                    desc: "Create a free account or sign in to join this community, interact with creators, and post.",
                  });
                  setIsAuthModalOpen(true);
                }}
              />
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/50 border-none">
            <div>
              <p className="text-xs text-muted-foreground">Members</p>
              <p className="text-base font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                <Users weight="fill" className="h-4 w-4 text-secondary" />
                {membersCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pricing</p>
              <p className="text-base font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                <DollarSign weight="fill" className="h-4 w-4 text-secondary" />
                {community.pricing_type === "paid" ? `$${community.price_amount}` : "Free"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Visibility</p>
              <p className="text-base font-bold text-foreground capitalize mt-0.5">
                {community.visibility}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="text-base font-bold text-foreground mt-0.5">
                {community.category}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (About vs Courses vs Members) */}
      <div className="flex border-b border-border gap-4">
        <button
          onClick={() => setActiveTab("about")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "about"
              ? "border-secondary text-secondary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          About & Overview
        </button>
        <button
          onClick={() => setActiveTab("courses")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "courses"
              ? "border-secondary text-secondary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Courses & Digital Goods ({coursesGoods.length})
        </button>
        <button
          onClick={() => setActiveTab("members")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "members"
              ? "border-secondary text-secondary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Active Members ({membersCount})
        </button>
      </div>

      {/* Main Content Details — capped to same width as header area */}
      <div className="max-w-5xl mx-auto w-full">
      {activeTab === "about" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column: About & Description */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-lg border-none bg-card p-4 space-y-3 ">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Info weight="fill" className="h-4 w-4 text-secondary" />
                About this Community
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {community.description ||
                  "No description provided for this community space."}
              </p>
            </div>

            {/* Member Feed Preview for Guests */}
            {!isAuthenticated && (
              <div className="rounded-lg border-none/80 bg-card p-4  space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare weight="fill" className="h-4 w-4 text-secondary" />
                    <h4 className="text-sm font-bold text-foreground">Community Feed & Discussions</h4>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground gap-1">
                    <Lock weight="fill" className="h-3 w-3" /> Members Only
                  </Badge>
                </div>

                {/* Blurred mockup of posts */}
                <div className="relative overflow-hidden rounded-lg border-none bg-muted/20 p-4 space-y-3 filter blur-[2px] select-none pointer-events-none opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted-foreground/30" />
                    <div className="space-y-1">
                      <div className="h-3 w-28 rounded bg-muted-foreground/30" />
                      <div className="h-2 w-16 rounded bg-muted-foreground/20" />
                    </div>
                  </div>
                  <div className="h-3 w-full rounded bg-muted-foreground/20" />
                  <div className="h-3 w-3/4 rounded bg-muted-foreground/20" />
                </div>

                {/* CTA */}
                <div className="text-center pt-2 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Sign in or create a free account to join the conversation in <strong>{community.name}</strong>.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setAuthModalReason({
                          title: `Join ${community.name}`,
                          desc: "Log in or register to participate in discussions and unlock full member features.",
                        });
                        setIsAuthModalOpen(true);
                      }}
                      className="h-8 text-xs font-bold bg-secondary text-secondary-foreground hover:bg-secondary/90"
                    >
                      Join Community to View Feed
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Rules & Guidelines */}
          <div className="space-y-6">
            <div className="rounded-lg border-none bg-card p-4 space-y-4 ">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShieldWarning weight="fill" className="h-4 w-4 text-secondary" />
                Community Guidelines
              </h3>

              <div className="space-y-2.5">
                {community.rules && community.rules.length > 0 ? (
                  community.rules.map((rule, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary text-[11px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="pt-0.5 leading-snug">{rule}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Standard MurihSpace terms apply.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "courses" ? (
        /* Courses & Digital Goods Tab */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <BookOpen weight="fill" className="h-5 w-5 text-secondary" />
                In-Community Courses & Digital Assets
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exclusive content for members and public educational resources.
              </p>
            </div>
          </div>

          {coursesGoodsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 rounded-lg bg-muted animate-pulse border-none" />
              ))}
            </div>
          ) : coursesGoods.length === 0 ? (
            <div className="rounded-lg border-none bg-card p-12 text-center space-y-3">
              <BookOpen weight="fill" className="h-10 w-10 text-muted-foreground mx-auto" />
              <h4 className="font-bold text-foreground text-base">No Courses or Digital Assets Yet</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No courses or downloadable goods have been published in this community yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coursesGoods.map((item) => (
                <div key={item.id} className="rounded-lg border-none bg-card overflow-hidden flex flex-col justify-between  hover:border-secondary/50 transition">
                  <div>
                    <img src={item.image} alt={item.title} className="w-full h-40 object-cover" />
                    <div className="p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-bold text-secondary border-secondary/30">
                          {item.type}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          {item.access}
                        </Badge>
                      </div>
                      <h4 className="font-bold text-foreground text-sm line-clamp-2">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">{typeof item.lessons === 'number' ? `${item.lessons} lessons` : item.lessons}</p>
                    </div>
                  </div>
                  <div className="p-5 pt-0 flex items-center justify-between border-t border-border mt-3">
                    <span className="font-extrabold text-sm text-emerald-500">{item.price}</span>
                    <Button size="sm" className="bg-secondary text-secondary-foreground text-xs font-semibold">
                      {item.access === "MEMBERS ONLY" ? "Join to Unlock" : "Access Now"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Members Directory Tab */
        <div className="rounded-lg border-none bg-card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Users weight="fill" className="h-4 w-4 text-secondary" />
                Active Members
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {membersTotal} member{membersTotal === 1 ? "" : "s"} in this community
              </p>
            </div>
          </div>

          {membersLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 weight="fill" className="h-6 w-6 animate-spin text-secondary" />
            </div>
          ) : membersError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-semibold text-muted-foreground">{membersError}</p>
              <Button size="sm" variant="outline" className="mt-4" onClick={loadMembers}>Retry</Button>
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <UserPlus weight="fill" className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="font-semibold text-base mt-4">No members yet</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Members who join this community will appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 sm:p-5">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border-none bg-card p-3 hover:border-secondary/40 transition-colors"
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      {m.user?.avatar ? (
                        <AvatarImage src={m.user.avatar} alt={m.user?.name ?? "Member"} />
                      ) : null}
                      <AvatarFallback className="bg-secondary/15 text-secondary text-sm font-bold">
                        {(m.user?.name ?? "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{m.user?.name ?? "Unknown Member"}</p>
                      <p className="text-xs text-muted-foreground truncate">@{m.user?.username ?? "unknown"}</p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold capitalize ${MEMBER_ROLE_STYLES[m.role] ?? MEMBER_ROLE_STYLES.member}`}>
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>

              {membersLastPage > 1 && (
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Page {membersPage} of {membersLastPage}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={membersPage <= 1}
                      onClick={() => setMembersPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft weight="fill" className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={membersPage >= membersLastPage}
                      onClick={() => setMembersPage((p) => Math.min(membersLastPage, p + 1))}
                    >
                      <ChevronRight weight="fill" className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      </div>

      {/* Creator Join Requests Modal */}
      <JoinRequestsModal
        open={isRequestsModalOpen}
        onOpenChange={setIsRequestsModalOpen}
        communityId={community.id}
        communityName={community.name}
      />

      {/* Roles & Permissions Modal */}
      <RoleManagementModal
        open={isRolesModalOpen}
        onOpenChange={setIsRolesModalOpen}
        communityId={community.id}
        communityName={community.name}
      />

      {/* Auth Prompt Modal for Guests */}
      <AuthPromptModal
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        title={authModalReason.title}
        description={authModalReason.desc}
      />
    </div>
  );
}
