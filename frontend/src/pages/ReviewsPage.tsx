import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { useAuth } from '@/hooks/useAuth';
import {
  Medal as Award,
  ChatTeardropText as MessageSquare,
  Plus,
  Spinner as Loader2,
  Trash as Trash2,
  Pencil as Edit,
  Clock,
  ArrowBendDownRight,
  Storefront,
  CheckCircle,
  ChatCircleDots,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/authFetch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Review {
  id: number;
  physical_product_id: number;
  rating: number;
  title: string | null;
  body: string | null;
  is_approved: boolean;
  vendor_reply: string | null;
  vendor_replied_at: string | null;
  created_at: string;
  can_edit: boolean;
  edit_expires_at: string | null;
  buyer: { id: number; name: string; username: string; avatar?: string; avatar_url?: string } | null;
  product: { id: number; title: string; images: string[] | null } | null;
}

interface ReviewStats {
  average: number;
  total: number;
  unreplied?: number;
  distribution?: Record<string, number>;
}

function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Award weight="fill" key={s} size={size} className={s <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'} />
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
  const { user } = useAuth();
  const isVendor = user?.role === 'vendor' || user?.role === 'creator';
  const confirm = useConfirm();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Buyer Form State
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Review | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fProductId, setFProductId] = useState('');
  const [fRating, setFRating] = useState(5);
  const [fTitle, setFTitle] = useState('');
  const [fBody, setFBody] = useState('');

  // Vendor Reply Modal State
  const [replyReview, setReplyReview] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpoint = isVendor ? '/store/reviews/vendor' : '/store/reviews/my';
      const res = await authFetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        const rawData = json?.data?.data ?? json?.data ?? [];
        const reviewList: Review[] = Array.isArray(rawData)
          ? rawData
          : Array.isArray(rawData?.data)
          ? rawData.data
          : [];
        setReviews(reviewList);
        const statsData = json?.data?.stats ?? json?.stats ?? null;
        if (statsData) {
          setStats(statsData);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false);
    }
  }, [isVendor]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Buyer: Open New Review
  function openNew() {
    setEditing(null);
    setFProductId('');
    setFRating(5);
    setFTitle('');
    setFBody('');
    setShowForm(true);
  }

  // Buyer: Open Edit Review
  function openEdit(r: Review) {
    setEditing(r);
    setFProductId(String(r.physical_product_id));
    setFRating(r.rating);
    setFTitle(r.title ?? '');
    setFBody(r.body ?? '');
    setShowForm(true);
  }

  // Buyer: Submit Review
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const url = editing ? `/store/reviews/${editing.id}` : `/store/reviews`;
    const method = editing ? 'PUT' : 'POST';
    const body = editing
      ? JSON.stringify({ rating: fRating, title: fTitle, body: fBody })
      : JSON.stringify({ physical_product_id: Number(fProductId), rating: fRating, title: fTitle, body: fBody });

    try {
      const res = await authFetch(url, { method, body });
      const json = await res.json();
      if (res.ok) {
        await fetchReviews();
        setShowForm(false);
        setEditing(null);
        setMessage({ type: 'success', text: editing ? 'Review updated.' : 'Review submitted. Pending verification.' });
      } else {
        setMessage({ type: 'error', text: json.message ?? 'Failed to submit review.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Buyer: Delete Review
  async function deleteReview(id: number) {
    if (!await confirm({ title: 'Delete Review', message: 'Are you sure you want to delete this review?', variant: 'destructive' })) return;
    try {
      const res = await authFetch(`/store/reviews/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchReviews();
        setMessage({ type: 'success', text: 'Review deleted.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error occurred.' });
    }
  }

  // Vendor: Open Reply Modal
  function openReplyModal(r: Review) {
    setReplyReview(r);
    setReplyText(r.vendor_reply ?? '');
  }

  // Vendor: Submit Reply
  async function handleReplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!replyReview || !replyText.trim()) return;

    setIsReplying(true);
    setMessage(null);

    try {
      const res = await authFetch(`/store/reviews/${replyReview.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ reply: replyText.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        setReviews(prev => prev.map(r => r.id === replyReview.id ? { ...r, vendor_reply: replyText.trim(), vendor_replied_at: new Date().toISOString() } : r));
        setReplyReview(null);
        setMessage({ type: 'success', text: 'Your reply has been published.' });
      } else {
        setMessage({ type: 'error', text: json.message ?? 'Failed to post reply.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error occurred.' });
    } finally {
      setIsReplying(false);
    }
  }

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center h-64">
        <Loader2 weight="fill" className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-4 lg:p-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-md">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            {isVendor ? 'Store Reviews & Customer Feedback' : 'Product Reviews'}
          </h1>
          <p className="text-sm text-white/80 max-w-xl">
            {isVendor
              ? 'View customer feedback on your store items and respond directly to customer reviews.'
              : "Share and manage your feedback on products you've purchased on MurihSpace."}
          </p>
        </div>

        {/* Vendors CANNOT write reviews, only buyers can */}
        {!isVendor && (
          <Button
            onClick={openNew}
            className="bg-[#2164b6] text-white hover:bg-[#1a5091] font-semibold h-11 px-5 rounded-lg gap-2 shrink-0 self-start sm:self-auto shadow-sm"
          >
            <Plus weight="fill" className="h-5 w-5" /> Write Review
          </Button>
        )}
      </div>

      {/* ── Vendor Quick Stats ── */}
      {isVendor && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Award weight="fill" className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-medium">Average Store Rating</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-foreground">{stats.average || '0.0'}</span>
              <StarDisplay rating={Math.round(stats.average)} size={20} />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <MessageSquare weight="fill" className="w-5 h-5 text-[#2164b6] dark:text-[#7ab0ff]" />
              <span className="text-sm font-medium">Total Customer Reviews</span>
            </div>
            <p className="text-3xl font-black text-foreground">{stats.total ?? 0}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <ChatCircleDots weight="fill" className="w-5 h-5 text-indigo-500" />
              <span className="text-sm font-medium">Awaiting Vendor Reply</span>
            </div>
            <p className="text-3xl font-black text-foreground">{stats.unreplied ?? 0}</p>
          </div>
        </div>
      )}

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 border ${
          message.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* ── Buyer Review Form ── */}
      {!isVendor && showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border/60 bg-card p-6 space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-foreground">{editing ? 'Edit Your Review' : 'Write a Product Review'}</h2>

          {!editing && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Product ID *</label>
              <Input
                value={fProductId}
                onChange={e => setFProductId(e.target.value)}
                required
                type="number"
                className="text-sm"
                placeholder="Enter physical product ID"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Rating *</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} type="button" onClick={() => setFRating(s)} className="p-1 hover:scale-110 transition-transform">
                  <Award weight="fill" size={28} className={s <= fRating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30 hover:text-amber-400'} />
                </button>
              ))}
              <span className="ml-2 text-sm font-bold text-foreground">{fRating} of 5 stars</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Review Headline</label>
            <Input
              value={fTitle}
              onChange={e => setFTitle(e.target.value)}
              className="text-sm"
              placeholder="e.g. Excellent build quality and fast delivery!"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Your Experience</label>
            <textarea
              value={fBody}
              onChange={e => setFBody(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 outline-none transition-all"
              placeholder="Write detailed feedback about the product..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting} className="gap-2 bg-[#2164b6] hover:bg-[#1a5091] text-white">
              {isSubmitting && <Loader2 weight="fill" className="w-4 h-4 animate-spin" />}
              {editing ? 'Update Review' : 'Submit Review'}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* ── Reviews List ── */}
      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center space-y-3 bg-card shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
            <MessageSquare weight="fill" className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            {isVendor ? 'No customer reviews yet' : 'No reviews written yet'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {isVendor
              ? 'When customers buy and review your store items, their feedback and ratings will appear here.'
              : "Reviews you write for products you've purchased will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => {
            const canEdit = !isVendor && !!r.can_edit && !!r.edit_expires_at && new Date(r.edit_expires_at).getTime() > now;

            return (
              <div
                key={r.id}
                className="rounded-2xl border border-border/60 bg-card overflow-hidden p-5 sm:p-6 shadow-sm hover:border-border transition-all duration-200 space-y-4"
              >
                {/* Header: Product & Reviewer Info */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 bg-muted/70 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border border-border/40">
                      {r.product?.images?.[0] ? (
                        <img src={r.product.images[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Storefront weight="fill" className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        {r.product?.title ?? `Product #${r.physical_product_id}`}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <StarDisplay rating={r.rating} />
                        <span className="text-xs font-semibold text-foreground">{r.rating}.0</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          By <strong className="text-foreground">{r.buyer?.name ?? 'Verified Buyer'}</strong> (@{r.buyer?.username ?? 'buyer'})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Buyer (Edit/Delete) or Vendor (Reply) */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isVendor ? (
                      <Button
                        size="sm"
                        variant={r.vendor_reply ? 'outline' : 'default'}
                        onClick={() => openReplyModal(r)}
                        className={`h-9 text-xs font-semibold gap-1.5 rounded-lg ${
                          r.vendor_reply
                            ? 'border-border text-foreground hover:bg-muted'
                            : 'bg-[#2164b6] hover:bg-[#1a5091] text-white'
                        }`}
                      >
                        <ArrowBendDownRight weight="fill" className="w-4 h-4" />
                        {r.vendor_reply ? 'Edit Reply' : 'Reply to Customer'}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" disabled={!canEdit} onClick={() => openEdit(r)} title="Edit Review">
                          <Edit weight="fill" className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteReview(r.id)} title="Delete Review">
                          <Trash2 weight="fill" className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Review Body */}
                <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
                  {r.title && <h4 className="font-bold text-sm text-foreground mb-1">{r.title}</h4>}
                  {r.body && <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{r.body}</p>}
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span>Reviewed on {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {r.is_approved && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle weight="fill" className="w-3.5 h-3.5" /> Verified Purchase
                      </span>
                    )}
                    {!isVendor && r.edit_expires_at && (
                      <span className={`flex items-center gap-1 ${canEdit ? 'text-blue-500' : 'text-muted-foreground/60'}`}>
                        <Clock weight="fill" className="w-3.5 h-3.5" />
                        {canEdit ? `${formatTimeLeft(r.edit_expires_at)} left to edit` : 'Edit window closed'}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Vendor Official Response ── */}
                {r.vendor_reply && (
                  <div className="ml-4 sm:ml-8 rounded-xl bg-[#2164b6]/5 border-l-4 border-[#2164b6] p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#2164b6] dark:text-[#7ab0ff] flex items-center gap-1.5">
                        <Storefront weight="fill" className="w-3.5 h-3.5" /> Vendor Response
                      </span>
                      {r.vendor_replied_at && (
                        <span className="text-muted-foreground text-[11px]">
                          {new Date(r.vendor_replied_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">{r.vendor_reply}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Vendor Reply Dialog ── */}
      <Dialog open={!!replyReview} onOpenChange={open => !open && setReplyReview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {replyReview?.vendor_reply ? 'Edit Vendor Reply' : 'Reply to Customer Review'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Your response will be displayed publicly beneath this customer's review on your store and product pages.
            </DialogDescription>
          </DialogHeader>

          {replyReview && (
            <form onSubmit={handleReplySubmit} className="space-y-4 pt-2">
              <div className="p-3 bg-muted/40 rounded-xl text-xs space-y-1 border border-border/40">
                <p className="font-semibold text-foreground">Review on {replyReview.product?.title}:</p>
                <div className="flex items-center gap-1.5 text-amber-500">
                  <StarDisplay rating={replyReview.rating} size={14} />
                  <span className="font-bold">{replyReview.rating}.0</span>
                </div>
                {replyReview.body && <p className="text-muted-foreground italic line-clamp-3">"{replyReview.body}"</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Your Official Response *
                </label>
                <textarea
                  rows={5}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  required
                  maxLength={5000}
                  className="w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 outline-none transition-all"
                  placeholder="Thank the customer for their feedback and address any questions or support notes..."
                />
                <p className="text-[11px] text-muted-foreground text-right mt-1">{replyText.length} / 5000</p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setReplyReview(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isReplying || !replyText.trim()} className="bg-[#2164b6] hover:bg-[#1a5091] text-white gap-2">
                  {isReplying && <Loader2 weight="fill" className="w-4 h-4 animate-spin" />}
                  Publish Reply
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
