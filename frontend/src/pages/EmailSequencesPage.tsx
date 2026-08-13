import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { ListOrdered, Plus, Loader2, Power, PowerOff, Trash2, Clock, Check, X, Settings2, Play, Sparkles, Send, MoveDown } from 'lucide-react';
import { authFetch } from "@/lib/api/authFetch";





interface Step {
  id: number; subject: string; delay_days: number; order: number; content?: string;
}

interface Sequence {
  id: number; title: string; description: string | null;
  trigger_event: string; status: string; is_active: boolean;
  steps_count: number; created_at: string;
  steps: Step[];
}

const TRIGGER_EVENTS = [
  { id: 'purchase', label: 'Product Purchase', icon: '🛒' },
  { id: 'signup', label: 'New Subscriber', icon: '👋' },
  { id: 'subscription', label: 'Paid Subscription', icon: '⭐️' },
  { id: 'abandoned_cart', label: '🛒 Abandoned Cart' },
  { id: 'post_purchase', label: '🎁 Post-Purchase Follow-up' },
];

const triggerLabel = (id: string) => TRIGGER_EVENTS.find(t => t.id === id)?.label ?? id;

export function EmailSequencesPage() {
  const confirm = useConfirm();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: '', description: '', trigger_event: 'signup' });
  
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedStepForm, setExpandedStepForm] = useState<Record<string, { subject: string; content: string; delay: string }>>({});
  
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchAll = useCallback(async () => {
    try {
      const res = await authFetch(`/email-sequences?page=${page}&per_page=20`, {  });
      if (res.ok) { const j = await res.json(); setSequences(j.data?.data ?? []); setLastPage(j.data?.last_page ?? 1); }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [page]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function showMsg(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  function resetForm() { 
    setForm({ title: '', description: '', trigger_event: 'signup' }); 
    setEditId(null); 
    setShowForm(false); 
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `/email-sequences/${editId}` : `/email-sequences`;
    try {
      const res = await authFetch(url, { method,  body: JSON.stringify(form) });
      if (res.ok) { await fetchAll(); resetForm(); showMsg('success', editId ? 'Sequence updated.' : 'Sequence created.'); }
      else { const j = await res.json(); showMsg('error', j.message ?? 'Failed to save sequence.'); }
    } catch { showMsg('error', 'Network error.'); }
  }

  async function toggleSequence(id: number) {
    try {
      await authFetch(`/email-sequences/${id}/toggle`, { method: 'POST',  });
      await fetchAll();
    } catch { /* ignore */ }
  }

  async function deleteSequence(id: number) {
    if (!await confirm({ title: 'Delete Sequence', message: 'Delete this sequence and all its steps? This action cannot be undone.', variant: 'destructive' })) return;
    try { 
      const res = await authFetch(`/email-sequences/${id}`, { method: 'DELETE',  }); 
      await fetchAll(); 
      if (res.ok) showMsg('success', 'Sequence deleted.');
      else showMsg('error', 'Failed to delete sequence.');
    } catch { showMsg('error', 'Network error.'); }
  }

  function getStepFormData(sequenceId: number) {
    return expandedStepForm[`step_${sequenceId}`] || { subject: '', content: '', delay: '1' };
  }

  function updateStepForm(sequenceId: number, field: string, value: string) {
    setExpandedStepForm({
      ...expandedStepForm,
      [`step_${sequenceId}`]: { ...getStepFormData(sequenceId), [field]: value }
    });
  }

  async function addStep(sequenceId: number) {
    const data = getStepFormData(sequenceId);
    if (!data.subject.trim() || !data.content.trim()) {
      showMsg('error', 'Subject and content are required.');
      return;
    }
    try {
      const res = await authFetch(`/email-sequences/${sequenceId}/steps`, {
        method: 'POST', 
        body: JSON.stringify({ 
          subject: data.subject, 
          content: data.content, 
          delay_days: Number(data.delay) || 0 
        }),
      });
      if (res.ok) { 
        await fetchAll(); 
        setExpandedStepForm({ ...expandedStepForm, [`step_${sequenceId}`]: { subject: '', content: '', delay: '1' } }); 
        showMsg('success', 'Step added successfully.');
      } else {
        const j = await res.json();
        showMsg('error', j.message ?? 'Failed to add step.');
      }
    } catch { showMsg('error', 'Network error.'); }
  }

  async function deleteStep(sequenceId: number, stepId: number) {
    if (!await confirm({ title: 'Delete Step', message: 'Remove this email from the sequence?', variant: 'destructive' })) return;
    try {
      const res = await authFetch(`/email-sequences/${sequenceId}/steps/${stepId}`, { method: 'DELETE',  });
      await fetchAll();
      if (res.ok) showMsg('success', 'Step deleted.');
      else showMsg('error', 'Failed to delete step.');
    } catch { showMsg('error', 'Network error.'); }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-xl bg-[#2164b6]/20 animate-pulse"></div>
          <Loader2 className="h-10 w-10 animate-spin text-[#2164b6] relative z-10" />
        </div>
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading Sequences...</p>
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
            Marketing Automation
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            Automated Sequences
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Create email drip campaigns that automatically trigger when users take specific actions.
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
          {showForm ? 'Cancel Creation' : 'New Sequence'}
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
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{editId ? 'Edit Sequence' : 'Configure New Sequence'}</h2>
              <p className="text-xs text-muted-foreground mt-1">Set up the trigger and core details before adding emails.</p>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sequence Title</label>
                  <input 
                    value={form.title} 
                    onChange={e => setForm({ ...form, title: e.target.value })} 
                    required
                    placeholder="e.g. Welcome Series for New Subscribers"
                    className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Trigger Event</label>
                  <select 
                    value={form.trigger_event} 
                    onChange={e => setForm({ ...form, trigger_event: e.target.value })} 
                    className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all appearance-none"
                  >
                    {TRIGGER_EVENTS.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2 flex flex-col h-full">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Internal Description</label>
                <textarea 
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="What is the goal of this sequence? (Only visible to you)"
                  className="w-full flex-1 rounded-xl bg-background border border-border/50 p-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all resize-none min-h-[120px]" 
                />
              </div>
            </div>
            
            <div className="pt-6 border-t border-border/50 flex items-center justify-end gap-3">
              <button 
                type="submit" 
                className="px-8 py-3 rounded-xl bg-[#2164b6] text-white text-sm font-bold hover:bg-[#1a5091] hover:shadow-lg transition-all duration-300"
              >
                {editId ? 'Update Sequence' : 'Create & Add Emails'}
              </button>
            </div>
          </form>
        </div>
      )}

      {sequences.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center gap-4 py-24 rounded-3xl border border-dashed border-border/50 bg-card/30 backdrop-blur-sm">
          <div className="w-20 h-20 rounded-3xl bg-[#2164b6]/10 flex items-center justify-center mb-2">
            <ListOrdered className="h-10 w-10 text-[#2164b6]" />
          </div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">No sequences yet</h2>
          <p className="text-sm text-muted-foreground max-w-md">Build powerful email funnels that run on autopilot to convert followers into customers and welcome new subscribers.</p>
          <button 
            onClick={() => setShowForm(true)}
            className="mt-4 px-6 py-3 rounded-xl bg-background border border-border/50 text-foreground font-bold hover:bg-muted transition-colors"
          >
            Create First Sequence
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sequences.map(s => (
            <div key={s.id} className={`rounded-2xl border ${s.is_active ? 'border-emerald-500/30' : 'border-border/50'} bg-card/50 backdrop-blur-xl overflow-hidden transition-all duration-300`}>
              
              {/* Sequence Header Card */}
              <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${s.is_active ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-muted-foreground/30'}`}></div>
                    <h3 className="text-xl font-bold text-foreground">{s.title}</h3>
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-background border border-border/50 text-muted-foreground flex items-center gap-1">
                      <Play className="w-3 h-3" /> Trigger: {triggerLabel(s.trigger_event)}
                    </span>
                  </div>
                  {s.description && <p className="text-sm text-muted-foreground line-clamp-2 max-w-3xl">{s.description}</p>}
                </div>
                
                <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 border-border/50 pt-4 md:pt-0">
                  <button 
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    className="h-10 px-4 rounded-xl bg-background border border-border/50 text-foreground text-sm font-bold hover:bg-muted transition-colors flex items-center gap-2"
                  >
                    <ListOrdered className="w-4 h-4" /> 
                    {expandedId === s.id ? 'Hide Visual Builder' : `View Flow (${s.steps_count} Steps)`}
                  </button>
                  <button 
                    onClick={() => toggleSequence(s.id)} 
                    className={`h-10 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                      s.is_active 
                        ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white' 
                        : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                    }`}
                  >
                    {s.is_active ? <><PowerOff className="w-4 h-4" /> Pause</> : <><Power className="w-4 h-4" /> Activate</>}
                  </button>
                  <button 
                    onClick={() => deleteSequence(s.id)} 
                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Visual Sequence Builder */}
              {expandedId === s.id && (
                <div className="bg-background/80 border-t border-border/50 p-6 md:p-8 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="max-w-4xl mx-auto space-y-6">
                    
                    <div className="flex justify-center">
                      <div className="px-6 py-3 rounded-full bg-muted border border-border/50 text-sm font-bold text-foreground flex items-center gap-2 shadow-sm">
                        <Play className="w-4 h-4 text-primary" /> User triggers '{triggerLabel(s.trigger_event)}'
                      </div>
                    </div>
                    
                    {(s.steps?.length ?? 0) === 0 ? (
                      <div className="flex flex-col items-center py-8 opacity-50">
                        <MoveDown className="w-6 h-6 text-muted-foreground mb-4" />
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sequence ends immediately</p>
                      </div>
                    ) : (
                      <div className="space-y-6 relative">
                        {/* Connecting Line */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/50 -translate-x-1/2 z-0"></div>
                        
                        {(s.steps ?? []).map((st, idx) => (
                          <div key={st.id} className="relative z-10 flex flex-col items-center">
                            
                            {/* Delay Node */}
                            <div className="bg-background border border-border/50 rounded-full px-4 py-1.5 mb-6 text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 shadow-sm">
                              <Clock className="w-3.5 h-3.5" /> 
                              Wait {st.delay_days} {st.delay_days === 1 ? 'day' : 'days'}
                            </div>
                            
                            {/* Email Card */}
                            <div className="w-full max-w-2xl bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden group transition-all hover:border-primary/30">
                              <div className="p-4 flex items-start gap-4">
                                <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-black text-lg">
                                  {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0 pt-1">
                                  <h4 className="text-sm font-bold text-foreground truncate pr-4">{st.subject}</h4>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1 opacity-70">
                                    {st.content ? st.content.replace(/<[^>]*>?/gm, ' ') : 'No content'}
                                  </p>
                                </div>
                                <button 
                                  onClick={() => deleteStep(s.id, st.id)} 
                                  className="p-2 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add New Step Form */}
                    <div className="relative z-10 flex flex-col items-center pt-6">
                      <div className="bg-background border border-border/50 rounded-full px-4 py-1.5 mb-6 text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 shadow-sm">
                        <Plus className="w-3.5 h-3.5" /> Next Step
                      </div>
                      
                      <div className="w-full max-w-2xl bg-card/30 rounded-2xl border border-dashed border-border/80 p-5 space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-24 shrink-0 space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Wait (Days)</label>
                            <input 
                              type="number" min="0"
                              value={getStepFormData(s.id).delay}
                              onChange={(e) => updateStepForm(s.id, 'delay', e.target.value)}
                              className="w-full h-10 rounded-lg bg-background border border-border/50 px-3 text-sm focus:ring-[#2164b6]/50" 
                            />
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Subject Line</label>
                            <input 
                              type="text"
                              value={getStepFormData(s.id).subject}
                              onChange={(e) => updateStepForm(s.id, 'subject', e.target.value)}
                              placeholder="e.g. Here is your free guide!"
                              className="w-full h-10 rounded-lg bg-background border border-border/50 px-3 text-sm focus:ring-[#2164b6]/50" 
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email Content</label>
                          <textarea 
                            value={getStepFormData(s.id).content}
                            onChange={(e) => updateStepForm(s.id, 'content', e.target.value)}
                            placeholder="Write your email here..."
                            rows={3}
                            className="w-full rounded-lg bg-background border border-border/50 p-3 text-sm focus:ring-[#2164b6]/50 resize-none font-mono" 
                          />
                        </div>
                        <div className="flex justify-end pt-2">
                          <button 
                            onClick={() => addStep(s.id)}
                            className="px-6 py-2.5 rounded-lg bg-foreground text-background text-xs font-bold hover:bg-foreground/90 transition-colors flex items-center gap-2"
                          >
                            <Send className="w-3.5 h-3.5" /> Add Email to Flow
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}
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
