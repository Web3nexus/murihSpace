import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { Award, MessageSquare, Loader2, CheckCircle2, XCircle, Trash2, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface AdminReview {
  id: number; physical_product_id: number; rating: number;
  title: string | null; body: string | null;
  is_approved: boolean; created_at: string;
  buyer: { id: number; name: string; username: string } | null;
  product: { id: number; title: string; images: string[] | null } | null;
}

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Award key={s} size={size} className={s <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'} />
      ))}
    </div>
  );
}

export function AdminReviewsPage() {
  const confirm = useConfirm();
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchReviews = useCallback(async () => {
    setFetchError(null);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '20' });
      if (filter !== 'all') params.set('status', filter);
      const res = await fetch(`${API_BASE}/securegate/reviews?${params}`, { headers: getAuthHeaders() });
      if (res.ok) { const j = await res.json(); setReviews(j?.data?.data ?? j?.data ?? []); setLastPage(j.data?.last_page ?? j.data?.data?.last_page ?? 1); }
      else throw new Error(`HTTP ${res.status}`);
    } catch (e) { setFetchError(e instanceof Error ? e.message : 'Failed to load reviews'); }
    finally { setIsLoading(false); }
  }, [page, filter]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  async function toggleApprove(id: number) {
    try {
      const res = await fetch(`${API_BASE}/securegate/reviews/${id}/approve`, { method: 'POST', headers: getAuthHeaders() });
      const j = await res.json();
      if (res.ok) { setMessage({ type: 'success', text: j.data?.is_approved ? 'Review approved.' : 'Review unapproved.' }); fetchReviews(); }
      else { setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  async function deleteReview(id: number) {
    if (!await confirm({ title: 'Delete Review', message: 'Delete this review permanently?', variant: 'destructive' })) return;
    try {
      const res = await fetch(`${API_BASE}/securegate/reviews/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) { setMessage({ type: 'success', text: 'Review deleted.' }); fetchReviews(); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  if (isLoading) return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const counts = { all: reviews.length, pending: reviews.filter(r => !r.is_approved).length, approved: reviews.filter(r => r.is_approved).length };
  const filtered = reviews;

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <span className="px-2.5 py-0.5 rounded-full bg-[#38A8D8]/20 text-[#38A8D8] text-xs font-semibold uppercase tracking-wider border border-[#38A8D8]/30">Admin</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Review Moderation</h1>
          <p className="text-sm text-white/70 max-w-xl">Approve, reject, or remove product reviews.</p>
        </div>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setIsLoading(true); fetchReviews(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 border ${
          message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>{message.text}</div>
      )}

      <div className="flex gap-1 border-b border-border pb-1">
        {(['all', 'pending', 'approved'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-sm font-bold transition-colors ${
              filter === f ? 'bg-card text-foreground border-x border-t border-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} <span className="text-xs text-muted-foreground">({counts[f]})</span></button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-card">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <h3 className="text-base font-semibold text-foreground">No reviews</h3>
          <p className="text-xs text-muted-foreground">No {filter !== 'all' ? filter : ''} reviews to moderate.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                    {r.product?.images?.[0] ? <img src={r.product.images[0]} alt="" className="w-full h-full object-cover" /> : <MessageSquare className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{r.product?.title ?? 'Product #' + r.physical_product_id}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StarDisplay rating={r.rating} />
                      <span className="text-xs text-muted-foreground">by @{r.buyer?.username ?? 'unknown'}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${r.is_approved ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {r.is_approved ? 'Approved' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-4">
                  <Button variant="ghost" size="icon" onClick={() => toggleApprove(r.id)} title={r.is_approved ? 'Unapprove' : 'Approve'}>
                    {r.is_approved ? <XCircle className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteReview(r.id)} title="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {r.title && <p className="font-semibold text-sm text-foreground mt-2">{r.title}</p>}
              {r.body && <p className="text-sm text-muted-foreground mt-1">{r.body}</p>}
              <p className="text-xs text-muted-foreground/30 mt-2">{new Date(r.created_at).toLocaleDateString()}</p>
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
