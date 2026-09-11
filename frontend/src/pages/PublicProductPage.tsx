import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { authFetch } from "@/lib/api/authFetch";
import { useAuth } from "@/hooks/useAuth";
import { SEOHead } from "@/components/common/SEOHead";
import { OpenInAppBanner } from "@/components/common/OpenInAppBanner";
import { ShareModal } from "@/components/common/ShareModal";
import { AuthPromptModal } from "@/components/auth/AuthPromptModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  ShoppingCart,
  ShareNetwork,
  Check,
  CheckCircle,
  ShieldCheck,
  ArrowLeft,
  Storefront,
  Warning as AlertTriangle,
  Spinner as Loader2,
  Tag,
  Truck,
  FileText,
  DownloadSimple,
  SealCheck
} from "@phosphor-icons/react";

interface ProductData {
  id: string | number;
  raw_id?: number;
  product_type: "physical" | "digital";
  type: "physical" | "digital";
  title: string;
  name?: string;
  description: string;
  price: number;
  currency: string;
  symbol: string;
  sellerId?: string | number;
  sellerName?: string;
  sellerUsername?: string;
  sellerAvatar?: string;
  sellerRating?: number;
  sellerJoinedDate?: string;
  isVerified?: boolean;
  category?: string;
  condition?: string;
  images: string[];
  cover_url?: string;
  escrow_protected?: boolean;
  stock_quantity?: number;
  in_stock?: boolean;
  download_count?: number;
  created_at?: string;
}

