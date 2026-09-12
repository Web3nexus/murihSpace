import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Link } from "react-router";
import { AnimatedPage } from "@/components/common/AnimatedPage";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api/client";
import { timeAgo, mapApiPost, mapApiComments } from "@/lib/feed";
import { SkeletonFeed } from "@/components/ui/skeletons";
import {
  Users as Users,
  Plus as Plus,
  Package as Package,
  Calendar as Calendar,
  ChatCircle as MessageCircle,
  VideoCamera as Video,
  ChartBar as BarChart2,
  Heart as Heart,
  ShareNetwork as Share2,
  DotsThree as MoreHorizontal,
  CaretRight as ChevronRight,
  Play as Play,
  SealCheck as BadgeCheck,
  PaperPlaneRight as Send,
  Spinner as Loader2,
  Copy as Copy,
  Check as Check,
  X as X,
  CaretDown as ChevronDown,
  Rss as Rss,
  WarningCircle as AlertCircle,
  User as UserIcon,
} from "@phosphor-icons/react";

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
  const [suggestedCommunities, setSuggestedCommunities] = useState<
    { id: number; name: string; slug: string; logo_url?: string | null; members_count?: number }[]
  >([]);
  const [upcomingEventsList, setUpcomingEventsList] = useState<
    { id: number; title: string; starts_at?: string; location?: string }[]
  >([]);
  const [reqsLoading, setReqsLoading] = useState(true);
  const [reqActionId, setReqActionId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiClient.get("/friends/requests"),
      apiClient.get("/community-requests/incoming"),
      apiClient.get("/communities?tab=discover&per_page=4"),
      apiClient.get("/events?per_page=3"),
    ])
      .then(([f, c, comms, evts]) => {
        if (!active) return;
        if (f.status === "fulfilled") {
          const fData = f.value.data?.data?.data ?? f.value.data?.data ?? [];
          setFriendReqs(Array.isArray(fData) ? fData : []);
        }
        if (c.status === "fulfilled") {
          const cData = c.value.data?.data?.data ?? c.value.data?.data ?? [];
          setCommunityReqs(Array.isArray(cData) ? cData : []);
        }
        if (comms.status === "fulfilled") {
          const commData = comms.value.data?.data?.data ?? comms.value.data?.data ?? comms.value.data ?? [];
          setSuggestedCommunities(Array.isArray(commData) ? commData.slice(0, 4) : []);
        }
        if (evts.status === "fulfilled") {
          const evtData = evts.value.data?.data?.data ?? evts.value.data?.data ?? evts.value.data ?? [];
          setUpcomingEventsList(Array.isArray(evtData) ? evtData.slice(0, 3) : []);
        }
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

  return (
    <AnimatedPage className="w-full min-h-screen bg-[#F0F2F5] dark:bg-[#18191A] text-[#050505] dark:text-[#E4E6EB]">
      <div className="flex w-full justify-center max-w-[1400px] mx-auto min-h-0">

        <div className="flex-1 min-w-0 p-3 sm:p-4 space-y-4 max-w-[680px] w-full mx-auto">

          <div className="bg-white dark:bg-[#242526] rounded-lg shadow-xs p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#2164b6] flex items-center justify-center text-white shrink-0 overflow-hidden">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon weight="fill" className="text-white/90" style={{ width: 20, height: 20 }} />
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setComposerOpen(true);
                  setCommunityPickerOpen(false);
                }}
                className="w-full rounded-full bg-[#F0F2F5] dark:bg-[#3A3B3C] hover:bg-[#E4E6EB] dark:hover:bg-[#4E4F50] transition-colors px-4 py-2.5 text-xs sm:text-[14px] text-[#65676B] dark:text-[#B0B3B8] cursor-pointer flex items-center justify-between"
              >
                <span>What's on your mind?</span>
              </button>
            </div>

            {composerOpen && (
              <div className="pt-2 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <textarea
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="Write your post here... Share thoughts, updates, or announcements."
                  className="w-full h-28 p-3.5 text-xs sm:text-sm rounded-lg border-none bg-background focus:outline-none focus:ring-2 focus:ring-[#2164b6]/40 resize-none"
                  autoFocus
                />

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCommunityPickerOpen(!communityPickerOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none/60 text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {selectedCommunityId
                      ? userCommunities.find((c) => c.id === selectedCommunityId)?.name ?? "Select community"
                      : "Select community"}
                    <ChevronDown weight="fill" className="h-3 w-3" />
                  </button>
                  {communityPickerOpen && userCommunities.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-card border-none rounded-lg shadow-lg z-30 py-1 max-h-48 overflow-y-auto">
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
                    <div className="absolute top-full left-0 mt-1 w-56 bg-card border-none rounded-lg shadow-lg z-30 py-3 px-3 text-xs text-muted-foreground text-center">
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
                    className="px-4 py-2 rounded-lg bg-[#2164b6] hover:bg-[#1a5091] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-1.5 "
                  >
                    {submittingPost ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send weight="fill" className="h-3.5 w-3.5" />}
                    Publish Post
                  </button>
                </div>
                {postError && (
                  <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <AlertCircle weight="fill" className="h-3.5 w-3.5" /> {postError}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-1 sm:gap-2 border-t border-border/60 pt-3 overflow-x-auto no-scrollbar">
              {[
                { icon: <Plus weight="fill" className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" />, label: "Create Post", action: () => { setComposerOpen(true); setCommunityPickerOpen(false); } },
                { icon: <Package weight="fill" className="h-4 w-4 text-rose-500" />, label: "Add Product", to: "/app/store" },
                { icon: <Video weight="fill" className="h-4 w-4 text-red-500" />, label: "Go Live", to: "/app/audio-rooms" },
                { icon: <Video weight="fill" className="h-4 w-4 text-emerald-500" />, label: "New Meeting", to: "/app/meetings" },
                { icon: <Calendar weight="fill" className="h-4 w-4 text-blue-500" />, label: "New Event", to: "/app/events" },
                { icon: <BarChart2 weight="fill" className="h-4 w-4 text-amber-500" />, label: "Poll", to: "/app/communities" },
              ].map((act, i) => (
                act.to ? (
                  <Link key={i} to={act.to} className="shrink-0">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none/60 hover:border-border hover:bg-muted/50 text-xs font-semibold text-foreground transition-all">
                      {act.icon}
                      <span>{act.label}</span>
                    </button>
                  </Link>
                ) : (
                  <button key={i} onClick={act.action} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none/60 hover:border-border hover:bg-muted/50 text-xs font-semibold text-foreground transition-all">
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
                className="relative shrink-0 w-28 sm:w-32 h-44 rounded-lg overflow-hidden bg-gradient-to-b from-[#2164b6] to-blue-600  cursor-pointer group hover:scale-[1.02] transition-transform flex flex-col items-center justify-center text-white p-3 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  {storyUploading
                    ? <Loader2 weight="fill" className="h-6 w-6 text-white animate-spin" />
                    : <Plus weight="fill" className="h-6 w-6 text-white stroke-[2.5]" />}
                </div>
                <span className="text-xs font-bold text-center leading-tight">
                  {storyUploading ? "Creating…" : "Create Story"}
                </span>
              </button>

              {stories.map((story) => (
                <div key={story.id} className="relative shrink-0 w-28 sm:w-32 h-44 rounded-lg overflow-hidden bg-slate-800  cursor-pointer group hover:scale-[1.02] transition-transform">
                  {story.bg && <img src={story.bg} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />

                  {story.mediaType === "text" && story.text && (
                    <div className="absolute inset-0 flex items-center justify-center px-3">
                      <p className="text-[12px] font-semibold text-white leading-snug line-clamp-4 drop- text-center">
                        {story.text}
                      </p>
                    </div>
                  )}

                  <div className="absolute top-2.5 left-2.5 z-10">
                    <div className="h-9 w-9 rounded-full p-[2px] bg-[#1877f2]">
                      {story.avatar
                        ? <img src={story.avatar} alt="" className="w-full h-full rounded-full object-cover border-2 border-white/40" />
                        : <div className="w-full h-full rounded-full bg-muted flex items-center justify-center text-xs font-bold text-white border-2 border-white/40">{story.name.charAt(0).toUpperCase()}</div>
                      }
                    </div>
                  </div>

                  <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 text-white">
                    <p className="text-[11px] font-bold leading-tight line-clamp-2 drop-">{story.name}</p>
                    <p className="text-[9px] text-white/80 font-medium">{story.time}</p>
                  </div>
                </div>
              ))}
            </div>

            {storyComposerOpen && (
              <div className="mt-3 rounded-lg border-none bg-card p-4  space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <textarea
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  placeholder="Share an update with your audience…"
                  maxLength={500}
                  className="w-full h-24 p-3.5 text-xs sm:text-sm rounded-lg border-none bg-background focus:outline-none focus:ring-2 focus:ring-[#2164b6]/40 resize-none"
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
                      className="px-4 py-1.5 rounded-lg bg-[#2164b6] hover:bg-[#1a5091] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-1.5 "
                    >
                      {storyUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send weight="fill" className="h-3.5 w-3.5" />}
                      Publish Story
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-white dark:bg-card border-none shadow-sm flex items-center justify-center text-foreground hover:bg-muted transition-colors">
              <ChevronRight weight="fill" className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            {feedLoading && posts.length === 0 && (
              <SkeletonFeed count={3} />
            )}

            {!feedLoading && posts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground space-y-2">
                <Rss weight="fill" className="h-8 w-8 mx-auto opacity-40" />
                <p className="text-sm font-semibold">No posts in your feed yet</p>
                <p className="text-xs">Follow communities and creators to see their posts here.</p>
                <Link to="/app/communities">
                  <button className="mt-2 px-4 py-2 rounded-lg bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold text-xs transition-colors">
                    Browse Communities
                  </button>
                </Link>
              </div>
            )}

            {posts.map((post) => {
              const isCommenting = activeCommentPostId === post.id;

              return (
                <div key={post.id} className="bg-card border-none  rounded-lg p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#1877f2] p-[2px]">
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
                            <BadgeCheck weight="fill" className="h-3.5 w-3.5 text-sky-500" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{post.badge} · {post.time} · 🌐</p>
                      </div>
                    </div>
                    <button className="text-muted-foreground hover:text-foreground p-1">
                      <MoreHorizontal weight="fill" className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {post.content}
                  </p>

                  {post.embedType === "video" && post.embedBg && (
                    <div className="rounded-lg border-none overflow-hidden bg-slate-900 flex flex-col sm:flex-row group cursor-pointer">
                      <div className="relative sm:w-48 h-32 bg-slate-800 shrink-0 flex items-center justify-center overflow-hidden">
                        <img src={post.embedBg} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80" />
                        <div className="absolute h-10 w-10 rounded-full bg-black/60 backdrop-blur-xs border border-white/30 flex items-center justify-center text-white">
                          <Play weight="fill" className="h-5 w-5 fill-white ml-0.5" />
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
                    <div className="p-3.5 rounded-lg border-none bg-slate-50/50 dark:bg-muted/30 flex items-center gap-4">
                      <div className="h-20 w-16 rounded-lg bg-gradient-to-br from-[#2164b6] to-blue-700 shrink-0 overflow-hidden  flex items-center justify-center text-white p-2">
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
                    <div className="rounded-lg overflow-hidden border-none bg-slate-800">
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
                      <Heart weight="fill" className={`h-4 w-4 ${post.isLiked ? "fill-[#2164b6]" : ""}`} /> Like
                    </button>
                    <button
                      onClick={() => handleClickComment(post.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isCommenting ? "text-[#2164b6] dark:text-[#7ab0ff] bg-[#2164b6]/10" : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <MessageCircle weight="fill" className="h-4 w-4" /> Comment
                    </button>
                    <button
                      onClick={() => handleShare(post)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <Share2 weight="fill" className="h-4 w-4" /> Share
                    </button>
                  </div>

                  {isCommenting && (
                    <div className="border-t border-border/60 pt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      {loadingComments.has(post.id) && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 weight="fill" className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}

                      {!loadingComments.has(post.id) && post.commentList.length > 0 && (
                        <div className="space-y-2.5">
                          {post.commentList.map((cmt) => (
                            <div key={cmt.id} className="flex items-start gap-2.5 text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-muted/40">
                              <div className="h-7 w-7 rounded-full bg-[#1877f2] flex items-center justify-center text-white shrink-0">
                                {cmt.avatar_url ? <img src={cmt.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : <UserIcon weight="fill" className="text-white/90" style={{ width: 14, height: 14 }} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-foreground text-[11px]">
                                    {cmt.user_name}
                                    {cmt.verified && (
                                      <BadgeCheck weight="fill" size={12} className="inline-block ml-0.5 text-sky-500 -mt-0.5" aria-label="Verified" />
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
                          className="flex-1 h-9 px-3.5 text-xs rounded-full border-none bg-background focus:outline-none focus:ring-2 focus:ring-[#2164b6]/40"
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          disabled={submittingComment || !commentInput.trim()}
                          className="px-3.5 h-9 rounded-lg bg-[#2164b6] hover:bg-[#1a5091] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-1 shrink-0"
                        >
                          {submittingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send weight="fill" className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

        </div>

        {/* Right Rail: 280-320px, borderless, holding Requests, Suggested Communities, Events, Chats */}
        <div className="w-[280px] xl:w-[320px] shrink-0 hidden lg:block py-4 px-2 space-y-4 overflow-y-auto h-[calc(100vh-3.5rem)] sticky top-14 no-scrollbar">

          {/* 1. Requests (Friends & Communities) */}
          <div className="rounded-lg bg-white dark:bg-[#242526] shadow-xs p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users weight="fill" className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" />
                <h3 className="font-bold text-[#050505] dark:text-[#E4E6EB] text-xs sm:text-sm">Requests</h3>
                {totalRequests > 0 && (
                  <span className="h-4 min-w-[18px] px-1 rounded-full bg-[#2164b6] text-white text-[9px] font-extrabold flex items-center justify-center">
                    {totalRequests > 99 ? "99+" : totalRequests}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                <Link to="/app/requests" className="text-[#2164b6] dark:text-[#7ab0ff] hover:underline">See all</Link>
              </div>
            </div>

            {reqsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 weight="fill" className="h-4 w-4 animate-spin text-muted-foreground/50" />
              </div>
            ) : requestItems.length === 0 ? (
              <p className="text-[11px] text-[#65676B] dark:text-[#B0B3B8] text-center py-2">
                No pending requests
              </p>
            ) : (
              <div className="space-y-2.5">
                {requestItems.map((item) => (
                  <div key={`${item.kind}-${item.id}`} className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-full shrink-0 overflow-hidden bg-[#2164b6] flex items-center justify-center text-white">
                      {item.avatarUrl
                        ? <img src={item.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : <UserIcon weight="fill" className="text-white/90" style={{ width: 16, height: 16 }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#050505] dark:text-[#E4E6EB] truncate leading-snug">{item.name}</p>
                      <p className="text-[10px] text-[#65676B] dark:text-[#B0B3B8] truncate">{item.sub}</p>
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
                        className="h-7 w-7 rounded-md bg-[#2164b6] text-white hover:bg-[#1a5091] flex items-center justify-center transition-colors disabled:opacity-50"
                      >
                        {reqActionId === item.id
                          ? <Loader2 weight="fill" className="h-3.5 w-3.5 animate-spin" />
                          : <Check weight="bold" className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() =>
                          item.kind === "friend"
                            ? handleFriendRequestAction(item.id, "decline")
                            : handleCommunityRequestAction(item.id, "reject")
                        }
                        disabled={reqActionId === item.id}
                        title={item.kind === "friend" ? "Decline" : "Reject"}
                        className="h-7 w-7 rounded-md bg-[#E4E6EB] dark:bg-[#3A3B3C] text-[#050505] dark:text-[#E4E6EB] hover:bg-[#D8DADF] flex items-center justify-center transition-colors disabled:opacity-50"
                      >
                        <X weight="bold" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Suggested Communities */}
          <div className="rounded-lg bg-white dark:bg-[#242526] shadow-xs p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#050505] dark:text-[#E4E6EB] text-xs sm:text-sm">
                Suggested Communities
              </h3>
              <Link to="/app/communities" className="text-[11px] font-semibold text-[#2164b6] dark:text-[#7ab0ff] hover:underline">
                See all
              </Link>
            </div>

            {suggestedCommunities.length === 0 ? (
              <p className="text-[11px] text-[#65676B] dark:text-[#B0B3B8] text-center py-2">
                No new suggestions
              </p>
            ) : (
              <div className="space-y-2.5">
                {suggestedCommunities.map((comm) => (
                  <div key={comm.id} className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-lg shrink-0 overflow-hidden bg-[#2164b6]/10 text-[#2164b6] flex items-center justify-center">
                      {comm.logo_url ? (
                        <img src={comm.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon weight="fill" className="text-white/90" style={{ width: 18, height: 18 }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#050505] dark:text-[#E4E6EB] truncate leading-tight">
                        {comm.name}
                      </p>
                      <p className="text-[10px] text-[#65676B] dark:text-[#B0B3B8] truncate">
                        {comm.members_count ? `${comm.members_count} members` : "Active group"}
                      </p>
                    </div>
                    <Link
                      to={`/app/communities/${comm.slug}`}
                      className="px-2.5 py-1 rounded-md bg-[#F0F2F5] dark:bg-[#3A3B3C] hover:bg-[#E4E6EB] dark:hover:bg-[#4E4F50] text-[#050505] dark:text-[#E4E6EB] text-[11px] font-semibold transition-colors shrink-0"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Upcoming Events */}
          <div className="rounded-lg bg-white dark:bg-[#242526] shadow-xs p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#050505] dark:text-[#E4E6EB] text-xs sm:text-sm">
                Upcoming Events
              </h3>
              <Link to="/app/events" className="text-[11px] font-semibold text-[#2164b6] dark:text-[#7ab0ff] hover:underline">
                See all
              </Link>
            </div>

            {upcomingEventsList.length === 0 ? (
              <div className="flex items-center gap-2.5 py-1">
                <div className="h-9 w-9 rounded-lg bg-rose-500/10 text-rose-600 shrink-0 font-black text-center text-[9px] leading-tight flex flex-col items-center justify-center">
                  <span>{analytics.upcomingEvent.month || "LIVE"}</span>
                  <span className="text-xs">{analytics.upcomingEvent.day || "•"}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#050505] dark:text-[#E4E6EB] truncate">
                    {analytics.upcomingEvent.title || "No scheduled events"}
                  </p>
                  <p className="text-[10px] text-[#65676B] dark:text-[#B0B3B8]">
                    {analytics.upcomingEvent.date || "Stay tuned for new lives"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingEventsList.map((evt) => {
                  const d = evt.starts_at ? new Date(evt.starts_at) : null;
                  const month = d ? d.toLocaleString("en-US", { month: "short" }).toUpperCase() : "LIVE";
                  const day = d ? String(d.getDate()) : "•";
                  return (
                    <Link
                      key={evt.id}
                      to="/app/events"
                      className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] transition-colors"
                    >
                      <div className="h-9 w-9 rounded-lg bg-rose-500/10 text-rose-600 shrink-0 font-bold text-center text-[9px] leading-tight flex flex-col items-center justify-center">
                        <span>{month}</span>
                        <span className="text-xs font-black">{day}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-[#050505] dark:text-[#E4E6EB] truncate leading-tight">
                          {evt.title}
                        </p>
                        <p className="text-[10px] text-[#65676B] dark:text-[#B0B3B8] truncate">
                          {evt.location || "Online Studio"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Conversations */}
          <div className="rounded-lg bg-white dark:bg-[#242526] shadow-xs p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#050505] dark:text-[#E4E6EB] text-xs sm:text-sm">
                Conversations
              </h3>
              <Link to="/app/messages" className="text-[11px] font-semibold text-[#2164b6] dark:text-[#7ab0ff] hover:underline">
                Open Chat
              </Link>
            </div>
            <div className="space-y-1">
              {analytics.channels.slice(0, 3).map((ch, idx) => (
                <Link
                  key={idx}
                  to="/app/messages"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-[12px] font-medium text-[#050505] dark:text-[#E4E6EB] truncate">{ch.name}</span>
                  </div>
                  <span className="text-[10px] text-[#65676B] dark:text-[#B0B3B8] shrink-0">{ch.badge}</span>
                </Link>
              ))}
            </div>
          </div>

        </div>

      </div>

      {shareModalPost && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border-none shadow-2xl rounded-lg p-5 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Share2 weight="fill" className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" /> Share Post
              </h3>
              <button onClick={() => setShareModalPost(null)} className="text-muted-foreground hover:text-foreground">
                <X weight="fill" className="h-4 w-4" />
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
                className="flex-1 h-9 px-3 text-xs rounded-lg border-none bg-muted/40 font-mono text-muted-foreground truncate"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 h-9 rounded-lg bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold text-xs transition-colors flex items-center gap-1 shrink-0"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy weight="fill" className="h-3.5 w-3.5" />}
                {copiedLink ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareModalPost.content.slice(0, 100))}&url=${encodeURIComponent(`${window.location.origin}/app/feed?post=${shareModalPost.id}`)}`}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-lg border-none bg-slate-50 dark:bg-muted/40 hover:bg-muted text-center text-xs font-semibold text-foreground transition-colors"
              >
                Twitter / X
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/app/feed?post=${shareModalPost.id}`)}`}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-lg border-none bg-slate-50 dark:bg-muted/40 hover:bg-muted text-center text-xs font-semibold text-foreground transition-colors"
              >
                Facebook
              </a>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareModalPost.content.slice(0, 100)} ${window.location.origin}/app/feed?post=${shareModalPost.id}`)}`}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-lg border-none bg-slate-50 dark:bg-muted/40 hover:bg-muted text-center text-xs font-semibold text-foreground transition-colors"
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
