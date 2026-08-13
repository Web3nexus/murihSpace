import { getAuthToken } from "@/lib/auth/token";
import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  Package,
  Loader2,
  Receipt,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CreatorSaleRow, Order } from '@/types/order';
import { authFetch } from "@/lib/api/authFetch";



const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed:  { label: 'Completed',  color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25' },
  pending:    { label: 'Pending',    color: 'bg-amber-500/15 text-amber-600 border-amber-500/25' },
  processing: { label: 'Processing', color: 'bg-blue-500/15 text-blue-600 border-blue-500/25' },
  failed:     { label: 'Failed',     color: 'bg-destructive/15 text-destructive border-destructive/25' },
  refunded:   { label: 'Refunded',   color: 'bg-muted text-muted-foreground border-border' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export function SalesOrdersPage() {
  const [sales, setSales] = useState<CreatorSaleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<Order | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchSales = useCallback(async () => {
    const token = getAuthToken();
    setFetchError(null);
    try {
      const res = await authFetch(`/orders/sales?page=${page}&per_page=20`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const json = await res.json();
        setSales(json.data?.data ?? []);
        setLastPage(json.data?.last_page ?? 1);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load sales');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSales(); }, [fetchSales]);

  const openReceipt = async (orderId: number) => {
    const token = getAuthToken();

    try {
      const res = await authFetch(`/orders/${orderId}/receipt`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        const json = await res.json();
        setSelectedReceipt(json.data?.data ?? json.data);
      }
    } catch (e) { console.error('Failed to fetch receipt', e); }
  };

  // Summary metrics
  const totalRevenue = sales
    .filter((s) => s.status === 'completed')
    .reduce((acc, s) => acc + Number(s.subtotal), 0);
  const totalNet = sales
    .filter((s) => s.status === 'completed')
    .reduce((acc, s) => acc + Number(s.net_payout), 0);
  const totalSales = sales.filter((s) => s.status === 'completed').length;

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
          <DollarSign className="h-6 w-6 text-secondary" />
          Sales & Orders
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Track all your digital product sales, payouts, and order receipts.
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Gross Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: <TrendingUp className="h-5 w-5 text-secondary" />, sub: 'Before platform fee' },
          { label: 'Net Payout', value: `$${totalNet.toFixed(2)}`, icon: <DollarSign className="h-5 w-5 text-emerald-500" />, sub: 'After 10% platform fee' },
          { label: 'Completed Orders', value: totalSales.toString(), icon: <Package className="h-5 w-5 text-secondary" />, sub: 'Successful transactions' },
        ].map((m) => (
          <div key={m.label} className="border border-border rounded-2xl bg-card p-4 shadow-sm flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-secondary/10 shrink-0">{m.icon}</div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">{m.label}</p>
              <p className="text-xl font-black text-foreground">{m.value}</p>
              <p className="text-[10px] text-muted-foreground">{m.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setIsLoading(true); fetchSales(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      {/* Sales Table */}
      {isLoading ? (
        <div className="py-16 text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-secondary mx-auto" />
          <p className="text-xs text-muted-foreground">Loading sales data…</p>
        </div>
      ) : sales.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card space-y-3">
          <DollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <h3 className="text-sm font-bold text-foreground">No sales yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Your digital product sales will appear here once buyers complete their purchases.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border">
                <tr className="text-left">
                  {['Order #', 'Buyer', 'Product', 'Gross', 'Fee', 'Net Payout', 'Status', 'Date', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-foreground font-semibold whitespace-nowrap">
                      {s.order_number}
                    </td>
                    <td className="px-4 py-3.5 text-foreground whitespace-nowrap">
                      {s.buyer?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-foreground max-w-[140px]">
                      <span className="truncate block">{s.product?.title ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-foreground whitespace-nowrap">
                      ${Number(s.subtotal).toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                      -${Number(s.platform_fee).toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 font-extrabold text-emerald-600 whitespace-nowrap">
                      ${Number(s.net_payout).toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                      {s.paid_at ? new Date(s.paid_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openReceipt(s.id)}
                        className="h-7 text-[10px] font-semibold text-secondary hover:text-secondary gap-1 px-2"
                      >
                        <Receipt className="h-3.5 w-3.5" /> Receipt
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* Receipt Modal */}
      {selectedReceipt !== null && (
        <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
          <DialogContent className="sm:max-w-lg md:max-w-xl bg-card border-border shadow-2xl rounded-2xl p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Receipt className="h-5 w-5 text-secondary" />
                Order Receipt
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border text-xs space-y-2.5">
                {[
                  ['Order Number', selectedReceipt.order_number],
                  ['Product', selectedReceipt.product?.title],
                  ['Buyer', selectedReceipt.buyer?.name],
                  ['Subtotal', `$${Number(selectedReceipt.subtotal).toFixed(2)} ${selectedReceipt.currency}`],
                  ['Platform Fee', `-$${Number(selectedReceipt.platform_fee).toFixed(2)} ${selectedReceipt.currency}`],
                  ['Total', `$${Number(selectedReceipt.total).toFixed(2)} ${selectedReceipt.currency}`],
                  ['Payment', selectedReceipt.payment_provider],
                  ['Paid At', selectedReceipt.paid_at ? new Date(selectedReceipt.paid_at).toLocaleString() : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground font-medium">{label}</span>
                    <span className="font-bold text-foreground text-right max-w-[55%] truncate">{value}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <StatusBadge status={selectedReceipt.status} />
                {selectedReceipt.download_url && (
                  <a
                    href={`/products/${selectedReceipt.product_id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary hover:underline"
                  >
                    Download File <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
