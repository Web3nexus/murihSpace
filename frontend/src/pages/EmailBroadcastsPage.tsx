import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { Mail, Loader2, Send, Edit2, Trash2, Check, Eye, MousePointerClick, Plus, Sparkles, X, Clock, BarChart2 } from 'lucide-react';
import { authFetch } from "@/lib/api/authFetch";





interface Broadcast {
  id: number;
  title: string;
  subject: string;
  content: string;
  status: string;
  sent_count: number;
  recipient_count: number;
  open_count: number;
  click_count: number;
  sent_at: string | null;
}

const statusStyles: Record<string, string> = {
  draft: 'bg-muted/50 text-muted-foreground border-border/50',
  sending: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  sent: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  cancelled: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
};

export function EmailBroadcastsPage() {
  const confirm = useConfirm();
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
      const res = await authFetch(`/email-broadcasts?page=${page}&per_page=20`, {  });
      if (res.ok) { const j = await res.json(); setBroadcasts(j.data?.data ?? []); setLastPage(j.data?.last_page ?? 1); }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [page]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function resetForm() { setForm({ title: '', subject: '', content: '' }); setEditId(null); setShowForm(false); }

  function showMsg(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `/email-broadcasts/${editId}` : `/email-broadcasts`;
    try {
      const res = await authFetch(url, { method,  body: JSON.stringify(form) });
      if (res.ok) { await fetchAll(); resetForm(); showMsg('success', editId ? 'Broadcast updated.' : 'Broadcast saved to drafts.'); }
      else { const j = await res.json(); showMsg('error', j.message ?? 'Failed to save broadcast.'); }
    } catch { showMsg('error', 'Network error.'); }
  }

  async function sendBroadcast(id: number) {
    if (!await confirm({ title: 'Send Broadcast', message: 'Send this broadcast to all your subscribers immediately?' })) return;
    try {
      const res = await authFetch(`/email-broadcasts/${id}/send`, { method: 'POST',  });
      if (res.ok) { await fetchAll(); showMsg('success', 'Broadcast sent successfully!'); }
      else { const j = await res.json(); showMsg('error', j.message ?? 'Failed to send broadcast.'); }
    } catch { showMsg('error', 'Network error.'); }
  }

  async function deleteBroadcast(id: number) {
    if (!await confirm({ title: 'Delete Broadcast', message: 'Delete this broadcast? This cannot be undone.', variant: 'destructive' })) return;
    try { 
      const res = await authFetch(`/email-broadcasts/${id}`, { method: 'DELETE',  }); 
      await fetchAll(); 
      if (res.ok) showMsg('success', 'Broadcast deleted.');
      else showMsg('error', 'Failed to delete broadcast.');
    } catch { showMsg('error', 'Network error.'); }
  }

  function startEdit(b: Broadcast) {
    setForm({ title: b.title, subject: b.subject, content: b.content || '' });
    setEditId(b.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-xl bg-[#2164b6]/20 animate-pulse"></div>
          <Loader2 className="h-10 w-10 animate-spin text-[#2164b6] relative z-10" />
        </div>
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading Broadcasts...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-6 lg:p-8 animate-in fade-in duration-500 pb-24">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-20">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Engage Your Audience
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            Email Broadcasts
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Send newsletters, announcements, and product updates to your community directly to their inbox.
          </p>
        </div>
        
        <button 
          onClick={() => { if(showForm) resetForm(); else setShowForm(true); }}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-all duration-300 ${
            showForm 
              ? 'bg-muted text-foreground hover:bg-muted/80 shadow-none' 
              : 'bg-gradient-to-r from-[#2164b6] to-[#1a5091] text-white hover:-translate-y-0.5 hover:shadow-[#2164b6]/25'
          }`}
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel Compose' : 'Compose Email'}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : null}
          {message.text}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl shadow-xl overflow-hidden animate-in slide-in-from-top-4 duration-500">
          <div className="p-6 border-b border-border/50 flex items-center gap-4 bg-background/50">
            <div className="p-2.5 rounded-xl bg-[#2164b6]/10 text-[#2164b6] shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{editId ? 'Edit Draft' : 'New Broadcast'}</h2>
              <p className="text-xs text-muted-foreground mt-1">Design your email and send it to your entire subscriber list.</p>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Internal Campaign Name</label>
                <input 
                  value={form.title} 
                  onChange={e => setForm({ ...form, title: e.target.value })} 
                  required
                  placeholder="e.g. November Newsletter"
                  className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Subject Line</label>
                <input 
                  value={form.subject} 
                  onChange={e => setForm({ ...form, subject: e.target.value })} 
                  required
                  placeholder="e.g. Exciting updates for this month! 🎉"
                  className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all" 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Content (HTML)</label>
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">Supports standard HTML tags</span>
              </div>
              <textarea 
                value={form.content} 
                onChange={e => setForm({ ...form, content: e.target.value })} 
                required
                rows={12} 
                placeholder="<h1>Hello!</h1><p>Write your email content here...</p>"
                className="w-full rounded-xl bg-background border border-border/50 p-4 text-sm font-mono focus:ring-2 focus:ring-[#2164b6]/50 transition-all resize-y" 
              />
            </div>
            
            <div className="pt-6 border-t border-border/50 flex items-center justify-end gap-3">
              <button 
                type="button"
                onClick={resetForm}
                className="px-6 py-3 rounded-xl bg-muted text-foreground text-sm font-bold hover:bg-muted/80 transition-colors"
              >
                Discard
              </button>
              <button 
                type="submit" 
                className="px-8 py-3 rounded-xl bg-[#2164b6] text-white text-sm font-bold hover:bg-[#1a5091] hover:shadow-lg transition-all duration-300"
              >
                {editId ? 'Update Draft' : 'Save to Drafts'}
              </button>
            </div>
          </form>
        </div>
      )}

      {broadcasts.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center gap-4 py-24 rounded-3xl border border-dashed border-border/50 bg-card/30 backdrop-blur-sm">
          <div className="w-20 h-20 rounded-3xl bg-[#2164b6]/10 flex items-center justify-center mb-2">
            <Mail className="h-10 w-10 text-[#2164b6]" />
          </div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">No broadcasts yet</h2>
          <p className="text-sm text-muted-foreground max-w-md">Start engaging your audience by creating your first email broadcast. Send newsletters, announcements, or exclusive offers.</p>
          <button 
            onClick={() => setShowForm(true)}
            className="mt-4 px-6 py-3 rounded-xl bg-background border border-border/50 text-foreground font-bold hover:bg-muted transition-colors"
          >
            Create First Broadcast
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {broadcasts.map(b => (
            <div key={b.id} className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-5 md:p-6 transition-all duration-300 hover:shadow-lg hover:border-primary/30">
              
              {/* Status Glow */}
              <div className={`absolute -right-16 -top-16 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 ${
                b.status === 'sent' ? 'bg-emerald-500' : b.status === 'draft' ? 'bg-muted-foreground' : 'bg-blue-500'
              }`}></div>
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-foreground leading-tight">{b.title}</h3>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusStyles[b.status] || 'bg-muted text-muted-foreground'}`}>
                        {b.status === 'sent' && <Check className="w-3 h-3" />}
                        {b.status === 'draft' && <Edit2 className="w-3 h-3" />}
                        {b.status === 'sending' && <Loader2 className="w-3 h-3 animate-spin" />}
                        {b.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground"><span className="text-foreground/50 mr-1">Subject:</span> {b.subject}</p>
                  </div>
                  
                  {b.status === 'sent' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-background border border-border/50">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Send className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Delivered</span>
                        </div>
                        <p className="text-lg font-black text-foreground">{b.sent_count}<span className="text-xs text-muted-foreground font-medium ml-1">/ {b.recipient_count}</span></p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Eye className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Opens</span>
                        </div>
                        <p className="text-lg font-black text-foreground">{b.open_count}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MousePointerClick className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Clicks</span>
                        </div>
                        <p className="text-lg font-black text-foreground">{b.click_count}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Sent On</span>
                        </div>
                        <p className="text-sm font-bold text-foreground truncate mt-1">
                          {b.sent_at ? new Date(b.sent_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 shrink-0 md:pt-1 border-t md:border-t-0 border-border/50 pt-4 md:pl-4">
                  {b.status === 'draft' && (
                    <>
                      <button 
                        onClick={() => startEdit(b)} 
                        className="h-10 px-4 rounded-xl bg-background border border-border/50 text-foreground text-sm font-bold hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" /> Edit
                      </button>
                      <button 
                        onClick={() => sendBroadcast(b.id)} 
                        className="h-10 px-4 rounded-xl bg-[#2164b6] text-white text-sm font-bold hover:bg-[#1a5091] hover:shadow-lg transition-all flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" /> Send Now
                      </button>
                    </>
                  )}
                  {b.status === 'sent' && (
                    <button 
                      disabled
                      title="Reporting is not available yet"
                      className="h-10 px-4 rounded-xl bg-background border border-border/50 text-foreground text-sm font-bold hover:bg-muted transition-colors flex items-center gap-2 opacity-50 cursor-not-allowed"
                    >
                      <BarChart2 className="w-4 h-4" /> Report
                    </button>
                  )}
                  <button 
                    onClick={() => deleteBroadcast(b.id)} 
                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors ml-2"
                    title="Delete Broadcast"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-4 pt-8">
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page <= 1} 
            className="px-4 py-2 rounded-xl bg-background border border-border/50 text-sm font-bold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Page <span className="text-foreground mx-1">{page}</span> of <span className="text-foreground ml-1">{lastPage}</span>
          </span>
          <button 
            onClick={() => setPage(p => Math.min(lastPage, p + 1))} 
            disabled={page >= lastPage} 
            className="px-4 py-2 rounded-xl bg-background border border-border/50 text-sm font-bold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