export default function PublicProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchProduct() {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(`/marketplace/${id}`);
        if (!res.ok) {
          throw new Error("Product not found or unavailable.");
        }
        const json = await res.json();
        const data = json?.data?.data ?? json?.data;
        if (!data) {
          throw new Error("Product details not available.");
        }
        setProduct(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load product.");
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [id]);

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (!product) return;

    setAddingToCart(true);
    try {
      const isPhysical = product.product_type === "physical" || product.type === "physical";
      const productId = product.raw_id || (typeof product.id === "string" && product.id.startsWith("p_") ? parseInt(product.id.slice(2)) : parseInt(String(product.id)));

      const res = await authFetch(`/store/cart/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          product_type: isPhysical ? "physical" : "digital",
          quantity,
        }),
      });

      if (res.ok) {
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 3000);
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.message || "Failed to add item to cart.");
      }
    } catch {
      alert("Error adding item to cart.");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    await handleAddToCart();
    navigate("/app/store/cart");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-3">
        <Loader2 weight="fill" className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium">Loading product details…</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle weight="fill" className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Product Not Found</h2>
        <p className="text-xs text-muted-foreground max-w-sm">
          {error || "This item may have been removed or is no longer active."}
        </p>
        <Link to="/app/store">
          <Button variant="outline" size="sm" className="text-xs font-semibold gap-2 rounded-xl">
            <ArrowLeft weight="bold" className="h-4 w-4" /> Explore Marketplace
          </Button>
        </Link>
      </div>
    );
  }

  const isPhysical = product.product_type === "physical" || product.type === "physical";
  const images = product.images && product.images.length > 0 ? product.images : [product.cover_url || ""];
  const currentImage = images[selectedImageIndex] || product.cover_url || "";
  const inStock = product.in_stock !== false && (product.stock_quantity === undefined || product.stock_quantity > 0);
  const formattedPrice = `${product.symbol || "$"}${(Number(product.price) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const shareUrl = window.location.href;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <SEOHead
        title={`${product.title} by ${product.sellerName || "Creator"}`}
        description={product.description || `Buy ${product.title} on MurihSpace. Escrow-protected checkout.`}
        image={currentImage}
        url={shareUrl}
        type="product"
      />

      <OpenInAppBanner scheme={`murihspace://product/${id}`} title={`View ${product.title} in app`} />

      {/* Top Header / Navigation */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between">
          <Link
            to={product.sellerUsername ? `/u/${product.sellerUsername}` : "/app"}
            className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft weight="bold" className="h-4 w-4" />
            <span>{product.sellerName ? `Back to ${product.sellerName}` : "Back to MurihSpace"}</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShareModal(true)}
              className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-border"
            >
              <ShareNetwork weight="fill" className="h-3.5 w-3.5 text-primary" />
              Share Link
            </Button>
            {isAuthenticated && (
              <Link to="/app/store/cart">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl relative">
                  <ShoppingCart weight="bold" className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Image Gallery */}
          <div className="lg:col-span-7 space-y-4">
            <div className="w-full aspect-square sm:aspect-[4/3] rounded-3xl overflow-hidden bg-muted/40 border border-border/80 shadow-lg relative flex items-center justify-center">
              {currentImage ? (
                <img
                  src={currentImage}
                  alt={product.title}
                  className="w-full h-full object-cover transition-all"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground/40 space-y-2">
                  <Package weight="fill" className="h-16 w-16" />
                  <span className="text-xs font-bold">No Image Available</span>
                </div>
              )}

              {/* Escrow Protected Floating Pill */}
              <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-border/60 shadow-sm flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck weight="fill" className="h-4 w-4" />
                Escrow Protected
              </div>
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`h-16 w-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                      selectedImageIndex === idx
                        ? "border-primary shadow-md ring-2 ring-primary/20"
                        : "border-border/60 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Product Overview & Buy Box */}
          <div className="lg:col-span-5 space-y-6">
            {/* Category & Badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                <Tag weight="fill" className="h-3.5 w-3.5" />
                {product.category || (isPhysical ? "Physical Product" : "Digital Download")}
              </span>
              <span className="text-muted-foreground/40">•</span>
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
                {isPhysical ? "Physical" : "Digital Asset"}
              </Badge>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-snug">
              {product.title}
            </h1>

            {/* Price & Stock */}
            <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex items-baseline justify-between">
              <div>
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block mb-0.5">
                  Price
                </span>
                <span className="text-3xl font-black text-foreground font-mono">
                  {formattedPrice}
                </span>
              </div>

              <div>
                {inStock ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                    <CheckCircle weight="fill" className="h-3.5 w-3.5" />
                    In Stock
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20 inline-flex items-center gap-1">
                    Out of Stock
                  </span>
                )}
              </div>
            </div>

            {/* Quantity Selector & Action Buttons */}
            <div className="space-y-3">
              {isPhysical && inStock && (
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Quantity:
                  </label>
                  <div className="flex items-center border border-border rounded-xl bg-card">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-3 py-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
                    >
                      -
                    </button>
                    <span className="px-3 text-xs font-bold font-mono">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => q + 1)}
                      className="px-3 py-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleAddToCart}
                  disabled={!inStock || addingToCart}
                  variant="outline"
                  className="flex-1 h-12 text-xs font-bold gap-2 rounded-xl border-primary/40 text-primary hover:bg-primary/5"
                >
                  {addedToCart ? (
                    <>
                      <Check weight="bold" className="h-4 w-4 text-emerald-500" />
                      Added to Cart!
                    </>
                  ) : (
                    <>
                      <ShoppingCart weight="bold" className="h-4 w-4" />
                      {addingToCart ? "Adding…" : "Add to Cart"}
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleBuyNow}
                  disabled={!inStock}
                  className="flex-1 h-12 text-xs font-bold gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                >
                  <ShieldCheck weight="fill" className="h-4 w-4" />
                  Buy with Escrow
                </Button>
              </div>
            </div>

            {/* Creator / Vendor Profile Card */}
            <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Sold & Fulfilled By
              </span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center text-lg overflow-hidden shrink-0 border border-border">
                    {product.sellerAvatar ? (
                      <img src={product.sellerAvatar} alt={product.sellerName} className="w-full h-full object-cover" />
                    ) : (
                      (product.sellerName || "C").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-foreground">{product.sellerName || "Creator"}</h4>
                      {product.isVerified && (
                        <SealCheck weight="fill" className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">@{product.sellerUsername || "creator"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {product.sellerUsername && (
                    <Link to={`/u/${product.sellerUsername}`}>
                      <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg">
                        Profile
                      </Button>
                    </Link>
                  )}
                  {product.sellerUsername && (
                    <Link to={`/store/${product.sellerUsername}`}>
                      <Button variant="secondary" size="sm" className="h-8 text-xs font-semibold rounded-lg gap-1">
                        <Storefront weight="fill" className="h-3.5 w-3.5" />
                        Store
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Product Highlights */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-2.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <ShieldCheck weight="fill" className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Buyer Protection: Funds held securely in escrow until delivery is verified.</span>
              </div>
              {isPhysical ? (
                <div className="flex items-center gap-2.5">
                  <Truck weight="fill" className="h-4 w-4 text-primary shrink-0" />
                  <span>Physical delivery with tracked postal or courier shipping.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <DownloadSimple weight="fill" className="h-4 w-4 text-primary shrink-0" />
                  <span>Instant digital delivery upon payment confirmation.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Full Description & Reviews */}
        <div className="mt-12 pt-8 border-t border-border space-y-6">
          <div className="max-w-3xl space-y-3">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileText weight="fill" className="h-5 w-5 text-primary" />
              Product Description
            </h2>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line bg-card p-6 rounded-2xl border border-border/80 shadow-sm">
              {product.description || "No description provided for this product."}
            </div>
          </div>
        </div>
      </main>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={product.title}
        description={`Check out ${product.title} on MurihSpace for ${formattedPrice}`}
        url={shareUrl}
        type="product"
        imageUrl={currentImage}
        badge={isPhysical ? "Physical" : "Digital"}
      />

      {/* Auth Prompt Modal */}
      <AuthPromptModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        title="Sign in to purchase"
        description="Create an account or sign in to complete your purchase and track orders on MurihSpace."
      />
    </div>
  );
}
