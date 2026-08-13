import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { Briefcase, Plus, Loader2, Building2, DollarSign, Edit2, Trash2, Check, AlertCircle, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/api/authFetch";





function formatPrice(cents: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const sym = symbols[currency] ?? currency + ' ';
  return sym + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

interface Brand {
  id: number; name: string; slug: string; logo_url: string | null;
  website: string | null; description: string | null; industry: string | null;
  contact_email: string | null;
}

interface BrandDeal {
  id: number; title: string; deal_type: string; status: string;
  budget: number; currency: string; description: string | null; deliverables: string | null;
  starts_at: string | null; ends_at: string | null;
  created_at: string;
  brand: { id: number; name: string; slug: string; logo_url: string | null; industry: string | null } | null;
}

const DEAL_TYPES = ['sponsored_post', 'affiliate', 'collaboration', 'event', 'other'];

const DEAL_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  negotiating: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  active: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-500/15 text-red-600 border-red-500/30',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${DEAL_STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground border-border'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}


export function BrandDealsPage() {
  const confirm = useConfirm();
  const [deals, setDeals] = useState<BrandDeal[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ brand_id: '', title: '', deal_type: 'sponsored_post', budget: '', currency: 'NGN', description: '', deliverables: '', starts_at: '', ends_at: '' });
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchAll = useCallback(async () => {
    try {
      const [dRes, bRes] = await Promise.all([
        authFetch(`/brand-deals?page=${page}&per_page=20`, {  }),
        authFetch(`/brands`, {  }),
      ]);
      if (dRes.ok) { const j = await dRes.json(); setDeals(j.data?.data ?? []); setLastPage(j.data?.last_page ?? 1); }
      if (bRes.ok) { const j = await bRes.json(); setBrands(j.data?.data ?? []); }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [page]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function resetForm() {
    setForm({ brand_id: '', title: '', deal_type: 'sponsored_post', budget: '', currency: 'NGN', description: '', deliverables: '', starts_at: '', ends_at: '' });
    setEditId(null);
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `/brand-deals/${editId}` : `/brand-deals`;
    try {
      const res = await authFetch(url, {
        method, 
        body: JSON.stringify({ ...form, brand_id: Number(form.brand_id), budget: form.budget ? Number(form.budget) * 100 : 0 }),
      });
      if (res.ok) { await fetchAll(); resetForm(); setMessage({ type: 'success', text: editId ? 'Deal updated.' : 'Deal created.' }); }
      else { const j = await res.json(); setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  function startEdit(d: BrandDeal) {
    setForm({
      brand_id: String(d.brand?.id ?? ''),
      title: d.title,
      deal_type: d.deal_type,
      budget: String(d.budget / 100),
      currency: d.currency,
      description: d.description ?? '',
      deliverables: d.deliverables ?? '',
      starts_at: d.starts_at?.split('T')[0] ?? '',
      ends_at: d.ends_at?.split('T')[0] ?? '',
    });
    setEditId(d.id);
    setShowForm(true);
  }

  async function deleteDeal(id: number) {
    if (!await confirm({ title: 'Delete Deal', message: 'Delete this deal?', variant: 'destructive' })) return;
    try {
      const res = await authFetch(`/brand-deals/${id}`, { method: 'DELETE',  });
      if (res.ok) { await fetchAll(); setMessage({ type: 'success', text: 'Deal deleted.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  if (isLoading) {
    return (
      <div className="h-64 w-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Briefcase className="h-6 w-6 text-secondary" />
            Brand Deals Hub
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your brand partnerships, budgets and deliverables in one place.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }}
          variant={showForm ? "outline" : "default"} className="shrink-0">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'New Deal'}
        </Button>
      </div>

      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
          {message.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="p-0.5 hover:opacity-70"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-xs">
          <div>
            <h2 className="text-base font-bold text-foreground">{editId ? 'Edit Deal' : 'New Brand Deal'}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Set the terms of this brand partnership.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Brand *</Label>
              <Select value={form.brand_id} onValueChange={v => setForm({ ...form, brand_id: v })} required>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select a brand" /></SelectTrigger>
                <SelectContent>
                  {(brands ?? []).map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Deal Type</Label>
              <Select value={form.deal_type} onValueChange={v => setForm({ ...form, deal_type: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEAL_TYPES.map(d => <SelectItem key={d} value={d}>{d.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Title *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Instagram Sponsored Post" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Budget (in currency units)</Label>
              <div className="flex gap-2">
                <Input type="number" min="0" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="flex-1" />
                <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">NGN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Status</Label>
              <Input value="Pending" readOnly disabled className="text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground">New deals are created as pending.</p>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Deliverables</Label>
              <Textarea value={form.deliverables} onChange={e => setForm({ ...form, deliverables: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Start Date</Label>
              <Input type="date" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">End Date</Label>
              <Input type="date" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} />
            </div>
          </div>
          <Button type="submit" className="mt-2">{editId ? 'Update Deal' : 'Create Deal'}</Button>
        </form>
      )}

      {deals.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Briefcase className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-bold text-foreground">No brand deals yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">Create your first brand partnership deal to get started earning from sponsorships.</p>
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}><Plus className="h-4 w-4" /> New Deal</Button>
        </div>
      ) : (<>
        <div className="space-y-3">
          {(deals ?? []).map(d => (
            <div key={d.id} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  {d.brand?.logo_url ? <img src={d.brand.logo_url} alt={d.brand.name} className="w-8 h-8 rounded-lg" /> : <Building2 className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-foreground truncate">{d.title}</h3>
                    <StatusBadge status={d.status ?? 'pending'} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span>{d.brand?.name ?? 'Unbranded'}</span>
                    <span>·</span>
                    <span className="capitalize">{d.deal_type.replace('_', ' ')}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <DollarSign className="w-3 h-3" />{formatPrice(d.budget, d.currency)}
                    </span>
                  </div>
                  {d.deliverables && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{d.deliverables}</p>}
                  {(d.starts_at || d.ends_at) && (
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                      {d.starts_at && <span>From {new Date(d.starts_at).toLocaleDateString()}</span>}
                      {d.ends_at && <span>To {new Date(d.ends_at).toLocaleDateString()}</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" onClick={() => startEdit(d)} aria-label="Edit deal">
                  <Edit2 className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => deleteDeal(d.id)} aria-label="Delete deal">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {lastPage > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
            <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage}>Next</Button>
          </div>
        )}
      </>)}
    </div>
  );
}
