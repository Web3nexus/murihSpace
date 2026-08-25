import * as React from "react";
import { Link, useNavigate } from "react-router";
import { AnimatedPage } from "@/components/common/AnimatedPage";
import { CreateCommunityModal } from "@/components/community/CreateCommunityModal";
import { apiClient } from "@/lib/api/client";
import {
  Search,
  Plus,
  Settings,
  Users,
  Globe,
  Compass,
  Clock,
  Lock,
  MoreHorizontal,
  Heart,
  MessageCircle,
  Share2,
  ChevronRight,
} from "lucide-react";
import type { Community } from "@/types/community";

interface FeedPost {
  id: number;
  author: string;
  avatar_url?: string;
  community_name: string;
  community_avatar?: string;
  community_slug: string;
  badge?: string;
  time: string;
  content: string;
  media_url?: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
}

const CATEGORIES = [
  "All", "Technology", "Art & Design", "Business",
  "Gaming", "Education", "Lifestyle", "Fitness", "General",
];

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function CommunitiesPage() {
  const navigate = useNavigate();

  // Left panel state
  const [panel, setPanel] = React.useState<"feed" | "discover" | "my">("feed");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // Communities data
  const [myCommunities, setMyCommunities] = React.useState<Community[]>([]);
  const [allCommunities, setAllCommunities] = React.useState<Community[]>([]);
  const [loadingCommunities, setLoadingCommunities] = React.useState(true);

  // Feed posts from joined communities
  const [feedPosts, setFeedPosts] = React.useState<FeedPost[]>([]);
  const [loadingFeed, setLoadingFeed] = React.useState(true);

  // Discover filters
  const [selectedCategory, setSelectedCategory] = React.useState("All");
  const [discoverPage, setDiscoverPage] = React.useState(1);
  const [discoverLastPage, setDiscoverLastPage] = React.useState(1);

  // Deferred (debounced) discover search
  const debouncedQuery = React.useDeferredValue(searchQuery.trim());
  const discoverSeq = React.useRef(0);

  // Fetch my communities
  const fetchMyCommunities = React.useCallback(async () => {
    try {
      const res = await apiClient.get("/my-communities?per_page=50");
      const raw = res.data?.data?.communities ?? res.data?.communities ?? res.data?.data ?? res.data ?? [];
      setMyCommunities(Array.isArray(raw) ? raw : []);
    } catch {
      setMyCommunities([]);
    } finally {
      setLoadingCommunities(false);
    }
  }, []);

  // Fetch all / discover communities
  const fetchAllCommunities = React.useCallback(async () => {
    const seq = ++discoverSeq.current;
    try {
      const params = new URLSearchParams({ page: String(discoverPage), per_page: "18" });
      if (selectedCategory !== "All") params.set("category", selectedCategory);
      if (debouncedQuery) params.set("search", debouncedQuery);
      const res = await apiClient.get(`/communities?${params}`);
      if (seq !== discoverSeq.current) return;
      const list = res.data?.data ?? res.data ?? {};
      setAllCommunities(Array.isArray(list) ? list : list.data ?? []);
      setDiscoverLastPage(list?.last_page ?? 1);
    } catch {
      if (seq === discoverSeq.current) setAllCommunities([]);
    }
  }, [discoverPage, selectedCategory, debouncedQuery]);

  // Fetch community activity feed
  const fetchFeed = React.useCallback(async () => {
    setLoadingFeed(true);
    try {
      const res = await apiClient.get("/feed?per_page=20");
      const raw = res.data?.data ?? res.data ?? [];
      const posts: FeedPost[] = (Array.isArray(raw) ? raw : raw.data ?? []).map(
        (p: Record<string, unknown>) => ({
          id: Number(p.id),
          author: (p.author_name ?? (p.user as Record<string, unknown> | undefined)?.name ?? "Community Member") as string,
          avatar_url: (p.avatar_url ?? (p.user as Record<string, unknown> | undefined)?.avatar_url) as string | undefined,
          community_name: ((p.community as Record<string, unknown> | undefined)?.name ?? "Community") as string,
          community_avatar: (p.community as Record<string, unknown> | undefined)?.logo_url as string | undefined,
          community_slug: ((p.community as Record<string, unknown> | undefined)?.slug ?? "#") as string,
          badge: (p.author_badge ?? p.badge) as string | undefined,
          time: timeAgo(p.created_at as string ?? new Date().toISOString()),
          content: (p.content ?? p.body ?? "") as string,
          media_url: (p.media_url ?? p.embed_url) as string | undefined,
          likes: Number(p.likes_count ?? p.likes ?? 0),
          comments: Number(p.comments_count ?? p.comments ?? 0),
          shares: Number(p.shares_count ?? p.shares ?? 0),
          isLiked: Boolean(p.is_liked),
        })
      );
      setFeedPosts(posts);
    } catch {
      setFeedPosts([]);
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  React.useEffect(() => { fetchMyCommunities(); }, [fetchMyCommunities]);
  React.useEffect(() => { fetchFeed(); }, [fetchFeed]);
  React.useEffect(() => { fetchAllCommunities(); }, [fetchAllCommunities]);

  function handleCreated(newCommunity: Community) {
    setMyCommunities((prev) => [newCommunity, ...prev]);
    setPanel("my");
  }

  function toggleLike(postId: number) {
    setFeedPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
    apiClient.post(`/posts/${postId}/reactions/toggle`, { type: "like" }).catch(() => {});
  }

  async function handleJoin(community: Community) {
    try {
      const res = await apiClient.post(`/communities/${community.id}/join`);
      const membershipStatus = res.data?.membership?.status ?? res.data?.data?.membership?.status;
      if (membershipStatus !== "active") return;
      setMyCommunities((prev) =>
        prev.some((c) => c.id === community.id) ? prev : [...prev, community]
      );
    } catch { /* silently fail */ }
  }

  // Filtered search for left panel
  const filteredMyList = myCommunities.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDiscover = allCommunities.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Main content by panel ──
  const renderMain = () => {
    if (panel === "feed") {
      return (
        <div className="space-y-0">
          <div className="pb-4 border-b border-border">
            <h2 className="text-[15px] font-bold text-foreground">Recent activity</h2>
          </div>

          {loadingFeed ? (
            <div className="space-y-4 pt-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-card border border-border rounded-2xl p-4 space-y-3 animate-pulse">
                  <div className="flex gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-32 rounded bg-muted" />
                      <div className="h-3 w-24 rounded bg-muted" />
                    </div>
                  </div>
                  <div className="h-4 w-full rounded bg-muted" />
                  <div className="h-4 w-2/3 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : feedPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">No activity yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Join communities to see their posts here.
              </p>
              <button
                onClick={() => setPanel("discover")}
                className="mt-4 px-4 py-2 rounded-lg bg-[#2164b6] text-white text-sm font-bold hover:bg-[#1a5091] transition-colors"
              >
                Discover Communities
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-4">
              {feedPosts.map((post) => (
                <div key={post.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
                  {/* Post Header */}
                  <div className="flex items-start gap-3 p-4 pb-3">
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-full bg-muted overflow-hidden">
                        {post.community_avatar ? (
                          <img src={post.community_avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#2164b6] text-white font-bold text-sm">
                            {post.community_name.charAt(0)}
                          </div>
                        )}
                      </div>
                      {/* Author mini-avatar */}
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-card bg-muted overflow-hidden">
                        {post.avatar_url ? (
                          <img src={post.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-purple-500 text-white text-[8px] font-bold">
                            {post.author.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/app/communities/${post.community_slug}`}
                        className="text-[13.5px] font-bold text-foreground hover:underline line-clamp-1"
                      >
                        {post.community_name}
                      </Link>
                      <p className="text-[12px] text-muted-foreground">
                        {post.author}
                        {post.badge && (
                          <span className="ml-1.5 text-[#2164b6] dark:text-[#7ab0ff] font-semibold">
                            · {post.badge}
                          </span>
                        )}
                        {" · "}{post.time}
                      </p>
                    </div>

                    <button className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Post Content */}
                  <div className="px-4 pb-3">
                    <p className="text-[14px] text-foreground leading-relaxed">{post.content}</p>
                  </div>

                  {/* Media */}
                  {post.media_url && (
                    <div className="mx-4 mb-3 rounded-xl overflow-hidden border border-border">
                      <img src={post.media_url} alt="" className="w-full object-cover max-h-72" />
                    </div>
                  )}

                  {/* Reaction counts */}
                  {(post.likes > 0 || post.comments > 0) && (
                    <div className="px-4 py-2 flex items-center justify-between text-[12px] text-muted-foreground border-t border-border/50">
                      <span>{post.likes > 0 ? `${post.likes} Likes` : ""}</span>
                      <span>{post.comments > 0 ? `${post.comments} Comments` : ""}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center border-t border-border">
                    {[
                      {
                        icon: <Heart className={`h-[18px] w-[18px] ${post.isLiked ? "fill-rose-500 text-rose-500" : ""}`} />,
                        label: "Like",
                        onClick: () => toggleLike(post.id),
                        active: post.isLiked,
                      },
                      {
                        icon: <MessageCircle className="h-[18px] w-[18px]" />,
                        label: "Comment",
                        onClick: () => navigate(`/app/communities/${post.community_slug}`),
                        active: false,
                      },
                      {
                        icon: <Share2 className="h-[18px] w-[18px]" />,
                        label: "Share",
                        onClick: () => {
                          navigator.clipboard.writeText(`${window.location.origin}/app/communities/${post.community_slug}`);
                        },
                        active: false,
                      },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        onClick={btn.onClick}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold transition-colors hover:bg-muted/50 ${
                          btn.active ? "text-rose-500" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {btn.icon}
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (panel === "discover") {
      return (
        <div className="space-y-4">
          <h2 className="text-[15px] font-bold text-foreground">Discover Communities</h2>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setDiscoverPage(1); }}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "bg-[#2164b6] text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredDiscover.length === 0 ? (
              <div className="col-span-2 text-center py-16 text-muted-foreground">
                <Globe className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-semibold">No communities found</p>
                <p className="text-sm mt-1">Try a different category or search term.</p>
              </div>
            ) : (
              filteredDiscover.map((c) => {
                const isJoined = myCommunities.some((m) => m.id === c.id);
                return (
                  <div key={c.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-[#2164b6]/40 transition-all group">
                    {/* Cover */}
                    <div className="h-24 w-full relative overflow-hidden bg-gradient-to-r from-[#2164b6] to-blue-700">
                      {c.cover_url && (
                        <img src={c.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      )}
                    </div>
                    <div className="p-4 pt-0">
                      <div className="-mt-7 mb-3 flex items-end gap-3">
                        <div className="h-12 w-12 rounded-xl border-2 border-card shadow-sm overflow-hidden bg-[#2164b6] flex items-center justify-center text-white font-black text-base">
                          {c.logo_url
                            ? <img src={c.logo_url} alt="" className="w-full h-full object-cover" />
                            : c.name.charAt(0).toUpperCase()
                          }
                        </div>
                        <div className="flex-1 min-w-0 mt-7">
                          <h3 className="font-bold text-[13.5px] text-foreground truncate">{c.name}</h3>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {(c.members_count ?? 1).toLocaleString()} members
                            {c.privacy === "private" && <Lock className="h-3 w-3 ml-1" />}
                          </p>
                        </div>
                      </div>
                      <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                        {c.description || "A community on MurihSpace."}
                      </p>
                      <button
                        onClick={() => isJoined ? navigate(`/app/communities/${c.slug}`) : handleJoin(c)}
                        className={`w-full py-2 rounded-lg text-[13px] font-bold transition-colors ${
                          isJoined
                            ? "bg-muted text-foreground hover:bg-muted/80"
                            : "bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] hover:bg-[#2164b6]/20"
                        }`}
                      >
                        {isJoined ? "View Group" : "+ Join"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {discoverLastPage > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button onClick={() => setDiscoverPage((p) => Math.max(1, p - 1))} disabled={discoverPage <= 1} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Previous</button>
              <span className="text-xs text-muted-foreground">Page {discoverPage} of {discoverLastPage}</span>
              <button onClick={() => setDiscoverPage((p) => Math.min(discoverLastPage, p + 1))} disabled={discoverPage >= discoverLastPage} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      );
    }

    // My Communities panel
    return (
      <div className="space-y-4">
        <h2 className="text-[15px] font-bold text-foreground">Your Communities</h2>
        {loadingCommunities ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl animate-pulse">
                <div className="h-12 w-12 rounded-xl bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-32 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredMyList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">No communities yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create or join communities to see them here.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-lg bg-[#2164b6] text-white text-sm font-bold hover:bg-[#1a5091] transition-colors"
            >
              + Create Community
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMyList.map((c) => (
              <Link
                key={c.id}
                to={`/app/communities/${c.slug}`}
                className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-[#2164b6]/40 hover:shadow-xs transition-all group"
              >
                <div className="h-12 w-12 rounded-xl overflow-hidden bg-[#2164b6] flex items-center justify-center text-white font-black text-base shrink-0">
                  {c.logo_url
                    ? <img src={c.logo_url} alt="" className="w-full h-full object-cover" />
                    : c.name.charAt(0).toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[13.5px] text-foreground truncate group-hover:text-[#2164b6] dark:text-[#7ab0ff] transition-colors">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    {(c.members_count ?? 1).toLocaleString()} members
                    {c.privacy === "private" && <><Lock className="h-3 w-3" /> Private</>}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <AnimatedPage className="w-full min-h-screen bg-[#F0F2F5] dark:bg-background">
      <div className="flex w-full h-[calc(100vh-56px)]">

        {/* ── LEFT PANEL ── */}
        <div className="hidden lg:flex w-[340px] shrink-0 bg-[#F8F7F4] dark:bg-card border-r border-border flex-col overflow-y-auto">

          {/* Panel Header */}
          <div className="px-4 pt-5 pb-3 flex items-center justify-between">
            <h1 className="text-[22px] font-black text-foreground">Communities</h1>
            <button
              onClick={() => setIsModalOpen(true)}
              className="h-9 w-9 rounded-full bg-[#F0F2F5] hover:bg-[#E4E6EB] flex items-center justify-center text-[#1a2e3b] transition-colors"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#65676B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setDiscoverPage(1); }}
                placeholder="Search communities"
                className="w-full h-9 pl-9 pr-3 text-[13px] rounded-full border border-border bg-[#F0F2F5] dark:bg-muted placeholder:text-[#65676B] text-[#1a2e3b] dark:text-foreground focus:outline-none focus:ring-2 focus:ring-[#2164b6]/30 focus:border-[#2164b6] transition-all"
              />
            </div>
          </div>

          {/* Nav Items */}
          <nav className="px-2 space-y-0.5">
            {[
              { id: "feed", label: "Your feed", icon: <Clock className="h-5 w-5" /> },
              { id: "discover", label: "Discover", icon: <Compass className="h-5 w-5" /> },
              { id: "my", label: "Your communities", icon: <Users className="h-5 w-5" /> },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setPanel(item.id as "feed" | "discover" | "my")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold transition-colors ${
                  panel === item.id
                    ? "bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff]"
                    : "text-[#1a2e3b] hover:bg-[#F0F2F5]"
                }`}
              >
                <span className={`p-2 rounded-full ${panel === item.id ? "bg-[#2164b6]/15" : "bg-[#F0F2F5]"}`}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Create New Group Button */}
          <div className="px-4 py-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-[#2164b6]/30 text-[#2164b6] dark:text-[#7ab0ff] text-[13px] font-bold hover:bg-[#2164b6]/5 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create New Community
            </button>
          </div>

          <div className="mx-4 border-t border-border" />

          {/* Groups You've Joined */}
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-foreground">Communities you've joined</h3>
            <button
              onClick={() => setPanel("my")}
              className="text-[12px] font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline"
            >
              See all
            </button>
          </div>

          <div className="px-2 pb-4 space-y-0.5 flex-1">
            {loadingCommunities ? (
              <div className="space-y-2 px-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex items-center gap-3 animate-pulse">
                    <div className="h-10 w-10 rounded-xl bg-muted shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-28 rounded bg-muted" />
                      <div className="h-2.5 w-20 rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : myCommunities.length === 0 ? (
              <p className="text-[12px] text-muted-foreground px-3 py-2">
                You haven't joined any communities yet.
              </p>
            ) : (
              myCommunities.slice(0, 8).map((c) => (
                <Link
                  key={c.id}
                  to={`/app/communities/${c.slug}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F0F2F5] transition-colors group"
                >
                  <div className="h-10 w-10 rounded-xl overflow-hidden bg-[#2164b6] flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {c.logo_url
                      ? <img src={c.logo_url} alt="" className="w-full h-full object-cover" />
                      : c.name.charAt(0).toUpperCase()
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate group-hover:text-[#2164b6] dark:text-[#7ab0ff] transition-colors">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.last_active_at ? `Last active ${timeAgo(c.last_active_at)} ago` : `${(c.members_count ?? 1).toLocaleString()} members`}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-[680px] mx-auto px-4 py-6">
            {renderMain()}
          </div>
        </div>
      </div>

      {/* Create Community Modal */}
      <CreateCommunityModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onCreated={handleCreated}
      />
    </AnimatedPage>
  );
}
