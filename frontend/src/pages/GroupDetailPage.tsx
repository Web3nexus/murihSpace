import * as React from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  UsersThree,
  Globe,
  Lock,
  ShieldCheck,
  Gear,
  ChatCircleDots,
  Newspaper,
  Users,
  Info,
  UserPlus,
  Check,
  Copy,
  Trash,
  SpinnerGap,
  Hourglass,
  ArrowLeft,
  MapPin,
  Warning,
  User as UserIcon,
  ShareNetwork,
  Sparkle,
  MagnifyingGlass,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { GroupChatView } from "@/components/groups/GroupChatView";
import PostCard from "@/components/feed/PostCard";
import type {
  Group,
  GroupMember,
  GroupJoinRequest,
} from "@/types/group";
import type { Post } from "@/types/post";

export function GroupDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = React.useState<Group | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<
    "chat" | "feed" | "members" | "about" | "settings"
  >("chat");

  // Joining / leaving states
  const [actionLoading, setActionLoading] = React.useState(false);

  // Invite Modal
  const [inviteModalOpen, setInviteModalOpen] = React.useState(false);
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [inviteUsername, setInviteUsername] = React.useState("");
  const [inviteStatus, setInviteStatus] = React.useState<string | null>(null);

  // Share pill feedback
  const [copiedShareLink, setCopiedShareLink] = React.useState(false);

  // Feed State
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loadingFeed, setLoadingFeed] = React.useState(false);
  const [newPostContent, setNewPostContent] = React.useState("");
  const [newPostType, setNewPostType] = React.useState<"post" | "announcement">("post");
  const [submittingPost, setSubmittingPost] = React.useState(false);

  // Members State
  const [members, setMembers] = React.useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = React.useState(false);
  const [memberSearch, setMemberSearch] = React.useState("");
  const [membersTab, setMembersTab] = React.useState<"all" | "requests">("all");
  const [joinRequests, setJoinRequests] = React.useState<GroupJoinRequest[]>([]);

  // Settings State
  const [settingsForm, setSettingsForm] = React.useState<{
    name: string;
    description: string;
    category: string;
    privacy: "public" | "private" | "invite_only";
    avatar_url: string;
    cover_url: string;
    rules: string;
    who_can_post: "all_members" | "admins_only";
    who_can_chat: "all_members" | "admins_only";
    who_can_invite: "all_members" | "admins_only";
  }>({
    name: "",
    description: "",
    category: "General",
    privacy: "public",
    avatar_url: "",
    cover_url: "",
    rules: "",
    who_can_post: "all_members",
    who_can_chat: "all_members",
    who_can_invite: "all_members",
  });
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [settingsSuccess, setSettingsSuccess] = React.useState(false);

  // Fetch Group Data
  const fetchGroup = React.useCallback(async () => {
    if (!slug) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/groups/${slug}`);
      const raw = res.data;

      // Extract cleanly across any wrapping layer
      const data: Group | null =
        raw?.data?.data && typeof raw.data.data === "object" && raw.data.data.slug
          ? raw.data.data
          : raw?.data && typeof raw.data === "object" && raw.data.slug
          ? raw.data
          : raw?.group && typeof raw.group === "object" && raw.group.slug
          ? raw.group
          : raw?.slug
          ? raw
          : null;

      if (!data) {
        throw new Error(raw?.message || "Group not found or unavailable.");
      }

      setGroup(data);
      setSettingsForm({
        name: data.name || "",
        description: data.description || "",
        category: data.category || "General",
        privacy: data.privacy || "public",
        avatar_url: data.avatar_url || "",
        cover_url: data.cover_url || "",
        rules: data.rules || "",
        who_can_post: data.settings?.who_can_post || "all_members",
        who_can_chat: data.settings?.who_can_chat || "all_members",
        who_can_invite: data.settings?.who_can_invite || "all_members",
      });
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load group.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  React.useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  // Fetch Feed Posts
  const fetchPosts = React.useCallback(async () => {
    if (!group) return;
    try {
      setLoadingFeed(true);
      const res = await apiClient.get(`/groups/${group.id}/posts`);
      const raw = res.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.data?.data)
        ? raw.data.data
        : [];
      setPosts(list);
    } catch (err) {
      console.error("Failed to load group posts", err);
      setPosts([]);
    } finally {
      setLoadingFeed(false);
    }
  }, [group]);

  React.useEffect(() => {
    if (activeTab === "feed" && group?.id) {
      fetchPosts();
    }
  }, [activeTab, group?.id, fetchPosts]);

  // Fetch Members & Join Requests
  const fetchMembers = React.useCallback(async () => {
    if (!group) return;
    try {
      setLoadingMembers(true);
      const res = await apiClient.get(`/groups/${group.id}/members`);
      const raw = res.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.data?.data)
        ? raw.data.data
        : [];
      setMembers(list);

      if (group.is_admin_or_owner) {
        const reqRes = await apiClient.get(`/groups/${group.id}/join-requests`);
        const reqRaw = reqRes.data;
        const reqList = Array.isArray(reqRaw)
          ? reqRaw
          : Array.isArray(reqRaw?.data)
          ? reqRaw.data
          : Array.isArray(reqRaw?.data?.data)
          ? reqRaw.data.data
          : [];
        setJoinRequests(reqList);
      }
    } catch (err) {
      console.error("Failed to load members", err);
    } finally {
      setLoadingMembers(false);
    }
  }, [group]);

  React.useEffect(() => {
    if (activeTab === "members" && group?.id) {
      fetchMembers();
    }
  }, [activeTab, group?.id, fetchMembers]);

  // Handle Share Group
  const handleShareGroup = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2500);
  };

  // Join Group Action
  const handleJoin = async () => {
    if (!group) return;
    try {
      setActionLoading(true);
      const res = await apiClient.post(`/groups/${group.id}/join`);
      if (res.data?.status === "joined") {
        fetchGroup();
      } else {
        setGroup((prev) => (prev ? { ...prev, has_pending_request: true } : prev));
      }
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.message || "Failed to join group.");
    } finally {
      setActionLoading(false);
    }
  };

  // Leave Group Action
  const handleLeave = async () => {
    if (!group) return;
    if (!confirm("Are you sure you want to leave this community space?")) return;
    try {
      setActionLoading(true);
      await apiClient.post(`/groups/${group.id}/leave`);
      fetchGroup();
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.message || "Failed to leave group.");
    } finally {
      setActionLoading(false);
    }
  };

  // Open Invite Modal
  const handleOpenInvite = async () => {
    if (!group) return;
    setInviteModalOpen(true);
    setInviteStatus(null);
    try {
      const res = await apiClient.get(`/groups/${group.id}/invite-link`);
      const raw = res.data;
      const link = raw?.invite_url || raw?.data?.invite_url || raw?.url || raw?.data?.url;
      setInviteUrl(link || null);
    } catch (err) {
      console.error("Failed to fetch invite link", err);
    }
  };

  // Send Direct Invitation
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !inviteUsername.trim()) return;
    try {
      setInviteStatus("sending");
      await apiClient.post(`/groups/${group.id}/invitations`, {
        username: inviteUsername.trim(),
      });
      setInviteStatus("success");
      setInviteUsername("");
    } catch (err: any) {
      setInviteStatus(err.response?.data?.error || "Failed to send invitation.");
    }
  };

  // Copy Invite Link
  const handleCopyInviteLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Feed: Submit New Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !newPostContent.trim()) return;
    try {
      setSubmittingPost(true);
      await apiClient.post(`/groups/${group.id}/posts`, {
        content: newPostContent.trim(),
        post_type: newPostType,
      });
      setNewPostContent("");
      setNewPostType("post");
      fetchPosts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create post.");
    } finally {
      setSubmittingPost(false);
    }
  };

  // Moderation: Review Join Request
  const handleReviewRequest = async (requestId: number, action: "approve" | "reject") => {
    if (!group) return;
    try {
      await apiClient.post(`/groups/${group.id}/join-requests/${requestId}/review`, { action });
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
      fetchMembers();
      fetchGroup();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to process request.");
    }
  };

  // Moderation: Update Role / Remove Member
  const handleMemberRole = async (memberId: number, newRole: "admin" | "moderator" | "member") => {
    if (!group) return;
    try {
      await apiClient.put(`/groups/${group.id}/members/${memberId}/role`, { role: newRole });
      fetchMembers();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update role.");
    }
  };

  const handleRemoveMember = async (memberId: number, ban = false) => {
    if (!group) return;
    if (!confirm(`Are you sure you want to ${ban ? "ban" : "remove"} this member?`)) return;
    try {
      await apiClient.delete(`/groups/${group.id}/members/${memberId}?ban=${ban ? 1 : 0}`);
      fetchMembers();
      fetchGroup();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to remove member.");
    }
  };

  // Settings: Save Changes
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;
    try {
      setSavingSettings(true);
      setSettingsSuccess(false);
      await apiClient.put(`/groups/${group.id}`, {
        name: settingsForm.name,
        description: settingsForm.description,
        category: settingsForm.category,
        privacy: settingsForm.privacy,
        avatar_url: settingsForm.avatar_url || undefined,
        cover_url: settingsForm.cover_url || undefined,
        rules: settingsForm.rules || undefined,
      });

      await apiClient.put(`/groups/${group.id}/settings`, {
        who_can_post: settingsForm.who_can_post,
        who_can_chat: settingsForm.who_can_chat,
        who_can_invite: settingsForm.who_can_invite,
      });

      setSettingsSuccess(true);
      fetchGroup();
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Settings: Delete Group
  const handleDeleteGroup = async () => {
    if (!group) return;
    const confirmName = prompt(`Type "${group.name}" to permanently delete this group:`);
    if (confirmName !== group.name) {
      alert("Group name does not match. Deletion cancelled.");
      return;
    }
    try {
      await apiClient.delete(`/groups/${group.id}`);
      navigate("/app/groups");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete group.");
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="relative">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
            <UsersThree weight="fill" className="h-7 w-7" />
          </div>
          <div className="absolute -inset-1 rounded-2xl border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-base text-foreground">Loading Community Space...</h3>
          <p className="text-xs text-muted-foreground">Preparing real-time discussions & feed posts</p>
        </div>
      </div>
    );
  }

  // Error / Not Found State
  if (error || !group) {
    return (
      <div className="max-w-lg mx-auto py-24 px-4 text-center space-y-6">
        <div className="h-20 w-20 rounded-3xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto shadow-xs">
          <Warning className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Community Space Not Found</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {error || "This group may have been renamed, archived, or is currently inaccessible."}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            onClick={() => fetchGroup()}
            variant="outline"
            className="rounded-xl px-5 h-10 text-xs font-semibold"
          >
            Retry Loading
          </Button>
          <Button
            onClick={() => navigate("/app/groups")}
            className="rounded-xl px-5 h-10 text-xs font-semibold bg-primary text-primary-foreground"
          >
            Explore All Groups
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* 1. HERO COVER BANNER */}
      <div className="relative w-full h-52 sm:h-64 md:h-80 bg-gradient-to-r from-primary/30 via-secondary/20 to-primary/10 overflow-hidden border-b border-border/40">
        {group.cover_url ? (
          <img
            src={group.cover_url}
            alt={group.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-background/40 to-primary/15 flex items-center justify-center">
            <div className="text-center space-y-1 opacity-40">
              <UsersThree weight="duotone" className="h-16 w-16 mx-auto text-primary" />
              <span className="text-xs font-semibold tracking-wider uppercase text-foreground">
                MurihSpace Community
              </span>
            </div>
          </div>
        )}

        {/* Backdrop Fade & Glass Top Controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-black/30" />

        <div className="absolute top-4 left-4 right-4 z-10 max-w-6xl mx-auto flex items-center justify-between">
          <Link
            to="/app/groups"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/80 text-xs font-bold text-foreground hover:bg-background transition-all shadow-sm"
          >
            <ArrowLeft weight="bold" className="h-3.5 w-3.5" />
            <span>Groups Directory</span>
          </Link>

          <button
            type="button"
            onClick={handleShareGroup}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/80 text-xs font-bold text-foreground hover:bg-background transition-all shadow-sm cursor-pointer"
          >
            {copiedShareLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-500">Link Copied!</span>
              </>
            ) : (
              <>
                <ShareNetwork className="h-3.5 w-3.5 text-primary" />
                <span>Share</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. GROUP HEADER & PROFILE BAR */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative -mt-16 sm:-mt-20 flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-6 border-b border-border/70">
          {/* Avatar & Title Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
            {/* Avatar Frame */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden bg-background border-4 border-background shadow-2xl flex-shrink-0 ring-1 ring-border/80">
              {group.avatar_url ? (
                <img
                  src={group.avatar_url}
                  alt={group.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-primary/10 text-primary flex items-center justify-center font-bold text-4xl">
                  <UsersThree weight="fill" className="h-14 w-14 text-primary" />
                </div>
              )}
            </div>

            {/* Title & Metadata Badges */}
            <div className="space-y-2 mb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  {group.name}
                </h1>

                {/* Privacy Badge */}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted/80 border border-border/70 text-foreground">
                  {group.privacy === "public" ? (
                    <>
                      <Globe className="h-3.5 w-3.5 text-emerald-500" /> Public
                    </>
                  ) : group.privacy === "private" ? (
                    <>
                      <Lock className="h-3.5 w-3.5 text-amber-500" /> Private
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Invite Only
                    </>
                  )}
                </span>

                {/* Category Pill */}
                <span className="text-xs px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold">
                  {group.category}
                </span>
              </div>

              {/* Sub-meta metrics */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5 font-bold text-foreground">
                  <UsersThree weight="fill" className="h-4 w-4 text-primary" />
                  <span>
                    {group.members_count} {group.members_count === 1 ? "member" : "members"}
                  </span>
                </span>
                <span>•</span>
                <span>
                  Created by <span className="text-foreground font-semibold">@{group.creator?.username || "creator"}</span>
                </span>
                {group.location && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <span>{group.location}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {group.is_member ? (
              <>
                <Button
                  onClick={handleOpenInvite}
                  variant="outline"
                  className="rounded-2xl gap-2 h-11 border-border/80 shadow-xs flex-1 md:flex-none text-xs font-bold"
                >
                  <UserPlus weight="bold" className="h-4 w-4 text-primary" />
                  <span>Invite</span>
                </Button>

                {group.is_admin_or_owner && (
                  <Button
                    onClick={() => setActiveTab("settings")}
                    variant="outline"
                    className="rounded-2xl h-11 w-11 p-0 border-border/80 shadow-xs"
                    title="Community Admin Settings"
                  >
                    <Gear weight="bold" className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  variant="secondary"
                  className="rounded-2xl gap-2 h-11 bg-primary/10 hover:bg-destructive/10 hover:text-destructive text-primary font-bold transition-all text-xs"
                  onClick={handleLeave}
                  disabled={actionLoading}
                >
                  <Check weight="bold" className="h-4 w-4" />
                  <span>Joined</span>
                </Button>
              </>
            ) : group.has_pending_request ? (
              <Button
                variant="secondary"
                disabled
                className="rounded-2xl gap-2 h-11 opacity-80 text-xs font-bold"
              >
                <Hourglass className="h-4 w-4 animate-spin" />
                <span>Approval Pending</span>
              </Button>
            ) : (
              <Button
                onClick={handleJoin}
                disabled={actionLoading}
                className="rounded-2xl gap-2 h-11 px-7 bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow-sm flex-1 md:flex-none text-xs"
              >
                {actionLoading ? (
                  <SpinnerGap className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus weight="bold" className="h-4 w-4" />
                )}
                <span>{group.privacy === "public" ? "Join Space" : "Request to Join"}</span>
              </Button>
            )}
          </div>
        </div>

        {/* 3. SEGMENTED TAB NAVIGATION */}
        <div className="flex items-center gap-1 sm:gap-2 border-b border-border/70 overflow-x-auto py-1 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "chat"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ChatCircleDots weight="fill" className="h-4 w-4" />
            <span>Group Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("feed")}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "feed"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Newspaper weight="fill" className="h-4 w-4" />
            <span>Community Feed</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "members"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users weight="fill" className="h-4 w-4" />
            <span>Members</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted font-bold text-muted-foreground">
              {group.members_count}
            </span>
            {group.is_admin_or_owner && joinRequests.length > 0 && (
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("about")}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "about"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Info weight="fill" className="h-4 w-4" />
            <span>About & Rules</span>
          </button>

          {group.is_admin_or_owner && (
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "settings"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Gear weight="fill" className="h-4 w-4" />
              <span>Admin Settings</span>
            </button>
          )}
        </div>

        {/* 4. TAB CONTENTS & SIDEBAR */}
        <div className="pt-6">
          {/* TAB 1: REAL-TIME GROUP CHAT */}
          {activeTab === "chat" && (
            <div>
              {group.is_member ? (
                <GroupChatView group={group} />
              ) : (
                <div className="p-12 text-center rounded-3xl border border-border/80 bg-card/50 max-w-xl mx-auto space-y-4">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <ChatCircleDots weight="fill" className="h-8 w-8" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-lg text-foreground">Member Chat Locked</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Join {group.name} to participate in live discussions, share media, and chat with members.
                    </p>
                  </div>
                  <Button
                    onClick={handleJoin}
                    className="rounded-xl px-6 bg-primary text-primary-foreground font-semibold"
                  >
                    Join to Chat
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GROUP FEED (With Sticky Info Sidebar) */}
          {activeTab === "feed" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Feed Column */}
              <div className="lg:col-span-8 space-y-6">
                {/* Post Composer */}
                {group.is_member && group.can_post && (
                  <form
                    onSubmit={handleCreatePost}
                    className="p-5 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-xs space-y-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 overflow-hidden flex items-center justify-center font-bold text-primary flex-shrink-0">
                        {(user as any)?.avatar ? (
                          <img
                            src={(user as any).avatar}
                            alt={user?.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <UserIcon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-bold text-foreground">
                          Post to {group.name}
                        </span>
                      </div>
                      {group.is_admin_or_owner && (
                        <select
                          value={newPostType}
                          onChange={(e) => setNewPostType(e.target.value as any)}
                          className="text-xs rounded-xl bg-muted border border-border/80 px-2.5 py-1 font-semibold focus:outline-none"
                        >
                          <option value="post">Standard Post</option>
                          <option value="announcement">📢 Announcement</option>
                        </select>
                      )}
                    </div>

                    <Textarea
                      placeholder={`Share an update, question, or thought with ${group.name}...`}
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      rows={3}
                      className="rounded-2xl resize-none bg-background border-border/70 text-sm p-3.5 focus-visible:ring-primary"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Sparkle className="h-3.5 w-3.5 text-primary" />
                        <span>Visible to community members</span>
                      </div>
                      <Button
                        type="submit"
                        disabled={submittingPost || !newPostContent.trim()}
                        className="rounded-xl px-5 h-9 bg-primary text-primary-foreground font-bold text-xs"
                      >
                        {submittingPost ? "Publishing..." : "Publish Post"}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Posts List */}
                {loadingFeed ? (
                  <div className="py-16 text-center text-xs text-muted-foreground">
                    <SpinnerGap className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                    <span>Loading community feed...</span>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="p-12 rounded-3xl border border-dashed border-border text-center space-y-3">
                    <Newspaper className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                    <h3 className="font-bold text-base text-foreground">No posts yet</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Be the first to share an update, thought, or discussion topic with fellow members.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar Column */}
              <div className="lg:col-span-4 space-y-6">
                {/* About Quick Card */}
                <div className="p-6 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-4 shadow-xs">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <Info weight="fill" className="h-4 w-4 text-primary" />
                    <span>About this Space</span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {group.description || "No description provided for this community yet."}
                  </p>

                  <div className="space-y-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Category</span>
                      <span className="font-bold text-foreground">{group.category}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total Members</span>
                      <span className="font-bold text-foreground">{group.members_count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Access</span>
                      <span className="capitalize font-bold text-foreground">{group.privacy}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Share Invite */}
                <div className="p-6 rounded-3xl border border-primary/20 bg-primary/5 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <UserPlus weight="bold" className="h-4 w-4 text-primary" />
                    <span>Grow this Community</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Invite collaborators and peers to join discussions and build this space together.
                  </p>
                  <Button
                    onClick={handleOpenInvite}
                    className="w-full rounded-xl h-10 bg-primary text-primary-foreground font-bold text-xs"
                  >
                    Send Community Invites
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MEMBERS & MODERATION */}
          {activeTab === "members" && (
            <div className="space-y-6 max-w-4xl">
              {/* Member Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <MagnifyingGlass className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search members by name or username..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="pl-10 h-11 rounded-2xl bg-background border-border/80 text-xs"
                  />
                </div>

                {group.is_admin_or_owner && joinRequests.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={membersTab === "all" ? "default" : "outline"}
                      onClick={() => setMembersTab("all")}
                      className="rounded-xl text-xs h-9"
                    >
                      Active ({members.length})
                    </Button>
                    <Button
                      size="sm"
                      variant={membersTab === "requests" ? "default" : "outline"}
                      onClick={() => setMembersTab("requests")}
                      className="rounded-xl text-xs h-9 gap-1.5"
                    >
                      <span>Join Requests</span>
                      <span className="h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                        {joinRequests.length}
                      </span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Members List */}
              {loadingMembers ? (
                <div className="py-16 text-center text-xs text-muted-foreground">
                  <SpinnerGap className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                  <span>Loading members directory...</span>
                </div>
              ) : membersTab === "requests" ? (
                /* Join Requests View */
                <div className="space-y-3">
                  {joinRequests.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No pending join requests.
                    </div>
                  ) : (
                    joinRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-2xl border border-border bg-card flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 overflow-hidden flex items-center justify-center font-bold text-primary">
                            {req.user?.avatar ? (
                              <img src={req.user.avatar} alt={req.user.name} className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-sm block">{req.user?.name}</span>
                            <span className="text-xs text-muted-foreground">@{req.user?.username}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleReviewRequest(req.id, "approve")}
                            className="rounded-xl h-8 px-3 text-xs bg-primary text-primary-foreground font-bold"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReviewRequest(req.id, "reject")}
                            className="rounded-xl h-8 px-3 text-xs"
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Active Members Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {members
                    .filter((m) =>
                      m.user?.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
                      m.user?.username?.toLowerCase().includes(memberSearch.toLowerCase())
                    )
                    .map((m) => (
                      <div
                        key={m.id}
                        className="p-4 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-primary/10 overflow-hidden flex items-center justify-center font-bold text-primary flex-shrink-0">
                            {m.user?.avatar ? (
                              <img src={m.user.avatar} alt={m.user.name} className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-foreground truncate block">
                              {m.user?.name}
                            </span>
                            <span className="text-xs text-muted-foreground truncate block">
                              @{m.user?.username}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {group.is_admin_or_owner && m.role !== "owner" ? (
                            <select
                              value={m.role}
                              onChange={(e) => handleMemberRole(m.id, e.target.value as any)}
                              className="text-[10px] uppercase font-bold px-2 py-1 rounded-lg bg-muted border border-border/80 text-foreground cursor-pointer focus:outline-none"
                            >
                              <option value="member">Member</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                                m.role === "owner"
                                  ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                                  : m.role === "admin"
                                  ? "bg-primary/15 text-primary border border-primary/30"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {m.role}
                            </span>
                          )}

                          {group.is_admin_or_owner && m.role !== "owner" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(m.id)}
                              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                              title="Remove member"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ABOUT & GUIDELINES */}
          {activeTab === "about" && (
            <div className="max-w-3xl space-y-8">
              {/* Description Card */}
              <div className="p-6 sm:p-8 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-3 shadow-xs">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Info weight="fill" className="h-4 w-4 text-primary" />
                  <span>Community Purpose & Overview</span>
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {group.description || "No detailed description has been added for this space."}
                </p>
              </div>

              {/* Guidelines & Rules Card */}
              <div className="p-6 sm:p-8 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-4 shadow-xs">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <ShieldCheck weight="fill" className="h-5 w-5 text-primary" />
                  <span>Community Rules & Conduct</span>
                </h3>
                {group.rules ? (
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 text-xs text-foreground leading-relaxed whitespace-pre-line font-mono">
                    {group.rules}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Standard MurihSpace community conduct rules apply. Please maintain respectful, collaborative communication.
                  </p>
                )}
              </div>

              {/* Meta details card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-4 rounded-2xl border border-border/70 bg-card/40 space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Primary Category</span>
                  <span className="font-bold text-foreground">{group.category}</span>
                </div>
                <div className="p-4 rounded-2xl border border-border/70 bg-card/40 space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Total Members</span>
                  <span className="font-bold text-foreground">{group.members_count}</span>
                </div>
                <div className="p-4 rounded-2xl border border-border/70 bg-card/40 space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Privacy Level</span>
                  <span className="font-bold text-foreground capitalize">{group.privacy}</span>
                </div>
                <div className="p-4 rounded-2xl border border-border/70 bg-card/40 space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Location</span>
                  <span className="font-bold text-foreground">{group.location || "Global Remote"}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ADMIN SETTINGS */}
          {activeTab === "settings" && group.is_admin_or_owner && (
            <div className="max-w-2xl space-y-8">
              <form onSubmit={handleSaveSettings} className="p-6 sm:p-8 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-6 shadow-xs">
                <div className="flex items-center justify-between pb-4 border-b border-border/60">
                  <div className="space-y-1">
                    <h3 className="font-bold text-base text-foreground">Community Settings</h3>
                    <p className="text-xs text-muted-foreground">Update community details, permissions, and appearance</p>
                  </div>
                  {settingsSuccess && (
                    <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Saved
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Group Name</Label>
                    <Input
                      value={settingsForm.name}
                      onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                      required
                      className="rounded-2xl h-11 bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</Label>
                    <Textarea
                      value={settingsForm.description}
                      onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                      rows={3}
                      className="rounded-2xl bg-background resize-none text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Who can post in feed?</Label>
                    <select
                      value={settingsForm.who_can_post}
                      onChange={(e) => setSettingsForm({ ...settingsForm, who_can_post: e.target.value as any })}
                      className="w-full h-11 rounded-2xl bg-background border border-border px-3 text-xs focus:outline-none"
                    >
                      <option value="all_members">All active members</option>
                      <option value="admins_only">Admins and moderators only</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Who can chat?</Label>
                    <select
                      value={settingsForm.who_can_chat}
                      onChange={(e) => setSettingsForm({ ...settingsForm, who_can_chat: e.target.value as any })}
                      className="w-full h-11 rounded-2xl bg-background border border-border px-3 text-xs focus:outline-none"
                    >
                      <option value="all_members">All active members</option>
                      <option value="admins_only">Admins only</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={savingSettings}
                    className="rounded-xl px-6 h-10 bg-primary text-primary-foreground font-bold text-xs"
                  >
                    {savingSettings ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </form>

              {/* Danger Zone */}
              <div className="p-6 sm:p-8 rounded-3xl border border-destructive/30 bg-destructive/5 space-y-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-destructive">Danger Zone</h4>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete this community, all messages, feed posts, and member affiliations.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteGroup}
                  className="rounded-xl text-xs font-bold h-10 px-5"
                >
                  Permanently Delete Group
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. INVITE MEMBERS MODAL */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="max-w-md p-6 sm:p-8 rounded-3xl bg-background border-border/80 shadow-2xl">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <UserPlus weight="bold" className="h-4 w-4" />
              <span>Invite to Community</span>
            </div>
            <DialogTitle className="text-xl font-bold">Invite to {group.name}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Share an instant join link or invite registered users directly by their handle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Shareable Link Box */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Instant Invite Link
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={inviteUrl || "Generating invite link..."}
                  className="h-11 rounded-2xl bg-muted/60 text-xs font-mono select-all"
                />
                <Button
                  type="button"
                  onClick={handleCopyInviteLink}
                  disabled={!inviteUrl}
                  className="rounded-2xl h-11 px-4 bg-primary text-primary-foreground font-bold text-xs gap-1.5 flex-shrink-0"
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Direct Username Invite */}
            <form onSubmit={handleSendInvite} className="space-y-3 pt-2 border-t border-border/60">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Invite by Username
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter username (e.g. alex)"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  className="h-11 rounded-2xl bg-background text-xs"
                />
                <Button
                  type="submit"
                  disabled={inviteStatus === "sending" || !inviteUsername.trim()}
                  className="rounded-2xl h-11 px-4 bg-primary text-primary-foreground font-bold text-xs gap-1.5 flex-shrink-0"
                >
                  <PaperPlaneTilt className="h-4 w-4" />
                  <span>Send</span>
                </Button>
              </div>

              {inviteStatus === "success" && (
                <p className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> Invitation sent successfully!
                </p>
              )}
              {inviteStatus && inviteStatus !== "sending" && inviteStatus !== "success" && (
                <p className="text-xs font-semibold text-destructive">{inviteStatus}</p>
              )}
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GroupDetailPage;
