import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, Plus, Loader2, Eye, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

interface DisputeOrderItem {
  product_id: number; title: string | null; quantity: number; images: string[] | null;
}

interface DisputeOrder {
  id: number; order_number: string; status: string;
  total: number; currency: string; created_at: string;
  items: DisputeOrderItem[];
  buyer?: { id: number; name: string; username: string } | null;
}

interface Dispute {
  id: number; fulfilment_order_id: number;
  subject: string; subject_label: string; description: string;
  status: string; resolution: string | null;
  created_at: string; resolved_at: string | null;
  raised_by: { id: number; name: string; username: string } | null;
  resolved_by: { id: number; name: string; username: string } | null;
  order: DisputeOrder | null;
}

const STATUS_CFG: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  open:          { label: 'Open',          className: 'bg-muted text-muted-foreground',                   icon: ShieldAlert },
  under_review:  { label: 'Under Review',  className: 'bg-muted text-muted-foreground',                   icon: Clock },
  resolved:      { label: 'Resolved',      className: 'bg-[#38A8D8]/20 text-[#38A8D8] border border-[#38A8D8]/30', icon: CheckCircle },
  dismissed:     { label: 'Dismissed',     className: 'bg-muted text-muted-foreground',                  icon: XCircle },
};

export function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [fOrderId, setFOrderId] = useState('');
  const [fSubject, setFSubject] = useState('not_received');
  const [fDesc, setFDesc] = useState('');

  const SUBJECTS = [
    { value: 'not_received', label: 'Not Received' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'wrong_item', label: 'Wrong Item' },
    { value: 'defective', label: 'Defective' },
    { value: 'not_as_described', label: 'Not as Described' },
    { value: 'other', label: 'Other' },
  ];

  const fetchDisputes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/store/disputes`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setDisputes(json.data?.data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/store/disputes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fulfilment_order_id: Number(fOrderId),
          subject: fSubject,
          description: fDesc,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        await fetchDisputes();
        setShowForm(false);
        setFOrderId('');
        setFSubject('not_received');
        setFDesc('');
        setMessage({ type: 'success', text: 'Dispute opened.' });
      } else {
        setMessage({ type: 'error', text: json.message ?? 'Failed.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setIsSubmitting(false);
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
    const sc = STATUS_CFG[selected.status] ?? STATUS_CFG.open;
    const Icon = sc.icon;

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
        <div className="bg-card rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-lg border border-border" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Dispute #{selected.id}</h2>
            <Badge className={sc.className + ' flex items-center gap-1'}>
              <Icon className="w-3.5 h-3.5" /> {sc.label}
            </Badge>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Order:</span>{' '}
              <strong>{selected.order?.order_number}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Subject:</span>{' '}
              <strong>{selected.subject_label}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Raised by:</span>{' '}
              <strong>@{selected.raised_by?.username}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span>{' '}
              {new Date(selected.created_at).toLocaleDateString()}
            </div>
          </div>

          <div className="mt-4 p-4 bg-muted rounded-xl">
            <p className="text-sm font-medium mb-1">Description</p>
            <p className="text-sm text-foreground/80">{selected.description}</p>
          </div>

          {selected.resolution && (
            <div className="mt-3 p-4 bg-muted rounded-xl">
              <p className="text-sm font-medium mb-1">Resolution</p>
              <p className="text-sm text-foreground/80">{selected.resolution}</p>
              {selected.resolved_by && (
                <p className="text-xs text-muted-foreground mt-1">by @{selected.resolved_by.username}</p>
              )}
            </div>
          )}

          {selected.order && selected.order.items.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Items</p>
              <div className="space-y-1">
                {selected.order.items.map((item, i) => (
                  <div key={i} className="text-sm text-foreground/80 flex items-center gap-2">
                    <div className="w-8 h-8 bg-muted rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.images?.[0] ? <img src={item.images[0]} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <span>{item.title ?? 'Product'} x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button variant="outline" onClick={() => setSelected(null)} className="mt-6">Close</Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#38A8D8]/20 text-[#38A8D8] text-xs font-semibold uppercase tracking-wider border border-[#38A8D8]/30">
              Phase 9 — Disputes
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Disputes</h1>
          <p className="text-sm text-white/70 max-w-xl">Manage and resolve order disputes on the marketplace.</p>
        </div>
        <Button onClick={() => setShowForm(true)}
          className="bg-[#38A8D8] text-white hover:bg-[#2E96C5] font-semibold h-11 px-5 rounded-xl shadow-md gap-2 shrink-0 self-start sm:self-auto">
          <Plus className="h-5 w-5" />
          Open Dispute
        </Button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-[#38A8D8]/20 text-[#38A8D8]' : 'bg-muted text-muted-foreground'
        }`}>
          {message.text}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-2xl max-w-lg w-full p-6 shadow-lg border border-border" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Open a Dispute</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">Fulfilment Order ID *</label>
                <Input value={fOrderId} onChange={e => setFOrderId(e.target.value)}
                  required type="number" placeholder="Enter the order ID" />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">Subject *</label>
                <select value={fSubject} onChange={e => setFSubject(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  {SUBJECTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">Description *</label>
                <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={4}
                  required minLength={10}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Describe the issue (min 10 characters)" />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Dispute
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {disputes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold">No disputes</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">If there's an issue with an order, you can open a dispute here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map(d => {
            const sc = STATUS_CFG[d.status] ?? STATUS_CFG.open;
            const Icon = sc.icon;
            return (
              <div key={d.id} className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:shadow-md hover:border-primary/30 transition-all duration-200 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{d.subject_label}</span>
                        <Badge className={sc.className}>{sc.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Order: {d.order?.order_number} &middot; {new Date(d.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelected(d)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-foreground/80 mt-2 line-clamp-2">{d.description}</p>
                {d.resolution && (
                  <p className="text-xs text-[#38A8D8] mt-1">Resolution: {d.resolution}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected && <DetailModal />}
    </div>
  );
}
