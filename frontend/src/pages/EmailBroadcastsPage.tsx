import { useState, useEffect, useCallback } from 'react';
import { Mail, Plus, Loader2, Send, Edit2, Trash2, Eye, MousePointerClick } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = localStorage.getItem('murihspace-token');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface Broadcast {
  id: number; title: string; subject: string; status: string;
  recipient_count: number; sent_count: number;
  open_count: number; click_count: number;
  sent_at: string | null; created_at: string;
}

export function EmailBroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: '', subject: '', content: '' });
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/email-broadcasts?page=${page}&per_page=20`, { headers: getAuthHeaders() });
      if (res.ok) { const j = await res.json(); setBroadcasts(j.data?.data ?? []); setLastPage(j.data?.last_page ?? 1); }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [page]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function resetForm() { setForm({ title: '', subject: '', content: '' }); setEditId(null); setShowForm(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `${API_BASE}/email-broadcasts/${editId}` : `${API_BASE}/email-broadcasts`;
    try {
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(form) });
      if (res.ok) { await fetchAll(); resetForm(); setMessage({ type: 'success', text: editId ? 'Updated.' : 'Created.' }); }
      else { const j = await res.json(); setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  async function sendBroadcast(id: number) {
    if (!confirm('Send this broadcast to all subscribers?')) return;
    try {
      const res = await fetch(`${API_BASE}/email-broadcasts/${id}/send`, { method: 'POST', headers: getAuthHeaders() });
      if (res.ok) { await fetchAll(); setMessage({ type: 'success', text: 'Broadcast sent!' }); }
      else { const j = await res.json(); setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  async function deleteBroadcast(id: number) {
    if (!confirm('Delete this broadcast?')) return;
    try { await fetch(`${API_BASE}/email-broadcasts/${id}`, { method: 'DELETE', headers: getAuthHeaders() }); await fetchAll(); }
    catch { /* ignore */ }
  }

  function startEdit(b: Broadcast) {
    setForm({ title: b.title, subject: b.subject, content: '' });
    setEditId(b.id);
    setShowForm(true);
  }

  const statusStyles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600', sending: 'bg-blue-50 text-blue-700',
    sent: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-red-50 text-red-600',
  };

  if (isLoading) {
    return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Email Broadcasts</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm">
          <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'New Broadcast'}
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 mb-8 space-y-4">
          <h2 className="font-semibold">{editId ? 'Edit Broadcast' : 'New Broadcast'}</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Title (internal)</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Subject Line</label>
            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email Content (HTML or plain text)</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} required
              rows={8} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
          <button type="submit" className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm">
            {editId ? 'Update' : 'Save Draft'}
          </button>
        </form>
      )}

      {broadcasts.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-4 py-16">
          <Mail className="w-16 h-16 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700">No broadcasts yet</h2>
          <p className="text-gray-500">Create your first email broadcast to engage your audience.</p>
        </div>
      ) : (<>
        <div className="space-y-3">
          {broadcasts.map(b => (
            <div key={b.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{b.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[b.status] ?? 'bg-gray-100'}`}>
                      {b.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{b.subject}</p>
                  {b.status === 'sent' && (
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span><Send className="w-3 h-3 inline mr-1" />{b.sent_count}/{b.recipient_count}</span>
                      <span><Eye className="w-3 h-3 inline mr-1" />{b.open_count} opens</span>
                      <span><MousePointerClick className="w-3 h-3 inline mr-1" />{b.click_count} clicks</span>
                      {b.sent_at && <span>{new Date(b.sent_at).toLocaleDateString()}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-4">
                  {b.status === 'draft' && (
                    <>
                      <button onClick={() => startEdit(b)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <Edit2 className="w-4 h-4 text-gray-400" />
                      </button>
                      <button onClick={() => sendBroadcast(b.id)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Send">
                        <Send className="w-4 h-4 text-blue-500" />
                      </button>
                    </>
                  )}
                  <button onClick={() => deleteBroadcast(b.id)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {lastPage > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Previous</button>
            <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
            <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Next</button>
          </div>
        )}
      </>)}
    </div>
  );
}
