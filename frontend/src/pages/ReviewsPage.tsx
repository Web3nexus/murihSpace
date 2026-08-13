import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { Award, MessageSquare, Plus, Loader2, Trash2, Edit, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/authFetch";






interface Review {
  id: number; physical_product_id: number; rating: number;
  title: string | null; body: string | null;
  is_approved: boolean; created_at: string;
  can_edit: boolean; edit_expires_at: string | null;
  buyer: { id: number; name: string; username: string } | null;
  product: { id: number; title: string; images: string[] | null } | null;
}

function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Award key={s} size={size} className={s <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'} />
      ))}
    </div>
  );
}

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}

export function ReviewsPage() {
  const confirm = useConfirm();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Review | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fProductId, setFProductId] = useState('');
  const [fRating, setFRating] = useState(5);
  const [fTitle, setFTitle] = useState('');
  const [fBody, setFBody] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await authFetch(`/store/reviews/my`, {  });
      if (res.ok) { const json = await res.json();         setReviews(json.data?.data ?? []); }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  function openNew() {
    setEditing(null); setFProductId(''); setFRating(5); setFTitle(''); setFBody(''); setShowForm(true);
  }

  function openEdit(r: Review) {
    setEditing(r); setFProductId(String(r.physical_product_id)); setFRating(r.rating);
    setFTitle(r.title ?? ''); setFBody(r.body ?? ''); setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true); setMessage(null);

    const url = editing ? `/store/reviews/${editing.id}` : `/store/reviews`;
    const method = editing ? 'PUT' : 'POST';
    const body = editing
      ? JSON.stringify({ rating: fRating, title: fTitle, body: fBody })
      : JSON.stringify({ physical_product_id: Number(fProductId), rating: fRating, title: fTitle, body: fBody });

    try {
      const res = await authFetch(url, { method,  body });
      const json = await res.json();
      if (res.ok) {
        await fetchReviews(); setShowForm(false); setEditing(null);
        setMessage({ type: 'success', text: editing ? 'Review updated.' : 'Review submitted. Pending approval.' });
      } else {
        setMessage({ type: 'error', text: json.message ?? 'Failed.' });
      }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
    finally { setIsSubmitting(false); }
  }

  async function deleteReview(id: number) {
    if (!await confirm({ title: 'Delete Review', message: 'Delete this review?', variant: 'destructive' })) return;
    try {
      const res = await authFetch(`/store/reviews/${id}`, { method: 'DELETE',  });
      if (res.ok) { await fetchReviews(); setMessage({ type: 'success', text: 'Review deleted.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  if (isLoading) {
    return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#2164b6]/20 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-semibold uppercase tracking-wider border border-[#2164b6]/30">
              My Reviews
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Product Reviews</h1>
          <p className="text-sm text-white/70 max-w-xl">Share your feedback on products you've purchased.</p>
        </div>
        <Button onClick={openNew} className="bg-[#2164b6] text-white hover:bg-[#1a5091] font-semibold h-11 px-5 rounded-xl shadow-md gap-2 shrink-0 self-start sm:self-auto">
          <Plus className="h-5 w-5" /> Write Review
        </Button>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 border ${
          message.type === 'success' ? 'bg-emerald-50/50 text-emerald-600 border-emerald-200/50' : 'bg-destructive/10 text-destructive border-destructive/20'
        }`}>
          {message.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">{editing ? 'Edit Review' : 'Write a Review'}</h2>

          {!editing && (
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Product ID *</label>
              <Input value={fProductId} onChange={e => setFProductId(e.target.value)}
                required type="number" className="text-sm" placeholder="Enter the physical product ID" />
            </div>
          )}

          <div>
            <label className="block text-sm text-muted-foreground mb-2">Rating *</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} type="button" onClick={() => setFRating(s)}>
                  <Award size={28} className={s <= fRating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground hover:text-amber-400'} />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground self-center">{fRating}/5</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Title</label>
            <Input value={fTitle} onChange={e => setFTitle(e.target.value)} className="text-sm" placeholder="Summary of your review" />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Review</label>
            <textarea value={fBody} onChange={e => setFBody(e.target.value)} rows={4}
              className="w-full rounded-xl border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none transition-colors"
              placeholder="What did you think?" />
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Update' : 'Submit Review'}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No reviews yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">Reviews you write for products will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => {
            const canEdit = r.can_edit && new Date(r.edit_expires_at!).getTime() > now;
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:shadow-md hover:border-primary/30 transition-all duration-200 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                      {r.product?.images?.[0] ? (
                        <img src={r.product.images[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <MessageSquare className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{r.product?.title ?? 'Product #' + r.physical_product_id}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarDisplay rating={r.rating} />
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          r.is_approved ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {r.is_approved ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" disabled={!canEdit} onClick={() => openEdit(r)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteReview(r.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {r.title && <p className="font-semibold text-sm text-foreground mt-2">{r.title}</p>}
                {r.body && <p className="text-sm text-muted-foreground mt-1">{r.body}</p>}
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-xs text-muted-foreground/60">{new Date(r.created_at).toLocaleDateString()}</p>
                  {r.edit_expires_at && (
                    <span className={`text-xs flex items-center gap-1 ${
                      canEdit ? 'text-blue-500' : 'text-muted-foreground/50'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {canEdit ? `${formatTimeLeft(r.edit_expires_at)} left to edit` : 'Edit window expired'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
