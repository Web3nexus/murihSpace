import { useState, useEffect, useCallback } from 'react';
import { Flag, Plus, Loader2, ToggleLeft, ToggleRight, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import type { FeatureFlag } from '@/types/admin';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
const authHeaders = () => {
  const t = localStorage.getItem('auth_token') || localStorage.getItem('murihspace-token');
  return { Accept: 'application/json', 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

export function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/securegate/feature-flags`, { headers: authHeaders() });
      if (res.ok) { const j = await res.json(); setFlags(j.data ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const toggleFlag = async (flag: FeatureFlag) => {
    await fetch(`${API_BASE}/securegate/feature-flags/${flag.id}`, {
      method: 'PUT', headers: authHeaders(),
      body: JSON.stringify({ enabled: !flag.enabled }),
    });
    fetchFlags();
  };

  const deleteFlag = async (id: number) => {
    await fetch(`${API_BASE}/securegate/feature-flags/${id}`, { method: 'DELETE', headers: authHeaders() });
    fetchFlags();
  };

  const createFlag = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setSubmitting(true); setMsg(null);
    const form = new FormData(e.currentTarget);
    const body = { key: form.get('key'), label: form.get('label'), description: form.get('description') };
    try {
      const res = await fetch(`${API_BASE}/securegate/feature-flags`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
      });
      const j = await res.json();
      if (res.ok) { setMsg({ type: 'success', text: 'Feature flag created.' }); setShowCreate(false); fetchFlags(); }
      else setMsg({ type: 'error', text: j.message || 'Failed.' });
    } catch { setMsg({ type: 'error', text: 'Network error.' }); }
    setSubmitting(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Flag className="h-6 w-6 text-secondary" /> Feature Flags
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Toggle platform features on and off.</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setMsg(null); }} className="text-xs font-bold gap-1.5"><Plus className="h-4 w-4" /> New Flag</Button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-secondary" /></div>
        : flags.length === 0 ? <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card"><Flag className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" /><h3 className="text-sm font-bold">No feature flags</h3></div>
        : <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
            <div className="divide-y divide-border/50">
              {flags.map((f) => (
                <div key={f.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/10 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{f.label}</p>
                      <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{f.key}</code>
                    </div>
                    {f.description && <p className="text-[11px] text-muted-foreground mt-0.5">{f.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleFlag(f)} className={`p-1.5 rounded-lg transition-colors ${f.enabled ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-muted-foreground hover:bg-muted'}`}>
                      {f.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <button onClick={() => deleteFlag(f.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>}

      <Dialog open={showCreate} onOpenChange={() => { setShowCreate(false); setMsg(null); }}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold"><Flag className="h-5 w-5 text-secondary" /> Create Feature Flag</DialogTitle>
            <DialogDescription className="text-xs">Add a new toggleable platform feature.</DialogDescription>
          </DialogHeader>
          {msg && <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>{msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}{msg.text}</div>}
          <form onSubmit={createFlag} className="space-y-3">
            <Input name="key" placeholder="Key (e.g. new_checkout)" required className="text-sm" />
            <Input name="label" placeholder="Display label" required className="text-sm" />
            <Input name="description" placeholder="Description (optional)" className="text-sm" />
            <Button type="submit" disabled={submitting} className="w-full text-sm font-bold">{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Create Flag</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
