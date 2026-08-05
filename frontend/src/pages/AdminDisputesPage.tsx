import { useState, useEffect, useCallback } from "react";
import { ShieldAlert, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

interface Dispute {
  id: number; order_id: number; buyer_name: string; seller_name: string;
  reason: string; status: "open" | "resolved" | "refunded"; amount: number; currency: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = { open: "bg-amber-500/20 text-amber-400", resolved: "bg-emerald-500/20 text-emerald-400", refunded: "bg-rose-500/20 text-rose-400" };

import { AlertCircle, Check } from "lucide-react";
import { getAuthToken } from "@/lib/auth/token";

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [processing, setProcessing] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/securegate/disputes?page=${page}&per_page=20`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setDisputes(list?.data ?? list ?? []);
      setLastPage(j.data?.last_page ?? j.data?.data?.last_page ?? 1);
    } catch { setError("Failed to load disputes."); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { loadData(); }, [loadData]);

  const resolve = async (id: number, action: "resolve" | "refund") => {
    setProcessing(id);
    setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/securegate/disputes/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status: action === "resolve" ? "resolved" : "refunded" }) });
      if (res.ok) { setMsg({ ok: true, text: `Dispute ${action === "resolve" ? "resolved" : "refunded"}.` }); loadData(); }
      else { const j = await res.json().catch(() => ({})); setMsg({ ok: false, text: j.message || "Action failed." }); }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    finally { setProcessing(null); }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div><h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5"><ShieldAlert className="h-6 w-6 text-[#38A8D8]" /> Disputes Management</h1><p className="text-xs text-muted-foreground mt-1">Manage refund requests and disputes.</p></div>

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

      {disputes.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card"><ShieldAlert className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><h3 className="text-sm font-bold">No disputes</h3></div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <div key={d.id} className="border border-border rounded-2xl bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                <div className="flex items-center gap-3 min-w-0">
                  <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">Order #{d.order_id} — {d.buyer_name} vs {d.seller_name}</p>
                    <p className="text-[11px] text-muted-foreground">{d.currency} {d.amount.toLocaleString()} · {new Date(d.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[d.status]}`}>{d.status}</span>
              </div>
              {expanded === d.id && (
                <div className="px-4 pb-4 pt-2 border-t border-border/50 space-y-3">
                  <p className="text-xs text-foreground">{d.reason}</p>
                  {d.status === "open" && (
                    <div className="flex gap-2">
                      <Button size="sm" disabled={processing === d.id} onClick={() => resolve(d.id, "resolve")} className="text-[10px] h-7 gap-1"><CheckCircle2 className="h-3 w-3" /> Resolve</Button>
                      <Button size="sm" variant="outline" disabled={processing === d.id} onClick={() => resolve(d.id, "refund")} className="text-[10px] h-7 gap-1 text-destructive"><XCircle className="h-3 w-3" /> Refund</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Previous</button>
          <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
          <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
