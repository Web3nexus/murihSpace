import { useState, useEffect } from 'react';
import { Crown, Loader2, Check, CreditCard, AlertCircle, X } from 'lucide-react';
import type { SubscriptionPlan } from '@/types/subscription';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = localStorage.getItem('murihspace-token');
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

export function BrowsePlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/subscriptions/plans/public`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((json) => setPlans(json.data?.data ?? []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleSubscribe = async (planId: number) => {
    setSubscribing(planId);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/subscriptions/subscribe`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ plan_id: planId }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Subscribed successfully! Welcome aboard.' });
      } else if (res.status === 402) {
        setMessage({ type: 'error', text: `${json.message} Required: ${formatPrice(json.required)}, Balance: ${formatPrice(json.balance)}` });
      } else {
        setMessage({ type: 'error', text: json.message ?? 'Subscription failed.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    }
    setSubscribing(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-foreground flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          Membership Plans
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Subscribe to creators and unlock exclusive content.</p>
      </div>

      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
          {message.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="p-0.5 hover:opacity-70"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Crown className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-bold text-foreground">No plans available</p>
          <p className="text-xs text-muted-foreground mt-1">Creators haven't published any membership plans yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-2xl border border-border bg-card p-5 flex flex-col">
              {plan.creator && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                    {plan.creator.name.charAt(0)}
                  </div>
                  <span className="text-xs font-semibold text-foreground truncate">{plan.creator.name}</span>
                </div>
              )}
              <h3 className="text-base font-extrabold text-foreground">{plan.name}</h3>
              {plan.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.description}</p>
              )}
              <div className="mt-3 mb-4">
                <span className="text-2xl font-extrabold text-foreground">{formatPrice(plan.price, plan.currency)}</span>
                <span className="text-xs text-muted-foreground ml-1">{plan.billing_cycle === 'yearly' ? '/year' : '/month'}</span>
              </div>
              {plan.features && plan.features.length > 0 && (
                <ul className="space-y-1.5 mb-4 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-secondary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={subscribing === plan.id}
                className="w-full py-2.5 rounded-xl bg-secondary text-secondary-foreground font-bold text-xs hover:bg-secondary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                {subscribing === plan.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CreditCard className="h-3.5 w-3.5" />
                )}
                Subscribe
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
