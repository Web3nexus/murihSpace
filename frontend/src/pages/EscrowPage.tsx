import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, Check, X, AlertCircle, ChevronRight } from 'lucide-react';
import { authFetch } from "@/lib/api/authFetch";





function formatPrice(cents: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const sym = symbols[currency] ?? currency + ' ';
  return sym + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function formatDateTime(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface Escrow {
  id: number; order_id: number | null; buyer_id: number; seller_id: number;
  amount: number; currency: string; status: string; release_window_days: number;
  released_at: string | null; created_at: string;
  buyer?: { id: number; name: string; username: string };
  seller?: { id: number; name: string; username: string };
  order?: { id: number; order_number: string; total: number; currency: string };
  disputes?: Dispute[];
}

interface Dispute {
  id: number; escrow_id: number; raised_by: number; reason: string;
  status: string; admin_id: number | null; resolution_note: string | null;
  resolved_at: string | null; created_at: string;
  raised_by_user?: { id: number; name: string; username: string };
  admin?: { id: number; name: string; username: string };
}

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  held: { color: 'bg-amber-500/15 text-amber-600 border-amber-500/30', label: 'Held' },
  released: { color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', label: 'Released' },
  refunded: { color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', label: 'Refunded' },
  disputed: { color: 'bg-red-500/15 text-red-600 border-red-500/30', label: 'Disputed' },
};

const DISPUTE_STATUS_BADGE: Record<string, { color: string; label: string }> = {
  open: { color: 'bg-red-500/15 text-red-600 border-red-500/30', label: 'Open' },
  under_review: { color: 'bg-amber-500/15 text-amber-600 border-amber-500/30', label: 'Under Review' },
  resolved_buyer: { color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', label: 'Resolved (Buyer)' },
  resolved_seller: { color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', label: 'Resolved (Seller)' },
  cancelled: { color: 'bg-muted text-muted-foreground border-border', label: 'Cancelled' },
};

export function EscrowPage() {
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedEscrow, setSelectedEscrow] = useState<Escrow | null>(null);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchEscrows = useCallback(async () => {
    try {
      const res = await authFetch(`/wallet/escrow?page=${page}&per_page=20`, {  });
      if (res.ok) {
        const json = await res.json();
        setEscrows(json.data?.data ?? []);
        setLastPage(json.data?.last_page ?? 1);
      }
    } catch { /* silent */ }
    setIsLoading(false);
  }, [page]);

  useEffect(() => { fetchEscrows(); }, [fetchEscrows]);

  const handleAction = async (action: string, id: number) => {
    setMessage(null);
    try {
      const endpoints: Record<string, string> = {
        release: `/wallet/escrow/${id}/release`,
        refund: `/wallet/escrow/${id}/refund`,
      };
      const res = await authFetch(endpoints[action], { method: 'POST',  });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Action failed.');
      setMessage({ type: 'success', text: json.message ?? 'Done.' });
      fetchEscrows();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Action failed.' });
    }
  };

  const handleOpenDispute = async (escrowId: number) => {
    if (!disputeReason || disputeReason.length < 10) {
      setMessage({ type: 'error', text: 'Please provide a detailed reason (min 10 characters).' });
      return;
    }
    setMessage(null);
    try {
      const res = await authFetch(`/wallet/escrow/${escrowId}/dispute`, {
        method: 'POST', 
        body: JSON.stringify({ reason: disputeReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to open dispute.');
      setShowDisputeForm(false);
      setDisputeReason('');
      setMessage({ type: 'success', text: 'Dispute opened. An admin will review it shortly.' });
      fetchEscrows();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed.' });
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-secondary" />
            Escrow Balances
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Funds held in escrow for physical product purchases. Release to sellers or open a dispute.
          </p>
        </div>
      </div>

      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
          {message.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="p-0.5 hover:opacity-70"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin text-secondary mx-auto" /></div>
      ) : !selectedEscrow && escrows.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-3xl bg-card space-y-3">
          <ShieldCheck className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <h3 className="text-sm font-bold text-foreground">No escrows yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">Escrows are created when a physical product is purchased. They will appear here.</p>
        </div>
      ) : !selectedEscrow ? (
        <div className="space-y-3">
          {lastPage > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Previous</button>
              <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
              <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Next</button>
            </div>
          )}
          {escrows.map((escrow) => {
            const badge = STATUS_BADGE[escrow.status] ?? STATUS_BADGE.held;
            return (
              <div
                key={escrow.id}
                onClick={() => setSelectedEscrow(escrow)}
                className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {escrow.buyer?.name?.charAt(0) ?? '?'}{escrow.seller?.name?.charAt(0) ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      {escrow.buyer?.name} → {escrow.seller?.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {escrow.order?.order_number ?? 'No order'} · {formatDateTime(escrow.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-extrabold text-foreground">{formatPrice(escrow.amount, escrow.currency)}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>{badge.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setSelectedEscrow(null)} className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1">← Back to escrows</button>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-foreground">Escrow #{selectedEscrow.id}</h2>
                <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${(STATUS_BADGE[selectedEscrow.status] ?? STATUS_BADGE.held).color}`}>
                  {(STATUS_BADGE[selectedEscrow.status] ?? STATUS_BADGE.held).label}
                </span>
              </div>
              <span className="text-2xl font-extrabold text-foreground">{formatPrice(selectedEscrow.amount, selectedEscrow.currency)}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium">Buyer</p>
                <p className="font-semibold text-foreground">{selectedEscrow.buyer?.name ?? 'Unknown'}</p>
                {selectedEscrow.buyer?.username && <p className="text-muted-foreground">@{selectedEscrow.buyer.username}</p>}
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium">Seller</p>
                <p className="font-semibold text-foreground">{selectedEscrow.seller?.name ?? 'Unknown'}</p>
                {selectedEscrow.seller?.username && <p className="text-muted-foreground">@{selectedEscrow.seller.username}</p>}
              </div>
              {selectedEscrow.order && (
                <div className="space-y-1">
                  <p className="text-muted-foreground font-medium">Order</p>
                  <p className="font-semibold text-foreground">{selectedEscrow.order.order_number}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium">Release Window</p>
                <p className="font-semibold text-foreground">{selectedEscrow.release_window_days} days</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium">Created</p>
                <p className="font-semibold text-foreground">{formatDateTime(selectedEscrow.created_at)}</p>
              </div>
              {selectedEscrow.released_at && (
                <div className="space-y-1">
                  <p className="text-muted-foreground font-medium">Released</p>
                  <p className="font-semibold text-foreground">{formatDateTime(selectedEscrow.released_at)}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            {selectedEscrow.status === 'held' && (
              <div className="flex items-center gap-2 pt-2">
                <button onClick={() => handleAction('release', selectedEscrow.id)} className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Release to Seller
                </button>
                <button onClick={() => { setShowDisputeForm(true); setDisputeReason(''); }} className="px-4 py-2 rounded-xl bg-red-500/10 text-red-600 font-bold text-xs hover:bg-red-500/20 border border-red-500/30 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" /> Open Dispute
                </button>
              </div>
            )}

            {/* Disputes */}
            {selectedEscrow.disputes && selectedEscrow.disputes.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">Disputes</h3>
                <div className="space-y-2">
                  {selectedEscrow.disputes.map((d) => {
                    const dbadge = DISPUTE_STATUS_BADGE[d.status] ?? DISPUTE_STATUS_BADGE.open;
                    return (
                      <div key={d.id} className="rounded-xl border border-border bg-muted/20 p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dbadge.color}`}>{dbadge.label}</span>
                          <span className="text-[10px] text-muted-foreground">{formatDateTime(d.created_at)}</span>
                        </div>
                        <p className="text-xs text-foreground">{d.reason}</p>
                        {d.resolution_note && <p className="text-xs text-muted-foreground italic">Resolution: {d.resolution_note}</p>}
                        {d.admin && <p className="text-[10px] text-muted-foreground">Reviewed by: {d.admin.name}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dispute Form Modal */}
      {showDisputeForm && selectedEscrow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="border border-border rounded-2xl bg-card p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Open Dispute</h3>
            <p className="text-xs text-muted-foreground">
              Dispute escrow #{selectedEscrow.id} — {formatPrice(selectedEscrow.amount, selectedEscrow.currency)}
            </p>
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider">Reason for dispute</label>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Describe the issue in detail (min 10 characters)..."
                rows={4}
                className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setShowDisputeForm(false)} className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => handleOpenDispute(selectedEscrow.id)} className="px-4 py-2 text-xs font-bold rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all">
                Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
