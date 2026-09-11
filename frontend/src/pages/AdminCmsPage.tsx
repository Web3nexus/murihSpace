import { getAuthToken } from "@/lib/auth/token";
import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Spinner as Loader2,
  EyeSlash as EyeOff,
  Eye,
  Trash as Trash2,
  WarningCircle as AlertCircle,
  CheckCircle as CheckCircle2,
  FloppyDisk,
  Megaphone,
  PaperPlaneTilt,
  Users,
  CalendarBlank,
} from "@phosphor-icons/react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import type { PageSection } from '@/types/admin';
import { authFetch } from "@/lib/api/authFetch";

const authHeaders = () => {
  const t = getAuthToken();
  return { Accept: 'application/json', 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

const PAGES = ['home', 'features', 'pricing'];

interface SystemBroadcastItem {
  id: number;
  title: string;
  body: string;
  type: string;
  target_audience: string;
  action_url?: string | null;
  action_label?: string | null;
  recipients_count: number;
  sent_at?: string | null;
  admin?: {
    id: number;
    name: string;
    username: string;
    avatar?: string;
  };
}

export function AdminCmsPage() {
  const [activeTab, setActiveTab] = useState<'sections' | 'broadcasts'>('sections');

  // Landing Sections State
  const [sections, setSections] = useState<PageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState('home');
  const [editing, setEditing] = useState<PageSection | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // General Broadcasts State
  const [broadcasts, setBroadcasts] = useState<SystemBroadcastItem[]>([]);
  const [broadcastsLoading, setBroadcastsLoading] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    body: '',
    type: 'announcement',
    target_audience: 'all',
    action_url: '',
    action_label: '',
  });

  const fetchSections = useCallback(async () => {
    try {
      const res = await authFetch(`/securegate/cms?page=${selectedPage}`, { headers: authHeaders() });
      if (res.ok) { const j = await res.json(); setSections(j?.data?.data ?? j?.data ?? []); }
    } finally { setLoading(false); }
  }, [selectedPage]);

  const fetchBroadcasts = useCallback(async () => {
    try {
      setBroadcastsLoading(true);
      const res = await authFetch('/securegate/broadcasts', { headers: authHeaders() });
      if (res.ok) {
        const j = await res.json();
        setBroadcasts(j?.data?.data ?? j?.data ?? []);
      }
    } finally {
      setBroadcastsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'sections') {
      fetchSections();
    } else {
      fetchBroadcasts();
    }
  }, [activeTab, fetchSections, fetchBroadcasts]);

  const toggleActive = async (section: PageSection) => {
    const res = await authFetch(`/securegate/cms/${section.id}`, {
      method: 'PUT', headers: authHeaders(),
      body: JSON.stringify({ is_active: !section.is_active }),
    });
    if (res.ok) fetchSections();
  };

  const deleteSection = async (id: number) => {
    await authFetch(`/securegate/cms/${id}`, { method: 'DELETE', headers: authHeaders() });
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
      const res = await authFetch(`/securegate/cms/${editing.id}`, {
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
    authFetch(`/securegate/cms/reorder`, {
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
    authFetch(`/securegate/cms/reorder`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ sections: reordered }),
    });
  };

  const createSection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true); setMsg(null);
    const form = new FormData(e.currentTarget);
    const body = {
      page: selectedPage,
      key: form.get('key'),
      label: form.get('label'),
      type: form.get('type') || 'text',
      content: {},
      sort_order: sections.length,
      is_active: true,
    };
    const res = await authFetch(`/securegate/cms`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (res.ok) { setShowCreate(false); fetchSections(); }
    else setMsg({ type: 'error', text: j.message || 'Failed to create.' });
    setSubmitting(false);
  };

  // Broadcasts Actions
  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await authFetch('/securegate/broadcasts', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(broadcastForm),
      });
      const data = await res.json();
      if (res.ok) {
        setShowBroadcastModal(false);
        setBroadcastForm({
          title: '',
          body: '',
          type: 'announcement',
          target_audience: 'all',
          action_url: '',
          action_label: '',
        });
        fetchBroadcasts();
      } else {
        setMsg({ type: 'error', text: data.message || 'Failed to dispatch broadcast.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error sending broadcast.' });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteBroadcast = async (id: number) => {
    if (!confirm('Are you sure you want to delete this broadcast log?')) return;
    const res = await authFetch(`/securegate/broadcasts/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) {
      fetchBroadcasts();
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'security_alert':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/30">Security Alert</span>;
      case 'system_update':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">System Update</span>;
      case 'policy_update':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-500/15 text-purple-500 border border-purple-500/30">Policy Update</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-500/15 text-sky-500 border border-sky-500/30">Announcement</span>;
    }
  };

  const getAudienceBadge = (audience: string) => {
    switch (audience) {
      case 'creators':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/15 text-indigo-400">Creators Only</span>;
      case 'vendors':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-500">Vendors Only</span>;
      case 'members':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-muted text-muted-foreground">Standard Members</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-400">All Users (Global)</span>;
    }
  };

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-4 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2.5">
            <FileText weight="fill" className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> CMS & System Broadcasts
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Manage landing page contents and dispatch official broadcasts to all ecosystem users.</p>
        </div>

        {/* Top-Level Tab Switcher */}
        <div className="flex gap-1 rounded-xl bg-muted/60 p-1 border border-border/60">
          <button
            onClick={() => setActiveTab('sections')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'sections' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText weight="fill" className="h-4 w-4" /> Landing Sections
          </button>
          <button
            onClick={() => setActiveTab('broadcasts')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'broadcasts' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Megaphone weight="fill" className="h-4 w-4 text-sky-500" /> General Broadcasts
          </button>
        </div>
      </div>

      {activeTab === 'sections' ? (
        /* LANDING PAGE SECTIONS TAB */
        <>
          <div className="flex items-center justify-between">
            {/* Page tabs */}
            <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
              {PAGES.map((p) => (
                <button
                  key={p}
                  onClick={() => { setSelectedPage(p); setLoading(true); }}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize ${
                    selectedPage === p ? 'bg-accent text-foreground ' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <Button onClick={() => { setShowCreate(true); setMsg(null); }} className="text-xs font-bold gap-1.5">
              <Plus weight="fill" className="h-4 w-4" /> Add Section
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 weight="fill" className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>
          ) : sections.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card">
              <FileText weight="fill" className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-sm font-bold">No sections for this page</h3>
            </div>
          ) : (
            <div className="space-y-3">
              {sections.map((section, index) => (
                <div key={section.id} className="border-none rounded-lg bg-card overflow-hidden shadow-sm">
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
                        {section.is_active ? <Eye className="h-4 w-4" /> : <EyeOff weight="fill" className="h-4 w-4" />}
                      </button>
                      <button onClick={() => deleteSection(section.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 weight="fill" className="h-4 w-4" />
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
            </div>
          )}
        </>
      ) : (
        /* GENERAL BROADCASTS TAB */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Megaphone weight="fill" className="h-5 w-5 text-sky-500" /> Platform General Broadcasts
              </h2>
              <p className="text-xs text-muted-foreground">
                Broadcast official security alerts, announcements, and policy updates directly to users across Web & Mobile.
              </p>
            </div>
            <Button
              onClick={() => { setShowBroadcastModal(true); setMsg(null); }}
              className="text-xs font-bold gap-1.5 bg-sky-600 hover:bg-sky-500 text-white"
            >
              <PaperPlaneTilt weight="fill" className="h-4 w-4" /> Compose Broadcast
            </Button>
          </div>

          {broadcastsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 weight="fill" className="h-8 w-8 animate-spin text-sky-500" />
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card">
              <Megaphone weight="fill" className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-foreground">No broadcasts sent yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Dispatch an official notification or security alert to members in the MurihSpace System channel.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {broadcasts.map((b) => (
                <div key={b.id} className="p-4 rounded-xl border border-border/80 bg-card shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-extrabold text-foreground">{b.title}</h3>
                      {getTypeBadge(b.type)}
                      {getAudienceBadge(b.target_audience)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users weight="fill" className="h-3.5 w-3.5 text-primary" /> {b.recipients_count.toLocaleString()} recipients
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <CalendarBlank className="h-3.5 w-3.5" />
                        {b.sent_at ? new Date(b.sent_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Draft'}
                      </span>
                      <button
                        onClick={() => deleteBroadcast(b.id)}
                        className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition"
                        title="Delete broadcast record"
                      >
                        <Trash2 weight="fill" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                    {b.body}
                  </p>

                  {(b.action_url || b.admin) && (
                    <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                      <div>
                        {b.action_url && (
                          <span className="text-sky-500 font-semibold">
                            Link: {b.action_label || 'Action'} → {b.action_url}
                          </span>
                        )}
                      </div>
                      <div>
                        {b.admin && (
                          <span>Sent by: <strong className="text-foreground">{b.admin.name}</strong> (@{b.admin.username})</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compose Broadcast Dialog */}
      <Dialog open={showBroadcastModal} onOpenChange={() => { setShowBroadcastModal(false); setMsg(null); }}>
        <DialogContent className="sm:max-w-xl bg-card border-border shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-foreground">
              <Megaphone weight="fill" className="h-5 w-5 text-sky-500" /> New System Broadcast
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Dispatches an official in-app message and WebSocket alert to user devices in real time.
            </DialogDescription>
          </DialogHeader>

          {msg && (
            <div className={`p-3 rounded-lg text-xs font-bold flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle weight="fill" className="h-4 w-4 shrink-0" />}
              {msg.text}
            </div>
          )}

          <form onSubmit={sendBroadcast} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Broadcast Title</label>
              <Input
                placeholder="e.g. 📢 Platform Maintenance or 🚀 New Feature Available"
                value={broadcastForm.title}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                required
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Type</label>
                <select
                  value={broadcastForm.type}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, type: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-muted/40 text-foreground"
                >
                  <option value="announcement">Announcement</option>
                  <option value="security_alert">Security Alert</option>
                  <option value="system_update">System Update</option>
                  <option value="policy_update">Policy Update</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Target Audience</label>
                <select
                  value={broadcastForm.target_audience}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, target_audience: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-muted/40 text-foreground"
                >
                  <option value="all">All Users (Global)</option>
                  <option value="creators">Verified Creators Only</option>
                  <option value="vendors">Vendors Only</option>
                  <option value="members">Regular Members Only</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Message Content</label>
              <textarea
                placeholder="Write your broadcast message..."
                rows={4}
                value={broadcastForm.body}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, body: e.target.value })}
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-muted/40 text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Action URL (Optional)</label>
                <Input
                  placeholder="/app/communities or /kyc"
                  value={broadcastForm.action_url}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, action_url: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Button Label (Optional)</label>
                <Input
                  placeholder="e.g. Learn More or View"
                  value={broadcastForm.action_label}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, action_label: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowBroadcastModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white gap-1.5">
                {submitting ? <Loader2 weight="fill" className="h-4 w-4 animate-spin" /> : <PaperPlaneTilt weight="fill" className="h-4 w-4" />}
                Broadcast to Users
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Content Dialog (Landing) */}
      <Dialog open={!!editing} onOpenChange={() => { setEditing(null); setMsg(null); }}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border shadow-2xl rounded-lg p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileText weight="fill" className="h-5 w-5 text-[#2164b6] dark:text-[#7ab0ff]" /> Edit: {editing?.label}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Edit the JSON content for this section.</DialogDescription>
          </DialogHeader>
          {msg && <div className={`p-3 rounded-lg text-xs font-bold flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle weight="fill" className="h-4 w-4 shrink-0" />}{msg.text}</div>}
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-64 rounded-lg border-none bg-muted/30 p-4 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#2164b6]/30"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} className="text-xs">Cancel</Button>
            <Button onClick={saveContent} disabled={submitting} className="text-xs font-bold gap-1.5">
              {submitting ? <Loader2 weight="fill" className="h-4 w-4 animate-spin" /> : <FloppyDisk weight="fill" className="h-4 w-4" />}
              Save Content
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Section Dialog (Landing) */}
      <Dialog open={showCreate} onOpenChange={() => { setShowCreate(false); setMsg(null); }}>
        <DialogContent className="sm:max-w-lg md:max-w-xl bg-card border-border shadow-2xl rounded-lg p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold"><FileText weight="fill" className="h-5 w-5 text-[#2164b6] dark:text-[#7ab0ff]" /> Add Section</DialogTitle>
            <DialogDescription className="text-xs">Add a new content section to the {selectedPage} page.</DialogDescription>
          </DialogHeader>
          {msg && <div className={`p-3 rounded-lg text-xs font-bold flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle weight="fill" className="h-4 w-4 shrink-0" />}{msg.text}</div>}
          <form onSubmit={createSection} className="space-y-3">
            <Input name="key" placeholder="Key (e.g. hero)" required className="text-sm" />
            <Input name="label" placeholder="Display label" required className="text-sm" />
            <Input name="type" placeholder="Type (e.g. hero, features, cta)" defaultValue="text" className="text-sm" />
            <Button type="submit" disabled={submitting} className="w-full text-sm font-bold">{submitting ? <Loader2 weight="fill" className="h-4 w-4 animate-spin mr-2" /> : null}Create Section</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
