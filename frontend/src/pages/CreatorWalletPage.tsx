import { useState, useEffect, useCallback } from "react";
import { Wallet, Gift, Loader2, ArrowUpRight, DollarSign, Coins, Clock, Check, AlertCircle, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function CreatorWalletPage() {
  const [data, setData] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/creator-wallet`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/creator-wallet/payouts`, { headers: getAuthHeaders() }),
      ]);
      if (wRes.ok) setData(await wRes.json());
      if (pRes.ok) { const j = await pRes.json(); setPayouts(j?.data ?? j ?? []); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/creator-wallet/payouts`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ amount: parseFloat(payoutAmount), payment_method: paymentMethod, payment_details: paymentDetails }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Payout requested!" });
        setShowPayoutForm(false); setPayoutAmount(""); setPaymentDetails("");
        fetchData();
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j.message || "Failed to request payout." });
      }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    finally { setSending(false); }
  };

  const wallet = data?.wallet;
  const recentGifts = data?.recent_gifts || [];
  const topGifts = data?.top_gifts || [];

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6 text-green-500" /> Creator Wallet</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your gift earnings and payouts</p>
        </div>
        <Button onClick={() => setShowPayoutForm(!showPayoutForm)} disabled={!wallet || wallet.available_balance <= 0}>
          <ArrowUpRight className="w-4 h-4 mr-2" />Request Payout
        </Button>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{msg.text}
        </div>
      )}

      {showPayoutForm && (
        <div className="bg-white border rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Request a Payout</h2>
          <form onSubmit={handlePayout} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Amount</label>
              <Input type="number" min="1" step="0.01" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} required placeholder="0.00" />
              <p className="text-xs text-gray-400 mt-1">Available: {wallet?.available_balance?.toFixed(2) || "0.00"}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="bank_transfer">Bank Transfer</option>
                <option value="paypal">PayPal</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Payment Details</label>
              <Input value={paymentDetails} onChange={e => setPaymentDetails(e.target.value)} required placeholder="Account number, email, or phone" />
            </div>
            <Button type="submit" disabled={sending}>{sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Submit Request</Button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Gifts</p>
          <p className="text-2xl font-bold">{wallet?.total_gifts_received || 0}</p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500"><DollarSign className="w-3 h-3 inline text-green-500" /> Gross Earnings</p>
          <p className="text-2xl font-bold">{wallet?.gross_earnings?.toFixed(2) || "0.00"}</p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500"><Coins className="w-3 h-3 inline text-yellow-500" /> Available</p>
          <p className="text-2xl font-bold text-green-600">{wallet?.available_balance?.toFixed(2) || "0.00"}</p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500"><Clock className="w-3 h-3 inline text-blue-500" /> Pending</p>
          <p className="text-2xl font-bold text-blue-600">{wallet?.pending_balance?.toFixed(2) || "0.00"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border rounded-xl shadow-sm">
          <div className="p-4 border-b bg-gray-50"><h2 className="font-semibold flex items-center gap-2"><Gift className="w-4 h-4 text-pink-500" /> Recent Gifts</h2></div>
          {recentGifts.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No gifts received yet</div>
          ) : (
            <div className="divide-y max-h-80 overflow-y-auto">
              {recentGifts.map((t: any) => (
                <div key={t.id} className="p-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center"><Gift className="w-4 h-4 text-pink-500" /></div>
                    <div>
                      <p className="font-medium">{t.gift?.name} {t.is_anonymous ? "(Anonymous)" : `from ${t.sender?.name}`}</p>
                      <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-green-600">+{t.creator_earns}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border rounded-xl shadow-sm">
          <div className="p-4 border-b bg-gray-50"><h2 className="font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-500" /> Top Gifts</h2></div>
          {topGifts.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No data yet</div>
          ) : (
            <div className="divide-y">
              {topGifts.map((t: any) => (
                <div key={t.gift_id} className="p-3 flex items-center justify-between text-sm">
                  <span className="font-medium">{t.gift?.name}</span>
                  <div className="text-right">
                    <p className="font-semibold">{t.count}x</p>
                    <p className="text-xs text-gray-400">{t.total} coins</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm">
        <div className="p-4 border-b bg-gray-50"><h2 className="font-semibold">Payout History</h2></div>
        {payouts.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No payout requests yet</div>
        ) : (
          <div className="divide-y">
            {payouts.map((p: any) => (
              <div key={p.id} className="p-4 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">${p.amount} via {p.payment_method}</p>
                  <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <Badge className={p.status === "paid" ? "bg-green-100 text-green-700" : p.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}>{p.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
