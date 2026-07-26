import { useState, useEffect, useCallback } from 'react';
import { SendHorizonal, Plus, Loader2, Building2, Trash2, DollarSign } from 'lucide-react';

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
  id: number; name: string; slug: string; logo_url: string | null; industry: string | null;
}

interface Proposal {
  id: number; brand_name: string | null; brand_email: string | null;
  title: string; pitch: string; proposed_budget: number | null;
  currency: string; deliverables: string | null; status: string;
  sent_at: string | null; created_at: string;
  brand: Brand | null;
}

export function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    brand_id: '', brand_name: '', brand_email: '',
    title: '', pitch: '', proposed_budget: '', currency: 'NGN', deliverables: '',
  });

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pRes, bRes] = await Promise.all([
        fetch(`${API_BASE}/brand-proposals`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/brands`, { headers: getAuthHeaders() }),
      ]);
      if (pRes.ok) { const j = await pRes.json(); setProposals(j.data?.data ?? []); }
      if (bRes.ok) { const j = await bRes.json(); setBrands(j.data?.data ?? []); }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function resetForm() {
    setForm({ brand_id: '', brand_name: '', brand_email: '', title: '', pitch: '', proposed_budget: '', currency: 'NGN', deliverables: '' });
    setShowForm(false);
  }

  async function createProposal(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      const body: Record<string, any> = {
        title: form.title, pitch: form.pitch, currency: form.currency,
        deliverables: form.deliverables || null,
        proposed_budget: form.proposed_budget ? Number(form.proposed_budget) * 100 : null,
      };
      if (form.brand_id) { body.brand_id = Number(form.brand_id); }
      else { body.brand_name = form.brand_name; body.brand_email = form.brand_email || null; }

      const res = await fetch(`${API_BASE}/brand-proposals`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (res.ok) { await fetchAll(); resetForm(); setMessage({ type: 'success', text: 'Proposal created.' }); }
      else { const j = await res.json(); setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  async function sendProposal(id: number) {
    try {
      const res = await fetch(`${API_BASE}/brand-proposals/${id}/send`, { method: 'POST', headers: getAuthHeaders() });
      if (res.ok) { await fetchAll(); setMessage({ type: 'success', text: 'Proposal sent!' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  async function deleteProposal(id: number) {
    if (!confirm('Delete this proposal?')) return;
    try {
      const res = await fetch(`${API_BASE}/brand-proposals/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) { await fetchAll(); setMessage({ type: 'success', text: 'Proposal deleted.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  const statusStyles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-50 text-blue-700',
    viewed: 'bg-purple-50 text-purple-700', declined: 'bg-red-50 text-red-600',
    accepted: 'bg-emerald-50 text-emerald-700',
  };

  if (isLoading) {
    return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <SendHorizonal className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Outreach & Proposals</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm">
          <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'New Proposal'}
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={createProposal} className="bg-white border rounded-xl p-6 mb-8 space-y-4">
          <h2 className="font-semibold">New Pitch Proposal</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Brand (select existing or enter name below)</label>
            <select value={form.brand_id} onChange={e => setForm({ ...form, brand_id: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select a registered brand</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Brand Name (if not listed)</label>
              <input value={form.brand_name} onChange={e => setForm({ ...form, brand_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" disabled={!!form.brand_id} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Brand Email</label>
              <input type="email" value={form.brand_email} onChange={e => setForm({ ...form, brand_email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Title *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Pitch *</label>
            <textarea value={form.pitch} onChange={e => setForm({ ...form, pitch: e.target.value })} required
              rows={4} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Sell yourself! Why should this brand work with you?" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Proposed Budget</label>
              <div className="flex gap-2">
                <input type="number" min="0" value={form.proposed_budget}
                  onChange={e => setForm({ ...form, proposed_budget: e.target.value })}
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
              <label className="block text-sm text-gray-600 mb-1">Deliverables</label>
              <textarea value={form.deliverables} onChange={e => setForm({ ...form, deliverables: e.target.value })}
                rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm">
            Create Proposal (Draft)
          </button>
        </form>
      )}

      {proposals.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-4 py-16">
          <SendHorizonal className="w-16 h-16 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700">No proposals yet</h2>
          <p className="text-gray-500">Create a pitch proposal to reach out to brands.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map(p => (
            <div key={p.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{p.brand?.name ?? p.brand_name}</span>
                    {p.brand_email && <span className="text-xs text-gray-400">{p.brand_email}</span>}
                  </div>
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{p.pitch}</p>
                  {p.proposed_budget != null && (
                    <p className="text-sm text-gray-500 mt-1">
                      <DollarSign className="w-3 h-3 inline" /> {formatPrice(p.proposed_budget, p.currency)}
                    </p>
                  )}
                  {p.deliverables && <p className="text-xs text-gray-400 mt-1">Deliverables: {p.deliverables}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[p.status] ?? 'bg-gray-100'}`}>
                    {p.status}
                  </span>
                  {p.status === 'draft' && (
                    <button onClick={() => sendProposal(p.id)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Send">
                      <SendHorizonal className="w-4 h-4 text-blue-500" />
                    </button>
                  )}
                  <button onClick={() => deleteProposal(p.id)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {p.status === 'draft' ? 'Draft' : `Sent ${p.sent_at ? new Date(p.sent_at).toLocaleDateString() : ''}`}
                {' · '}Created {new Date(p.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
