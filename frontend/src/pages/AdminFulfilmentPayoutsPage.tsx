import { useState, useEffect, useCallback } from "react";
import { DollarSign, Loader2, CheckCircle2, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function authHeaders() {
  const t = localStorage.getItem("murihspace-token") || localStorage.getItem("auth_token");
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

function fmt(cents: number, cur = "NGN") {
  const s: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" };
  return (s[cur] ?? cur + " ") + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

export default function AdminFulfilmentPayoutsPage() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [processing, setProcessing] = useState<number | null>(null);
  const [totals, setTotals] = useState({ pending: 0, paid: 0 });

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/securegate/payouts`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      const data = list?.data?.data ?? list?.data ?? list ?? [];
      const arr = Array.isArray(data) ? data : [];
      setPayouts(arr);
      setTotals({ pending: arr.filter((p: any) => p.status === "pending").reduce((s: number, p: any) => s + p.net_amount, 0), paid: arr.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + p.net_amount, 0) });
    } catch { setError("Failed to load payouts."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const markPaid = async (id: number) => {
    setProcessing(id);
    setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/securegate/payouts/${id}/mark-paid`, { method: "PUT", headers: authHeaders() });
      if (res.ok) { setMsg({ ok: true, text: "Marked as paid." }); loadData(); }
      else { const j = await res.json().catch(() => ({})); setMsg({ ok: false, text: j.message || "Failed." }); }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    finally { setProcessing(null); }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div><h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5"><DollarSign className="h-6 w-6 text-[#38A8D8]" /> Fulfilment Payouts</h1><p className="text-xs text-muted-foreground mt-1">Manage vendor fulfilment payouts.</p></div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      )}
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold ${msg.ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
          {msg.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border rounded-2xl bg-card p-5"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pending</p><p className="text-2xl font-black text-amber-400 mt-1">{fmt(totals.pending)}</p></div>
        <div className="border border-border rounded-2xl bg-card p-5"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Paid</p><p className="text-2xl font-black text-emerald-400 mt-1">{fmt(totals.paid)}</p></div>
      </div>

      {payouts.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card"><DollarSign className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><h3 className="text-sm font-bold">No payouts</h3></div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-left">{["Order", "Vendor", "Amount", "Fee", "Net", "Status", ""].map((h) => <th key={h} className="px-4 py-3 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {payouts.map((p: any) => (
                <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-mono text-muted-foreground">#{p.fulfilment_order_id}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">{p.creator?.name ?? p.vendor_name ?? p.vendor_id}</td>
                  <td className="px-4 py-3 font-mono">{fmt(p.gross_amount, p.currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmt(p.platform_fee, p.currency)}</td>
                  <td className="px-4 py-3 font-bold text-foreground">{fmt(p.net_amount, p.currency)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{p.status}</span></td>
                  <td className="px-4 py-3">{p.status === 'pending' && <Button size="sm" disabled={processing === p.id} onClick={() => markPaid(p.id)} className="text-[10px] h-7"><CheckCircle2 className="h-3 w-3 mr-1" />Mark Paid</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
