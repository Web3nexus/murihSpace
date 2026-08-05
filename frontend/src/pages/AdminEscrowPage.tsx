import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { Shield, Loader2, AlertTriangle, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getAuthToken } from "@/lib/auth/token";
import { useConfirm } from '@/components/ui/DialogProvider';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatAmount(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  return (symbols[currency] ?? currency + ' ') + (amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

interface EscrowItem {
  id: number; amount: number; currency: string; status: string;
  created_at: string; released_at: string | null;
  buyer: { id: number; name: string; username: string } | null;
  seller: { id: number; name: string; username: string } | null;
  order: { id: number; order_number: string } | null;
  disputes: any[];
}

export function AdminEscrowPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || '';
  const statusFilter = tabParam === 'disputed' ? 'disputed' : tabParam === 'escrow' ? '' : tabParam;
  const [escrows, setEscrows] = useState<EscrowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedEscrow, setSelectedEscrow] = useState<EscrowItem | null>(null);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [disputeResolution, setDisputeResolution] = useState('resolved_buyer');
  const [disputeNote, setDisputeNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchEscrows = useCallback(async () => {
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('per_page', '20');
      const res = await fetch(`${API_BASE}/securegate/escrow?${params}`, { headers: getAuthHeaders() });
      if (res.ok) { const j = await res.json(); setEscrows(j?.data?.data ?? j?.data ?? []); setLastPage(j.data?.last_page ?? j.data?.data?.last_page ?? 1); }
      else throw new Error(`HTTP ${res.status}`);
    } catch (e) { setFetchError(e instanceof Error ? e.message : 'Failed to load escrows'); }
    finally { setIsLoading(false); }
  }, [statusFilter, page]);

  useEffect(() => { fetchEscrows(); }, [fetchEscrows]);

  function handleTabChange(s: string) {
    setSearchParams(s ? { tab: s } : {});
    setPage(1);
  }

  const confirm = useConfirm();

  async function releaseEscrow(id: number) {
    if (!await confirm({ title: "Release Escrow", message: "Release this escrow to the seller?" })) return;
    try {
      const res = await fetch(`${API_BASE}/securegate/escrow/${id}/release`, { method: 'POST', headers: getAuthHeaders() });
      const j = await res.json();
      if (res.ok) { setMessage({ type: 'success', text: j.message ?? 'Released.' }); fetchEscrows(); }
      else { setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  async function refundEscrow(id: number) {
    if (!await confirm({ title: "Refund Escrow", message: "Refund this escrow to the buyer?", variant: "warning" })) return;
    try {
      const res = await fetch(`${API_BASE}/securegate/escrow/${id}/refund`, { method: 'POST', headers: getAuthHeaders() });
      const j = await res.json();
      if (res.ok) { setMessage({ type: 'success', text: j.message ?? 'Refunded.' }); fetchEscrows(); }
      else { setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  async function resolveDispute(_escrowId: number) {
    if (!selectedEscrow) return;
    setSubmitting(true);
    try {
      const disputeId = selectedEscrow.disputes?.[0]?.id;
      if (!disputeId) { setMessage({ type: 'error', text: 'No active dispute found.' }); setSubmitting(false); return; }
      const res = await fetch(`${API_BASE}/securegate/escrow/disputes/${disputeId}/resolve`, {
        method: 'PUT', headers: getAuthHeaders(),
        body: JSON.stringify({ resolution: disputeResolution, resolution_note: disputeNote || null }),
      });
      const j = await res.json();
      if (res.ok) { setMessage({ type: 'success', text: 'Dispute resolved.' }); setShowDisputeDialog(false); fetchEscrows(); }
      else { setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
    finally { setSubmitting(false); }
  }

  if (isLoading) return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const statusColors: Record<string, string> = { held: 'text-blue-400', released: 'text-emerald-400', refunded: 'text-amber-400', disputed: 'text-red-400' };

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <span className="px-2.5 py-0.5 rounded-full bg-[#2164b6]/20 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-semibold uppercase tracking-wider border border-[#2164b6]/30">Admin</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Escrow Management</h1>
          <p className="text-sm text-white/70 max-w-xl">View, release, refund escrows and resolve disputes.</p>
        </div>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setIsLoading(true); fetchEscrows(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 border ${
          message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>{message.text}</div>
      )}

      <div className="flex gap-1 border-b border-border pb-1">
        {['', 'held', 'released', 'refunded', 'disputed'].map(s => (
          <button key={s} onClick={() => handleTabChange(s)}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-bold transition-colors ${statusFilter === s ? 'bg-card text-foreground border-x border-t border-border' : 'text-muted-foreground hover:text-foreground'}`}
          >{s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}</button>
        ))}
      </div>

      {escrows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-card">
          <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <h3 className="text-base font-semibold text-foreground">No escrows found</h3>
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
          <div className="divide-y divide-border/50">
            {escrows.map(e => (
              <div key={e.id} className="px-4 py-3.5 hover:bg-muted/10 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 rounded-xl bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] shrink-0"><Shield className="h-4 w-4" /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground">{formatAmount(e.amount, e.currency)}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColors[e.status] ?? 'text-muted-foreground'}`}>{e.status}</span>
                        {e.disputes?.length > 0 && <AlertTriangle className="h-3 w-3 text-red-500" aria-label="Has dispute" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        #{e.order?.order_number ?? 'N/A'} · @{e.buyer?.username ?? '?'} → @{e.seller?.username ?? '?'} · {new Date(e.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedEscrow(e); }}>Detail</Button>
                    {e.status === 'held' && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => releaseEscrow(e.id)} className="text-emerald-500">Release</Button>
                        <Button variant="ghost" size="sm" onClick={() => refundEscrow(e.id)} className="text-amber-500">Refund</Button>
                      </>
                    )}
                    {e.status === 'disputed' && (
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedEscrow(e); setShowDisputeDialog(true); }} className="text-red-500">Resolve</Button>
                    )}
                  </div>
                </div>
                {selectedEscrow?.id === e.id && !showDisputeDialog && (
                  <div className="mt-3 p-3 rounded-xl bg-muted/30 text-xs text-muted-foreground space-y-1">
                    <p><strong>Order:</strong> #{e.order?.order_number ?? 'N/A'}</p>
                    <p><strong>Buyer:</strong> @{e.buyer?.username} ({e.buyer?.name})</p>
                    <p><strong>Seller:</strong> @{e.seller?.username} ({e.seller?.name})</p>
                    <p><strong>Created:</strong> {new Date(e.created_at).toLocaleString()}</p>
                    {e.released_at && <p><strong>Released:</strong> {new Date(e.released_at).toLocaleString()}</p>}
                    {e.disputes?.length > 0 && (
                      <div className="mt-2">
                        <p className="font-semibold text-foreground">Disputes:</p>
                        {e.disputes.map((d: any) => (
                          <div key={d.id} className="pl-2 border-l-2 border-red-300 mt-1">
                            <p className="text-foreground">{d.reason}</p>
                            <p>Status: {d.status} · Raised by @{d.raised_by?.username ?? '?'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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

      <Dialog open={showDisputeDialog} onOpenChange={setShowDisputeDialog}>
        <DialogContent className="sm:max-w-lg md:max-w-xl bg-card border-border shadow-2xl rounded-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Resolve Dispute
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Escrow #{selectedEscrow?.id} · {selectedEscrow && formatAmount(selectedEscrow.amount, selectedEscrow.currency)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Resolution</label>
              <select value={disputeResolution} onChange={e => setDisputeResolution(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="resolved_buyer">Resolved — Refund to Buyer</option>
                <option value="resolved_seller">Resolved — Release to Seller</option>
                <option value="cancelled">Cancelled — Return to Held</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Resolution Note</label>
              <textarea value={disputeNote} onChange={e => setDisputeNote(e.target.value)} rows={3}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                placeholder="Optional note explaining the decision..." />
            </div>
            <Button onClick={() => selectedEscrow && resolveDispute(selectedEscrow.id)} disabled={submitting} className="w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Resolve Dispute
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
