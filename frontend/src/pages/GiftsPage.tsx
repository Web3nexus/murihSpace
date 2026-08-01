import { useState, useEffect, useCallback } from "react";
import { Gift, Loader2, Search, Send, Coins, AlertCircle, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

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
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Gift className="w-6 h-6 text-pink-500" /> Gifts</h1>
          <p className="text-sm text-gray-500 mt-1">Send virtual gifts to your favourite creators</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm">
            <Coins className="w-4 h-4 text-yellow-600" />
            <span className="font-semibold text-yellow-700">{balance.toLocaleString()} MSH</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowCoinShop(true)}>
            <Plus className="w-4 h-4 mr-1" /> Buy Coins
          </Button>
          <Button variant={tab === "shop" ? "default" : "outline"} size="sm" onClick={() => setTab("shop")}>Shop</Button>
          <Button variant={tab === "history" ? "default" : "outline"} size="sm" onClick={() => setTab("history")}>History</Button>
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

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search gifts..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h2 className="font-semibold text-sm">Gift Tray</h2>
                <span className="text-xs text-gray-500">Tap a gift to send it</span>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar p-4">
                {filtered.map(gift => (
                  <button
                    key={gift.id}
                    onClick={() => setSelectedGift(gift)}
                    className={`relative shrink-0 w-24 border rounded-xl p-3 text-center transition-all hover:shadow-md hover:border-pink-300 ${selectedGift?.id === gift.id ? "border-pink-500 ring-2 ring-pink-200 bg-pink-50" : "border-gray-200 bg-white"}`}
                  >
                    <div className="w-11 h-11 mx-auto mb-2 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full flex items-center justify-center">
                      {gift.icon_url ? <img src={gift.icon_url} alt={gift.name} className="w-7 h-7 object-contain" /> : <Gift className="w-5 h-5 text-pink-500" />}
                    </div>
                    <p className="text-xs font-medium truncate">{gift.name}</p>
                    <p className="text-[11px] text-yellow-600 font-semibold mt-0.5">{gift.coin_price} coins</p>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-gray-400 py-8 text-center w-full">No gifts found.</p>
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
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50"><h2 className="font-semibold">Gift History</h2></div>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Gift className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No gift transactions yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {transactions.map((t: any) => (
                <div key={t.id} className="p-4 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{t.gift?.name || "Gift"} &rarr; {t.recipient?.name || `User #${t.recipient_id}`}</p>
                    <p className="text-gray-500 text-xs">{t.message && `"${t.message}"`} {new Date(t.created_at).toLocaleString()}</p>
                  </div>
                  <span className="font-semibold text-yellow-600">{t.coin_price} coins</span>
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
