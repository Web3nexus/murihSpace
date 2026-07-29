import { useState, useEffect, useCallback } from "react";
import { Rss, Loader2, Heart, MessageCircle, Share2, Bookmark, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = localStorage.getItem("murihspace-token") || localStorage.getItem("auth_token");
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface FeedPost {
  id: number; content: string; media_url: string | null;
  likes_count: number; comments_count: number;
  is_liked: boolean; is_bookmarked: boolean;
  created_at: string;
  user: { name: string; username: string; avatar_url: string | null };
}

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPosts = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/feed?page=${pageNum}&per_page=10`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load feed");
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      const items = list?.data ?? list ?? [];
      const meta = list?.meta ?? {};
      if (append) setPosts(p => [...p, ...items]); else setPosts(items);
      setHasMore(pageNum < (meta?.last_page ?? 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(next, true);
  };

  const toggleLike = async (post: FeedPost) => {
    const method = post.is_liked ? "DELETE" : "POST";
    try {
      const res = await fetch(`${API_BASE}/feed/${post.id}/like`, { method, headers: getAuthHeaders() });
      if (res.ok) setPosts(p => p.map(x => x.id === post.id ? { ...x, is_liked: !x.is_liked, likes_count: x.is_liked ? x.likes_count - 1 : x.likes_count + 1 } : x));
    } catch {}
  };

  const toggleBookmark = async (post: FeedPost) => {
    const method = post.is_bookmarked ? "DELETE" : "POST";
    try {
      const res = await fetch(`${API_BASE}/feed/${post.id}/bookmark`, { method, headers: getAuthHeaders() });
      if (res.ok) setPosts(p => p.map(x => x.id === post.id ? { ...x, is_bookmarked: !x.is_bookmarked } : x));
    } catch {}
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  return (
    <div className="w-full mx-auto max-w-[680px] space-y-6 p-6 lg:p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5"><Rss className="h-6 w-6 text-[#38A8D8]" /> Feed</h1>
        <Button size="sm" className="bg-[#38A8D8] hover:bg-[#2e8ab8] text-white">New Post</Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-4">Your personalized community feed.</p>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          <button onClick={() => { setError(null); fetchPosts(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      {!error && posts.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Rss className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No posts yet</p>
          <p className="text-xs mt-1">Follow creators to see their latest content here.</p>
        </div>
      )}

      {posts.map((p) => (
        <div key={p.id} className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold uppercase">
              {p.user.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">{p.user.name}</p>
              <p className="text-[11px] text-muted-foreground">@{p.user.username} &middot; {new Date(p.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.content}</p>
          {p.media_url && (
            <img src={p.media_url} alt="" className="w-full rounded-lg object-cover max-h-96" />
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <button onClick={() => toggleLike(p)} className={`flex items-center gap-1.5 hover:text-red-500 transition ${p.is_liked ? "text-red-500" : ""}`}>
              <Heart className={`h-4 w-4 ${p.is_liked ? "fill-red-500" : ""}`} /> {p.likes_count}
            </button>
            <button className="flex items-center gap-1.5 hover:text-[#38A8D8] transition">
              <MessageCircle className="h-4 w-4" /> {p.comments_count}
            </button>
            <button className="flex items-center gap-1.5 hover:text-[#38A8D8] transition"><Share2 className="h-4 w-4" /></button>
            <button onClick={() => toggleBookmark(p)} className={`flex items-center gap-1.5 hover:text-yellow-500 transition ml-auto ${p.is_bookmarked ? "text-yellow-500" : ""}`}>
              <Bookmark className={`h-4 w-4 ${p.is_bookmarked ? "fill-yellow-500" : ""}`} />
            </button>
          </div>
        </div>
      ))}

      {hasMore && !error && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="text-xs font-bold gap-2">
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Load More
          </Button>
        </div>
      )}
    </div>
  );
}
