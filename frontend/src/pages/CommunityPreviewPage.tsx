import * as React from "react";
import { useParams, Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { JoinCommunityButton } from "@/components/community/JoinCommunityButton";
import { JoinRequestsModal } from "@/components/community/JoinRequestsModal";
import { RoleManagementModal } from "@/components/community/RoleManagementModal";
import { RoleBadge } from "@/components/community/RoleBadge";
import {
  Users,
  Globe,
  Lock,
  CheckCircle2,
  ShieldAlert,
  ArrowLeft,
  Share2,
  Sparkles,
  DollarSign,
  Clock,
  Key,
} from "lucide-react";
import type { Community, CommunityCreator } from "@/types/community";

const DEMO_MEMBERS: (CommunityCreator & { roleName?: string })[] = [
  { id: 1, name: "Elena Rivera", username: "elenarivera", bio: "Creator Pro Host", roleName: "owner" },
  { id: 2, name: "Marcus Chen", username: "marcuschen", bio: "UI/UX Lead", roleName: "admin" },
  { id: 3, name: "Sarah Jenkins", username: "sarahjenkins", bio: "Moderation Team", roleName: "moderator" },
  { id: 4, name: "Alex Morgan", username: "alexmorgan", bio: "AI Developer", roleName: "member" },
  { id: 5, name: "David Kim", username: "davidkim", bio: "Product Manager", roleName: "member" },
];

export function CommunityPreviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [community, setCommunity] = React.useState<Community | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Dynamic live member count
  const [membersCount, setMembersCount] = React.useState<number>(892);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = React.useState(false);
  const [isRolesModalOpen, setIsRolesModalOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"about" | "members">("about");

  React.useEffect(() => {
    async function loadCommunity() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/v1/communities/${slug}`);
        if (res.ok) {
          const data = await res.json();
          if (data.community) {
            setCommunity(data.community);
            setMembersCount(data.community.members_count || 1);
          }
        }
      } catch {
        // Fallback demo community if API is offline
      } finally {
        setIsLoading(false);
      }
    }
    loadCommunity();
  }, [slug]);

  // Fallback mock data if community isn't loaded from API
  const displayCommunity: Community = community || {
    id: 999,
    user_id: 1,
    name: slug
      ? slug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "Murih Space Community",
    slug: slug || "murih-space-community",
    description:
      "Welcome to this exclusive creator space on MurihSpace. Connect with like-minded creators, participate in live audio rooms, share knowledge, and access premium digital assets.",
    category: "Technology",
    visibility: "public",
    pricing_type: "free",
    members_count: membersCount,
    logo_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80",
    cover_url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80",
    creator: { id: 1, name: "Elena Rivera", username: "elenarivera" },
    rules: [
      "Be respectful and supportive to all community members.",
      "No spam, self-promotion, or unauthorized link dumping.",
      "Engage constructively and share valuable insights.",
      "Protect private community discussions and member data.",
    ],
    created_at: "2026-07-01",
  };

  const handleStatusChange = (_newStatus: "active" | "pending" | "none", newCount: number) => {
    setMembersCount(newCount);
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-64 rounded-2xl bg-muted animate-pulse" />
        <div className="h-32 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back button & Creator Actions */}
      <div className="flex items-center justify-between">
        <Link
          to="/app/communities"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Communities Hub
        </Link>

        {/* Creator Control Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRolesModalOpen(true)}
            className="gap-2 h-9 text-xs font-semibold border-border hover:bg-muted"
          >
            <Key className="h-3.5 w-3.5 text-secondary" />
            Roles & Permissions
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRequestsModalOpen(true)}
            className="gap-2 h-9 text-xs font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
          >
            <Clock className="h-3.5 w-3.5" />
            Join Requests Queue
          </Button>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-border bg-card shadow-md">
        {/* Cover Photo */}
        <div className="h-64 sm:h-80 w-full relative bg-gradient-to-r from-[#102840] via-[#173852] to-[#38A8D8]/50">
          {displayCommunity.cover_url && (
            <img
              src={displayCommunity.cover_url}
              alt={displayCommunity.name}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#102840] via-transparent to-transparent opacity-80" />

          {/* Visibility & Category Pills */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <Badge className="bg-background/90 text-foreground backdrop-blur-md font-bold px-3 py-1 text-xs">
              {displayCommunity.visibility === "public" ? (
                <span className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-secondary" /> Public
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5 text-warning" /> Private
                </span>
              )}
            </Badge>

            <Badge className="bg-[#38A8D8] text-white font-bold px-3 py-1 text-xs">
              {displayCommunity.pricing_type === "paid"
                ? `$${displayCommunity.price_amount}`
                : "FREE ACCESS"}
            </Badge>
          </div>
        </div>

        {/* Community Info Header */}
        <div className="p-6 sm:p-8 pt-0 relative -mt-16 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            {/* Logo Avatar */}
            <div className="flex items-end gap-4">
              <div className="h-24 w-24 rounded-2xl border-4 border-card bg-primary text-primary-foreground text-3xl font-extrabold flex items-center justify-center shadow-xl overflow-hidden shrink-0">
                {displayCommunity.logo_url ? (
                  <img
                    src={displayCommunity.logo_url}
                    alt={displayCommunity.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  displayCommunity.name.charAt(0).toUpperCase()
                )}
              </div>

              <div className="space-y-1 pb-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-semibold">
                    {displayCommunity.category}
                  </Badge>
                  <span className="text-xs text-white/70 font-mono">
                    /c/{displayCommunity.slug}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {displayCommunity.name}
                </h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>Created by {displayCommunity.creator?.name || "Community Host"}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-secondary fill-secondary/20" />
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 self-start sm:self-auto pt-2 sm:pt-0">
              <Button variant="outline" size="sm" className="gap-2 h-11 px-4 text-xs font-semibold">
                <Share2 className="h-4 w-4" />
                Share
              </Button>

              {/* Go to Feed */}
              <Link to={`/app/communities/${displayCommunity.slug}/feed`}>
                <Button size="sm" className="gap-2 h-11 px-4 text-xs font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                  <Sparkles className="h-4 w-4" />
                  View Feed
                </Button>
              </Link>

              {/* Dynamic Stateful Join/Leave Button */}
              <JoinCommunityButton
                community={displayCommunity}
                onStatusChange={handleStatusChange}
              />
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/50 border border-border">
            <div>
              <p className="text-xs text-muted-foreground">Members</p>
              <p className="text-base font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                <Users className="h-4 w-4 text-secondary" />
                {membersCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pricing</p>
              <p className="text-base font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                <DollarSign className="h-4 w-4 text-secondary" />
                {displayCommunity.pricing_type === "paid" ? `$${displayCommunity.price_amount}` : "Free"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Visibility</p>
              <p className="text-base font-bold text-foreground capitalize mt-0.5">
                {displayCommunity.visibility}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="text-base font-bold text-foreground mt-0.5">
                {displayCommunity.category}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (About vs Members) */}
      <div className="flex border-b border-border gap-6">
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

      {/* Main Content Details */}
      {activeTab === "about" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: About & Description */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-3 shadow-xs">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-secondary" />
                About this Community
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {displayCommunity.description ||
                  "No description provided for this community space."}
              </p>
            </div>
          </div>

          {/* Right Column: Rules & Guidelines */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xs">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-secondary" />
                Community Guidelines
              </h3>

              <div className="space-y-2.5">
                {displayCommunity.rules && displayCommunity.rules.length > 0 ? (
                  displayCommunity.rules.map((rule, idx) => (
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
      ) : (
        /* Members Directory Tab with Role Badges */
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-secondary" />
              Community Members List
            </h3>
            <span className="text-xs text-muted-foreground">{membersCount} active members</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {DEMO_MEMBERS.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-muted/30 hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0 rounded-lg">
                    <AvatarImage src={m.avatar} alt={m.name} />
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                      {m.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-foreground truncate">{m.name}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">@{m.username}</p>
                    {m.bio && <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">{m.bio}</p>}
                  </div>
                </div>

                <RoleBadge role={m.roleName} isOwner={m.roleName === "owner"} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Creator Join Requests Modal */}
      <JoinRequestsModal
        open={isRequestsModalOpen}
        onOpenChange={setIsRequestsModalOpen}
        communityId={displayCommunity.id}
        communityName={displayCommunity.name}
      />

      {/* Roles & Permissions Modal */}
      <RoleManagementModal
        open={isRolesModalOpen}
        onOpenChange={setIsRolesModalOpen}
        communityId={displayCommunity.id}
        communityName={displayCommunity.name}
      />
    </div>
  );
}
