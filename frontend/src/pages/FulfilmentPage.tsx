import { Package, Truck, Loader2, Search, Eye, MapPin, Clock } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { usePrompt } from '@/components/ui/DialogProvider';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";

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

interface FulfilmentItem {
  id: number; product_id: number; quantity: number;
  unit_price: number; currency: string;
  product: { id: number; title: string; sku: string; price: number; images: string[] | null } | null;
}

interface Address {
  id: number; label: string; full_name: string; phone: string | null;
  street_line1: string; street_line2: string | null; city: string; state: string;
  postal_code: string | null; country: string;
}

interface FulfilmentOrder {
  id: number; order_number: string; status: string;
  subtotal: number; shipping_cost: number; platform_fee: number; total: number; currency: string;
  tracking_number: string | null; carrier: string | null;
  estimated_delivery: string | null;
  shipped_at: string | null; delivered_at: string | null;
  notes: string | null; created_at: string;
  items: FulfilmentItem[];
  shipping_address: Address | null;
  buyer?: { id: number; name: string; username: string } | null;
  net_payout?: number;
}

interface TrackingEvent {
  id: number; event: string; location: string | null;
  description: string | null; occurred_at: string;
}

const TRACKING_EVENT_LABELS: Record<string, string> = {
  order_placed: 'Order Placed',
  confirmed: 'Confirmed',
  processing: 'Processing',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

type Tab = 'sales' | 'orders';

const STATUS_FLOW: Record<string, { label: string; color: string; next: string[] }> = {
  pending:     { label: 'Pending',     color: 'bg-muted text-muted-foreground',        next: ['confirmed'] },
  confirmed:   { label: 'Confirmed',   color: 'bg-primary/10 text-primary',            next: ['processing', 'cancelled'] },
  processing:  { label: 'Processing',  color: 'bg-amber-500/10 text-amber-600',        next: ['shipped', 'cancelled'] },
  shipped:     { label: 'Shipped',     color: 'bg-purple-500/10 text-purple-600',      next: ['delivered'] },
  delivered:   { label: 'Delivered',   color: 'bg-emerald-500/10 text-emerald-600',    next: [] },
  cancelled:   { label: 'Cancelled',   color: 'bg-destructive/10 text-destructive',    next: [] },
  refunded:    { label: 'Refunded',    color: 'bg-orange-500/10 text-orange-600',      next: [] },
};

export function FulfilmentPage() {
  const [tab, setTab] = useState<Tab>('sales');
  const [orders, setOrders] = useState<FulfilmentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<FulfilmentOrder | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpoint = tab === 'sales' ? `${API_BASE}/store/fulfilment/sales` : `${API_BASE}/store/fulfilment/orders`;
      const res = await fetch(endpoint, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data?.data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function updateStatus(orderId: number, status: string) {
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/store/fulfilment/${orderId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (res.ok) {
        await fetchOrders();
        setMessage({ type: 'success', text: json.message ?? 'Status updated.' });
      } else {
        setMessage({ type: 'error', text: json.message ?? 'Failed to update.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    }
  }

  const prompt = usePrompt();

  async function saveTracking(orderId: number) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const tn = await prompt({ title: "Tracking Number", message: "Enter tracking number:", defaultValue: order.tracking_number ?? '' });
    if (!tn) return;
    const carrier = await prompt({ title: "Carrier Name", message: "Enter carrier (e.g. DHL, FedEx, USPS):", defaultValue: order.carrier ?? '' });
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/store/fulfilment/${orderId}/tracking`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tracking_number: tn, carrier: carrier ?? '' }),
      });
      const json = await res.json();
      if (res.ok) {
        await fetchOrders();
        setMessage({ type: 'success', text: 'Tracking info saved.' });
      } else {
        setMessage({ type: 'error', text: json.message ?? 'Failed.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    }
  }

  const filtered = orders.filter(o =>
    o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.items.some(i => i.product?.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  async function openDetail(order: FulfilmentOrder) {
    setSelected(order);
    setLoadingEvents(true);
    try {
      const res = await fetch(`${API_BASE}/store/fulfilment/${order.id}/tracking`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setTrackingEvents(json.data?.data ?? []);
      }
    } catch {
      setTrackingEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const DetailModal = () => {
    if (!selected) return null;
    const cfg = STATUS_FLOW[selected.status] ?? STATUS_FLOW.pending;

    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
        <div className="border border-border rounded-2xl bg-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">{selected.order_number}</h2>
              <p className="text-sm text-muted-foreground">{new Date(selected.created_at).toLocaleDateString()}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
          </div>

          {selected.shipping_address && (
            <div className="mb-4 p-4 bg-muted rounded-xl border border-border">
              <div className="flex items-center gap-2 text-sm font-medium mb-2 text-foreground">
                <MapPin className="w-4 h-4" /> Shipping Address
              </div>
              <p className="text-sm text-foreground">{selected.shipping_address.full_name}</p>
              <p className="text-sm text-muted-foreground">{selected.shipping_address.street_line1}</p>
              {selected.shipping_address.street_line2 && <p className="text-sm text-muted-foreground">{selected.shipping_address.street_line2}</p>}
              <p className="text-sm text-muted-foreground">{selected.shipping_address.city}, {selected.shipping_address.state} {selected.shipping_address.postal_code}</p>
              {selected.shipping_address.phone && <p className="text-sm text-muted-foreground">{selected.shipping_address.phone}</p>}
            </div>
          )}

          {selected.buyer && tab === 'sales' && (
            <p className="text-sm text-muted-foreground mb-3">Buyer: <strong className="text-foreground">{selected.buyer.name}</strong> (@{selected.buyer.username})</p>
          )}

          <div className="space-y-2 mb-4">
            {selected.items.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-muted rounded-xl border border-border">
                <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground flex-shrink-0 overflow-hidden">
                  {item.product?.images?.[0] ? (
                    <img src={item.product.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.product?.title ?? 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">SKU: {item.product?.sku} &middot; Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-foreground">{formatPrice(item.unit_price * item.quantity, item.currency)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">{formatPrice(selected.subtotal)}</span></div>
            {selected.shipping_cost > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="text-foreground">{formatPrice(selected.shipping_cost)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Platform fee</span><span className="text-foreground">-{formatPrice(selected.platform_fee)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-border pt-2 mt-2">
              <span className="text-foreground">Total</span><span className="text-foreground">{formatPrice(selected.total)}</span>
            </div>
          </div>

          {selected.tracking_number && (
            <div className="mt-4 p-3 bg-muted border border-border rounded-xl text-sm text-foreground">
              <Truck className="w-4 h-4 inline mr-1" />
              <strong>{selected.carrier ?? 'Carrier'}:</strong> {selected.tracking_number}
              {selected.estimated_delivery && (
                <> &middot; Est. delivery: {selected.estimated_delivery}</>
              )}
            </div>
          )}

          {/* Tracking Timeline */}
          <div className="mt-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
              <Clock className="w-4 h-4" /> Tracking Timeline
            </h3>
            {loadingEvents ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : trackingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No tracking events yet.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" />
                <div className="space-y-4">
                  {trackingEvents.map((ev, idx) => (
                    <div key={ev.id} className="flex gap-3">
                      <div className={`relative z-10 w-[18px] h-[18px] rounded-full flex-shrink-0 mt-0.5
                        ${idx === 0 ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted-foreground/20'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {TRACKING_EVENT_LABELS[ev.event] ?? ev.event}
                        </p>
                        {ev.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          {new Date(ev.occurred_at).toLocaleString()}
                          {ev.location && ` · ${ev.location}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      {/* ── Page Header Banner ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#2164b6]/20 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-semibold uppercase tracking-wider border border-[#2164b6]/30">
              Phase 9 — Fulfilment
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Fulfilment</h1>
          <p className="text-sm text-white/70 max-w-xl">Manage sales fulfilment and track your orders.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-muted rounded-xl gap-1 w-fit">
        <button
          onClick={() => setTab('sales')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            tab === 'sales' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Sales to Fulfil
        </button>
        <button
          onClick={() => setTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            tab === 'orders' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          My Orders
        </button>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 border ${
          message.type === 'success' ? 'bg-emerald-50/50 text-emerald-600 border-emerald-200/50' : 'bg-destructive/10 text-destructive border-destructive/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by order number or product..."
          className="pl-10 h-10 rounded-xl bg-card border-border text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Package className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {tab === 'sales' ? 'No sales yet' : 'No orders yet'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {tab === 'sales' ? "When customers purchase your products, they'll appear here." : 'Orders you place will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const cfg = STATUS_FLOW[order.status] ?? STATUS_FLOW.pending;
            return (
              <div key={order.id} className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:shadow-md hover:border-primary/30 transition-all duration-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{order.order_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openDetail(order)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2">
                  {order.items.map(item => (
                    <div key={item.id} className="flex items-center gap-2 bg-muted px-3 py-2 rounded-xl text-sm flex-shrink-0 border border-border">
                      <div className="w-8 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.product?.images?.[0] ? (
                          <img src={item.product.images[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground truncate max-w-[120px]">{item.product?.title ?? 'Product'}</p>
                        <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-semibold text-foreground">{formatPrice(order.total)}</span>
                    {order.buyer && tab === 'sales' && (
                      <span className="text-muted-foreground">@{order.buyer.username}</span>
                    )}
                    {order.tracking_number && (
                      <span className="text-xs flex items-center gap-1 text-muted-foreground">
                        <Truck className="w-3 h-3" /> {order.carrier}: {order.tracking_number}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {tab === 'sales' && cfg.next.length > 0 && cfg.next.map(nextStatus => (
                      <Button
                        key={nextStatus}
                        size="sm"
                        onClick={() => updateStatus(order.id, nextStatus)}
                      >
                        {nextStatus === 'shipped' ? 'Mark Shipped' :
                         nextStatus === 'delivered' ? 'Mark Delivered' :
                         nextStatus === 'confirmed' ? 'Confirm' :
                         nextStatus === 'cancelled' ? 'Cancel' :
                         `Move to ${nextStatus}`}
                      </Button>
                    ))}
                    {tab === 'sales' && (order.status === 'processing' || order.status === 'shipped') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => saveTracking(order.id)}
                      >
                        {order.tracking_number ? 'Update Tracking' : 'Add Tracking'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && <DetailModal />}
    </div>
  );
}
