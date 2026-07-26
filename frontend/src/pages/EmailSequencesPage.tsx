import { useState, useEffect, useCallback } from 'react';
import { ListOrdered, Plus, Loader2, Power, PowerOff, Trash2, Clock } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = localStorage.getItem('murihspace-token');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface Step {
  id: number; subject: string; delay_days: number; order: number; content?: string;
}

interface Sequence {
  id: number; title: string; description: string | null;
  trigger_event: string; status: string; is_active: boolean;
  steps_count: number; created_at: string;
  steps: Step[];
}

const TRIGGER_EVENTS = ['purchase', 'signup', 'subscription', 'follow', 'custom'];

export function EmailSequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: '', description: '', trigger_event: 'purchase' });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedStepForm, setExpandedStepForm] = useState<Record<string, string>>({});

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/email-sequences`, { headers: getAuthHeaders() });
      if (res.ok) { const j = await res.json();         setSequences(j.data?.data ?? []); }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function resetForm() { setForm({ title: '', description: '', trigger_event: 'purchase' }); setEditId(null); setShowForm(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `${API_BASE}/email-sequences/${editId}` : `${API_BASE}/email-sequences`;
    try {
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(form) });
      if (res.ok) { await fetchAll(); resetForm(); setMessage({ type: 'success', text: editId ? 'Updated.' : 'Created.' }); }
      else { const j = await res.json(); setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  async function toggleSequence(id: number) {
    try {
      await fetch(`${API_BASE}/email-sequences/${id}/toggle`, { method: 'POST', headers: getAuthHeaders() });
      await fetchAll();
    } catch { /* ignore */ }
  }

  async function deleteSequence(id: number) {
    if (!confirm('Delete this sequence and all its steps?')) return;
    try { await fetch(`${API_BASE}/email-sequences/${id}`, { method: 'DELETE', headers: getAuthHeaders() }); await fetchAll(); }
    catch { /* ignore */ }
  }

  async function addStep(sequenceId: number) {
    const key = `step_${sequenceId}`;
    const data = expandedStepForm[key];
    if (!data?.trim()) return;
    try {
      const lines = data.split('\n').filter(Boolean);
      const subject = lines[0] ?? 'Untitled';
      const content = lines.slice(1).join('\n');
      const res = await fetch(`${API_BASE}/email-sequences/${sequenceId}/steps`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ subject, content, delay_days: 0 }),
      });
      if (res.ok) { await fetchAll(); setExpandedStepForm({ ...expandedStepForm, [key]: '' }); }
    } catch { /* ignore */ }
  }

  async function deleteStep(sequenceId: number, stepId: number) {
    try {
      await fetch(`${API_BASE}/email-sequences/${sequenceId}/steps/${stepId}`, { method: 'DELETE', headers: getAuthHeaders() });
      await fetchAll();
    } catch { /* ignore */ }
  }

  if (isLoading) {
    return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ListOrdered className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Automated Sequences</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm">
          <Plus className="w-4 h-4" /> {showForm ? 'Cancel' : 'New Sequence'}
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 mb-8 space-y-4">
          <h2 className="font-semibold">{editId ? 'Edit Sequence' : 'New Automated Sequence'}</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Title</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Trigger Event</label>
            <select value={form.trigger_event} onChange={e => setForm({ ...form, trigger_event: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              {TRIGGER_EVENTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button type="submit" className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm">
            {editId ? 'Update' : 'Create Sequence'}
          </button>
        </form>
      )}

      {sequences.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-4 py-16">
          <ListOrdered className="w-16 h-16 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700">No sequences yet</h2>
          <p className="text-gray-500">Create automated email sequences triggered by user actions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map(s => (
            <div key={s.id} className="bg-white border rounded-xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{s.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                        {s.trigger_event}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.is_active ? 'Active' : s.status}
                      </span>
                    </div>
                    {s.description && <p className="text-sm text-gray-600 mt-1">{s.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">{s.steps_count} step{s.steps_count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <button onClick={() => toggleSequence(s.id)} className="p-1.5 hover:bg-gray-100 rounded-lg" title={s.is_active ? 'Pause' : 'Activate'}>
                      {s.is_active ? <PowerOff className="w-4 h-4 text-amber-500" /> : <Power className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button onClick={() => deleteSequence(s.id)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                    <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                      className="px-3 py-1 text-xs bg-gray-100 rounded-lg hover:bg-gray-200">
                      {expandedId === s.id ? 'Hide Steps' : `${s.steps_count} Steps`}
                    </button>
                  </div>
                </div>
              </div>

              {expandedId === s.id && (
                <div className="border-t bg-gray-50 px-4 py-3 space-y-3">
                  {s.steps.length === 0 && <p className="text-sm text-gray-400">No steps yet. Add your first email below.</p>}
                  {s.steps.map(st => (
                    <div key={st.id} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">{st.order}</span>
                        <div>
                          <span className="text-sm font-medium">{st.subject}</span>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            <span>Delay: {st.delay_days}d</span>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => deleteStep(s.id, st.id)} className="p-1 hover:bg-gray-100 rounded">
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <textarea
                      value={expandedStepForm[`step_${s.id}`] ?? ''}
                      onChange={e => setExpandedStepForm({ ...expandedStepForm, [`step_${s.id}`]: e.target.value })}
                      placeholder="First line = subject, rest = body"
                      rows={2} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                    <button onClick={() => addStep(s.id)}
                      className="px-4 py-2 bg-black text-white rounded-lg text-sm shrink-0">
                      Add Email
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
