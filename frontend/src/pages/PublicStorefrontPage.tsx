import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router";
import { authFetch } from "@/lib/api/authFetch";
import { useAuth } from "@/hooks/useAuth";
import { SEOHead } from "@/components/common/SEOHead";
import { OpenInAppBanner } from "@/components/common/OpenInAppBanner";
import { ShareModal } from "@/components/common/ShareModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Storefront,
  Globe,
  ArrowSquareOut as ExternalLink,
  Users,
  CheckCircle as CheckCircle2,
  ArrowLeft,
  Spinner as Loader2,
  Warning as AlertTriangle,
  ChatText,
  ShareNetwork,
  Package,
  PencilSimple as Edit3,
  Eye
} from "@phosphor-icons/react";
import type { PublicStorefront } from "@/types/storefront";

interface StorePost {
  id: number;
  content: string;
  font_family: string;
  background_color: string;
  text_color: string;
  text_align: "left" | "center" | "right";
  created_at: string;
}

const FONT_MAP: Record<string, string> = {
  sans: "system-ui, -apple-system, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
  display: "Impact, 'Arial Black', sans-serif",
  handwriting: "'Segoe Script', 'Apple Chancery', cursive",
};

export function PublicStorefrontPage() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [searchParams] = useSearchParams();
  const isPreviewParam = searchParams.get("preview") === "true";

  const { user: currentUser } = useAuth();
  const [store, setStore] = useState<PublicStorefront | null>(null);
  const [posts, setPosts] = useState<StorePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & tabs
  const [showShareModal, setShowShareModal] = useState(false);
  const [productTab, setProductTab] = useState<"all" | "physical" | "digital">("all");
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (!shortCode) return;

    async function fetchPublicStore() {
      setIsLoading(true);
      setError(null);

      try {
        const previewQuery = isPreviewParam ? "?preview=true" : "";
        const [storeRes, postsRes] = await Promise.allSettled([
          authFetch(`/stores/${shortCode}${previewQuery}`, { headers: { Accept: "application/json" } }),
          authFetch(`/stores/${shortCode}/posts`, { headers: { Accept: "application/json" } }),
        ]);

        const storeResult = storeRes.status === "fulfilled" ? storeRes.value : null;
        const postsResult = postsRes.status === "fulfilled" ? postsRes.value : null;

        if (!storeResult?.ok) {
          const json = storeResult ? await storeResult.json().catch(() => ({})) : {};
          throw new Error(json.message ?? "Storefront not found or offline.");
        }

        const storeJson = await storeResult.json();
        setStore(storeJson.data?.data ?? storeJson.data);

        if (postsResult?.ok) {
          const postsJson = await postsResult.json();
          setPosts(postsJson.data?.data ?? postsJson.data ?? []);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unable to display storefront.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPublicStore();
  }, [shortCode, isPreviewParam]);

  const handlePublishNow = async () => {
    if (!store) return;
    setIsPublishing(true);
    try {
      const res = await authFetch("/storefront/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: true }),
      });
      if (res.ok) {
        setStore((prev) => (prev ? { ...prev, is_published: true, is_preview: false } : null));
      }
    } catch {
      // Ignore
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-3">
        <Loader2 weight="fill" className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium">Loading Storefront…</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle weight="fill" className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Storefront Not Available</h2>
        <p className="text-xs text-muted-foreground max-w-sm">
          {error ?? "This creator storefront does not exist or has been taken offline."}
        </p>
        <Link to="/app">
          <Button variant="outline" size="sm" className="text-xs font-semibold gap-2 rounded-xl">
            <ArrowLeft weight="bold" className="h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const isOwner = store.is_owner || (currentUser && store.creator?.username === currentUser.username);
  const isPreviewMode = isPreviewParam || store.is_preview || !store.is_published;

  const physicalProducts = store.physical_products || [];
  const digitalProducts = store.digital_products || [];
  const totalProducts = physicalProducts.length + digitalProducts.length;

  const filteredProducts = [
    ...(productTab === "all" || productTab === "physical"
      ? physicalProducts.map((p) => ({ ...p, product_type: "physical" as const }))
      : []),
    ...(productTab === "all" || productTab === "digital"
      ? digitalProducts.map((d) => ({
          ...d,
          product_type: "digital" as const,
          images: [d.cover_url || ""],
          sku: undefined,
          stock_quantity: 999,
        }))
      : []),
  ];

  const shareUrl = `${window.location.origin}/store/${store.short_code}`;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <SEOHead
        title={`${store.display_name} | Official Storefront`}
        description={store.bio || store.tagline || `Shop digital products and merchandise from ${store.display_name} on MurihSpace.`}
        image={store.avatar_url || store.cover_url}
        url={shareUrl}
        type="website"
      />

      <OpenInAppBanner
        scheme={`murihspace://store/${store.short_code}`}
        title={`Visit ${store.display_name}'s Store in App`}
      />

      {/* ── Preview Mode Sticky Banner ── */}
      {isOwner && isPreviewMode && (
        <div className="sticky top-0 z-50 bg-amber-500/95 dark:bg-amber-600/95 text-black px-4 py-2.5 backdrop-blur-md shadow-md flex items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <Eye weight="fill" className="h-4 w-4 shrink-0" />
            <span>
              <strong>Preview Mode</strong> — You are previewing your storefront.
              {!store.is_published && " This store is currently in draft mode and hidden from the public."}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/app/store">
              <Button size="sm" variant="outline" className="h-7 text-xs font-bold bg-white/90 text-black border-none hover:bg-white rounded-lg gap-1">
                <Edit3 weight="bold" className="h-3 w-3" /> Edit Store
              </Button>
            </Link>
            {!store.is_published && (
              <Button
                size="sm"
                onClick={handlePublishNow}
                disabled={isPublishing}
                className="h-7 text-xs font-bold bg-black text-white hover:bg-black/80 rounded-lg gap-1"
              >
                {isPublishing ? "Publishing…" : "Publish Now"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Top Banner Navigation */}
      <header className="bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/app"
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft weight="bold" className="h-4 w-4" /> MurihSpace
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-xs font-mono text-muted-foreground font-semibold">store/{store.short_code}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShareModal(true)}
            className="h-8 text-xs font-bold gap-1.5 rounded-xl border-border hover:bg-muted"
          >
            <ShareNetwork weight="fill" className="h-3.5 w-3.5 text-primary" />
            Share Store
          </Button>

          {store.creator?.username && (
            <Link to={`/u/${store.creator.username}`}>
              <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground">
                Creator Profile
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
        {/* Cover & Avatar Header Card */}
        <div className="rounded-3xl bg-card border border-border/80 overflow-hidden shadow-xl">
          {/* Cover image */}
          <div className="h-44 sm:h-60 bg-muted/40 border-b border-border relative overflow-hidden">
            {store.cover_url ? (
              <img src={store.cover_url} alt={store.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent">
                <Storefront weight="fill" className="h-16 w-16" />
              </div>
            )}
          </div>

          {/* Profile Details */}
          <div className="p-5 sm:p-7 pt-0 relative space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-2">
              <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full border-4 border-card bg-primary text-primary-foreground font-black flex items-center justify-center text-xl sm:text-2xl shadow-xl overflow-hidden shrink-0">
                {store.avatar_url ? (
                  <img src={store.avatar_url} alt={store.display_name} className="w-full h-full object-cover" />
                ) : (
                  store.display_name.slice(0, 2).toUpperCase()
                )}
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                {store.creator?.username && (
                  <Link to={`/u/${store.creator.username}`}>
                    <Button variant="outline" size="sm" className="h-9 text-xs font-bold rounded-xl gap-1.5 border-border">
                      <ArrowLeft weight="bold" className="h-3.5 w-3.5" />
                      View Creator
                    </Button>
                  </Link>
                )}
                <Button
                  size="sm"
                  onClick={() => setShowShareModal(true)}
                  className="h-9 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-sm px-4"
                >
                  <ShareNetwork weight="fill" className="h-3.5 w-3.5" />
                  Share Store
                </Button>
              </div>
            </div>

            {/* Title & Badges */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">{store.display_name}</h1>
                <CheckCircle2 weight="fill" className="h-5 w-5 text-primary shrink-0" />
                {store.is_published ? (
                  <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Active Store
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-amber-500 border-amber-500/30">
                    Draft
                  </Badge>
                )}
              </div>
              {store.tagline && <p className="text-xs sm:text-sm font-semibold text-primary">{store.tagline}</p>}
            </div>

            {/* Bio */}
            {store.bio && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">{store.bio}</p>
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
                    className="px-3 py-1.5 rounded-xl bg-muted/70 hover:bg-muted border border-border/60 text-xs font-semibold text-foreground transition-all inline-flex items-center gap-1.5"
                  >
                    <Globe weight="fill" className="h-3.5 w-3.5 text-primary" />
                    {link.label}
                    <ExternalLink weight="bold" className="h-3 w-3 opacity-60" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Products Showcase Section ── */}
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Package weight="fill" className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Products & Assets</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {totalProducts}
              </span>
            </div>

            {/* Filter Tabs */}
            {totalProducts > 0 && (
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
                <button
                  onClick={() => setProductTab("all")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    productTab === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({totalProducts})
                </button>
                {physicalProducts.length > 0 && (
                  <button
                    onClick={() => setProductTab("physical")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      productTab === "physical" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Physical ({physicalProducts.length})
                  </button>
                )}
                {digitalProducts.length > 0 && (
                  <button
                    onClick={() => setProductTab("digital")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      productTab === "digital" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Digital ({digitalProducts.length})
                  </button>
                )}
              </div>
            )}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-card border border-dashed border-border/80 space-y-3">
              <Package weight="fill" className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">No products available in this store</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                The creator hasn't published any items in this category yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProducts.map((p) => {
                const isPhys = p.product_type === "physical";
                const img = (p.images && p.images[0]) || ('cover_url' in p ? (p as any).cover_url : '') || "";
                const priceFormatted = `${p.currency === "NGN" ? "₦" : "$"}${(Number(p.price) / (isPhys ? 100 : 1)).toFixed(2)}`;

                return (
                  <div
                    key={`${p.product_type}-${p.id}`}
                    className="rounded-2xl bg-card border border-border/80 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Product Thumbnail */}
                      <Link to={`/p/${p.id}`} className="block relative aspect-video bg-muted/50 overflow-hidden">
                        {img ? (
                          <img
                            src={img}
                            alt={p.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                            <Package weight="fill" className="h-10 w-10" />
                          </div>
                        )}
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-background/90 backdrop-blur-xs text-foreground border border-border/60">
                          {isPhys ? "Physical" : "Digital"}
                        </span>
                      </Link>

                      {/* Product Info */}
                      <div className="p-4 space-y-1.5">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                          {p.category || "General"}
                        </span>
                        <Link to={`/p/${p.id}`} className="block">
                          <h3 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                            {p.title}
                          </h3>
                        </Link>
                        {p.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {p.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="p-4 pt-0 border-t border-border/40 mt-2 flex items-center justify-between">
                      <div className="pt-3">
                        <span className="text-xs text-muted-foreground block text-[10px] uppercase font-bold">Price</span>
                        <span className="text-sm font-black text-foreground font-mono">{priceFormatted}</span>
                      </div>

                      <div className="pt-3 flex items-center gap-1.5">
                        <Link to={`/p/${p.id}`}>
                          <Button size="sm" className="h-8 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-3.5">
                            View Item
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Storefront Posts Section */}
        {posts.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-border">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <ChatText weight="fill" className="h-5 w-5 text-primary" />
              Creator Notes & Updates
            </h2>
            <div className="space-y-4">
              {posts.map((post) => {
                const font = FONT_MAP[post.font_family] ?? "system-ui, -apple-system, sans-serif";
                const textAlign = ["left", "center", "right"].includes(post.text_align) ? post.text_align : "left";
                return (
                  <div key={post.id} className="rounded-2xl border border-border/80 overflow-hidden shadow-sm">
                    <div className="p-6 sm:p-8" style={{ backgroundColor: post.background_color, fontFamily: font, textAlign }}>
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
          <div className="space-y-4 pt-4 border-t border-border">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Users weight="fill" className="h-5 w-5 text-primary" />
              Creator Communities
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {store.communities.map((c) => (
                <div
                  key={c.id}
                  className="p-5 rounded-2xl border border-border/80 bg-card hover:shadow-md transition-all flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground">{c.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {c.description ?? "Join this community to connect and engage."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Users weight="fill" className="h-3.5 w-3.5 text-primary" />
                      {c.members_count ?? 0} members
                    </span>

                    <Link to={`/communities/${c.slug}`}>
                      <Button size="sm" variant="outline" className="text-xs font-bold rounded-xl">
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

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={store.display_name}
        description={store.tagline || store.bio || `Explore ${store.display_name}'s official storefront on MurihSpace`}
        url={shareUrl}
        type="store"
        imageUrl={store.avatar_url || store.cover_url}
        badge={store.is_published ? "Storefront" : "Draft Store"}
      />
    </div>
  );
}
export default PublicStorefrontPage;
