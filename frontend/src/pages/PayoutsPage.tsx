import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Loader2, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

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

interface Payout {
  id: number; fulfilment_order_id: number; order_number: string | null;
  gross_amount: number; platform_fee: number; net_amount: number;
  currency: string; status: string;
  paid_at: string | null; created_at: string; order_created_at: string | null;
}

interface PayoutTotals {
  total_gross: number; total_fees: number; total_net: number;
  pending: number; paid: number;
}

export function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [totals, setTotals] = useState<PayoutTotals | null>(null);
  const [stats, setStats] = useState<{ pending: number; paid: number; total_orders: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPayouts = useCallback(async () => {
    try {
      const [payoutsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/store/payouts`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/store/payouts/stats`, { headers: getAuthHeaders() }),
      ]);
      if (payoutsRes.ok) {
        const json = await payoutsRes.json();
        setPayouts(json.data?.data ?? []);
        setTotals(json.data?.totals ?? null);
      }
      if (statsRes.ok) {
        const json = await statsRes.json();
        setStats(json.data?.data ?? json.data ?? null);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#38A8D8]/20 text-[#38A8D8] text-xs font-semibold uppercase tracking-wider border border-[#38A8D8]/30">
              Phase 9 — Payouts
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Payouts</h1>
          <p className="text-sm text-white/70 max-w-xl">Track your earnings and payout history.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatPrice(stats?.pending ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2 text-[#38A8D8] mb-2">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Paid</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatPrice(stats?.paid ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2 text-secondary mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Orders Fulfilled</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats?.total_orders ?? 0}</p>
        </div>
      </div>

      {totals && (
        <div className="rounded-2xl border border-border bg-card p-5 grid grid-cols-3 gap-4 text-sm shadow-xs">
          <div>
            <span className="text-muted-foreground">Gross Revenue:</span>{' '}
            <strong className="text-foreground">{formatPrice(totals.total_gross)}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Platform Fees:</span>{' '}
            <strong className="text-muted-foreground">{formatPrice(totals.total_fees)}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Net Earnings:</span>{' '}
            <strong className="text-foreground font-bold">{formatPrice(totals.total_net)}</strong>
          </div>
        </div>
      )}

      {payouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <DollarSign className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold">No payouts yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">Payouts are created when a fulfilment order is delivered.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Order</span>
            <span>Gross</span>
            <span>Fee</span>
            <span>Net</span>
            <span>Status</span>
          </div>
          {payouts.map(p => (
            <div key={p.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center rounded-2xl border border-border bg-card px-4 py-3.5 shadow-xs hover:shadow-md hover:border-primary/30 transition-all duration-200">
              <div>
                <p className="font-medium text-sm">{p.order_number ?? '#' + p.fulfilment_order_id}</p>
                <p className="text-xs text-muted-foreground">{p.order_created_at ? new Date(p.order_created_at).toLocaleDateString() : ''}</p>
              </div>
              <p className="text-sm font-medium">{formatPrice(p.gross_amount)}</p>
              <p className="text-sm text-muted-foreground">-{formatPrice(p.platform_fee)}</p>
              <p className="text-sm font-bold text-foreground">{formatPrice(p.net_amount)}</p>
              <Badge className={
                p.status === 'paid'
                  ? 'bg-[#38A8D8]/20 text-[#38A8D8] border-[#38A8D8]/30'
                  : 'bg-muted text-muted-foreground border-border'
              }>
                {p.status === 'paid' ? 'Paid' : 'Pending'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
