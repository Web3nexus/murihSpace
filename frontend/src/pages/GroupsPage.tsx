import * as React from "react";
import { useNavigate } from "react-router";
import {
  UsersThree,
  Plus,
  MagnifyingGlass,
  Globe,
  Lock,
  SpinnerGap,
  EnvelopeSimple,
  Compass,
  UserCheck,
  ArrowRight,
} from "@phosphor-icons/react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateGroupModal } from "@/components/groups/CreateGroupModal";
import type { Group, GroupInvitation } from "@/types/group";

const CATEGORIES = [
  "All",
  "Technology",
  "Creative & Art",
  "Business & Career",
  "Gaming",
  "Education & Study",
  "Fitness & Health",
  "Lifestyle & Hobbies",
];

function safeArray<T = any>(val: any): T[] {
  if (Array.isArray(val)) return val;
  if (Array.isArray(val?.data)) return val.data;
  if (Array.isArray(val?.data?.data)) return val.data.data;
  if (Array.isArray(val?.groups)) return val.groups;
  if (Array.isArray(val?.data?.groups)) return val.data.groups;
  if (val && typeof val === "object" && !("message" in val)) {
    const vals = Object.values(val);
    if (vals.length > 0 && typeof vals[0] === "object") {
      return vals as T[];
    }
  }
  return [];
}

