import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Loader2, EyeOff, Eye, Trash2, AlertCircle, CheckCircle2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import type { PageSection } from '@/types/admin';
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';
const authHeaders = () => {
  const t = getAuthToken();
  return { Accept: 'application/json', 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

const PAGES = ['home', 'features', 'pricing'];

export function AdminCmsPage() {
  const [sections, setSections] = useState<PageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState('home');
  const [editing, setEditing] = useState<PageSection | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSections = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/securegate/cms?page=${selectedPage}`, { headers: authHeaders() });
      if (res.ok) { const j = await res.json(); setSections(j?.data?.data ?? j?.data ?? []); }
    } finally { setLoading(false); }
  }, [selectedPage]);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  const toggleActive = async (section: PageSection) => {
    const res = await fetch(`${API_BASE}/securegate/cms/${section.id}`, {
      method: 'PUT', headers: authHeaders(),
      body: JSON.stringify({ is_active: !section.is_active }),
    });
    if (res.ok) fetchSections();
  };

  const deleteSection = async (id: number) => {
    await fetch(`${API_BASE}/securegate/cms/${id}`, { method: 'DELETE', headers: authHeaders() });
    fetchSections();
  };

  const openEditor = (section: PageSection) => {
    setEditing(section);
    setEditContent(JSON.stringify(section.content, null, 2));
    setMsg(null);
  };

  const saveContent = async () => {
    if (!editing) return;
    setSubmitting(true); setMsg(null);
    try {
      const content = JSON.parse(editContent);
      const res = await fetch(`${API_BASE}/securegate/cms/${editing.id}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ content }),
      });
      const j = await res.json();
      if (res.ok) { setMsg({ type: 'success', text: 'Section content saved.' }); setEditing(null); fetchSections(); }
      else setMsg({ type: 'error', text: j.message || 'Failed.' });
    } catch { setMsg({ type: 'error', text: 'Invalid JSON.' }); }
    setSubmitting(false);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...sections];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    const reordered = next.map((s, i) => ({ id: s.id, sort_order: i }));
    setSections(next);
    fetch(`${API_BASE}/securegate/cms/reorder`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ sections: reordered }),
    });
  };

  const moveDown = (index: number) => {
    if (index === sections.length - 1) return;
    const next = [...sections];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    const reordered = next.map((s, i) => ({ id: s.id, sort_order: i }));
    setSections(next);
    fetch(`${API_BASE}/securegate/cms/reorder`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ sections: reordered }),
    });
  };

  const createSection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setSubmitting(true); setMsg(null);
    const form = new FormData(e.currentTarget);
    const sectionKey = form.get('key') as string;
    const body = {
      page: selectedPage,
      key: sectionKey,
      type: form.get('type') || 'text',
      label: form.get('label'),
      content: {},
    };
    try {
      const res = await fetch(`${API_BASE}/securegate/cms`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
      });
      const j = await res.json();
      if (res.ok) { setMsg({ type: 'success', text: 'Section created.' }); setShowCreate(false); fetchSections(); }
      else setMsg({ type: 'error', text: j.message || 'Failed.' });
    } catch { setMsg({ type: 'error', text: 'Network error.' }); }
    setSubmitting(false);
  };

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <FileText className="h-6 w-6 text-[#38A8D8]" /> Website CMS
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Manage landing page sections.</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setMsg(null); }} className="text-xs font-bold gap-1.5"><Plus className="h-4 w-4" /> Add Section</Button>
      </div>

      {/* Page tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1 w-fit">
        {PAGES.map((p) => (
          <button
            key={p}
            onClick={() => { setSelectedPage(p); setLoading(true); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize ${
              selectedPage === p ? 'bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>
        : sections.length === 0 ? <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card"><FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" /><h3 className="text-sm font-bold">No sections for this page</h3></div>
        : <div className="space-y-3">
            {sections.map((section, index) => (
              <div key={section.id} className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveUp(index)} className="text-muted-foreground/50 hover:text-foreground transition-colors leading-none text-[10px]">&uarr;</button>
                      <button onClick={() => moveDown(index)} className="text-muted-foreground/50 hover:text-foreground transition-colors leading-none text-[10px]">&darr;</button>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{section.label}</p>
                      <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{section.key}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditor(section)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-xs font-medium">
                      Edit
                    </button>
                    <button onClick={() => toggleActive(section)} className={`p-1.5 rounded-lg transition-colors ${section.is_active ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-muted-foreground hover:bg-accent'}`}>
                      {section.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button onClick={() => deleteSection(section.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="px-4 py-2.5">
                  <p className="text-[11px] text-muted-foreground font-mono truncate">
                    {JSON.stringify(section.content).slice(0, 120)}...
                  </p>
                </div>
              </div>
            ))}
          </div>}

      {/* Edit Content Dialog */}
      <Dialog open={!!editing} onOpenChange={() => { setEditing(null); setMsg(null); }}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border shadow-2xl rounded-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileText className="h-5 w-5 text-[#38A8D8]" /> Edit: {editing?.label}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Edit the JSON content for this section.</DialogDescription>
          </DialogHeader>
          {msg && <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}{msg.text}</div>}
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-64 rounded-xl border border-border bg-muted/30 p-4 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#38A8D8]/30"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} className="text-xs">Cancel</Button>
            <Button onClick={saveContent} disabled={submitting} className="text-xs font-bold gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Content
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Section Dialog */}
      <Dialog open={showCreate} onOpenChange={() => { setShowCreate(false); setMsg(null); }}>
        <DialogContent className="sm:max-w-lg md:max-w-xl bg-card border-border shadow-2xl rounded-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold"><FileText className="h-5 w-5 text-[#38A8D8]" /> Add Section</DialogTitle>
            <DialogDescription className="text-xs">Add a new content section to the {selectedPage} page.</DialogDescription>
          </DialogHeader>
          {msg && <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}{msg.text}</div>}
          <form onSubmit={createSection} className="space-y-3">
            <Input name="key" placeholder="Key (e.g. hero)" required className="text-sm" />
            <Input name="label" placeholder="Display label" required className="text-sm" />
            <Input name="type" placeholder="Type (e.g. hero, features, cta)" defaultValue="text" className="text-sm" />
            <Button type="submit" disabled={submitting} className="w-full text-sm font-bold">{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Create Section</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
