import * as React from "react";
import { useParams, Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, NotFoundState, EmptyState } from "@/components/common/UIStateComponents";
import { JoinCommunityButton } from "@/components/community/JoinCommunityButton";
import { JoinRequestsModal } from "@/components/community/JoinRequestsModal";
import { RoleManagementModal } from "@/components/community/RoleManagementModal";
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
  UserPlus,
} from "lucide-react";
import type { Community } from "@/types/community";

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

export function CommunityPreviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [community, setCommunity] = React.useState<Community | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Dynamic live member count
  const [membersCount, setMembersCount] = React.useState<number>(0);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = React.useState(false);
  const [isRolesModalOpen, setIsRolesModalOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"about" | "members">("about");

  const loadCommunity = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/communities/${slug}`);
      if (res.ok) {
        const data = await res.json();
        if (data.data?.community) {
          setCommunity(data.data.community);
          setMembersCount(data.data.community.members_count || 1);
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

  React.useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

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

  if (error) {
    return (
      <div className="max-w-5xl mx-auto">
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
      <div className="max-w-5xl mx-auto">
        <NotFoundState
          title="Community not found"
          description="The community you're looking for doesn't exist or may have been removed."
        />
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
                  <Globe className="h-3.5 w-3.5 text-secondary" /> Public
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5 text-warning" /> Private
                </span>
              )}
            </Badge>

            <Badge className="bg-[#38A8D8] text-white font-bold px-3 py-1 text-xs">
              {community.pricing_type === "paid"
                ? `$${community.price_amount}`
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
                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {community.name}
                </h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>Created by {community.creator?.name || "Community Host"}</span>
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
              <Link to={`/app/communities/${community.slug}/feed`}>
                <Button size="sm" className="gap-2 h-11 px-4 text-xs font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                  <Sparkles className="h-4 w-4" />
                  View Feed
                </Button>
              </Link>

              {/* Dynamic Stateful Join/Leave Button */}
              <JoinCommunityButton
                community={community}
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
                {community.description ||
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
      ) : (
        /* Members Directory Tab */
        <EmptyState
          icon={UserPlus}
          title="Members list coming soon"
          description="The member directory will be available once the community members API is connected."
        />
      )}

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
    </div>
  );
}
