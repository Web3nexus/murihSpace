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
  Crown,
  Check,
  Copy,
  Trash,
  Megaphone,
  SpinnerGap,
  Hourglass,
  ArrowLeft,
  CalendarBlank,
  MapPin,
  Warning,
  Image as ImageIcon,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/upload/ImageUploader";
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
      const data = res.data?.data;
      setGroup(data);
      if (data) {
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
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load group.");
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
      const rawPosts = res.data?.posts || res.data?.data?.data || [];
      setPosts(rawPosts);
    } catch (err) {
      console.error("Failed to load group posts", err);
    } finally {
      setLoadingFeed(false);
    }
  }, [group?.id]);

  React.useEffect(() => {
    if (activeTab === "feed" && group?.is_member) {
      fetchPosts();
    }
  }, [activeTab, group?.is_member, fetchPosts]);

  // Fetch Members
  const fetchMembers = React.useCallback(async () => {
    if (!group) return;
    try {
      setLoadingMembers(true);
      const params = new URLSearchParams();
      if (memberSearch.trim()) params.set("search", memberSearch.trim());
      const res = await apiClient.get(`/groups/${group.id}/members?${params}`);
      setMembers(res.data?.members || res.data?.data?.data || []);

      if (group.is_admin_or_owner) {
        const reqRes = await apiClient.get(`/groups/${group.id}/join-requests`);
        setJoinRequests(reqRes.data?.data || []);
      }
    } catch (err) {
      console.error("Failed to load members", err);
    } finally {
      setLoadingMembers(false);
    }
  }, [group?.id, group?.is_admin_or_owner, memberSearch]);

  React.useEffect(() => {
    if (activeTab === "members" && group) {
      fetchMembers();
    }
  }, [activeTab, group, fetchMembers]);

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
      alert(err.response?.data?.error || err.response?.data?.message || "Failed to join.");
    } finally {
      setActionLoading(false);
    }
  };

  // Leave Group Action
  const handleLeave = async () => {
    if (!group) return;
    if (!confirm("Are you sure you want to leave this group?")) return;
    try {
      setActionLoading(true);
      await apiClient.post(`/groups/${group.id}/leave`);
      fetchGroup();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to leave group.");
    } finally {
      setActionLoading(false);
    }
  };

  // Open Invite Modal
  const handleOpenInvite = async () => {
    if (!group) return;
    setInviteModalOpen(true);
    try {
      const res = await apiClient.get(`/groups/${group.id}/invite-link`);
      setInviteUrl(res.data?.invite_url || null);
    } catch (err) {
      console.error("Failed to generate invite link", err);
    }
  };

  const handleCopyInvite = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !inviteUsername.trim()) return;
    try {
      setInviteStatus("Sending invitation...");
      await apiClient.post(`/groups/${group.id}/invitations`, {
        username: inviteUsername.trim(),
      });
      setInviteStatus(`Invitation successfully sent to @${inviteUsername.trim()}!`);
      setInviteUsername("");
    } catch (err: any) {
      setInviteStatus(err.response?.data?.error || err.response?.data?.message || "Failed to send invite.");
    }
  };

  // Feed: Create Post
  const [newPostImage, setNewPostImage] = React.useState<string>("");
  const [showImageUploader, setShowImageUploader] = React.useState<boolean>(false);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || (!newPostContent.trim() && !newPostImage)) return;
    try {
      setSubmittingPost(true);
      const res = await apiClient.post(`/groups/${group.id}/posts`, {
        content: newPostContent.trim(),
        type: newPostType,
        media_url: newPostImage || undefined,
      });
      const created = res.data?.data;
      if (created) {
        setPosts((prev) => [created, ...prev]);
        setNewPostContent("");
        setNewPostImage("");
        setShowImageUploader(false);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to publish post.");
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
      // Update details
      await apiClient.put(`/groups/${group.id}`, {
        name: settingsForm.name,
        description: settingsForm.description,
        category: settingsForm.category,
        privacy: settingsForm.privacy,
        avatar_url: settingsForm.avatar_url || undefined,
        cover_url: settingsForm.cover_url || undefined,
        rules: settingsForm.rules || undefined,
      });

      // Update settings permissions
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <SpinnerGap className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Loading group...</span>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center">
        <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
          <Warning className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Group Not Found</h2>
        <p className="text-muted-foreground text-sm mb-6">
          {error || "This group may have been removed or does not exist."}
        </p>
        <Button onClick={() => navigate("/app/groups")} className="rounded-xl">
          Back to Groups
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero Cover Banner */}
      <div className="relative w-full h-48 sm:h-64 md:h-72 bg-gradient-to-r from-primary/30 via-secondary/20 to-primary/10 overflow-hidden">
        {group.cover_url ? (
          <img
            src={group.cover_url}
            alt={group.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-secondary/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

        <div className="absolute top-4 left-4 z-10">
          <Link
            to="/app/groups"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/80 text-xs font-semibold hover:bg-background transition-all shadow-sm"
          >
            <ArrowLeft weight="bold" className="h-3.5 w-3.5" />
            All Groups
          </Link>
        </div>
      </div>

      {/* Group Header Info */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative -mt-16 sm:-mt-20 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pb-6 border-b border-border/70">
          {/* Avatar & Title */}
          <div className="flex items-end gap-4">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-background border-4 border-background shadow-xl flex-shrink-0">
              {group.avatar_url ? (
                <img
                  src={group.avatar_url}
                  alt={group.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-primary/10 text-primary flex items-center justify-center font-bold text-3xl">
                  {group.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="space-y-1 mb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {group.name}
                </h1>
                {/* Privacy Badge */}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted border border-border/60 text-muted-foreground">
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
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {group.category}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <UsersThree weight="fill" className="h-4 w-4 text-primary" />
                  {group.members_count} {group.members_count === 1 ? "member" : "members"}
                </span>
                <span>•</span>
                <span>Created by @{group.creator?.username || "creator"}</span>
                {group.location && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {group.location}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {group.is_member ? (
              <>
                <Button
                  onClick={handleOpenInvite}
                  variant="outline"
                  className="rounded-2xl gap-1.5 h-11 border-border/80 shadow-xs flex-1 sm:flex-none"
                >
                  <UserPlus weight="bold" className="h-4 w-4 text-primary" />
                  <span>Invite</span>
                </Button>

                {group.is_admin_or_owner && (
                  <Button
                    onClick={() => setActiveTab("settings")}
                    variant="outline"
                    className="rounded-2xl gap-1.5 h-11 border-border/80 shadow-xs"
                    title="Group Settings"
                  >
                    <Gear weight="bold" className="h-4 w-4" />
                  </Button>
                )}

                <div className="relative group/leave">
                  <Button
                    variant="secondary"
                    className="rounded-2xl gap-1.5 h-11 bg-primary/10 hover:bg-destructive/10 hover:text-destructive text-primary font-semibold transition-all"
                    onClick={handleLeave}
                    disabled={actionLoading}
                  >
                    <Check weight="bold" className="h-4 w-4" />
                    <span>Joined</span>
                  </Button>
                </div>
              </>
            ) : group.has_pending_request ? (
              <Button
                variant="secondary"
                disabled
                className="rounded-2xl gap-1.5 h-11 opacity-80"
              >
                <Hourglass className="h-4 w-4 animate-spin" />
                <span>Pending Approval</span>
              </Button>
            ) : (
              <Button
                onClick={handleJoin}
                disabled={actionLoading}
                className="rounded-2xl gap-1.5 h-11 px-6 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-sm flex-1 sm:flex-none"
              >
                {actionLoading ? (
                  <SpinnerGap className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus weight="bold" className="h-4 w-4" />
                )}
                <span>{group.privacy === "public" ? "Join Group" : "Request to Join"}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 sm:gap-2 border-b border-border/70 overflow-x-auto py-1 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
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
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "feed"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Newspaper weight="fill" className="h-4 w-4" />
            <span>Group Feed</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "members"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users weight="fill" className="h-4 w-4" />
            <span>Members</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-normal">
              {group.members_count}
            </span>
            {group.is_admin_or_owner && joinRequests.length > 0 && (
              <span className="h-2 w-2 rounded-full bg-destructive" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("about")}
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
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
              className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
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

        {/* Tab Content Panes */}
        <div className="pt-6">
          {/* TAB 1: REAL-TIME GROUP CHAT */}
          {activeTab === "chat" && <GroupChatView group={group} />}

          {/* TAB 2: GROUP FEED */}
          {activeTab === "feed" && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Feed Post Composer */}
              {group.is_member && group.can_post && (
                <form
                  onSubmit={handleCreatePost}
                  className="p-5 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-xs space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center font-bold text-primary flex-shrink-0">
                      {(user as any)?.avatar ? (
                        <img src={(user as any).avatar} alt={user?.name} className="w-full h-full object-cover" />
                      ) : (
                        user?.name?.charAt(0) || "U"
                      )}
                    </div>
                    <Textarea
                      placeholder={`Post an update in ${group.name}...`}
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      rows={2}
                      className="rounded-2xl bg-muted/40 border-border/60 resize-none text-sm"
                    />
                  </div>

                  {showImageUploader && (
                    <div className="pt-2 border-t border-border/40">
                      <ImageUploader
                        value={newPostImage}
                        onChange={(url) => setNewPostImage(url)}
                        folder="groups/posts"
                        label="Attach Photo"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNewPostType(newPostType === "announcement" ? "post" : "announcement")}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                          newPostType === "announcement"
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold"
                            : "border-border/60 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <Megaphone className="h-3.5 w-3.5" />
                        Announcement
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowImageUploader(!showImageUploader)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                          showImageUploader || newPostImage
                            ? "bg-primary/15 border-primary/30 text-primary font-semibold"
                            : "border-border/60 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>Photo</span>
                      </button>
                    </div>

                    <Button
                      type="submit"
                      disabled={submittingPost || (!newPostContent.trim() && !newPostImage)}
                      className="rounded-xl px-5 h-9 bg-primary text-primary-foreground text-xs font-semibold"
                    >
                      {submittingPost ? "Publishing..." : "Post"}
                    </Button>
                  </div>
                </form>
              )}

              {/* Feed Posts List */}
              {loadingFeed ? (
                <div className="py-12 flex justify-center text-muted-foreground">
                  <SpinnerGap className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-12 rounded-3xl border border-dashed border-border/80 text-muted-foreground space-y-2">
                  <Newspaper className="h-10 w-10 mx-auto text-muted-foreground/60" />
                  <div className="flex flex-col items-center justify-center text-center space-y-1 w-full">
                    <h4 className="font-semibold text-foreground text-center">No group posts yet</h4>
                    <p className="text-xs text-muted-foreground max-w-sm text-center mx-auto">
                      Be the first to share an update, announcement, or question in this group.
                    </p>
                  </div>
                </div>
              ) : (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    isModerator={group.is_admin_or_owner}
                  />
                ))
              )}
            </div>
          )}

          {/* TAB 3: MEMBERS */}
          {activeTab === "members" && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Member Subnav for Admins */}
              {group.is_admin_or_owner && (
                <div className="flex items-center gap-2 pb-2">
                  <button
                    type="button"
                    onClick={() => setMembersTab("all")}
                    className={`text-xs px-4 py-2 rounded-xl font-semibold transition-all ${
                      membersTab === "all"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Active Members ({group.members_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMembersTab("requests")}
                    className={`text-xs px-4 py-2 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
                      membersTab === "requests"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Join Requests
                    {joinRequests.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-destructive text-destructive-foreground text-[10px]">
                        {joinRequests.length}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {membersTab === "all" ? (
                <div className="space-y-4">
                  <Input
                    placeholder="Search members by name or @username..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="h-11 rounded-2xl bg-card border-border/80"
                  />

                  {loadingMembers ? (
                    <div className="py-8 flex justify-center text-muted-foreground">
                      <SpinnerGap className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : members.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center p-8 text-muted-foreground text-sm rounded-2xl border border-dashed border-border/80">
                      No members found matching your search.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/60 rounded-3xl border border-border/80 bg-card/60 overflow-hidden shadow-xs">
                      {members.map((m) => (
                        <div key={m.id} className="p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center font-bold text-muted-foreground text-sm">
                              {m.user?.avatar ? (
                                <img src={m.user.avatar} alt={m.user.name} className="w-full h-full object-cover" />
                              ) : (
                                m.user?.name?.charAt(0) || "U"
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">{m.user?.name}</span>
                                {m.role === "owner" ? (
                                  <span className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                                    <Crown weight="fill" className="h-3 w-3" /> Owner
                                  </span>
                                ) : m.role === "admin" ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                                    Admin
                                  </span>
                                ) : m.role === "moderator" ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/30 text-secondary-foreground font-semibold">
                                    Moderator
                                  </span>
                                ) : null}
                              </div>
                              <span className="text-xs text-muted-foreground">@{m.user?.username}</span>
                            </div>
                          </div>

                          {/* Admin Moderation Controls */}
                          {group.is_admin_or_owner && m.role !== "owner" && m.user_id !== user?.id && (
                            <div className="flex items-center gap-2">
                              <select
                                value={m.role}
                                onChange={(e) => handleMemberRole(m.id, e.target.value as any)}
                                className="h-8 rounded-lg bg-background border border-border text-xs px-2"
                              >
                                <option value="member">Member</option>
                                <option value="moderator">Moderator</option>
                                {group.user_role === "owner" && <option value="admin">Admin</option>}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(m.id, false)}
                                className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                                title="Remove member"
                              >
                                <Trash className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Join Requests Subtab */
                <div className="space-y-3">
                  {joinRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center p-8 text-muted-foreground text-sm rounded-2xl border border-dashed border-border/80">
                      No pending join requests.
                    </div>
                  ) : (
                    joinRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-2xl border border-border/80 bg-card/60 flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center font-bold text-muted-foreground">
                            {req.user?.avatar ? (
                              <img src={req.user.avatar} alt={req.user.name} className="w-full h-full object-cover" />
                            ) : (
                              req.user?.name?.charAt(0) || "U"
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{req.user?.name}</div>
                            <div className="text-xs text-muted-foreground">@{req.user?.username}</div>
                            {req.note && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                "{req.note}"
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleReviewRequest(req.id, "approve")}
                            className="rounded-xl h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReviewRequest(req.id, "reject")}
                            className="rounded-xl h-8 text-xs"
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
          )}

          {/* TAB 4: ABOUT & RULES */}
          {activeTab === "about" && (
            <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                {/* Description Card */}
                <div className="p-6 rounded-3xl border border-border/80 bg-card/60 shadow-xs space-y-3">
                  <h3 className="font-bold text-base text-foreground">About This Group</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {group.description || "No description provided for this group."}
                  </p>
                </div>

                {/* Rules Card */}
                <div className="p-6 rounded-3xl border border-border/80 bg-card/60 shadow-xs space-y-3">
                  <h3 className="font-bold text-base text-foreground">Group Rules & Guidelines</h3>
                  {group.rules ? (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {group.rules}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Standard MurihSpace community guidelines apply. Be respectful and collaborative.
                    </p>
                  )}
                </div>
              </div>

              {/* Sidebar Info Card */}
              <div className="space-y-4">
                <div className="p-5 rounded-3xl border border-border/80 bg-card/60 shadow-xs space-y-4 text-xs">
                  <h4 className="font-bold uppercase tracking-wider text-muted-foreground">
                    Group Details
                  </h4>

                  <div className="flex items-center gap-2 text-foreground">
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="capitalize">{group.privacy} Group</span>
                  </div>

                  <div className="flex items-center gap-2 text-foreground">
                    <CalendarBlank className="h-4 w-4 text-primary" />
                    <span>Created {new Date(group.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2 text-foreground">
                    <UsersThree className="h-4 w-4 text-primary" />
                    <span>{group.members_count} active members</span>
                  </div>

                  <div className="pt-3 border-t border-border/60">
                    <span className="font-medium text-muted-foreground block mb-1">
                      Group Owner
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{group.creator?.name}</span>
                      <span className="text-muted-foreground">@{group.creator?.username}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ADMIN SETTINGS */}
          {activeTab === "settings" && group.is_admin_or_owner && (
            <div className="max-w-2xl mx-auto space-y-8">
              {settingsSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold text-sm flex items-center gap-2">
                  <Check weight="bold" className="h-4 w-4" />
                  Group settings saved successfully.
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="p-6 sm:p-8 rounded-3xl border border-border/80 bg-card/60 shadow-xs space-y-6">
                <h3 className="text-lg font-bold">General Settings</h3>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Group Name
                  </Label>
                  <Input
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                    className="h-11 rounded-xl bg-background border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Category
                  </Label>
                  <Input
                    value={settingsForm.category}
                    onChange={(e) => setSettingsForm({ ...settingsForm, category: e.target.value })}
                    className="h-11 rounded-xl bg-background border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Description
                  </Label>
                  <Textarea
                    value={settingsForm.description}
                    onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                    rows={3}
                    className="rounded-xl bg-background border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Group Rules
                  </Label>
                  <Textarea
                    value={settingsForm.rules}
                    onChange={(e) => setSettingsForm({ ...settingsForm, rules: e.target.value })}
                    rows={3}
                    className="rounded-xl bg-background border-border"
                  />
                </div>

                {/* Visuals: Avatar & Cover Uploads */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Group Avatar (Icon / Logo)
                    </Label>
                    <ImageUploader
                      value={settingsForm.avatar_url || ""}
                      onChange={(url) => setSettingsForm({ ...settingsForm, avatar_url: url })}
                      folder="groups/avatars"
                      label="Upload Group Avatar"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Group Cover Banner
                    </Label>
                    <ImageUploader
                      value={settingsForm.cover_url || ""}
                      onChange={(url) => setSettingsForm({ ...settingsForm, cover_url: url })}
                      folder="groups/covers"
                      label="Upload Cover Banner"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-border/60 space-y-4">
                  <h4 className="text-sm font-bold">Permissions & Moderation</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <Label>Who can post to feed?</Label>
                      <select
                        value={settingsForm.who_can_post}
                        onChange={(e) => setSettingsForm({ ...settingsForm, who_can_post: e.target.value as any })}
                        className="w-full h-10 rounded-xl bg-background border border-border px-3"
                      >
                        <option value="all_members">All Members</option>
                        <option value="admins_only">Admins Only</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label>Who can send chat messages?</Label>
                      <select
                        value={settingsForm.who_can_chat}
                        onChange={(e) => setSettingsForm({ ...settingsForm, who_can_chat: e.target.value as any })}
                        className="w-full h-10 rounded-xl bg-background border border-border px-3"
                      >
                        <option value="all_members">All Members</option>
                        <option value="admins_only">Admins Only</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    type="submit"
                    disabled={savingSettings}
                    className="rounded-xl px-6 bg-primary text-primary-foreground font-semibold"
                  >
                    {savingSettings ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </form>

              {/* Danger Zone */}
              {group.user_role === "owner" && (
                <div className="p-6 rounded-3xl border border-destructive/30 bg-destructive/5 space-y-4">
                  <h4 className="text-sm font-bold text-destructive">Danger Zone</h4>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete this group, its chat history, and its member list. This action cannot be undone.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteGroup}
                    className="rounded-xl text-xs font-semibold"
                  >
                    Delete Group
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-xl font-bold">Invite Members</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Share the invite link or invite specific users by @username to join {group.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Shareable Link */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Shareable Invite Link
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={inviteUrl || "Generating invite link..."}
                  className="h-10 rounded-xl bg-muted text-xs font-mono"
                />
                <Button
                  onClick={handleCopyInvite}
                  disabled={!inviteUrl}
                  className="rounded-xl h-10 px-4 gap-1.5 flex-shrink-0"
                >
                  {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copiedLink ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            {/* Direct Username Invite */}
            <form onSubmit={handleSendInvite} className="space-y-2 pt-3 border-t border-border/60">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Invite by Username
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="e.g. adeyemi"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  className="h-10 rounded-xl bg-background"
                />
                <Button
                  type="submit"
                  disabled={!inviteUsername.trim()}
                  className="rounded-xl h-10 px-4"
                >
                  Send
                </Button>
              </div>
              {inviteStatus && (
                <p className="text-xs text-primary font-medium mt-1">{inviteStatus}</p>
              )}
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GroupDetailPage;
