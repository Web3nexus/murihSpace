import { useState, useEffect, useCallback } from "react";
import { Gift, Loader2, Search, Send, Coins, AlertCircle, Check, Plus, X, History, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { authFetch } from "@/lib/api/authFetch";
import { getCachedData, setCachedData } from "@/lib/api/cacheStore";
import { GiftAnimationOverlay, type GiftAnimationData } from "@/components/gifting/GiftAnimationOverlay";

interface GiftItem {
  id: number;
  name: string;
  icon_url: string | null;
  coin_price: number;
  creator_earns: number;
  category: string;
  is_active: boolean;
  sort_order: number;
}

interface CoinPack {
  id: number;
  name: string;
  coins: number;
  bonus_coins: number;
  price: number;
  currency: string;
  badge: string | null;
  is_active: boolean;
  sort_order: number;
}

function getAssetUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const apiBase = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";
  const backendHost = apiBase.replace(/\/api\/v1\/?$/, "");
  return `${backendHost}${path.startsWith('/') ? '' : '/'}${path}`;
}

function GiftIcon({ iconUrl, name, className = "w-full h-full object-contain drop-shadow-xs" }: { iconUrl: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = getAssetUrl(iconUrl);

  if (!url || failed) {
    return <Gift className="w-9 h-9 text-[#1877f2]" />;
  }

  return (
    <img
      src={url}
      alt={name}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function formatPrice(p: CoinPack) {
  const syms: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" };
  return (syms[p.currency] ?? p.currency + " ") + ((p.price || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function safeArray<T = any>(val: any): T[] {
  if (Array.isArray(val)) return val;
  if (Array.isArray(val?.data)) return val.data;
  if (Array.isArray(val?.data?.data)) return val.data.data;
  if (Array.isArray(val?.gifts)) return val.gifts;
  if (Array.isArray(val?.packs)) return val.packs;
  return [];
}

const CACHE_KEY_GIFTS = "gifts_catalogue";
const CACHE_KEY_PACKS = "coins_packs";
const CACHE_KEY_TRANSACTIONS = "gifts_transactions";
const CACHE_KEY_BALANCE = "user_wallet_balance";

export default function GiftsPage() {
  const [gifts, setGifts] = useState<GiftItem[]>(() => getCachedData<GiftItem[]>(CACHE_KEY_GIFTS) ?? []);
  const [packs, setPacks] = useState<CoinPack[]>(() => getCachedData<CoinPack[]>(CACHE_KEY_PACKS) ?? []);
  const [transactions, setTransactions] = useState<any[]>(() => getCachedData<any[]>(CACHE_KEY_TRANSACTIONS) ?? []);
  const [balance, setBalance] = useState<number>(() => getCachedData<number>(CACHE_KEY_BALANCE) ?? 0);
  const [loading, setLoading] = useState<boolean>(!getCachedData<GiftItem[]>(CACHE_KEY_GIFTS));

  const [search, setSearch] = useState("");
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<"shop" | "history">("shop");
  const [showCoinShop, setShowCoinShop] = useState(false);
  const [buying, setBuying] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("all");
  const [animData, setAnimData] = useState<GiftAnimationData | null>(null);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent && !getCachedData(CACHE_KEY_GIFTS)) {
      setLoading(true);
    }
    try {
      const [gRes, tRes, wRes, pRes] = await Promise.all([
        authFetch(`/gifts/catalogue`, {}),
        authFetch(`/gifts/transactions`, {}),
        authFetch(`/wallet`, {}),
        authFetch(`/coins/packs`, {}),
      ]);
      if (gRes.ok) {
        const j = await gRes.json();
        const parsedGifts = safeArray<GiftItem>(j);
        setGifts(parsedGifts);
        setCachedData(CACHE_KEY_GIFTS, parsedGifts);
      }
      if (tRes.ok) {
        const j = await tRes.json();
        const parsedTx = safeArray<any>(j);
        setTransactions(parsedTx);
        setCachedData(CACHE_KEY_TRANSACTIONS, parsedTx);
      }
      if (wRes.ok) {
        const j = await wRes.json();
        const b = j?.data?.balance ?? j?.data?.data?.balance ?? j?.balance ?? 0;
        setBalance(b);
        setCachedData(CACHE_KEY_BALANCE, b);
      }
      if (pRes.ok) {
        const j = await pRes.json();
        const parsedPacks = safeArray<CoinPack>(j);
        setPacks(parsedPacks);
        setCachedData(CACHE_KEY_PACKS, parsedPacks);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData(Boolean(getCachedData(CACHE_KEY_GIFTS)));
  }, [fetchData]);

  // Optimistic Coin Pack Purchase
  const buyPack = async (pack: CoinPack) => {
    setBuying(pack.id);
    setMsg(null);

    const totalCoins = pack.coins + (pack.bonus_coins || 0);
    // Optimistically update wallet balance
    setBalance((prev) => {
      const next = prev + totalCoins;
      setCachedData(CACHE_KEY_BALANCE, next);
      return next;
    });

    try {
      const res = await authFetch(`/coins/purchase`, {
        method: "POST",
        body: JSON.stringify({ coin_pack_id: pack.id, reference: crypto.randomUUID() }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: `Added ${totalCoins.toLocaleString()} coins to your wallet!` });
        setShowCoinShop(false);
        fetchData(true);
      } else {
        // Rollback optimistic update on failure
        const j = await res.json().catch(() => ({}));
        setBalance((prev) => {
          const prevBal = Math.max(0, prev - totalCoins);
          setCachedData(CACHE_KEY_BALANCE, prevBal);
          return prevBal;
        });
        setMsg({ ok: false, text: j.message || "Failed to purchase coins." });
      }
    } catch {
      setBalance((prev) => Math.max(0, prev - totalCoins));
      setMsg({ ok: false, text: "Network error." });
    } finally {
      setBuying(null);
    }
  };

  // Optimistic Gift Send
  const handleSend = async () => {
    if (!selectedGift || !recipient) return;
    const targetGift = selectedGift;
    const targetRecipient = recipient;
    const giftPrice = targetGift.coin_price;

    setSending(true);
    setMsg(null);

    // Optimistically deduct balance
    setBalance((prev) => {
      const next = Math.max(0, prev - giftPrice);
      setCachedData(CACHE_KEY_BALANCE, next);
      return next;
    });

    // Optimistically add transaction to history
    const tempTx = {
      id: "temp-" + Date.now(),
      gift: targetGift,
      recipient_id: targetRecipient,
      recipient: { name: `User #${targetRecipient}` },
      coin_price: giftPrice,
      message: message || undefined,
      created_at: new Date().toISOString(),
    };
    setTransactions((prev) => [tempTx, ...prev]);

    try {
      const res = await authFetch(`/gifts/send`, {
        method: "POST",
        body: JSON.stringify({
          gift_id: targetGift.id,
          recipient_id: parseInt(targetRecipient),
          giftable_type: "App\\Models\\User",
          giftable_id: parseInt(targetRecipient),
          is_anonymous: isAnonymous,
          message: message || undefined,
          idempotency_key: crypto.randomUUID(),
        }),
      });

      if (res.ok) {
        const resJson = await res.json().catch(() => ({}));
        setAnimData({
          giftName: targetGift.name,
          iconUrl: getAssetUrl(targetGift.icon_url),
          coinPrice: targetGift.coin_price,
          senderName: isAnonymous ? "Someone" : "You",
          animationType: resJson?.animation_type || (targetGift.coin_price >= 1000 ? "full_screen" : targetGift.coin_price >= 250 ? "premium" : "standard"),
        });
        setMsg({ ok: true, text: `Sent ${targetGift.name}!` });
        setSelectedGift(null); setRecipient(""); setMessage(""); setIsAnonymous(false);
        fetchData(true);
      } else {
        // Rollback balance & transaction history
        const j = await res.json().catch(() => ({}));
        setBalance((prev) => {
          const prevBal = prev + giftPrice;
          setCachedData(CACHE_KEY_BALANCE, prevBal);
          return prevBal;
        });
        setTransactions((prev) => prev.filter((t) => t.id !== tempTx.id));
        setMsg({ ok: false, text: j.message || "Failed to send gift." });
      }
    } catch {
      setBalance((prev) => prev + giftPrice);
      setTransactions((prev) => prev.filter((t) => t.id !== tempTx.id));
      setMsg({ ok: false, text: "Network error." });
    } finally {
      setSending(false);
    }
  };

  const safeGiftsList = safeArray<GiftItem>(gifts);
  const safePacksList = safeArray<CoinPack>(packs);
  const safeTxList = safeArray<any>(transactions);

  const categories = ["all", ...Array.from(new Set(safeGiftsList.map(g => g.category).filter(Boolean)))];
  const filtered = safeGiftsList.filter(g =>
    (g.name || "").toLowerCase().includes(search.toLowerCase()) &&
    (category === "all" || g.category === category)
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header Banner - Meta Standard Dark Surface */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 sm:p-8 rounded-2xl bg-card border border-border text-foreground shadow-xs">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider border border-primary/20">
            <Gift className="w-3.5 h-3.5" /> Virtual Gifting Store
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Gift Catalogue</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Send virtual gifts to your favorite creators, support streams, and boost community status.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="bg-muted/50 border border-border rounded-xl px-4 py-2 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Coins className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Balance</p>
              <p className="text-sm font-extrabold text-foreground">{balance.toLocaleString()} MSH</p>
            </div>
          </div>

          <ActionTooltip content="Purchase MSH coins to send gifts">
            <Button
              onClick={() => setShowCoinShop(true)}
              className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold h-10 px-4 rounded-xl gap-2 shadow-xs"
            >
              <Plus className="w-4 h-4" /> Buy Coins
            </Button>
          </ActionTooltip>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <ActionTooltip content="Browse available virtual gifts">
            <button
              onClick={() => setTab("shop")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                tab === "shop"
                  ? "bg-[#1877f2] text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <ShoppingBag className="w-4 h-4" /> Gift Tray
            </button>
          </ActionTooltip>

          <ActionTooltip content="View sent and received gifts">
            <button
              onClick={() => setTab("history")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                tab === "history"
                  ? "bg-[#1877f2] text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <History className="w-4 h-4" /> Transaction History
            </button>
          </ActionTooltip>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-xs font-bold border ${
          msg.ok ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
        }`}>
          {msg.ok ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-rose-500" />}
          {msg.text}
        </div>
      )}

      {tab === "shop" && (
        <div className="space-y-6">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                    category === cat
                      ? "bg-[#1877f2] text-white"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search gifts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#1877f2]/30 focus:border-[#1877f2]"
              />
            </div>
          </div>

          {/* Skeleton Loaders for Instant Feedback */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-2xl bg-card border border-border/50" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filtered.map(gift => (
                <button
                  key={gift.id}
                  onClick={() => setSelectedGift(gift)}
                  className={`group relative w-full border rounded-2xl p-4 text-center transition-all duration-200 hover:-translate-y-0.5 flex flex-col items-center justify-between ${
                    selectedGift?.id === gift.id
                      ? "border-[#1877f2] ring-2 ring-[#1877f2]/20 bg-[#1877f2]/10"
                      : "border-border bg-card hover:border-[#1877f2]/40"
                  }`}
                >
                  <span className={`self-end text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border mb-1 ${
                    gift.category === 'exclusive' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                    gift.category === 'premium' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                    gift.category === 'limited' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                    'bg-muted text-muted-foreground border-border'
                  }`}>
                    {gift.category}
                  </span>

                  <div className="w-16 h-16 mx-auto my-2 rounded-xl bg-muted/40 border border-border p-2 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                    <GiftIcon iconUrl={gift.icon_url} name={gift.name} />
                  </div>

                  <div className="w-full space-y-1 mt-1">
                    <p className="text-xs font-bold text-foreground truncate group-hover:text-[#1877f2] transition-colors">
                      {gift.name}
                    </p>
                    <div className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 font-extrabold text-[11px]">
                      <Coins className="w-3 h-3" />
                      <span>{gift.coin_price.toLocaleString()}</span>
                    </div>
                  </div>
                </button>
              ))}

              {filtered.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2">
                  <Gift className="w-10 h-10 opacity-20" />
                  <p className="text-xs font-bold">No gifts found matching your filter.</p>
                </div>
              )}
            </div>
          )}

          {/* Send Gift Modal Dialog (Meta Dark Mode Compliant) */}
          {selectedGift && (
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedGift(null)}
            >
              <div
                className="bg-card border border-border text-foreground rounded-2xl p-6 max-w-md w-full shadow-xl space-y-5 relative overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <ActionTooltip content="Close">
                  <button
                    onClick={() => setSelectedGift(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </ActionTooltip>

                <div className="text-center space-y-2.5">
                  <div className="w-20 h-20 mx-auto bg-muted/50 border border-border rounded-2xl flex items-center justify-center p-2.5 shadow-xs">
                    <GiftIcon iconUrl={selectedGift.icon_url} name={selectedGift.name} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{selectedGift.name}</h2>
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold text-xs mt-1">
                      <Coins className="w-3.5 h-3.5" /> {selectedGift.coin_price.toLocaleString()} Coins
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recipient receives <span className="font-bold text-foreground">{selectedGift.creator_earns} coins</span> after fee.
                  </p>
                </div>

                <div className="space-y-3.5 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground">Recipient User ID *</label>
                    <Input
                      type="number"
                      value={recipient}
                      onChange={e => setRecipient(e.target.value)}
                      placeholder="Enter user ID..."
                      className="bg-muted/30 border-border text-foreground placeholder:text-muted-foreground text-xs h-10 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground">Message (optional)</label>
                    <Textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Say something encouraging..."
                      rows={2.5}
                      className="bg-muted/30 border-border text-foreground placeholder:text-muted-foreground text-xs rounded-xl resize-none"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={e => setIsAnonymous(e.target.checked)}
                      className="h-4 w-4 rounded border-border bg-muted accent-[#1877f2]"
                    />
                    Send anonymously
                  </label>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      onClick={handleSend}
                      disabled={sending || !recipient}
                      className="flex-1 bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold h-10 rounded-xl"
                    >
                      {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Send Gift
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedGift(null)}
                      className="border border-border text-foreground hover:bg-muted font-bold h-10 rounded-xl"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20">
            <h2 className="font-bold text-foreground text-xs uppercase tracking-wider">Gifting Transactions</h2>
          </div>
          {safeTxList.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground flex flex-col items-center justify-center space-y-2">
              <Gift className="w-10 h-10 opacity-20" />
              <p className="font-bold text-xs">No gift transactions recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {safeTxList.map((t: any) => (
                <div key={t.id} className="p-4 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <p className="font-bold text-foreground">
                      {t.gift?.name || "Gift"}{" "}
                      <span className="text-muted-foreground font-normal mx-1">&rarr;</span>{" "}
                      {t.recipient?.name || `User #${t.recipient_id}`}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {t.message && <span className="italic mr-2">"{t.message}"</span>}
                      {new Date(t.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="font-extrabold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-xs">
                    {t.coin_price.toLocaleString()} coins
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Buy Coins Modal Dialog (Meta Dark Mode Compliant) */}
      {showCoinShop && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setShowCoinShop(false)}
        >
          <div
            className="bg-card border border-border text-foreground rounded-2xl p-6 max-w-lg w-full shadow-xl space-y-5 relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Coins className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Buy System Coins</h2>
                  <p className="text-xs text-muted-foreground">Balance: <span className="font-bold text-amber-500">{balance.toLocaleString()} MSH</span></p>
                </div>
              </div>
              <ActionTooltip content="Close">
                <button onClick={() => setShowCoinShop(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </ActionTooltip>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {safePacksList.map(pack => (
                <div
                  key={pack.id}
                  className={`relative border rounded-xl p-4 flex flex-col justify-between transition-all ${
                    pack.badge ? "border-amber-500/50 bg-amber-500/5" : "border-border bg-muted/20"
                  }`}
                >
                  {pack.badge && (
                    <span className="absolute -top-2.5 right-3 bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                      {pack.badge}
                    </span>
                  )}
                  <div className="space-y-0.5 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-amber-500" />
                      <span className="font-black text-lg text-foreground">{(pack.coins || 0).toLocaleString()}</span>
                    </div>
                    {(pack.bonus_coins || 0) > 0 && (
                      <span className="text-emerald-500 text-[11px] font-bold block">+{pack.bonus_coins} bonus coins</span>
                    )}
                    <p className="text-xs text-muted-foreground font-medium pt-1">{formatPrice(pack)}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => buyPack(pack)}
                    disabled={buying !== null}
                    className="w-full bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold rounded-xl h-9"
                  >
                    {buying === pack.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                    Purchase
                  </Button>
                </div>
              ))}
            </div>
            {safePacksList.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No coin packs available right now.</p>
            )}
          </div>
        </div>
      )}

      {/* Real-time sending animation overlay */}
      <GiftAnimationOverlay data={animData} onComplete={() => setAnimData(null)} />
    </div>
  );
}
