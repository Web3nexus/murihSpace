import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { AnimatedPage } from "@/components/common/AnimatedPage";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { timeAgo, mapApiPost, mapApiComments } from "@/lib/feed";
import {
  Plus,
  Heart,
  MessageCircle,
  Share2,
  ChevronRight,
  ChevronLeft,
  Play,
  BadgeCheck,
  Rss,
  Send,
  Loader2,
  Copy,
  Check,
  X,
  ChevronDown,
} from "lucide-react";

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
  commentList: CommentItem[];
  isSponsored?: boolean;
  ctaText?: string;
  ctaUrl?: string;
  impressionUrl?: string;
  clickUrl?: string;
}

export default function FeedPage() {
  const { user } = useAuth();

  const [activeCommentPostId, setActiveCommentPostId] = useState<number | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState<Set<number>>(new Set());

  const [shareModalPost, setShareModalPost] = useState<PostItem | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  interface StorySubItem {
    id: number;
    media_url?: string;
    media_type: string;
    caption?: string;
    created_at: string;
  }

  interface StoryGroup {
    id: number;
    name: string;
    avatar?: string;
    bg?: string;
    time?: string;
    items: StorySubItem[];
  }

  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeSubIndex, setActiveSubIndex] = useState<number>(0);
  const storyFileRef = useRef<HTMLInputElement>(null);
  const storyScrollRef = useRef<HTMLDivElement>(null);
  const [storyUploading, setStoryUploading] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState("");
  const [submittingPost, setSubmittingPost] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);
  const [userCommunities, setUserCommunities] = useState<{ id: number; name: string; logo_url?: string }[]>([]);
  const [communityPickerOpen, setCommunityPickerOpen] = useState(false);

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

  useEffect(() => {
    async function loadFeed() {
      setFeedLoading(true);
      try {
        const feedRes = await apiClient.get("/feed?page=1&per_page=20");
        const feedData = feedRes.data?.data ?? feedRes.data;
        const apiPosts = feedData?.data ?? (Array.isArray(feedData) ? feedData : []);
        const mapped: PostItem[] = apiPosts.map((p: any) => mapApiPost(p, user?.id));

        try {
          const adRes = await fetch(`http://localhost:8002/api/delivery/ad?placement=feed&user_id=${user?.id || 1}`);
          const adData = await adRes.json();
          
          if (adData.status === 'success' && adData.data) {
            const payload = adData.data;
            const sponsoredPost: PostItem = {
              id: Date.now() + Math.floor(Math.random() * 1000), // unique id
              author: "Sponsored",
              authorVerified: true,
              avatar: "", 
              badge: "Ad",
              time: "Sponsored",
              content: payload.creative?.body || "Check out this amazing offer!",
              likes: Math.floor(Math.random() * 100) + 10,
              comments: 0,
              shares: 0,
              isLiked: false,
              embedType: "media",
              embedBg: payload.creative?.image_url || "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80",
              commentList: [],
              isSponsored: true,
              ctaText: payload.cta_type || "Learn More",
              ctaUrl: payload.cta_url,
              impressionUrl: payload.tracking?.impression_url,
              clickUrl: payload.tracking?.click_url,
            };
            if (mapped.length >= 2) {
              mapped.splice(2, 0, sponsoredPost);
            } else {
              mapped.push(sponsoredPost);
            }
          }
        } catch (adErr) {
          console.error("Failed to load sponsored ad", adErr);
        }

        setPosts(mapped);
      } catch {}
      setFeedLoading(false);
    }

    async function loadStories() {
      try {
        const res = await apiClient.get("/stories");
        const raw = res.data?.data ?? res.data ?? [];
        const data: StoryGroup[] = Array.isArray(raw)
          ? raw
              .filter((g: { user?: { id: number } }) => Boolean(g?.user?.id))
              .map((g: { user: { id: number; name: string; avatar?: string }; stories?: StorySubItem[] }) => ({
                id: g.user.id,
                name: g.user.name,
                avatar: g.user.avatar,
                bg: g.stories?.[0]?.media_url,
                time: g.stories?.[0]?.created_at ? timeAgo(g.stories[0].created_at) : "",
                items: g.stories ?? [],
              }))
          : [];
        setStories(data);
      } catch {}
    }

    loadFeed();
    loadStories();
  }, [user?.id]);

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
    if (!commentInput.trim()) return;
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
            ? { ...p, comments: p.comments + 1, commentList: [...p.commentList, newComment] }
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
      // leave shares count untouched; the share was not recorded server-side
    }
  }

  useEffect(() => {
    if (!shareModalPost) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShareModalPost(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shareModalPost]);

  useEffect(() => {
    if (activeStoryIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveStoryIndex(null);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const curr = stories[activeStoryIndex];
        if (!curr) return;
        if (activeSubIndex < curr.items.length - 1) {
          setActiveSubIndex((s) => s + 1);
        } else if (activeStoryIndex < stories.length - 1) {
          setActiveStoryIndex((g) => g! + 1);
          setActiveSubIndex(0);
        } else {
          setActiveStoryIndex(null);
        }
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (activeSubIndex > 0) {
          setActiveSubIndex((s) => s - 1);
        } else if (activeStoryIndex > 0) {
          const prev = stories[activeStoryIndex - 1];
          setActiveStoryIndex((g) => g! - 1);
          setActiveSubIndex(prev.items.length - 1);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeStoryIndex, activeSubIndex, stories]);

  async function handleCreatePost() {
    if (!postText.trim() || !selectedCommunityId) return;
    setSubmittingPost(true);
    let success = false;
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
        success = true;
      }
    } catch (err) {
      console.error("Post creation failed:", err);
    }
    if (success) {
      setPostText("");
      setComposerOpen(false);
    }
    setSubmittingPost(false);
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

  async function handleStoryFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setStoryUploading(true);
    try {
      const isVideo = file.type.startsWith("video/");
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await apiClient.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const mediaUrl = uploadRes.data?.data?.url ?? uploadRes.data?.url;
      if (!mediaUrl) throw new Error("Upload returned no URL");
      const storyRes = await apiClient.post("/stories", {
        media_url: mediaUrl,
        media_type: isVideo ? "video" : "image",
      });
      const created = storyRes.data?.data ?? storyRes.data;
      const newItem: StorySubItem = {
        id: created?.id ?? Date.now(),
        media_url: mediaUrl,
        media_type: isVideo ? "video" : "image",
        created_at: new Date().toISOString(),
      };
      const groupId = created?.user?.id ?? user?.id ?? Date.now();
      setStories((prev) => {
        const existing = prev.find((g) => g.id === groupId);
        if (existing) {
          return [
            { ...existing, bg: mediaUrl, time: "Just now", items: [...existing.items, newItem] },
            ...prev.filter((g) => g.id !== groupId),
          ];
        }
        return [
          {
            id: groupId,
            name: created?.user?.name ?? user?.name ?? "You",
            avatar: created?.user?.avatar ?? user?.avatar,
            bg: mediaUrl,
            time: "Just now",
            items: [newItem],
          },
          ...prev,
        ];
      });
    } catch (err) {
      console.error("Story creation failed:", err);
      toast.error("Failed to create story. Please try again.");
    } finally {
      setStoryUploading(false);
      URL.revokeObjectURL(objectUrl);
      if (storyFileRef.current) storyFileRef.current.value = "";
    }
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

  return (
    <AnimatedPage className="w-full min-h-screen bg-slate-50/60 dark:bg-background">
      <div className="max-w-[760px] mx-auto p-4 sm:p-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
              <Rss className="h-5 w-5 text-[#2164b6] dark:text-[#7ab0ff]" /> Community Feed
            </h1>
            <p className="text-xs text-muted-foreground">Stay updated with content from creator communities you follow.</p>
          </div>
        </div>

        <div className="bg-card border border-border shadow-xs rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#2164b6] to-purple-600 flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden shadow-xs">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0)?.toUpperCase() ?? "U"
              )}
            </div>
            <div
              onClick={() => { setComposerOpen(true); setCommunityPickerOpen(false); }}
              className="flex-1 rounded-full border border-border/80 bg-muted/40 hover:bg-muted/70 transition-colors px-5 py-2.5 text-xs sm:text-sm text-muted-foreground cursor-pointer"
            >
              What do you want to share with your community today?
            </div>
          </div>

          {composerOpen && (
            <div className="pt-2 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Write your post here..."
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
                        onClick={() => { setSelectedCommunityId(c.id); setCommunityPickerOpen(false); }}
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
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setComposerOpen(false); setPostText(""); setCommunityPickerOpen(false); }}
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
                  Publish
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <div ref={storyScrollRef} className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
            <input
              ref={storyFileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleStoryFileChange}
            />
            <button
              onClick={() => storyFileRef.current?.click()}
              disabled={storyUploading}
              className="relative shrink-0 w-28 sm:w-32 h-44 rounded-2xl overflow-hidden bg-gradient-to-b from-[#2164b6] to-blue-600 shadow-xs cursor-pointer group hover:scale-[1.02] transition-transform flex flex-col items-center justify-center text-white p-3 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                {storyUploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Plus className="h-6 w-6 text-white stroke-[2.5]" />}
              </div>
              <span className="text-xs font-bold text-center leading-tight">{storyUploading ? "Uploading…" : "Create Story"}</span>
            </button>

            {stories.map((story, index) => (
              <div
                key={story.id}
                onClick={() => {
                  setActiveStoryIndex(index);
                  setActiveSubIndex(0);
                }}
                className="relative shrink-0 w-28 sm:w-32 h-44 rounded-2xl overflow-hidden bg-slate-800 shadow-xs cursor-pointer group hover:scale-[1.02] transition-transform"
              >
                {story.bg && <img src={story.bg} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
                <div className="absolute top-2.5 left-2.5 z-10">
                  <div className="h-9 w-9 rounded-full p-[2px] bg-gradient-to-tr from-purple-500 via-pink-500 to-[#2164b6]">
                    {story.avatar ? (
                      <img src={story.avatar} alt="" className="w-full h-full rounded-full object-cover border-2 border-white/40" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-muted flex items-center justify-center text-xs font-bold text-white border-2 border-white/40">
                        {story.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 text-white">
                  <p className="text-[11px] font-bold leading-tight line-clamp-2 drop-shadow-sm">{story.name}</p>
                  <p className="text-[9px] text-white/80 font-medium">{story.time}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => storyScrollRef.current?.scrollBy({ left: 320, behavior: "smooth" })}
            aria-label="Scroll stories"
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-white dark:bg-card border border-border shadow-md flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {feedLoading && posts.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-xs font-semibold">Loading feed…</span>
            </div>
          )}

          {!feedLoading && posts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <Rss className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-sm font-semibold">No posts in the feed yet</p>
              <p className="text-xs">Be the first to share something with the community.</p>
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
              <div key={post.id} className="bg-card border border-border shadow-xs rounded-2xl p-4 sm:p-5 space-y-3 relative">
                {post.isSponsored && post.impressionUrl && (
                  <img src={post.impressionUrl} alt="" className="hidden w-0 h-0 absolute" />
                )}
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
                    </div>
                    <Link to="/app/store">
                      <button className="px-3.5 py-1.5 rounded-lg bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] hover:bg-[#2164b6]/20 font-bold text-xs transition-colors shrink-0">
                        View
                      </button>
                    </Link>
                  </div>
                )}

                {post.embedType === "media" && post.embedBg && (
                  <div className="rounded-xl overflow-hidden border border-border bg-slate-800">
                    <img src={post.embedBg} alt="" className="w-full max-h-80 object-cover" />
                  </div>
                )}

                {post.isSponsored && post.ctaUrl && (
                  <div className="pt-2">
                    <a 
                      href={post.ctaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        if (post.clickUrl) fetch(post.clickUrl).catch(() => {});
                      }}
                      className="block w-full text-center px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#2164b6] dark:text-[#7ab0ff] font-bold text-xs transition-colors"
                    >
                      {post.ctaText} <ChevronRight className="inline-block h-4 w-4 ml-1 -mt-0.5" />
                    </a>
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
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(post.id); }}
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

      {shareModalPost && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShareModalPost(null)}
        >
          <div
            className="bg-card border border-border shadow-2xl rounded-2xl p-5 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Share2 className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" /> Share Post
              </h3>
              <button onClick={() => setShareModalPost(null)} aria-label="Close share dialog" className="text-muted-foreground hover:text-foreground">
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
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/app/feed?post=${shareModalPost.id}`);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 3000);
                }}
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

      {/* ── Story Viewer Modal ── */}
      {activeStoryIndex !== null && stories[activeStoryIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActiveStoryIndex(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Story by ${stories[activeStoryIndex].name}`}
            className="relative w-full max-w-sm h-[85vh] max-h-[640px] rounded-3xl overflow-hidden bg-slate-900 shadow-2xl flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background Media */}
            {stories[activeStoryIndex].items[activeSubIndex]?.media_url && stories[activeStoryIndex].items[activeSubIndex]?.media_type === "video" ? (
              <video
                src={stories[activeStoryIndex].items[activeSubIndex].media_url}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : stories[activeStoryIndex].items[activeSubIndex]?.media_url || stories[activeStoryIndex].bg ? (
              <img
                src={stories[activeStoryIndex].items[activeSubIndex]?.media_url ?? stories[activeStoryIndex].bg}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#2164b6] to-purple-800 flex items-center justify-center p-6 text-center text-white font-bold text-lg">
                {stories[activeStoryIndex].items[activeSubIndex]?.caption ?? stories[activeStoryIndex].name}
              </div>
            )}

            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80 pointer-events-none" />

            {/* Top Bar: Progress Bars + User Info + Close */}
            <div className="relative z-10 p-4 space-y-3">
              {/* Segmented Progress bar */}
              <div className="flex gap-1">
                {stories[activeStoryIndex].items.map((_, i) => (
                  <div key={i} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
                    <div
                      className={`h-full bg-white transition-all duration-300 ${
                        i < activeSubIndex ? "w-full" : i === activeSubIndex ? "w-full animate-pulse" : "w-0"
                      }`}
                    />
                  </div>
                ))}
              </div>

              {/* User header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-[#2164b6] p-[2px]">
                    {stories[activeStoryIndex].avatar ? (
                      <img src={stories[activeStoryIndex].avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-xs">
                        {stories[activeStoryIndex].name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white drop-shadow-sm">{stories[activeStoryIndex].name}</p>
                    <p className="text-[10px] text-white/70">{stories[activeStoryIndex].time}</p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveStoryIndex(null)}
                  className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                  aria-label="Close story"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Nav Tap Targets (Left/Right half click) */}
            <div className="absolute inset-0 z-0 flex">
              <div
                className="w-1/2 h-full cursor-pointer"
                onClick={() => {
                  if (activeSubIndex > 0) {
                    setActiveSubIndex((s) => s - 1);
                  } else if (activeStoryIndex > 0) {
                    const prevGroup = stories[activeStoryIndex - 1];
                    setActiveStoryIndex((g) => g! - 1);
                    setActiveSubIndex(prevGroup.items.length - 1);
                  }
                }}
              />
              <div
                className="w-1/2 h-full cursor-pointer"
                onClick={() => {
                  const currGroup = stories[activeStoryIndex];
                  if (activeSubIndex < currGroup.items.length - 1) {
                    setActiveSubIndex((s) => s + 1);
                  } else if (activeStoryIndex < stories.length - 1) {
                    setActiveStoryIndex((g) => g! + 1);
                    setActiveSubIndex(0);
                  } else {
                    setActiveStoryIndex(null);
                  }
                }}
              />
            </div>

            {/* Navigation Arrow buttons */}
            {activeStoryIndex > 0 || activeSubIndex > 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeSubIndex > 0) {
                    setActiveSubIndex((s) => s - 1);
                  } else if (activeStoryIndex > 0) {
                    const prevGroup = stories[activeStoryIndex - 1];
                    setActiveStoryIndex((g) => g! - 1);
                    setActiveSubIndex(prevGroup.items.length - 1);
                  }
                }}
                aria-label="Previous story"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}

            <button
              onClick={(e) => {
                e.stopPropagation();
                const currGroup = stories[activeStoryIndex];
                if (activeSubIndex < currGroup.items.length - 1) {
                  setActiveSubIndex((s) => s + 1);
                } else if (activeStoryIndex < stories.length - 1) {
                  setActiveStoryIndex((g) => g! + 1);
                  setActiveSubIndex(0);
                } else {
                  setActiveStoryIndex(null);
                }
              }}
                aria-label="Next story"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

            {/* Bottom Caption */}
            {stories[activeStoryIndex].items[activeSubIndex]?.caption && (
              <div className="relative z-10 p-4 pb-6 text-center">
                <p className="text-xs font-semibold text-white/90 bg-black/50 backdrop-blur-md p-3 rounded-2xl border border-white/10 line-clamp-3">
                  {stories[activeStoryIndex].items[activeSubIndex].caption}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
