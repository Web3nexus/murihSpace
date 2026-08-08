import { useState, useEffect, useCallback } from "react";
import { Gift, Loader2, Search, Send, Coins, AlertCircle, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface GiftItem { id: number; name: string; icon_url: string | null; coin_price: number; creator_earns: number; category: string; is_active: boolean; sort_order: number; }
interface CoinPack { id: number; name: string; coins: number; bonus_coins: number; price: number; currency: string; badge: string | null; is_active: boolean; sort_order: number; }

function formatPrice(p: CoinPack) {
  const syms: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" };
  return (syms[p.currency] ?? p.currency + " ") + (p.price / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GiftsPage() {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [packs, setPacks] = useState<CoinPack[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<"shop" | "history">("shop");
  const [balance, setBalance] = useState(0);
  const [showCoinShop, setShowCoinShop] = useState(false);
  const [buying, setBuying] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, tRes, wRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/gifts/catalogue`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/gifts/transactions`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/wallet`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/coins/packs`, { headers: getAuthHeaders() }),
      ]);
      if (gRes.ok) { const j = await gRes.json(); setGifts(j?.data ?? j ?? []); }
      if (tRes.ok) { const j = await tRes.json(); setTransactions(j?.data?.data ?? j?.data ?? j ?? []); }
      if (wRes.ok) { const j = await wRes.json(); setBalance(j?.data?.balance ?? j?.data?.data?.balance ?? j?.balance ?? 0); }
      if (pRes.ok) { const j = await pRes.json(); setPacks(j?.data ?? j ?? []); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const buyPack = async (pack: CoinPack) => {
    setBuying(pack.id); setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/coins/purchase`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ coin_pack_id: pack.id, reference: crypto.randomUUID() }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: `Added ${pack.coins + (pack.bonus_coins || 0)} coins to your wallet!` });
        setShowCoinShop(false);
        const wRes = await fetch(`${API_BASE}/wallet`, { headers: getAuthHeaders() });
        if (wRes.ok) { const j = await wRes.json(); setBalance(j?.data?.balance ?? j?.data?.data?.balance ?? j?.balance ?? 0); }
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j.message || "Failed to purchase coins." });
      }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    finally { setBuying(null); }
  };

  const handleSend = async () => {
    if (!selectedGift || !recipient) return;
    setSending(true); setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/gifts/send`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({
          gift_id: selectedGift.id,
          recipient_id: parseInt(recipient),
          giftable_type: "App\\Models\\User",
          giftable_id: parseInt(recipient),
          is_anonymous: isAnonymous,
          message: message || undefined,
          idempotency_key: crypto.randomUUID(),
        }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: `Sent ${selectedGift.name}!` });
        setSelectedGift(null); setRecipient(""); setMessage(""); setIsAnonymous(false);
        fetchData();
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j.message || "Failed to send gift." });
      }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    finally { setSending(false); }
  };

  const categories = ["all", ...Array.from(new Set(gifts.map(g => g.category)))];
  const filtered = gifts.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) &&
    (category === "all" || g.category === category)
  );

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground"><Gift className="w-6 h-6 text-pink-500" /> Gifts</h1>
          <p className="text-sm text-muted-foreground mt-1">Send virtual gifts to your favourite creators</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm">
            <Coins className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-amber-600 dark:text-amber-400">{balance.toLocaleString()} MSH</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowCoinShop(true)} className="gap-1.5 font-semibold">
            <Plus className="w-4 h-4" /> Buy Coins
          </Button>
          <Button variant={tab === "shop" ? "default" : "outline"} size="sm" onClick={() => setTab("shop")} className="font-semibold">Shop</Button>
          <Button variant={tab === "history" ? "default" : "outline"} size="sm" onClick={() => setTab("history")} className="font-semibold">History</Button>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{msg.text}
        </div>
      )}

      {tab === "shop" && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${category === cat ? "bg-pink-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search gifts..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
                <h2 className="font-bold text-foreground">Gift Tray</h2>
                <span className="text-xs text-muted-foreground font-medium">Tap a gift to send it</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-5">
                {filtered.map(gift => (
                  <button
                    key={gift.id}
                    onClick={() => setSelectedGift(gift)}
                    className={`relative w-full border rounded-2xl p-4 text-center transition-all hover:-translate-y-1 hover:shadow-md ${selectedGift?.id === gift.id ? "border-pink-500 ring-2 ring-pink-500/20 bg-pink-50 dark:bg-pink-500/10" : "border-border bg-background hover:border-pink-300 dark:hover:border-pink-500/50"}`}
                  >
                    <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/40 dark:to-purple-900/40 rounded-full flex items-center justify-center shadow-inner">
                      {gift.icon_url ? <img src={gift.icon_url} alt={gift.name} className="w-8 h-8 object-contain" /> : <Gift className="w-6 h-6 text-pink-500" />}
                    </div>
                    <p className="text-sm font-bold text-foreground truncate">{gift.name}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-1">{gift.coin_price} coins</p>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3">
                    <Gift className="w-10 h-10 opacity-20" />
                    <p className="text-sm font-medium">No gifts found.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedGift && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedGift(null)}>
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="text-center mb-4">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full flex items-center justify-center">
                    {selectedGift.icon_url ? <img src={selectedGift.icon_url} className="w-10 h-10 object-contain" /> : <Gift className="w-8 h-8 text-pink-500" />}
                  </div>
                  <h2 className="text-xl font-bold">{selectedGift.name}</h2>
                  <p className="text-yellow-600 font-semibold">{selectedGift.coin_price} coins</p>
                  <p className="text-sm text-gray-500">Creator earns {selectedGift.creator_earns} coins</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Recipient User ID *</label>
                    <Input type="number" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Enter user ID" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Message (optional)</label>
                    <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Say something nice..." rows={2} />
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="rounded" />
                    Send anonymously
                  </label>
                  <div className="flex gap-3 pt-2">
                    <Button onClick={handleSend} disabled={sending || !recipient} className="flex-1">
                      {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Send Gift
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedGift(null)}>Cancel</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "history" && (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30"><h2 className="font-bold text-foreground">Gift History</h2></div>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center space-y-3">
              <Gift className="w-12 h-12 opacity-20" />
              <p className="font-medium text-sm">No gift transactions yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((t: any) => (
                <div key={t.id} className="p-5 flex items-center justify-between text-sm hover:bg-muted/10 transition-colors">
                  <div>
                    <p className="font-bold text-foreground">{t.gift?.name || "Gift"} <span className="text-muted-foreground font-medium mx-1">&rarr;</span> {t.recipient?.name || `User #${t.recipient_id}`}</p>
                    <p className="text-muted-foreground text-xs mt-1">{t.message && <span className="italic mr-2">"{t.message}"</span>} {new Date(t.created_at).toLocaleString()}</p>
                  </div>
                  <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full">{t.coin_price} coins</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCoinShop && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCoinShop(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><Coins className="w-5 h-5 text-yellow-500" /> Buy Coins</h2>
              <button onClick={() => setShowCoinShop(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Buy coins to send gifts to creators. You currently have <span className="font-semibold text-yellow-600">{balance.toLocaleString()} MSH</span>.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {packs.map(pack => (
                <div key={pack.id} className={`relative border rounded-xl p-4 flex flex-col ${pack.badge ? "border-yellow-300 ring-1 ring-yellow-200" : "border-gray-200"} hover:shadow-md transition-shadow`}>
                  {pack.badge && (
                    <span className="absolute -top-2.5 right-3 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full">{pack.badge}</span>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <Coins className="w-4 h-4 text-yellow-500" />
                    <span className="font-bold text-lg">{pack.coins.toLocaleString()}</span>
                    {pack.bonus_coins > 0 && <span className="text-green-600 text-xs font-semibold">+{pack.bonus_coins} bonus</span>}
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{formatPrice(pack)}</p>
                  <Button size="sm" onClick={() => buyPack(pack)} disabled={buying !== null} className="w-full">
                    {buying === pack.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Buy
                  </Button>
                </div>
              ))}
            </div>
            {packs.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No coin packs available right now.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
