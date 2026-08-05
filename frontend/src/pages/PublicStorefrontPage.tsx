import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import {
  Store,
  Globe,
  ExternalLink,
  Users,
  CheckCircle2,
  UserPlus,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  MessageSquareText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PublicStorefront } from '@/types/storefront';

interface StorePost {
  id: number; content: string;
  font_family: string; background_color: string; text_color: string; text_align: "left" | "center" | "right";
  created_at: string;
}

const FONT_MAP: Record<string, string> = {
  sans: "system-ui, -apple-system, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
  display: "Impact, 'Arial Black', sans-serif",
  handwriting: "'Segoe Script', 'Apple Chancery', cursive",
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

export function PublicStorefrontPage() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [store, setStore] = useState<PublicStorefront | null>(null);
  const [posts, setPosts] = useState<StorePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shortCode) return;

    async function fetchPublicStore() {
      setIsLoading(true);
      setError(null);

      try {
        const [storeRes, postsRes] = await Promise.allSettled([
          fetch(`${API_BASE}/stores/${shortCode}`, { headers: { Accept: 'application/json' } }),
          fetch(`${API_BASE}/stores/${shortCode}/posts`, { headers: { Accept: 'application/json' } }),
        ]);
        const storeResult = storeRes.status === "fulfilled" ? storeRes.value : null;
        const postsResult = postsRes.status === "fulfilled" ? postsRes.value : null;

        if (!storeResult?.ok) {
          const json = storeResult ? await storeResult.json().catch(() => ({})) : {};
          throw new Error(json.message ?? 'Storefront not found or offline.');
        }

        const storeJson = await storeResult.json();
        setStore(storeJson.data?.data ?? storeJson.data);

        if (postsResult?.ok) {
          const postsJson = await postsResult.json();
          setPosts(postsJson.data?.data ?? postsJson.data ?? []);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unable to display storefront.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPublicStore();
  }, [shortCode]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
        <p className="text-xs text-muted-foreground font-medium">Loading Storefront…</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Storefront Not Available</h2>
        <p className="text-xs text-muted-foreground max-w-sm">
          {error ?? 'This creator storefront does not exist or has been taken offline.'}
        </p>
        <Link to="/app">
          <Button variant="outline" size="sm" className="text-xs font-semibold gap-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      {/* Top Banner Navigation */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <Link to="/app" className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> MurihSpace
        </Link>
        <span className="text-xs font-mono text-muted-foreground">/{store.short_code}</span>
      </header>

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Cover & Avatar Header Card */}
        <div className="border border-border rounded-3xl bg-card overflow-hidden shadow-xl">
          {/* Cover image */}
          <div className="h-48 sm:h-64 bg-gradient-to-r from-primary to-secondary relative overflow-hidden">
            {store.cover_url ? (
              <img src={store.cover_url} alt={store.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20">
                <Store className="h-16 w-16" />
              </div>
            )}
          </div>

          {/* Profile Details */}
          <div className="p-6 sm:p-8 pt-0 relative space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-2">
              <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full border-4 border-card bg-primary text-primary-foreground font-black flex items-center justify-center text-3xl sm:text-4xl shadow-xl overflow-hidden shrink-0">
                {store.avatar_url ? (
                  <img src={store.avatar_url} alt={store.display_name} className="w-full h-full object-cover" />
                ) : (
                  store.display_name.slice(0, 2).toUpperCase()
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button className="text-xs font-bold gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground px-5 rounded-xl shadow-md">
                  <UserPlus className="h-4 w-4" /> Follow Creator
                </Button>
              </div>
            </div>

            {/* Title & Badges */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{store.display_name}</h1>
                <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
              </div>
              {store.tagline && (
                <p className="text-sm font-semibold text-secondary">{store.tagline}</p>
              )}
            </div>

            {/* Bio */}
            {store.bio && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {store.bio}
              </p>
            )}

            {/* Social & Community External Links */}
            {store.links && store.links.length > 0 && (
              <div className="pt-2 flex flex-wrap gap-2">
                {store.links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-muted border border-border text-xs font-semibold text-foreground hover:bg-secondary/20 hover:text-secondary hover:border-secondary/30 transition-all inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {link.label}
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Store Posts Section */}
        {posts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-secondary" />
              Posts
            </h2>
            <div className="space-y-4">
              {posts.map((post) => {
                const font = FONT_MAP[post.font_family] ?? "system-ui, -apple-system, sans-serif";
                const textAlign = ["left", "center", "right"].includes(post.text_align) ? post.text_align : "left";
                return (
                  <div key={post.id} className="rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all">
                    <div className="p-6 sm:p-10" style={{ backgroundColor: post.background_color, fontFamily: font, textAlign }}>
                      <p className="text-base sm:text-lg font-medium leading-relaxed whitespace-pre-wrap" style={{ color: post.text_color }}>
                        {post.content}
                      </p>
                    </div>
                    <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Communities Section */}
        {store.communities && store.communities.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-secondary" />
              Creator Communities
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {store.communities.map((c) => (
                <div
                  key={c.id}
                  className="p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground">{c.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {c.description ?? 'Join this community to connect and engage.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-secondary" />
                      {c.members_count ?? 0} members
                    </span>

                    <Link to={`/communities/${c.slug}`}>
                      <Button size="sm" variant="outline" className="text-xs font-semibold rounded-xl">
                        View Community
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
