import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router";
import { AnimatedPage } from "@/components/common/AnimatedPage";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api/client";
import { timeAgo, mapApiPost, mapApiComments } from "@/lib/feed";
import { SkeletonFeed } from "@/components/ui/skeletons";
import {
  TrendingUp,
  Users,
  Wallet,
  Smartphone,
  Lightbulb,
  Plus,
  MessageSquare,
  Package,
  Calendar,
  Bot,
  MessageCircle,
  Inbox,
  Activity,
  Video,
  BarChart2,
  Heart,
  Share2,
  MoreHorizontal,
  ChevronRight,
  Play,
  BadgeCheck,
  Send,
  Loader2,
  Copy,
  Check,
  X,
  ChevronDown,
  Rss,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CommentItem {
  id: number;
  user_name: string;
  avatar_url?: string;
  content: string;
  time: string;
  verified?: boolean;
}

interface PostItem {
  id: number;
  author: string;
  authorVerified?: boolean;
  avatar: string;
  badge: string;
  time: string;
  content: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  embedType: "video" | "product" | "media" | null;
  embedTitle?: string;
  embedSub?: string;
  embedBg?: string;
  price?: string;
  mediaUrl?: string;
  commentList: CommentItem[];
}

interface AnalyticsData {
  totalRevenue: string;
  netEarnings: string;
  growthRate: string;
  revenueGrowth?: string | null;
  earningsGrowth?: string | null;
  growthRateDelta?: string | null;
  unreadCount: number;
  aiReplies: number;
  humanFollowUps: number;
  activeConversations: number;
  channels: { name: string; badge: string; color: string; bg: string }[];
  contentPlanner: { title: string; date: string; status: string }[];
  topProduct: { title: string; subtitle: string; price: string };
  communityMembers: string;
  communityGrowth: string;
  upcomingEvent: { title: string; date: string; month: string; day: string };
}

interface SidebarFriendRequest {
  id: number;
  sender: { id: number; name: string; username: string; avatar?: string | null; avatar_url?: string | null } | null;
  mutual_friends: number;
}

interface SidebarCommunityRequest {
  id: number;
  community: { id: number; name: string; slug: string; logo_url?: string | null } | null;
  user: { id: number; name: string; username: string; avatar?: string | null } | null;
  role: string;
}

/**
 * Shown when a Member account authenticates on the web.
 * Extracted as a standalone component so the main AppPage never violates
 * React's rules of hooks with an early return before its own hook calls.
 */
function MemberWebBlockPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSwitchAccount = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100 flex flex-col items-center">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6">
          <Smartphone className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Download the App</h1>
        <p className="text-slate-500 mb-8">
          The web dashboard is exclusively designed for Creators and Vendors. Please use the MurihSpace mobile app to connect, chat, and interact with communities.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl"
            onClick={() => window.open('https://play.google.com/store/apps/details?id=com.murihspace.app', '_blank')}
          >
            Google Play
          </Button>
          <Button
            className="flex-1 h-12 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => window.open('https://apps.apple.com/app/murihspace/id000000000', '_blank')}
          >
            App Store
          </Button>
        </div>
        <div className="mt-8 pt-6 border-t border-slate-100 w-full">
          <button
            onClick={handleSwitchAccount}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Sign in with a different account
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppPage() {
  const { user } = useAuth();

  // Member block early return has been moved to the bottom, after all hooks.

  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState("");
  const [submittingPost, setSubmittingPost] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);
  const [userCommunities, setUserCommunities] = useState<{ id: number; name: string; logo_url?: string }[]>([]);
  const [communityPickerOpen, setCommunityPickerOpen] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState<number | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState<Set<number>>(new Set());

  const [shareModalPost, setShareModalPost] = useState<PostItem | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRevenue: "$0.00",
    netEarnings: "$0.00",
    growthRate: "0%",
    unreadCount: 0,
    aiReplies: 0,
    humanFollowUps: 0,
    activeConversations: 0,
    channels: [
      { name: "General Chat", badge: "No activity", color: "text-muted-foreground", bg: "bg-muted" },
      { name: "Creators Hub", badge: "No activity", color: "text-muted-foreground", bg: "bg-muted" },
      { name: "Support Center", badge: "No activity", color: "text-muted-foreground", bg: "bg-muted" },
      { name: "Event Planners", badge: "No activity", color: "text-muted-foreground", bg: "bg-muted" },
    ],
    contentPlanner: [{ title: "No posts scheduled", date: "", status: "scheduled" }],
    topProduct: { title: "No products yet", subtitle: "", price: "" },
    communityMembers: "0 members",
    communityGrowth: "0% this week",
    upcomingEvent: { title: "No upcoming events", date: "", month: "", day: "" },
  });

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  const [friendReqs, setFriendReqs] = useState<SidebarFriendRequest[]>([]);
  const [communityReqs, setCommunityReqs] = useState<SidebarCommunityRequest[]>([]);
  const [reqsLoading, setReqsLoading] = useState(true);
  const [reqActionId, setReqActionId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiClient.get("/friends/requests"),
      apiClient.get("/community-requests/incoming"),
    ])
      .then(([f, c]) => {
        if (!active) return;
        const fData = f.data?.data?.data ?? f.data?.data ?? [];
        const cData = c.data?.data?.data ?? c.data?.data ?? [];
        setFriendReqs(Array.isArray(fData) ? fData : []);
        setCommunityReqs(Array.isArray(cData) ? cData : []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReqsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleFriendRequestAction = async (id: number, action: "accept" | "decline") => {
    setReqActionId(id);
    try {
      await apiClient.post(`/friends/requests/${id}/${action}`);
      setFriendReqs((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // keep request visible if the action failed
    } finally {
      setReqActionId(null);
    }
  };

  const handleCommunityRequestAction = async (id: number, action: "approve" | "reject") => {
    setReqActionId(id);
    try {
      await apiClient.post(`/memberships/${id}/${action}`);
      setCommunityReqs((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // keep request visible if the action failed
    } finally {
      setReqActionId(null);
    }
  };

  const friendRequests = friendReqs.filter((r) => r.sender);
  const communityRequests = communityReqs.filter((r) => r.community && r.user);
  const totalRequests = friendRequests.length + communityRequests.length;
  const requestItems: {
    kind: "friend" | "community";
    id: number;
    name: string;
    sub: string;
    avatarUrl?: string;
    initials: string;
  }[] = [
    ...friendRequests.slice(0, 3).map((r) => ({
      kind: "friend" as const,
      id: r.id,
      name: r.sender!.name,
      sub: "Sent you a friend request",
      avatarUrl: r.sender?.avatar_url ?? r.sender?.avatar ?? undefined,
      initials: r.sender!.name.charAt(0),
    })),
    ...communityRequests.slice(0, 3).map((r) => ({
      kind: "community" as const,
      id: r.id,
      name: r.user!.name,
      sub: `Requested to join ${r.community!.name}`,
      avatarUrl: r.community?.logo_url ?? undefined,
      initials: r.user!.name.charAt(0),
    })),
  ];

  interface StoryCard {
    id: number;
    name: string;
    isCreate?: boolean;
    time?: string;
    avatar?: string;
    bg?: string;
    text?: string;
    mediaType?: string;
    uploading?: boolean;
  }

  const [stories, setStories] = useState<StoryCard[]>([]);
  const [storyUploading, setStoryUploading] = useState(false);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [storyText, setStoryText] = useState("");

  useEffect(() => {
    apiClient.get("/stories")
      .then((res) => {
        const raw = res.data?.data ?? res.data ?? [];
        const data: StoryCard[] = Array.isArray(raw)
          ? raw.map((g: { user: { id: number; name: string; avatar?: string }; stories: { media_url: string; media_type: string; caption?: string; created_at: string }[] }) => ({
              id: g.user.id,
              name: g.user.name,
              avatar: g.user.avatar,
              bg: g.stories[0]?.media_url,
              text: g.stories[0]?.caption,
              mediaType: g.stories[0]?.media_type,
              time: g.stories[0]?.created_at
                ? timeAgo(g.stories[0].created_at)
                : "",
            }))
          : [];
        if (data.length > 0) setStories(data);
      })
      .catch(() => {});
  }, []);

  async function handleCreateTextStory() {
    const text = storyText.trim();
    if (!text) return;
    setStoryUploading(true);

    try {
      const storyRes = await apiClient.post("/stories", {
        media_type: "text",
        caption: text,
      });

      const created = storyRes.data?.data ?? storyRes.data;
      const newCard: StoryCard = {
        id: created?.user?.id ?? user?.id ?? Date.now(),
        name: created?.user?.name ?? user?.name ?? "You",
        avatar: created?.user?.avatar ?? user?.avatar,
        text,
        mediaType: "text",
        time: "Just now",
      };

      setStories((prev) => [newCard, ...prev]);
      setStoryText("");
      setStoryComposerOpen(false);
    } catch (err) {
      console.error("Story creation failed:", err);
      toast.error("Failed to create story. Please try again.");
    } finally {
      setStoryUploading(false);
    }
  }

  async function loadFeedComments(postId: number) {
    setLoadingComments((prev) => new Set(prev).add(postId));
    try {
      const res = await apiClient.get(`/posts/${postId}/comments`);
      const raw = res.data?.data ?? res.data ?? [];
      const comments: CommentItem[] = mapApiComments(raw);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, commentList: comments } : p))
      );
    } catch {}
    setLoadingComments((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
  }

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const feedRes = await apiClient.get("/feed?page=1&per_page=20");
      const feedData = feedRes.data?.data ?? feedRes.data;
      const apiPosts = feedData?.data ?? (Array.isArray(feedData) ? feedData : []);
      if (apiPosts.length > 0) {
        const mapped = apiPosts.map((p: any) => mapApiPost(p, user?.id));
        setPosts(mapped);
      }
    } catch (e) {
      // ignore
    }
    setFeedLoading(false);
  }, [user?.id]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [ovRes, statsRes] = await Promise.allSettled([
          apiClient.get("/analytics/overview"),
          apiClient.get("/conversations/stats"),
        ]);

        if (!active) return;

        if (ovRes.status === "fulfilled") {
          const ovData = ovRes.value.data?.data ?? ovRes.value.data;
          if (ovData?.revenue?.total) {
            const rev = (ovData.revenue.total / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
            const earnings = ((ovData.revenue.digital ?? 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
            setAnalytics((prev) => ({
              ...prev,
              totalRevenue: rev,
              netEarnings: earnings,
            }));
          }
        }

        if (statsRes.status === "fulfilled") {
          const s = statsRes.value.data?.data ?? statsRes.value.data;
          if (s) {
            setAnalytics((prev) => ({
              ...prev,
              unreadCount: s.unread ?? prev.unreadCount,
              aiReplies: s.ai_replies ?? prev.aiReplies,
              humanFollowUps: s.human_follow_ups ?? prev.humanFollowUps,
              activeConversations: s.active_conversations ?? prev.activeConversations,
            }));
          }
        }
      } catch (e) {
        // ignore
      }
    }

    loadData();
    loadFeed();
    return () => { active = false; };
  }, [user?.id, loadFeed]);

  async function handleCreatePost() {
    if (!postText.trim() || !selectedCommunityId || submittingPost) return;
    setSubmittingPost(true);
    setPostError(null);
    try {
      const res = await apiClient.post("/posts", {
        community_id: selectedCommunityId,
        type: "post",
        content: postText,
      });
      const created = res.data?.post ?? res.data?.data ?? res.data;
      if (created?.id) {
        const newPost: PostItem = {
          id: created.id,
          author: user?.name ?? "You",
          avatar: created.author?.avatar_url ?? user?.avatar_url ?? "",
          badge: created.community?.name ?? "Community",
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
        setPostText("");
        setComposerOpen(false);
      }
    } catch (err) {
      console.error("Post creation failed:", err);
      setPostError("Failed to publish the post. Please try again.");
    }
    setSubmittingPost(false);
  }

  async function toggleLike(id: number) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
    try {
      const res = await apiClient.post(`/posts/${id}/reactions/toggle`, { type: "like" });
      const likesCount = res.data?.likes_count;
      if (typeof likesCount === "number") {
        setPosts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, likes: likesCount } : p))
        );
      }
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
            : p
        )
      );
    }
  }

  async function handleAddComment(postId: number) {
    if (!commentInput.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await apiClient.post(`/posts/${postId}/comments`, {
        content: commentInput,
      });
      const created = res.data?.data ?? res.data;
      const newComment: CommentItem = {
        id: created?.id ?? Date.now(),
        user_name: user?.name ?? "You",
        avatar_url: user?.avatar_url ?? user?.avatar,
        content: commentInput,
        time: "Just now",
      };
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments: p.comments + 1,
                commentList: [...p.commentList, newComment],
              }
            : p
        )
      );
      setCommentInput("");
    } catch {}
    setSubmittingComment(false);
  }

  async function handleShare(post: PostItem) {
    setShareModalPost(post);
    setCopiedLink(false);
    try {
      const res = await apiClient.post(`/posts/${post.id}/share`);
      const sharesCount = res.data?.shares_count;
      if (typeof sharesCount === "number") {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, shares: sharesCount } : p))
        );
      } else {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, shares: p.shares + 1 } : p))
        );
      }
    } catch {
      // keep the current count; the server did not record the share
    }
  }

  function handleCopyLink() {
    if (!shareModalPost) return;
    const postUrl = `${window.location.origin}/app/feed?post=${shareModalPost.id}`;
    navigator.clipboard.writeText(postUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  }

  function handleClickComment(postId: number) {
    if (activeCommentPostId === postId) {
      setActiveCommentPostId(null);
      return;
    }
    setActiveCommentPostId(postId);
    const post = posts.find((p) => p.id === postId);
    if (post && post.commentList.length === 0) {
      loadFeedComments(postId);
    }
  }

  useEffect(() => {
    if (composerOpen && userCommunities.length === 0) {
      apiClient
        .get("/my-communities")
        .then((res) => {
          const raw = res.data?.communities ?? res.data?.data ?? [];
          const list = Array.isArray(raw)
            ? raw.map((c: any) => ({ id: c.id, name: c.name, logo_url: c.logo_url }))
            : [];
          setUserCommunities(list);
          if (list.length > 0 && !selectedCommunityId) {
            setSelectedCommunityId(list[0].id);
          }
        })
        .catch(() => {});
    }
  }, [composerOpen, userCommunities.length, selectedCommunityId]);

  if (user?.role === 'member') {
    return <MemberWebBlockPage />;
  }

  return (
    <AnimatedPage className="w-full min-h-screen bg-slate-50/60 dark:bg-background">
      <div className="flex w-full">

        <div className="flex-1 min-w-0 p-4 sm:p-6 space-y-5 max-w-[760px] mx-auto">

          <div className="bg-card border border-border shadow-xs rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#2164b6] to-purple-600 flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden shadow-xs">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  user?.name?.charAt(0)?.toUpperCase() ?? "U"
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setComposerOpen(true);
                  setCommunityPickerOpen(false);
                }}
                className="w-full rounded-full border border-border/80 bg-muted/40 hover:bg-muted/70 transition-colors px-5 py-2.5 text-xs sm:text-sm text-muted-foreground cursor-pointer flex items-center justify-between"
              >
                <span>What do you want to share with your community today?</span>
              </button>
            </div>

            {composerOpen && (
              <div className="pt-2 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <textarea
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="Write your post here... Share thoughts, updates, or announcements."
                  className="w-full h-28 p-3.5 text-xs sm:text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2164b6]/40 resize-none"
                  autoFocus
                />

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCommunityPickerOpen(!communityPickerOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {selectedCommunityId
                      ? userCommunities.find((c) => c.id === selectedCommunityId)?.name ?? "Select community"
                      : "Select community"}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {communityPickerOpen && userCommunities.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-30 py-1 max-h-48 overflow-y-auto">
                      {userCommunities.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCommunityId(c.id);
                            setCommunityPickerOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-semibold hover:bg-muted transition-colors flex items-center gap-2 ${
                            selectedCommunityId === c.id ? "text-[#2164b6] dark:text-[#7ab0ff]" : "text-foreground"
                          }`}
                        >
                          {c.logo_url ? (
                            <img src={c.logo_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] flex items-center justify-center text-[9px] font-bold">
                              {c.name.charAt(0)}
                            </div>
                          )}
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {communityPickerOpen && userCommunities.length === 0 && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-30 py-3 px-3 text-xs text-muted-foreground text-center">
                      <p className="font-semibold mb-1">No communities yet</p>
                      <Link to="/app/communities" className="text-[#2164b6] dark:text-[#7ab0ff] hover:underline" onClick={() => setCommunityPickerOpen(false)}>
                        Create a community first
                      </Link>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => { setComposerOpen(false); setPostText(""); setPostError(null); setCommunityPickerOpen(false); }}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreatePost}
                    disabled={submittingPost || !postText.trim() || !selectedCommunityId}
                    className="px-4 py-2 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    {submittingPost ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Publish Post
                  </button>
                </div>
                {postError && (
                  <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" /> {postError}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-1 sm:gap-2 border-t border-border/60 pt-3 overflow-x-auto no-scrollbar">
              {[
                { icon: <Plus className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" />, label: "Create Post", action: () => { setComposerOpen(true); setCommunityPickerOpen(false); } },
                { icon: <Package className="h-4 w-4 text-rose-500" />, label: "Add Product", to: "/app/store" },
                { icon: <Video className="h-4 w-4 text-red-500" />, label: "Go Live", to: "/app/audio-rooms" },
                { icon: <Calendar className="h-4 w-4 text-blue-500" />, label: "New Event", to: "/app/events" },
                { icon: <BarChart2 className="h-4 w-4 text-amber-500" />, label: "Poll", to: "/app/communities" },
              ].map((act, i) => (
                act.to ? (
                  <Link key={i} to={act.to} className="shrink-0">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 hover:border-border hover:bg-muted/50 text-xs font-semibold text-foreground transition-all">
                      {act.icon}
                      <span>{act.label}</span>
                    </button>
                  </Link>
                ) : (
                  <button key={i} onClick={act.action} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 hover:border-border hover:bg-muted/50 text-xs font-semibold text-foreground transition-all">
                    {act.icon}
                    <span>{act.label}</span>
                  </button>
                )
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
              <button
                onClick={() => setStoryComposerOpen(true)}
                disabled={storyUploading}
                className="relative shrink-0 w-28 sm:w-32 h-44 rounded-2xl overflow-hidden bg-gradient-to-b from-[#2164b6] to-blue-600 shadow-xs cursor-pointer group hover:scale-[1.02] transition-transform flex flex-col items-center justify-center text-white p-3 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  {storyUploading
                    ? <Loader2 className="h-6 w-6 text-white animate-spin" />
                    : <Plus className="h-6 w-6 text-white stroke-[2.5]" />}
                </div>
                <span className="text-xs font-bold text-center leading-tight">
                  {storyUploading ? "Creating…" : "Create Story"}
                </span>
              </button>

              {stories.map((story) => (
                <div key={story.id} className="relative shrink-0 w-28 sm:w-32 h-44 rounded-2xl overflow-hidden bg-slate-800 shadow-xs cursor-pointer group hover:scale-[1.02] transition-transform">
                  {story.bg && <img src={story.bg} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />

                  {story.mediaType === "text" && story.text && (
                    <div className="absolute inset-0 flex items-center justify-center px-3">
                      <p className="text-[12px] font-semibold text-white leading-snug line-clamp-4 drop-shadow-sm text-center">
                        {story.text}
                      </p>
                    </div>
                  )}

                  <div className="absolute top-2.5 left-2.5 z-10">
                    <div className="h-9 w-9 rounded-full p-[2px] bg-gradient-to-tr from-purple-500 via-pink-500 to-[#2164b6]">
                      {story.avatar
                        ? <img src={story.avatar} alt="" className="w-full h-full rounded-full object-cover border-2 border-white/40" />
                        : <div className="w-full h-full rounded-full bg-muted flex items-center justify-center text-xs font-bold text-white border-2 border-white/40">{story.name.charAt(0).toUpperCase()}</div>
                      }
                    </div>
                  </div>

                  <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 text-white">
                    <p className="text-[11px] font-bold leading-tight line-clamp-2 drop-shadow-sm">{story.name}</p>
                    <p className="text-[9px] text-white/80 font-medium">{story.time}</p>
                  </div>
                </div>
              ))}
            </div>

            {storyComposerOpen && (
              <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <textarea
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  placeholder="Share an update with your audience…"
                  maxLength={500}
                  className="w-full h-24 p-3.5 text-xs sm:text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2164b6]/40 resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{storyText.length}/500</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setStoryComposerOpen(false); setStoryText(""); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateTextStory}
                      disabled={storyUploading || !storyText.trim()}
                      className="px-4 py-1.5 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      {storyUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Publish Story
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-white dark:bg-card border border-border shadow-md flex items-center justify-center text-foreground hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            {feedLoading && posts.length === 0 && (
              <SkeletonFeed count={3} />
            )}

            {!feedLoading && posts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground space-y-2">
                <Rss className="h-8 w-8 mx-auto opacity-40" />
                <p className="text-sm font-semibold">No posts in your feed yet</p>
                <p className="text-xs">Follow communities and creators to see their posts here.</p>
                <Link to="/app/communities">
                  <button className="mt-2 px-4 py-2 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold text-xs transition-colors">
                    Browse Communities
                  </button>
                </Link>
              </div>
            )}

            {posts.map((post) => {
              const isCommenting = activeCommentPostId === post.id;

              return (
                <div key={post.id} className="bg-card border border-border shadow-xs rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#2164b6] to-purple-600 p-[2px]">
                        {post.avatar ? (
                          <img src={post.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <div className="w-full h-full rounded-full bg-muted flex items-center justify-center text-xs font-bold text-white">
                            {post.author.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-foreground">{post.author}</span>
                          {post.authorVerified && (
                            <BadgeCheck className="h-3.5 w-3.5 text-sky-500" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{post.badge} · {post.time} · 🌐</p>
                      </div>
                    </div>
                    <button className="text-muted-foreground hover:text-foreground p-1">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {post.content}
                  </p>

                  {post.embedType === "video" && post.embedBg && (
                    <div className="rounded-xl border border-border overflow-hidden bg-slate-900 flex flex-col sm:flex-row group cursor-pointer">
                      <div className="relative sm:w-48 h-32 bg-slate-800 shrink-0 flex items-center justify-center overflow-hidden">
                        <img src={post.embedBg} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80" />
                        <div className="absolute h-10 w-10 rounded-full bg-black/60 backdrop-blur-xs border border-white/30 flex items-center justify-center text-white">
                          <Play className="h-5 w-5 fill-white ml-0.5" />
                        </div>
                      </div>
                      <div className="p-3.5 flex flex-col justify-center bg-card flex-1 border-t sm:border-t-0 sm:border-l border-border">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">YOUTUBE.COM</span>
                        <h4 className="text-xs sm:text-sm font-bold text-foreground leading-snug group-hover:text-[#2164b6] dark:text-[#7ab0ff] transition-colors">
                          {post.embedTitle}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-tight">
                          {post.embedSub}
                        </p>
                      </div>
                    </div>
                  )}

                  {post.embedType === "product" && (
                    <div className="p-3.5 rounded-xl border border-border bg-slate-50/50 dark:bg-muted/30 flex items-center gap-4">
                      <div className="h-20 w-16 rounded-lg bg-gradient-to-br from-[#2164b6] to-blue-700 shrink-0 overflow-hidden shadow-xs flex items-center justify-center text-white p-2">
                        <div className="text-center">
                          <p className="text-[8px] font-extrabold uppercase tracking-widest text-white/80">LINK</p>
                          <p className="text-[10px] font-black leading-tight mt-1">External</p>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-foreground">{post.embedTitle}</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {post.embedSub}
                        </p>
                        {post.price && <p className="text-xs font-black text-foreground mt-1.5">{post.price}</p>}
                      </div>
                      <Link to="/app/store">
                        <button className="px-3.5 py-1.5 rounded-lg bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] hover:bg-[#2164b6]/20 font-bold text-xs transition-colors shrink-0">
                          View Product
                        </button>
                      </Link>
                    </div>
                  )}

                  {post.embedType === "media" && post.mediaUrl && (
                    <div className="rounded-xl overflow-hidden border border-border bg-slate-800">
                      <img src={post.mediaUrl} alt="" className="w-full max-h-80 object-cover" />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                    <div className="flex items-center gap-1">
                      <span className="inline-flex -space-x-1">
                        <span className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center text-[9px] text-white">👍</span>
                        <span className="h-4 w-4 rounded-full bg-rose-500 flex items-center justify-center text-[9px] text-white">❤️</span>
                      </span>
                      <span className="font-semibold text-foreground text-[11px] ml-1">{post.likes}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <button onClick={() => handleClickComment(post.id)} className="hover:text-[#2164b6] dark:text-[#7ab0ff] transition-colors">
                        {post.comments} Comments
                      </button>
                      <button onClick={() => handleShare(post)} className="hover:text-[#2164b6] dark:text-[#7ab0ff] transition-colors">
                        {post.shares} Shares
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center border-t border-border/60 pt-2 gap-1">
                    <button
                      onClick={() => toggleLike(post.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        post.isLiked ? "text-[#2164b6] dark:text-[#7ab0ff] bg-[#2164b6]/10" : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${post.isLiked ? "fill-[#2164b6]" : ""}`} /> Like
                    </button>
                    <button
                      onClick={() => handleClickComment(post.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isCommenting ? "text-[#2164b6] dark:text-[#7ab0ff] bg-[#2164b6]/10" : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <MessageCircle className="h-4 w-4" /> Comment
                    </button>
                    <button
                      onClick={() => handleShare(post)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <Share2 className="h-4 w-4" /> Share
                    </button>
                  </div>

                  {isCommenting && (
                    <div className="border-t border-border/60 pt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      {loadingComments.has(post.id) && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}

                      {!loadingComments.has(post.id) && post.commentList.length > 0 && (
                        <div className="space-y-2.5">
                          {post.commentList.map((cmt) => (
                            <div key={cmt.id} className="flex items-start gap-2.5 text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-muted/40">
                              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#2164b6] to-purple-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                                {cmt.avatar_url ? <img src={cmt.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : cmt.user_name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-foreground text-[11px]">
                                    {cmt.user_name}
                                    {cmt.verified && (
                                      <BadgeCheck size={12} className="inline-block ml-0.5 text-sky-500 -mt-0.5" aria-label="Verified" />
                                    )}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground">{cmt.time}</span>
                                </div>
                                <p className="text-muted-foreground mt-0.5 text-[11px] leading-tight">{cmt.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={commentInput}
                          onChange={(e) => setCommentInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(post.id); } }}
                          placeholder="Write a comment..."
                          className="flex-1 h-9 px-3.5 text-xs rounded-full border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2164b6]/40"
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          disabled={submittingComment || !commentInput.trim()}
                          className="px-3.5 h-9 rounded-full bg-[#2164b6] hover:bg-[#1a5091] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-1 shrink-0"
                        >
                          {submittingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

        </div>

        <div className="w-[350px] shrink-0 hidden lg:block p-4 space-y-4 overflow-y-auto h-screen sticky top-16 border-l border-border bg-[#F8F7F4] dark:bg-card/40">

          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff]">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <h3 className="font-bold text-foreground text-xs sm:text-sm">Requests</h3>
                {totalRequests > 0 && (
                  <span className="h-4 min-w-[18px] px-1 rounded-full bg-[#2164b6] text-white text-[9px] font-extrabold flex items-center justify-center">
                    {totalRequests > 99 ? "99+" : totalRequests}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <Link to="/app/friends" className="text-[#2164b6] dark:text-[#7ab0ff] hover:underline">Friends</Link>
                <span className="text-muted-foreground/40">·</span>
                <Link to="/app/communities" className="text-[#2164b6] dark:text-[#7ab0ff] hover:underline">Communities</Link>
              </div>
            </div>

            {reqsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
              </div>
            ) : requestItems.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/60 text-center py-2">
                No pending requests
              </p>
            ) : (
              <div className="space-y-2">
                {requestItems.map((item) => (
                  <div key={`${item.kind}-${item.id}`} className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-full shrink-0 overflow-hidden bg-gradient-to-br from-[#2164b6] to-[#1a6b9e] flex items-center justify-center text-white font-bold text-xs">
                      {item.avatarUrl
                        ? <img src={item.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : item.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-foreground truncate">{item.name}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{item.sub}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() =>
                          item.kind === "friend"
                            ? handleFriendRequestAction(item.id, "accept")
                            : handleCommunityRequestAction(item.id, "approve")
                        }
                        disabled={reqActionId === item.id}
                        title={item.kind === "friend" ? "Accept" : "Approve"}
                        className="h-6 w-6 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 flex items-center justify-center transition-colors disabled:opacity-50"
                      >
                        {reqActionId === item.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Check className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={() =>
                          item.kind === "friend"
                            ? handleFriendRequestAction(item.id, "decline")
                            : handleCommunityRequestAction(item.id, "reject")
                        }
                        disabled={reqActionId === item.id}
                        title={item.kind === "friend" ? "Decline" : "Reject"}
                        className="h-6 w-6 rounded-lg border border-border/60 text-muted-foreground hover:bg-muted flex items-center justify-center transition-colors disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-purple-200/80 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/70 via-purple-50/20 to-card p-4.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-600">
                  <Bot className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-foreground text-xs sm:text-sm">AI Assistant</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-purple-500/15 text-purple-600">BETA</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">Your MurihSpace AI, built to help you grow faster.</p>

            <div className="space-y-2 pt-1">
              {[
                { icon: <BarChart2 className="h-3.5 w-3.5 text-purple-600" />, text: "Create a poll to engage your community" },
                { icon: <Lightbulb className="h-3.5 w-3.5 text-emerald-600" />, text: "Suggest content ideas based on your audience" },
                { icon: <MessageSquare className="h-3.5 w-3.5 text-blue-600" />, text: "Summarize top conversations this week" },
              ].map((p, idx) => (
                <button key={idx} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-card border border-purple-100/80 dark:border-purple-950 hover:border-purple-300 transition-colors text-left shadow-2xs">
                  <div className="p-1 rounded-md bg-purple-50 dark:bg-purple-950 shrink-0">{p.icon}</div>
                  <span className="text-[11px] font-medium text-foreground leading-tight">{p.text}</span>
                </button>
              ))}
            </div>

            <Link to="/app/ai-assistant" className="block text-center text-[11px] font-bold text-purple-600 hover:underline pt-1">
              Go to AI Assistant &rarr;
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff]">
                  <Inbox className="h-3.5 w-3.5" />
                </div>
                <h3 className="font-bold text-foreground text-xs sm:text-sm">MurihSpace Inbox</h3>
              </div>
              <Link to="/app/messages" className="text-[10px] font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline">See all</Link>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Unread", value: analytics.unreadCount },
                { label: "AI Replies", value: analytics.aiReplies },
                { label: "Human Follow-Ups", value: analytics.humanFollowUps },
                { label: "Active Conversations", value: analytics.activeConversations },
              ].map((item) => (
                <div key={item.label} className="p-2.5 rounded-xl bg-slate-50 dark:bg-muted/40 border border-border/50">
                  <span className="text-[10px] text-muted-foreground font-semibold block leading-tight">{item.label}</span>
                  <span className="text-base font-black text-foreground">{item.value}</span>
                </div>
              ))}
            </div>

            <Link to="/app/messages" className="block text-center text-[11px] font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline border-t border-border/50 pt-2">
              Open Inbox &rarr;
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff]">
                  <MessageSquare className="h-3.5 w-3.5" />
                </div>
                <h3 className="font-bold text-foreground text-xs sm:text-sm">MurihSpace Chat Center</h3>
              </div>
              <Link to="/app/messages" className="text-[10px] font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline">Go to Inbox &rarr;</Link>
            </div>
            <p className="text-[10px] text-muted-foreground">All your community conversations in one place</p>

            <div className="grid grid-cols-2 gap-2">
              {analytics.channels.map((ch, idx) => (
                <Link key={idx} to="/app/messages">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-muted/40 border border-border/50 hover:border-[#2164b6]/40 transition-all cursor-pointer">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={`p-1 rounded-md ${ch.bg} ${ch.color}`}>
                        <MessageCircle className="h-3 w-3" />
                      </div>
                      <span className="text-[11px] font-bold text-foreground truncate">{ch.name}</span>
                    </div>
                    <span className={`text-[9px] font-semibold ${ch.color}`}>{ch.badge}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
                <h3 className="font-bold text-foreground text-xs sm:text-sm">Revenue &amp; Growth</h3>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground border border-border rounded-md px-1.5 py-0.5">This month ▾</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[9px] text-muted-foreground font-semibold">Total Revenue</p>
                <p className="text-xs font-black text-foreground">{analytics.totalRevenue}</p>
                {analytics.revenueGrowth && <p className="text-[9px] font-bold text-emerald-500">{analytics.revenueGrowth}</p>}
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground font-semibold">Net Earnings</p>
                <p className="text-xs font-black text-foreground">{analytics.netEarnings}</p>
                {analytics.earningsGrowth && <p className="text-[9px] font-bold text-emerald-500">{analytics.earningsGrowth}</p>}
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground font-semibold">Growth Rate</p>
                <p className="text-xs font-black text-foreground">{analytics.growthRate}</p>
                {analytics.growthRateDelta && <p className="text-[9px] font-bold text-emerald-500">{analytics.growthRateDelta}</p>}
              </div>
            </div>

            <div className="h-8 w-full pt-1">
              <svg className="w-full h-full" viewBox="0 0 200 30" preserveAspectRatio="none">
                <path d="M 0 25 Q 40 20, 80 15 T 140 10 T 200 5" fill="none" stroke="#2164b6" strokeWidth="2" />
              </svg>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                <Wallet className="h-3.5 w-3.5" />
              </div>
              <h3 className="font-bold text-foreground text-xs sm:text-sm">Monetization Status</h3>
            </div>
            <p className="text-[11px] text-muted-foreground text-center py-2">Wallet data unavailable</p>
            <Link to="/app/wallet" className="block text-center text-[10px] font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline">
              Go to Wallet
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                  <Activity className="h-3.5 w-3.5" />
                </div>
                <h3 className="font-bold text-foreground text-xs sm:text-sm">Chat Activity</h3>
              </div>
              <Link to="/app/messages" className="text-[10px] font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline">View All</Link>
            </div>
            <p className="text-[11px] text-muted-foreground text-center py-2">No recent activity</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card p-3 shadow-xs space-y-2">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-[#2164b6] dark:text-[#7ab0ff]" />
                <span className="text-[11px] font-bold text-foreground">Content Planner</span>
              </div>
              <Link to="/app/marketing" className="text-[9px] font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline block">View Calendar</Link>
              <div className="text-[10px] text-muted-foreground">
                <p className="font-semibold text-foreground">{analytics.contentPlanner[0]?.title ?? "No posts scheduled"}</p>
                <p className="text-[9px]">{analytics.contentPlanner[0]?.date ?? ""}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-3 shadow-xs space-y-2">
              <div className="flex items-center gap-1">
                <Package className="h-3 w-3 text-amber-500" />
                <span className="text-[11px] font-bold text-foreground">Top Products</span>
              </div>
              <Link to="/app/store" className="text-[9px] font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline block">View All</Link>
              <div className="flex items-center gap-2">
                <div className="h-7 w-6 rounded bg-[#2164b6] shrink-0 text-[8px] text-white font-bold flex items-center justify-center">
                  PDF
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold truncate">{analytics.topProduct.title}</p>
                  <p className="text-[9px] text-muted-foreground">{analytics.topProduct.subtitle}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card p-3 shadow-xs space-y-2">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3 text-purple-500" />
                <span className="text-[11px] font-bold text-foreground">Community Activity</span>
              </div>
              <Link to="/app/communities" className="text-[9px] font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline block">View All</Link>
              <div className="text-[10px]">
                <p className="font-bold text-foreground">{analytics.communityMembers}</p>
                <p className="text-[9px] text-emerald-500 font-semibold">{analytics.communityGrowth}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-3 shadow-xs space-y-2">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-rose-500" />
                <span className="text-[11px] font-bold text-foreground">Upcoming Events</span>
              </div>
              <Link to="/app/events" className="text-[9px] font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline block">See all</Link>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-600 shrink-0 font-black text-center text-[9px] leading-tight flex flex-col items-center justify-center">
                  <span>{analytics.upcomingEvent.month}</span>
                  <span className="text-xs">{analytics.upcomingEvent.day}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold truncate">{analytics.upcomingEvent.title}</p>
                  <p className="text-[9px] text-muted-foreground">{analytics.upcomingEvent.date}</p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {shareModalPost && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border shadow-2xl rounded-2xl p-5 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Share2 className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" /> Share Post
              </h3>
              <button onClick={() => setShareModalPost(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Share this post with your network or copy direct link:
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/app/feed?post=${shareModalPost.id}`}
                className="flex-1 h-9 px-3 text-xs rounded-xl border border-border bg-muted/40 font-mono text-muted-foreground truncate"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 h-9 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold text-xs transition-colors flex items-center gap-1 shrink-0"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedLink ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareModalPost.content.slice(0, 100))}&url=${encodeURIComponent(`${window.location.origin}/app/feed?post=${shareModalPost.id}`)}`}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl border border-border bg-slate-50 dark:bg-muted/40 hover:bg-muted text-center text-xs font-semibold text-foreground transition-colors"
              >
                Twitter / X
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/app/feed?post=${shareModalPost.id}`)}`}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl border border-border bg-slate-50 dark:bg-muted/40 hover:bg-muted text-center text-xs font-semibold text-foreground transition-colors"
              >
                Facebook
              </a>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareModalPost.content.slice(0, 100)} ${window.location.origin}/app/feed?post=${shareModalPost.id}`)}`}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl border border-border bg-slate-50 dark:bg-muted/40 hover:bg-muted text-center text-xs font-semibold text-foreground transition-colors"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
