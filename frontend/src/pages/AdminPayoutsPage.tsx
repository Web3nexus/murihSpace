import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Loader2, CheckCircle2, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = localStorage.getItem('murihspace-token');
  return { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatAmount(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  return (symbols[currency] ?? currency + ' ') + (amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

interface PayoutItem {
  id: number; gross_amount: number; platform_fee: number; net_amount: number;
  currency: string; status: string; paid_at: string | null; created_at: string;
  creator: { id: number; name: string; username: string } | null;
  fulfilment_order: { id: number; order_number: string; status: string; total: number; currency: string } | null;
}

interface PayoutSummary {
  total_pending: number; total_paid: number; total_failed: number;
  pending_count: number; paid_count: number;
}

export function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchPayouts = useCallback(async () => {
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('per_page', '20');
      const res = await fetch(`${API_BASE}/securegate/payouts?${params}`, { headers: getAuthHeaders() });
      if (res.ok) { const j = await res.json(); const d = j?.success ? j?.data : j; setPayouts(d?.data?.data ?? d?.data ?? []); setSummary(d?.summary ?? null); setLastPage(d?.data?.last_page ?? d?.last_page ?? 1); }
      else throw new Error(`HTTP ${res.status}`);
    } catch (e) { setFetchError(e instanceof Error ? e.message : 'Failed to load payouts'); }
    finally { setIsLoading(false); }
  }, [statusFilter, page]);

  useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

  async function markPaid(id: number) {
    if (!confirm('Mark this payout as paid?')) return;
    try {
      const res = await fetch(`${API_BASE}/securegate/payouts/${id}/mark-paid`, { method: 'PUT', headers: getAuthHeaders() });
      const j = await res.json();
      if (res.ok) { setMessage({ type: 'success', text: 'Payout marked as paid.' }); fetchPayouts(); }
      else { setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  if (isLoading) return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <span className="px-2.5 py-0.5 rounded-full bg-[#38A8D8]/20 text-[#38A8D8] text-xs font-semibold uppercase tracking-wider border border-[#38A8D8]/30">Admin</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Fulfilment Payouts</h1>
          <p className="text-sm text-white/70 max-w-xl">Manage creator payouts for physical product orders.</p>
        </div>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setIsLoading(true); fetchPayouts(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 border ${
          message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>{message.text}</div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Pending', value: formatAmount(summary.total_pending), count: summary.pending_count, color: 'text-amber-500' },
            { label: 'Paid', value: formatAmount(summary.total_paid), count: summary.paid_count, color: 'text-emerald-500' },
            { label: 'Failed', value: formatAmount(summary.total_failed), color: 'text-red-500' },
            { label: 'Total Pending Orders', value: summary.pending_count, color: 'text-muted-foreground' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              {s.count !== undefined && <p className="text-xs text-muted-foreground">{s.count} payouts</p>}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 border-b border-border pb-1">
        {['', 'pending', 'paid', 'failed'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-bold transition-colors ${statusFilter === s ? 'bg-card text-foreground border-x border-t border-border' : 'text-muted-foreground hover:text-foreground'}`}
          >{s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}</button>
        ))}
      </div>

      {payouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-card">
          <DollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <h3 className="text-base font-semibold text-foreground">No payouts found</h3>
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
          <div className="divide-y divide-border/50">
            {payouts.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-xl shrink-0 ${p.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : p.status === 'failed' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {p.status === 'paid' ? <CheckCircle2 className="h-4 w-4" /> : p.status === 'failed' ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{formatAmount(p.net_amount, p.currency)}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${p.status === 'paid' ? 'text-emerald-400' : p.status === 'failed' ? 'text-rose-400' : 'text-amber-400'}`}>{p.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      @{p.creator?.username ?? '?'} · Order #{p.fulfilment_order?.order_number ?? 'N/A'} · {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4 text-xs text-muted-foreground">
                  <span>Gross: {formatAmount(p.gross_amount, p.currency)}</span>
                  <span>Fee: -{formatAmount(p.platform_fee, p.currency)}</span>
                  {p.status === 'pending' && (
                    <Button variant="default" size="sm" onClick={() => markPaid(p.id)} className="ml-2">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Paid
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
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
