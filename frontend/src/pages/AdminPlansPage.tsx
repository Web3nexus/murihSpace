import { useState, useEffect, useCallback } from 'react';
import { Crown, Loader2, Users, DollarSign, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = localStorage.getItem('murihspace-token');
  return { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatAmount(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  return (symbols[currency] ?? currency + ' ') + (amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

interface PlanItem {
  id: number; name: string; description: string | null; price: number;
  currency: string; billing_cycle: string; is_active: boolean;
  features: string[] | null; subscriber_count: number; created_at: string;
  creator: { id: number; name: string; username: string } | null;
}

interface PlanSummary {
  total_plans: number; active_plans: number; total_subscribers: number;
  mrr: number; creators_with_plans: number;
}

export function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [summary, setSummary] = useState<PlanSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchPlans = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '50' });
      if (search) params.set('search', search);
      const res = await fetch(`${API_BASE}/securegate/plans?${params}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const j = await res.json();
        setPlans(j.data?.data ?? []);
        setSummary(j.data?.summary ?? null);
        setLastPage(j.data?.last_page ?? 1);
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  async function toggleActive(id: number) {
    try {
      const res = await fetch(`${API_BASE}/securegate/plans/${id}/toggle`, { method: 'POST', headers: getAuthHeaders() });
      const j = await res.json();
      if (res.ok) { setMessage({ type: 'success', text: 'Plan toggled.' }); fetchPlans(); }
      else { setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  if (isLoading) return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <span className="px-2.5 py-0.5 rounded-full bg-[#38A8D8]/20 text-[#38A8D8] text-xs font-semibold uppercase tracking-wider border border-[#38A8D8]/30">Admin</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Plans & Platform Fees</h1>
          <p className="text-sm text-white/70 max-w-xl">View all subscription plans across the platform.</p>
        </div>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 border ${
          message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>{message.text}</div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Plans', value: summary.total_plans, icon: Crown, color: 'text-[#38A8D8]' },
            { label: 'Active Plans', value: summary.active_plans, icon: ToggleRight, color: 'text-emerald-500' },
            { label: 'Active Subscribers', value: summary.total_subscribers, icon: Users, color: 'text-blue-500' },
            { label: 'MRR', value: formatAmount(summary.mrr), icon: DollarSign, color: 'text-purple-500' },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <Icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search plans..." className="pl-9 text-sm" />
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-card">
          <Crown className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <h3 className="text-base font-semibold text-foreground">No subscription plans</h3>
          <p className="text-xs text-muted-foreground">Creators haven't created any plans yet.</p>
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
          <div className="divide-y divide-border/50">
            {plans.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-xl ${p.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'} shrink-0`}>
                    <Crown className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground truncate">{p.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${p.is_active ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      @{p.creator?.username ?? '?'} · {formatAmount(p.price, p.currency)}/{p.billing_cycle} · {p.subscriber_count} subscribers
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Button variant="ghost" size="icon" onClick={() => toggleActive(p.id)} title={p.is_active ? 'Deactivate' : 'Activate'}>
                    {p.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
