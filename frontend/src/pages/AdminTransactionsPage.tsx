import { useState, useEffect, useCallback } from 'react';
import { BadgeDollarSign, Loader2, CheckCircle2, Clock, XCircle, AlertCircle, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WithdrawalRequest } from '@/types/wallet';
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
const authHeaders = () => {
  const t = getAuthToken();
  return { Accept: 'application/json', 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

const requestId = { current: 0 };

export function AdminTransactionsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [processing, setProcessing] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');

  const loadWithdrawals = useCallback(async () => {
    const id = ++requestId.current;
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '20' });
      if (search) params.set('search', search);
      const res = await fetch(`${API_BASE}/securegate/withdrawals?${params}`, { headers: authHeaders() });
      if (id !== requestId.current) return;
      if (res.ok) { const j = await res.json(); setWithdrawals(j?.data?.data ?? j?.data ?? []); setLastPage(j.data?.last_page ?? j.data?.data?.last_page ?? 1); }
      else setError('Failed to load withdrawals.');
    } catch { if (id === requestId.current) setError('Unable to connect.'); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [page, search]);

  useEffect(() => { loadWithdrawals(); }, [loadWithdrawals]);

  const handleProcess = async (id: number, action: 'approve' | 'reject') => {
    setProcessing(id);
    setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/securegate/withdrawals/${id}/process`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ action, rejection_reason: action === 'reject' ? 'Rejected by admin' : null }),
      });
      if (res.ok) { setMsg({ ok: true, text: `Withdrawal ${action === 'approve' ? 'approved' : 'rejected'}.` }); loadWithdrawals(); }
      else { const j = await res.json().catch(() => ({})); setMsg({ ok: false, text: j.message || 'Action failed.' }); }
    } catch { setMsg({ ok: false, text: 'Network error.' }); }
    finally { setProcessing(null); }
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-400',
    approved: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-emerald-500/20 text-emerald-400',
    rejected: 'bg-rose-500/20 text-rose-400',
  };

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <BadgeDollarSign className="h-6 w-6 text-[#38A8D8]" /> Transactions
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Review withdrawals, orders, and platform transactions.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          <button onClick={() => { setLoading(true); loadWithdrawals(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold ${msg.ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
          {msg.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {msg.text}
        </div>
      )}
      <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border bg-white/[0.02] flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xs font-bold text-foreground">Withdrawal Requests</h2>
          <div className="relative max-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by ID, user, status..." className="pl-8 h-8 text-xs" />
          </div>
        </div>
        {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>
          : withdrawals.length === 0 ? <div className="p-12 text-center"><BadgeDollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" /><p className="text-xs text-muted-foreground">No withdrawal requests.</p></div>
          : <div className="divide-y divide-border/50">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${statusColor[w.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {w.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : w.status === 'rejected' ? <XCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">#{w.id} — {w.user?.name ?? w.user?.username ?? `User #${w.user_id}`}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-foreground">{((w.amount ?? 0) / 100).toFixed(2)} {w.currency}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor[w.status] ?? ''}`}>{w.status}</span>
                    </div>
                    {w.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" disabled={processing === w.id} onClick={() => handleProcess(w.id, 'approve')} className="h-7 text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white">Approve</Button>
                        <Button size="sm" disabled={processing === w.id} onClick={() => handleProcess(w.id, 'reject')} variant="destructive" className="h-7 text-[10px] font-bold">Reject</Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>}
      </div>

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