export function GroupsPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = React.useState<"my" | "discover" | "invitations">("my");
  const [createModalOpen, setCreateModalOpen] = React.useState(false);

  // My Groups
  const [myGroups, setMyGroups] = React.useState<Group[]>([]);
  const [loadingMyGroups, setLoadingMyGroups] = React.useState(true);

  // Discover Groups
  const [discoverGroups, setDiscoverGroups] = React.useState<Group[]>([]);
  const [loadingDiscover, setLoadingDiscover] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("All");

  // Invitations
  const [invitations, setInvitations] = React.useState<GroupInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = React.useState(true);

  // Action loading state (join / accept / decline)
  const [actionId, setActionId] = React.useState<number | null>(null);

  // Safe memoized arrays
  const safeMyGroups = React.useMemo(() => safeArray<Group>(myGroups), [myGroups]);
  const safeDiscoverGroups = React.useMemo(() => safeArray<Group>(discoverGroups), [discoverGroups]);
  const safeInvitations = React.useMemo(() => safeArray<GroupInvitation>(invitations), [invitations]);

  // Fetch My Groups
  const fetchMyGroups = React.useCallback(async () => {
    try {
      setLoadingMyGroups(true);
      const res = await apiClient.get("/groups/mine");
      const list = safeArray<Group>(res.data);
      setMyGroups(list);
    } catch (err) {
      console.error("Failed to load my groups", err);
      setMyGroups([]);
    } finally {
      setLoadingMyGroups(false);
    }
  }, []);

  // Fetch Discover Groups
  const fetchDiscover = React.useCallback(async () => {
    try {
      setLoadingDiscover(true);
      const params = new URLSearchParams();
      if (selectedCategory !== "All") params.set("category", selectedCategory);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await apiClient.get(`/groups?${params}`);
      setDiscoverGroups(safeArray<Group>(res.data));
    } catch (err) {
      console.error("Failed to discover groups", err);
      setDiscoverGroups([]);
    } finally {
      setLoadingDiscover(false);
    }
  }, [selectedCategory, searchQuery]);

  // Fetch Invitations
  const fetchInvitations = React.useCallback(async () => {
    try {
      setLoadingInvitations(true);
      const res = await apiClient.get("/groups/invitations");
      setInvitations(safeArray<GroupInvitation>(res.data));
    } catch (err) {
      console.error("Failed to load invitations", err);
      setInvitations([]);
    } finally {
      setLoadingInvitations(false);
    }
  }, []);

  React.useEffect(() => {
    fetchMyGroups();
    fetchInvitations();
  }, [fetchMyGroups, fetchInvitations]);

  React.useEffect(() => {
    if (activeTab === "discover") {
      fetchDiscover();
    }
  }, [activeTab, fetchDiscover]);

  // Handle Join Group
  const handleJoinGroup = async (group: Group, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setActionId(group.id);
      const res = await apiClient.post(`/groups/${group.id}/join`);
      if (res.data?.status === "joined") {
        navigate(`/app/groups/${group.slug}`);
      } else {
        setDiscoverGroups((prev) =>
          prev.map((g) => (g.id === group.id ? { ...g, has_pending_request: true } : g))
        );
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to join group.");
    } finally {
      setActionId(null);
    }
  };

  // Handle Invitation Response
  const handleInvitationAction = async (inviteId: number, action: "accept" | "decline") => {
    try {
      setActionId(inviteId);
      const res = await apiClient.post(`/groups/invitations/${inviteId}/respond`, { action });
      setInvitations((prev) => prev.filter((i) => i.id !== inviteId));
      fetchMyGroups();
      if (action === "accept" && res.data?.group_slug) {
        navigate(`/app/groups/${res.data.group_slug}`);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to respond to invitation.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <UsersThree weight="fill" className="h-6 w-6" />
              <span className="text-xs font-bold uppercase tracking-wider">MurihSpace Social</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Groups
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Connect with focused spaces for real-time group chat, collaboration, and shared feeds.
            </p>
          </div>

          <Button
            onClick={() => setCreateModalOpen(true)}
            className="rounded-2xl px-5 h-11 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-sm gap-2"
          >
            <Plus weight="bold" className="h-4 w-4" />
            <span>Create Group</span>
          </Button>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-2xl border border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab("my")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "my"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCheck weight="bold" className="h-4 w-4" />
              <span>My Groups</span>
              {safeMyGroups.length > 0 && (
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-primary/15 text-primary">
                  {safeMyGroups.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("discover")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "discover"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Compass weight="bold" className="h-4 w-4" />
              <span>Discover</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("invitations")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "invitations"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <EnvelopeSimple weight="bold" className="h-4 w-4" />
              <span>Invitations</span>
              {safeInvitations.length > 0 && (
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-destructive text-destructive-foreground">
                  {safeInvitations.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Bar */}
          {activeTab === "discover" && (
            <div className="relative w-full sm:w-72">
              <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-card border-border/80 text-xs"
              />
            </div>
          )}
        </div>

        {/* Category Chips (Discover tab) */}
        {activeTab === "discover" && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-3.5 py-1.5 rounded-full border whitespace-nowrap transition-all font-medium ${
                  selectedCategory === cat
                    ? "bg-primary border-primary text-primary-foreground shadow-xs"
                    : "border-border/70 text-muted-foreground hover:border-border hover:bg-muted/40"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* TAB 1: MY GROUPS */}
        {activeTab === "my" && (
          <div>
            {loadingMyGroups ? (
              <div className="py-16 flex justify-center text-muted-foreground">
                <SpinnerGap className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : safeMyGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-3xl border border-dashed border-border/80 bg-card/40 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <UsersThree weight="fill" className="h-7 w-7" />
                </div>
                <div className="flex flex-col items-center justify-center text-center space-y-1 w-full">
                  <h3 className="text-lg font-bold text-foreground text-center">You haven't joined any groups yet</h3>
                  <p className="text-xs text-muted-foreground max-w-sm text-center mx-auto">
                    Explore groups in the Discover tab or start your own group to connect with others.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Button
                    onClick={() => setActiveTab("discover")}
                    variant="outline"
                    className="rounded-xl text-xs"
                  >
                    Discover Groups
                  </Button>
                  <Button
                    onClick={() => setCreateModalOpen(true)}
                    className="rounded-xl text-xs bg-primary text-primary-foreground font-semibold"
                  >
                    Create a Group
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {safeMyGroups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => navigate(`/app/groups/${group.slug}`)}
                    className="group relative rounded-3xl border border-border/80 bg-card/70 hover:bg-card hover:border-primary/40 hover:shadow-lg transition-all overflow-hidden cursor-pointer flex flex-col justify-between"
                  >
                    {/* Card Cover */}
                    <div className="relative h-28 w-full bg-gradient-to-r from-primary/30 to-secondary/30 overflow-hidden">
                      {group.cover_url ? (
                        <img
                          src={group.cover_url}
                          alt={group.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/15 via-background to-secondary/20" />
                      )}
                      <span className="absolute top-3 right-3 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-background/85 backdrop-blur-md border border-border/60">
                        {group.category}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 pt-0 relative flex-1 flex flex-col justify-between">
                      {/* Avatar */}
                      <div className="-mt-8 mb-3 flex items-end justify-between">
                        <div className="w-14 h-14 rounded-2xl bg-background border-2 border-background shadow-md overflow-hidden flex items-center justify-center font-bold text-primary text-xl">
                          {group.avatar_url ? (
                            <img
                              src={group.avatar_url}
                              alt={group.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            group.name.charAt(0).toUpperCase()
                          )}
                        </div>

                        {group.user_role && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                            {group.user_role}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 mb-4">
                        <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {group.name}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {group.description || "No description provided."}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium">
                          <UsersThree className="h-4 w-4 text-primary" />
                          {group.members_count} {group.members_count === 1 ? "member" : "members"}
                        </span>
                        <span className="flex items-center gap-1 text-primary font-semibold group-hover:translate-x-0.5 transition-transform">
                          Open <ArrowRight weight="bold" className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DISCOVER GROUPS */}
        {activeTab === "discover" && (
          <div>
            {loadingDiscover ? (
              <div className="py-16 flex justify-center text-muted-foreground">
                <SpinnerGap className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : safeDiscoverGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-3xl border border-dashed border-border/80 bg-card/40 space-y-3">
                <Compass className="h-12 w-12 mx-auto text-muted-foreground/60" />
                <div className="flex flex-col items-center justify-center text-center space-y-1 w-full">
                  <h3 className="text-base font-bold text-foreground text-center">No groups found</h3>
                  <p className="text-xs text-muted-foreground max-w-sm text-center mx-auto">
                    Try changing your search terms or category filter.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {safeDiscoverGroups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => navigate(`/app/groups/${group.slug}`)}
                    className="group relative rounded-3xl border border-border/80 bg-card/70 hover:bg-card hover:border-primary/40 hover:shadow-lg transition-all overflow-hidden cursor-pointer flex flex-col justify-between"
                  >
                    {/* Cover */}
                    <div className="relative h-28 w-full bg-gradient-to-r from-primary/30 to-secondary/30 overflow-hidden">
                      {group.cover_url ? (
                        <img
                          src={group.cover_url}
                          alt={group.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/15 via-background to-secondary/20" />
                      )}
                      <div className="absolute top-3 right-3 flex items-center gap-1">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-background/85 backdrop-blur-md border border-border/60">
                          {group.category}
                        </span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-5 pt-0 relative flex-1 flex flex-col justify-between">
                      <div className="-mt-8 mb-3 flex items-end justify-between">
                        <div className="w-14 h-14 rounded-2xl bg-background border-2 border-background shadow-md overflow-hidden flex items-center justify-center font-bold text-primary text-xl">
                          {group.avatar_url ? (
                            <img
                              src={group.avatar_url}
                              alt={group.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            group.name.charAt(0).toUpperCase()
                          )}
                        </div>

                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border/60 text-muted-foreground font-medium">
                          {group.privacy === "public" ? (
                            <>
                              <Globe className="h-3 w-3 text-emerald-500" /> Public
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3 text-amber-500" /> Private
                            </>
                          )}
                        </span>
                      </div>

                      <div className="space-y-1 mb-4">
                        <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {group.name}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {group.description || "No description provided."}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                          <UsersThree className="h-4 w-4 text-primary" />
                          {group.members_count} {group.members_count === 1 ? "member" : "members"}
                        </span>

                        {group.is_member ? (
                          <span className="text-xs font-semibold text-primary">Joined</span>
                        ) : group.has_pending_request ? (
                          <span className="text-xs font-medium text-muted-foreground">Pending</span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={(e) => handleJoinGroup(group, e)}
                            disabled={actionId === group.id}
                            className="rounded-xl h-8 px-3 text-xs bg-primary text-primary-foreground font-semibold"
                          >
                            {actionId === group.id ? (
                              <SpinnerGap className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Join"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: INVITATIONS */}
        {activeTab === "invitations" && (
          <div className="max-w-2xl mx-auto space-y-4">
            {loadingInvitations ? (
              <div className="py-16 flex justify-center text-muted-foreground">
                <SpinnerGap className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : safeInvitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-3xl border border-dashed border-border/80 bg-card/40 space-y-2">
                <EnvelopeSimple className="h-12 w-12 mx-auto text-muted-foreground/60" />
                <div className="flex flex-col items-center justify-center text-center space-y-1 w-full">
                  <h3 className="text-base font-bold text-foreground text-center">No pending invitations</h3>
                  <p className="text-xs text-muted-foreground max-w-sm text-center mx-auto">
                    When someone invites you to join a private group, you'll see it here.
                  </p>
                </div>
              </div>
            ) : (
              safeInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="p-5 rounded-3xl border border-border/80 bg-card/60 flex items-center justify-between gap-4 shadow-xs"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
                      {inv.group?.avatar_url ? (
                        <img src={inv.group.avatar_url} alt={inv.group.name} className="w-full h-full object-cover" />
                      ) : (
                        inv.group?.name?.charAt(0) || "G"
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{inv.group?.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        Invited by <span className="text-foreground font-medium">@{inv.inviter?.username || "creator"}</span>
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {inv.group?.members_count} members • {inv.group?.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleInvitationAction(inv.id, "accept")}
                      disabled={actionId === inv.id}
                      className="rounded-xl h-8 px-3.5 text-xs bg-primary text-primary-foreground font-semibold"
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleInvitationAction(inv.id, "decline")}
                      disabled={actionId === inv.id}
                      className="rounded-xl h-8 px-3 text-xs"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreated={(newGroup) => {
          navigate(`/app/groups/${newGroup.slug}`);
        }}
      />
    </div>
  );
}

export default GroupsPage;
