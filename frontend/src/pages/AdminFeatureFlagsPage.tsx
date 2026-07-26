import { useState, useEffect, useCallback } from 'react';
import { Flag, Plus, Loader2, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface FeatureFlag {
  id: number; key: string; label: string; description?: string; enabled: boolean;
  created_at: string; updated_at: string;
}

export function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchFlags = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiClient.get('/securegate/feature-flags');
      const d = res.data?.success ? res.data.data : res.data;
      setFlags((d?.data as FeatureFlag[]) ?? []);
    } catch { setError('Failed to load feature flags'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const toggleFlag = async (flag: FeatureFlag) => {
    setToggling(flag.id);
    try {
      const res = await apiClient.put(`/securegate/feature-flags/${flag.id}`, { enabled: !flag.enabled });
      const d = res.data?.success ? res.data.data : res.data;
      if (d?.data) setFlags((prev) => prev.map((f) => f.id === flag.id ? (d.data as FeatureFlag) : f));
    } catch { setError('Failed to toggle flag'); }
    finally { setToggling(null); }
  };

  const deleteFlag = async (id: number) => {
    setDeleting(id);
    try {
      await apiClient.delete(`/securegate/feature-flags/${id}`);
      setFlags((prev) => prev.filter((f) => f.id !== id));
    } catch { setError('Failed to delete flag'); }
    finally { setDeleting(null); }
  };

  const createFlag = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setSubmitting(true); setMsg(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await apiClient.post('/securegate/feature-flags', {
        key: form.get('key'), label: form.get('label'), description: form.get('description'),
      });
      const d = res.data?.success ? res.data.data : res.data;
      if (d?.data) { setMsg({ type: 'success', text: 'Feature flag created.' }); setShowCreate(false); fetchFlags(); }
      else setMsg({ type: 'error', text: (d?.message as string) || 'Failed to create flag.' });
    } catch { setMsg({ type: 'error', text: 'Network error.' }); }
    setSubmitting(false);
  };

  return (
    <div className="w-full min-h-screen bg-background text-foreground">
      <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Flag className="h-7 w-7 text-primary" />
              Feature Flags
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Toggle platform features on and off</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setMsg(null); }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            <Plus className="h-4 w-4" /> New Flag
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : flags.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-16 text-center">
            <Flag className="h-10 w-10 text-muted-foreground/30" />
            <h3 className="text-sm font-bold text-muted-foreground">No feature flags</h3>
            <p className="text-xs text-muted-foreground/60">Create your first flag to start toggling platform features.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {flags.map((f) => (
                <div key={f.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{f.label}</p>
                      <code className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{f.key}</code>
                    </div>
                    {f.description && <p className="mt-0.5 text-xs text-muted-foreground">{f.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleFlag(f)}
                      disabled={toggling === f.id}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        f.enabled ? 'bg-primary' : 'bg-muted-foreground/20'
                      } ${toggling === f.id ? 'opacity-50' : ''}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        f.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                    <button
                      onClick={() => deleteFlag(f.id)}
                      disabled={deleting === f.id}
                      className="rounded-lg p-1.5 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                    >
                      {deleting === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Dialog */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowCreate(false); setMsg(null); }}>
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                <Flag className="h-5 w-5 text-primary" /> Create Feature Flag
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">Add a new toggleable platform feature.</p>

              {msg && (
                <div className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                  msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
                }`}>
                  {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  {msg.text}
                </div>
              )}

              <form onSubmit={createFlag} className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-muted-foreground">Key</label>
                  <input name="key" placeholder="e.g. new_checkout" required
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary/50" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-muted-foreground">Label</label>
                  <input name="label" placeholder="Display label" required
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary/50" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-muted-foreground">Description (optional)</label>
                  <input name="description" placeholder="What does this flag control?"
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary/50" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => { setShowCreate(false); setMsg(null); }}
                    className="flex-1 rounded-lg border border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm transition-all">
                    {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Create Flag'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
