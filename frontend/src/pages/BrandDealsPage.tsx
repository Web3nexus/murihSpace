import { useState, useEffect, useCallback } from 'react';
import { Briefcase, Plus, Loader2, Building2, DollarSign, Edit2, Trash2 } from 'lucide-react';

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


export function BrandDealsPage() {
  const [deals, setDeals] = useState<BrandDeal[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ brand_id: '', title: '', deal_type: 'sponsored_post', budget: '', currency: 'NGN', description: '', deliverables: '', starts_at: '', ends_at: '' });

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dRes, bRes] = await Promise.all([
        fetch(`${API_BASE}/brand-deals`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/brands`, { headers: getAuthHeaders() }),
      ]);
      if (dRes.ok) { const j = await dRes.json(); setDeals(j.data?.data ?? []); }
      if (bRes.ok) { const j = await bRes.json(); setBrands(j.data?.data ?? []); }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

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
    const url = editId ? `${API_BASE}/brand-deals/${editId}` : `${API_BASE}/brand-deals`;
    try {
      const res = await fetch(url, {
        method, headers: getAuthHeaders(),
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
    if (!confirm('Delete this deal?')) return;
    try {
      const res = await fetch(`${API_BASE}/brand-deals/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) { await fetchAll(); setMessage({ type: 'success', text: 'Deal deleted.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  const statusStyles: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700', negotiating: 'bg-blue-50 text-blue-700',
    active: 'bg-emerald-50 text-emerald-700', completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-50 text-red-600',
  };

  if (isLoading) {
    return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Brand Deals Hub</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm">
          <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'New Deal'}
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 mb-8 space-y-4">
          <h2 className="font-semibold">{editId ? 'Edit Deal' : 'New Brand Deal'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Brand *</label>
              <select value={form.brand_id} onChange={e => setForm({ ...form, brand_id: e.target.value })} required
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select brand</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Deal Type</label>
              <select value={form.deal_type} onChange={e => setForm({ ...form, deal_type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                {DEAL_TYPES.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Budget (in currency units)</label>
              <div className="flex gap-2">
                <input type="number" min="0" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}
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
              <label className="block text-sm text-gray-600 mb-1">Status</label>
              <select value={editId ? '' : 'pending'} onChange={() => {}}
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-400" disabled>
                <option value="pending">Pending (set on create)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Deliverables</label>
              <textarea value={form.deliverables} onChange={e => setForm({ ...form, deliverables: e.target.value })}
                rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Start Date</label>
              <input type="date" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">End Date</label>
              <input type="date" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm">
            {editId ? 'Update Deal' : 'Create Deal'}
          </button>
        </form>
      )}

      {deals.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-4 py-16">
          <Briefcase className="w-16 h-16 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700">No brand deals yet</h2>
          <p className="text-gray-500">Create your first brand partnership deal to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map(d => (
            <div key={d.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    {d.brand?.logo_url ? <img src={d.brand.logo_url} className="w-8 h-8 rounded" /> : <Building2 className="w-5 h-5 text-gray-400" />}
                  </div>
                  <div>
                    <h3 className="font-semibold">{d.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                      <span>{d.brand?.name}</span>
                      <span>·</span>
                      <span className="capitalize">{d.deal_type.replace('_', ' ')}</span>
                      <span>·</span>
                      <DollarSign className="w-3 h-3" />
                      <span>{formatPrice(d.budget, d.currency)}</span>
                    </div>
                    {d.deliverables && <p className="text-sm text-gray-600 mt-1">{d.deliverables}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[d.status] ?? 'bg-gray-100'}`}>
                    {d.status}
                  </span>
                  <button onClick={() => startEdit(d)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                    <Edit2 className="w-4 h-4 text-gray-400" />
                  </button>
                  <button onClick={() => deleteDeal(d.id)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
              {(d.starts_at || d.ends_at) && (
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  {d.starts_at && <span>From {new Date(d.starts_at).toLocaleDateString()}</span>}
                  {d.ends_at && <span>To {new Date(d.ends_at).toLocaleDateString()}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
