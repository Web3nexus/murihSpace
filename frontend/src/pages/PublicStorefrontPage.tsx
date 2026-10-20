import { safeHref } from "@/lib/safeUrl";
import { asApiError } from "@/lib/apiError";
import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router";
import { authFetch } from "@/lib/api/authFetch";
import { useAuth } from "@/hooks/useAuth";
import { SEOHead } from "@/components/common/SEOHead";
import { OpenInAppBanner } from "@/components/common/OpenInAppBanner";
import { ShareModal } from "@/components/common/ShareModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Discovery as Globe, N2User as Users, TickSquare as CheckCircle2, ArrowLeft, DangerTriangle as AlertTriangle, Edit as Edit3, Show as Eye } from "@/components/icons";
import { ArrowSquareOut as ExternalLink, Spinner as Loader2, ShareNetwork, Package } from "@/components/icons/rounded";
import type { PublicStorefront } from "@/types/storefront";
import { absolute, storefrontUrl } from "@/lib/deepLinks";
import { cn } from "@/lib/utils";

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
      const apiErr = asApiError(err);
        setError(err instanceof Error ? apiErr.message : "Unable to display storefront.");
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
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,oklch(0.985_0_0),oklch(1_0_0))] dark:bg-[radial-gradient(ellipse_at_top,oklch(0.18_0.03_270),oklch(0.13_0.03_270))] flex flex-col items-center justify-center gap-3">
        <Loader2 weight="fill" className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Loading storefront</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,oklch(0.985_0_0),oklch(1_0_0))] dark:bg-[radial-gradient(ellipse_at_top,oklch(0.18_0.03_270),oklch(0.13_0.03_270))] flex flex-col items-center justify-center p-4 text-center gap-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle weight="fill" className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Storefront Unavailable</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {error ?? "This creator storefront does not exist or has been taken offline."}
        </p>
        <Link to="/app">
          <Button variant="outline" size="sm" className="gap-2 rounded-2xl font-semibold">
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

  const shareUrl = absolute(storefrontUrl(store.short_code));

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,oklch(0.985_0_0),oklch(1_0_0))] dark:bg-[radial-gradient(ellipse_at_top,oklch(0.16_0.02_270),oklch(0.12_0.02_270))] text-foreground">
      <SEOHead
        title={`${store.display_name} · Official Storefront`}
        description={store.bio || store.tagline || `Shop digital products and merchandise from ${store.display_name} on MurihSpace.`}
        image={store.avatar_url || store.cover_url}
        url={shareUrl}
        type="website"
      />
      <OpenInAppBanner scheme={`murihspace://store/${store.short_code}`} title={`Visit ${store.display_name}'s Store in App`} />

      <div className={cn("sticky top-0 z-50", isOwner && isPreviewMode && "flex flex-col")}>
        {isOwner && isPreviewMode && (
          <div className="w-full border-b border-amber-400/40 bg-amber-400/95 px-4 py-2.5 text-black backdrop-blur-lg shadow-[0_10px_60px_-20px_oklch(0.8_0.16_90)]">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <Eye weight="fill" className="h-4 w-4" />
                <span>
                  <strong>Preview Mode</strong> — You’re previewing your storefront.
                  {!store.is_published && " This store is currently in draft mode and hidden from the public."}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/app/store">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full border-0 bg-white/95 px-3 font-bold text-black shadow-xs hover:bg-white">
                    <Edit3 weight="bold" className="h-3.5 w-3.5" /> Edit Store
                  </Button>
                </Link>
                {!store.is_published && (
                  <Button
                    size="sm"
                    onClick={handlePublishNow}
                    disabled={isPublishing}
                    className="h-8 gap-1.5 rounded-full bg-black px-3 font-bold text-white shadow-xs hover:bg-black/80"
                  >
                    {isPublishing ? "Publishing…" : "Publish Now"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <header className="w-full border-b border-border/70 bg-background/80 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <Link to="/app" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft weight="bold" className="h-4 w-4" />
                MurihSpace
              </Link>
              <span className="text-muted-foreground/40">/</span>
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">store / {store.short_code}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShareModal(true)}
                className="h-9 gap-1.5 rounded-full border-border/80 px-3.5 font-semibold"
              >
                <ShareNetwork weight="fill" className="h-4 w-4 text-primary" />
                Share
              </Button>
              {store.creator?.username && (
                <Link to={`/u/${store.creator.username}`}>
                  <Button variant="ghost" size="sm" className="h-9 rounded-full px-3.5 font-semibold text-muted-foreground hover:text-foreground">
                    Creator Profile
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </header>
      </div>

      <main className="mx-auto flex max-w-7xl flex-col gap-16 px-4 py-10 sm:px-6 lg:py-14">
        <section className="relative overflow-hidden rounded-[2.5rem] border border-border/80 bg-gradient-to-br from-primary/25 via-background to-background shadow-[0_120px_160px_-120px_oklch(0.7_0.2_270)] dark:from-primary/15">
          <div className="pointer-events-none absolute -top-40 right-[-20%] h-[28rem] w-[28rem] rounded-full bg-primary/25 blur-[140px]" />
          <div className="pointer-events-none absolute -bottom-48 left-[-15%] h-[26rem] w-[26rem] rounded-full bg-violet-500/20 blur-[140px] dark:bg-violet-500/12" />
          <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:p-14">
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-center gap-3">
                {store.is_published ? (
                  <Badge className="h-7 gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/20 px-2.5 text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live Storefront
                  </Badge>
                ) : (
                  <Badge variant="outline" className="h-7 gap-1.5 rounded-full border-amber-400/50 px-2.5 text-[11px] font-bold uppercase tracking-[0.28em] text-amber-500">
                    Draft Preview
                  </Badge>
                )}
                {store.creator?.username && (
                  <span className="text-sm font-medium text-muted-foreground">@{store.creator.username}</span>
                )}
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-balance text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">{store.display_name}</h1>
                  <CheckCircle2 weight="fill" className="h-8 w-8 text-primary sm:h-10 sm:w-10" />
                </div>
                {store.tagline && <p className="text-balance text-lg font-semibold text-primary sm:text-xl lg:text-2xl">{store.tagline}</p>}
                {store.bio && <p className="max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">{store.bio}</p>}
              </div>
              {store.links && store.links.length > 0 && (
                <div className="flex flex-wrap gap-2.5">
                  {store.links.map((link, idx) => (
                    <a
                      key={idx}
                      href={safeHref(link.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3.5 py-2 text-sm font-semibold shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md"
                    >
                      <Globe weight="fill" className="h-4 w-4 text-primary" />
                      {link.label}
                      <ExternalLink weight="bold" className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="relative mx-auto flex w-full max-w-sm flex-col items-center gap-6 lg:max-w-md">
              <div className="relative">
                <div className="absolute -inset-4 rounded-[3rem] bg-primary/30 blur-[120px]" />
                <div className="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-[2.5rem] border border-border/80 bg-card shadow-[0_80px_120px_-80px_oklch(0.6_0.25_270)] sm:h-56 sm:w-56 lg:h-72 lg:w-72">
                  {store.avatar_url ? (
                    <img src={store.avatar_url} alt={store.display_name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-5xl font-black tracking-tight text-primary sm:text-6xl lg:text-7xl">{store.display_name.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
              </div>
              {store.cover_url && (
                <div className="relative w-full overflow-hidden rounded-[2rem] border border-border/80 shadow-xl">
                  <div className="aspect-[16/9] w-full">
                    <img src={store.cover_url} alt={`${store.display_name} cover`} className="h-full w-full object-cover" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Package weight="fill" className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Curated Collection</h2>
              </div>
              <p className="text-sm text-muted-foreground sm:text-base">A focused selection of physical and digital offerings from this creator.</p>
            </div>
            {totalProducts > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-border/80 bg-background/80 p-1 shadow-xs backdrop-blur-xl">
                <button
                  onClick={() => setProductTab("all")}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
                    productTab === "all" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All · {totalProducts}
                </button>
                {physicalProducts.length > 0 && (
                  <button
                    onClick={() => setProductTab("physical")}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
                      productTab === "physical" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Physical · {physicalProducts.length}
                  </button>
                )}
                {digitalProducts.length > 0 && (
                  <button
                    onClick={() => setProductTab("digital")}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
                      productTab === "digital" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Digital · {digitalProducts.length}
                  </button>
                )}
              </div>
            )}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[2rem] border border-dashed border-border/80 bg-card/50 px-6 py-16 text-center">
              <Package weight="fill" className="h-10 w-10 text-muted-foreground/40" />
              <h3 className="text-lg font-bold tracking-tight">No products to show yet</h3>
              <p className="max-w-sm text-sm text-muted-foreground">The creator hasn’t published any items in this category just yet. Check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((p) => {
                const isPhys = p.product_type === "physical";
                const img = (p.images && p.images[0]) || ("cover_url" in p ? (p as { cover_url?: string }).cover_url : "") || "";
                const priceFormatted = `${p.currency === "NGN" ? "₦" : "$"}${(Number(p.price) / (isPhys ? 100 : 1)).toFixed(2)}`;

                return (
                  <Link key={`${p.product_type}-${p.id}`} to={`/p/${p.id}`} className="group flex flex-col overflow-hidden rounded-[2rem] border border-border/80 bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                    <div className="relative aspect-[16/10] overflow-hidden">
                      {img ? (
                        <img src={img} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-transparent text-muted-foreground/40">
                          <Package weight="fill" className="h-12 w-12" />
                        </div>
                      )}
                      <div className="absolute left-4 top-4 flex items-center gap-2">
                        <Badge className="rounded-full border-0 bg-background/90 px-2.5 text-[10px] font-bold uppercase tracking-[0.24em] text-foreground shadow-xs backdrop-blur">
                          {isPhys ? "Physical" : "Digital"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-6">
                      <div className="flex flex-col gap-1.5">
                        {p.category && <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary">{p.category}</span>}
                        <h3 className="text-balance text-lg font-bold tracking-tight group-hover:text-primary">{p.title}</h3>
                        {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <span className="font-mono text-lg font-black">{priceFormatted}</span>
                        <span className="text-sm font-semibold text-muted-foreground transition-colors group-hover:text-primary">View Item →</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {posts.length > 0 && (
          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Users weight="fill" className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Creator Notes</h2>
              </div>
              <p className="text-sm text-muted-foreground sm:text-base">Words, musings and updates straight from the creator.</p>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {posts.map((post) => {
                const font = FONT_MAP[post.font_family] ?? "system-ui, -apple-system, sans-serif";
                const textAlign = ["left", "center", "right"].includes(post.text_align) ? post.text_align : "left";
                return (
                  <div key={post.id} className="flex flex-col overflow-hidden rounded-[2rem] border border-border/80 bg-card shadow-sm">
                    <div className="flex flex-1 flex-col justify-center p-8 sm:p-10" style={{ backgroundColor: post.background_color, fontFamily: font, textAlign }}>
                      <p className="text-balance whitespace-pre-wrap text-lg leading-relaxed sm:text-xl" style={{ color: post.text_color }}>
                        {post.content}
                      </p>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/80 px-6 py-3 text-xs text-muted-foreground">
                      <span className="font-mono uppercase tracking-[0.32em]">{new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {store.communities && store.communities.length > 0 && (
          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Users weight="fill" className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Communities</h2>
              </div>
              <p className="text-sm text-muted-foreground sm:text-base">Spaces to connect with the creator and their audience.</p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {store.communities.map((c) => (
                <Link key={c.id} to={`/communities/${c.slug}`} className="group flex flex-col gap-4 rounded-[2rem] border border-border/80 bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-8">
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-xl font-bold tracking-tight group-hover:text-primary">{c.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{c.description ?? "Join this community to connect and engage."}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/80 pt-4">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users weight="fill" className="h-4 w-4 text-primary" />
                      <span className="font-semibold">{c.members_count ?? 0} members</span>
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground transition-colors group-hover:text-primary">Join Community →</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

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
