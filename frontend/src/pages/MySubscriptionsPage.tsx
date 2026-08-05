import { useState, useEffect } from 'react';
import { Crown, Loader2, CheckCircle2, XCircle, Calendar, Ban, AlertCircle } from 'lucide-react';
import type { Subscription } from '@/types/subscription';
import { formatDistanceToNow } from 'date-fns';
import { getAuthToken } from "@/lib/auth/token";
import { useConfirm } from '@/components/ui/DialogProvider';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatPrice(cents: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const sym = symbols[currency] ?? currency + ' ';
  return sym + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

export function MySubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/subscriptions/mine`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((json) => setSubscriptions(json.data?.data ?? []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const confirm = useConfirm();

  const handleCancel = async (id: number) => {
    if (!await confirm({ title: "Cancel Subscription", message: "Cancel this subscription? You will keep access until the end of the billing period.", variant: "warning" })) return;
    setCancelling(id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/subscriptions/${id}/cancel`, { method: 'POST', headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok) {
        setSubscriptions((prev) => prev.map((s) => s.id === id ? { ...s, ...(json.data?.data ?? json.data), is_active: false, status: 'canceled' } : s));
      } else {
        setError(json.message ?? 'Failed to cancel.');
      }
    } catch { setError('Network error.'); }
    setCancelling(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-xl font-extrabold text-foreground flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          My Subscriptions
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Manage your active memberships.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {subscriptions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Crown className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-bold text-foreground">No subscriptions yet</p>
          <p className="text-xs text-muted-foreground mt-1">Browse membership plans to subscribe to a creator.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {sub.creator?.name?.charAt(0) ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-foreground">{sub.creator?.name ?? 'Creator'}</span>
                      {sub.is_active ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 text-[10px] font-bold flex items-center gap-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Active
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center gap-0.5">
                          <XCircle className="h-2.5 w-2.5" /> {sub.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-foreground mt-0.5">{sub.plan?.name}</p>
                    {sub.plan && (
                      <p className="text-xs text-muted-foreground">{formatPrice(sub.plan.price, sub.plan.currency)}/{sub.plan.billing_cycle === 'yearly' ? 'yr' : 'mo'}</p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {sub.current_period_end && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
                      <Calendar className="h-3 w-3" />
                      {sub.is_active
                        ? `${sub.days_remaining} day${sub.days_remaining !== 1 ? 's' : ''} left`
                        : `Ended ${formatDistanceToNow(new Date(sub.current_period_end), { addSuffix: true })}`}
                    </p>
                  )}
                  {sub.is_active && (
                    <button
                      onClick={() => handleCancel(sub.id)}
                      disabled={cancelling === sub.id}
                      className="mt-2 px-3 py-1 rounded-lg border border-border text-[10px] font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors flex items-center gap-1 ml-auto"
                    >
                      {cancelling === sub.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
