import { useState, useEffect, useCallback } from 'react';
import { BadgeDollarSign, Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WithdrawalRequest } from '@/types/wallet';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
const authHeaders = () => {
  const t = localStorage.getItem('auth_token') || localStorage.getItem('murihspace-token');
  return { Accept: 'application/json', 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

export function AdminTransactionsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  const loadWithdrawals = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/securegate/withdrawals`, { headers: authHeaders() });
      if (res.ok) { const j = await res.json(); setWithdrawals(j?.data?.data ?? j?.data ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadWithdrawals(); }, [loadWithdrawals]);

  const handleProcess = async (id: number, action: 'approve' | 'reject') => {
    setProcessing(id);
    const res = await fetch(`${API_BASE}/securegate/withdrawals/${id}/process`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ action, rejection_reason: action === 'reject' ? 'Rejected by admin' : null }),
    });
    if (res.ok) setProcessing(null);
    loadWithdrawals();
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

      <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border bg-white/[0.02]">
          <h2 className="text-xs font-bold text-foreground">Withdrawal Requests</h2>
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
                      <p className="text-sm font-bold text-foreground">Withdrawal #{w.id}</p>
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
    </div>
  );
}
