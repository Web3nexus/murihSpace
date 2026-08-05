import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Loader2, CheckCircle, Send, Trash2, Building2 } from 'lucide-react';
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

interface Invoice {
  id: number; invoice_number: string; brand_name: string;
  brand_email: string | null; amount: number; currency: string;
  description: string | null; status: string;
  due_date: string | null; paid_at: string | null;
  notes: string | null; created_at: string;
  deal: { id: number; title: string } | null;
}

export function BrandInvoicingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [deals, setDeals] = useState<{ id: number; title: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    brand_deal_id: '', brand_name: '', brand_email: '',
    amount: '', currency: 'NGN', description: '', due_date: '', notes: '',
  });

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [iRes, dRes] = await Promise.all([
        fetch(`${API_BASE}/brand-invoices`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/brand-deals`, { headers: getAuthHeaders() }),
      ]);
      if (iRes.ok) { const j = await iRes.json(); setInvoices(j.data?.data ?? []); }
      if (dRes.ok) { const j = await dRes.json(); setDeals(j.data?.data?.map((d: any) => ({ id: d.id, title: d.title })) ?? []); }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function resetForm() {
    setForm({ brand_deal_id: '', brand_name: '', brand_email: '', amount: '', currency: 'NGN', description: '', due_date: '', notes: '' });
    setShowForm(false);
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      const body: Record<string, any> = {
        brand_name: form.brand_name, brand_email: form.brand_email || null,
        amount: Number(form.amount) * 100, currency: form.currency,
        description: form.description || null, due_date: form.due_date || null,
        notes: form.notes || null,
      };
      if (form.brand_deal_id) body.brand_deal_id = Number(form.brand_deal_id);

      const res = await fetch(`${API_BASE}/brand-invoices`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (res.ok) { await fetchAll(); resetForm(); setMessage({ type: 'success', text: 'Invoice created.' }); }
      else { const j = await res.json(); setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  async function markSent(id: number) {
    try {
      const res = await fetch(`${API_BASE}/brand-invoices/${id}/mark-sent`, { method: 'POST', headers: getAuthHeaders() });
      if (res.ok) { await fetchAll(); setMessage({ type: 'success', text: 'Marked as sent.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  async function markPaid(id: number) {
    try {
      const res = await fetch(`${API_BASE}/brand-invoices/${id}/mark-paid`, { method: 'POST', headers: getAuthHeaders() });
      if (res.ok) { await fetchAll(); setMessage({ type: 'success', text: 'Marked as paid!' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  const confirm = useConfirm();

  async function deleteInvoice(id: number) {
    if (!await confirm({ title: "Delete Invoice", message: "Delete this invoice?", variant: "destructive" })) return;
    try {
      const res = await fetch(`${API_BASE}/brand-invoices/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) { await fetchAll(); setMessage({ type: 'success', text: 'Invoice deleted.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  const statusStyles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-50 text-blue-700',
    paid: 'bg-emerald-50 text-emerald-700', overdue: 'bg-red-50 text-red-600',
    cancelled: 'bg-gray-100 text-gray-400',
  };

  const totalPending = invoices.filter(i => i.status === 'draft' || i.status === 'sent').reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);

  if (isLoading) {
    return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Brand Invoicing</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm">
          <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'New Invoice'}
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Pending</p>
          <p className="text-xl font-bold text-amber-600">{formatPrice(totalPending)}</p>
          <p className="text-xs text-gray-400">{invoices.filter(i => i.status === 'draft' || i.status === 'sent').length} invoices</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Paid</p>
          <p className="text-xl font-bold text-emerald-600">{formatPrice(totalPaid)}</p>
          <p className="text-xs text-gray-400">{invoices.filter(i => i.status === 'paid').length} invoices</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">All Time</p>
          <p className="text-xl font-bold">{formatPrice(totalPending + totalPaid)}</p>
          <p className="text-xs text-gray-400">{invoices.length} total invoices</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createInvoice} className="bg-white border rounded-xl p-6 mb-8 space-y-4">
          <h2 className="font-semibold">New Invoice</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Related Deal (optional)</label>
              <select value={form.brand_deal_id} onChange={e => setForm({ ...form, brand_deal_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">No deal linked</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Brand Email</label>
              <input type="email" value={form.brand_email} onChange={e => setForm({ ...form, brand_email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Brand Name *</label>
              <input value={form.brand_name} onChange={e => setForm({ ...form, brand_name: e.target.value })} required
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Amount</label>
              <div className="flex gap-2">
                <input type="number" min="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required
                  className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                  className="w-20 border rounded-lg px-2 py-2 text-sm">
                  <option value="NGN">NGN</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm">
            Create Invoice
          </button>
        </form>
      )}

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-4 py-16">
          <FileText className="w-16 h-16 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700">No invoices yet</h2>
          <p className="text-gray-500">Create an invoice to bill brands for your deals.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => (
            <div key={inv.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{inv.invoice_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[inv.status] ?? 'bg-gray-100'}`}>
                        {inv.status}
                      </span>
                    </div>
                    <h3 className="font-semibold mt-0.5">{inv.brand_name}</h3>
                    <p className="text-2xl font-bold mt-1">{formatPrice(inv.amount, inv.currency)}</p>
                    {inv.description && <p className="text-sm text-gray-600 mt-1">{inv.description}</p>}
                    {inv.deal && <p className="text-xs text-gray-400 mt-1">Deal: {inv.deal.title}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-4">
                  {inv.status === 'draft' && (
                    <button onClick={() => markSent(inv.id)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Mark sent">
                      <Send className="w-4 h-4 text-blue-500" />
                    </button>
                  )}
                  {inv.status === 'sent' && (
                    <button onClick={() => markPaid(inv.id)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Mark paid">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    </button>
                  )}
                  <button onClick={() => deleteInvoice(inv.id)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                {inv.due_date && <span>Due: {new Date(inv.due_date).toLocaleDateString()}</span>}
                {inv.paid_at && <span>Paid: {new Date(inv.paid_at).toLocaleDateString()}</span>}
                <span>Created: {new Date(inv.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
