import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { SendHorizonal, Plus, Loader2, Building2, Trash2, Check, X, Sparkles } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/api/authFetch";





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

const KANBAN_STAGES = [
  { id: 'draft', label: 'Drafts', color: 'bg-muted/50 border-border/50 text-muted-foreground' },
  { id: 'sent', label: 'Pitched', color: 'bg-blue-500/10 border-blue-500/20 text-blue-500' },
  { id: 'viewed', label: 'Negotiating', color: 'bg-purple-500/10 border-purple-500/20 text-purple-500' },
  { id: 'accepted', label: 'Accepted', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' },
  { id: 'declined', label: 'Declined', color: 'bg-rose-500/10 border-rose-500/20 text-rose-500' },
];

export function ProposalsPage() {
  const confirm = useConfirm();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    brand_id: '', brand_name: '', brand_email: '',
    title: '', pitch: '', proposed_budget: '', currency: 'NGN', deliverables: '',
  });
  
  // Drag and Drop state
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [pRes, bRes] = await Promise.all([
        // Fetch all proposals for Kanban
        authFetch(`/brand-proposals?page=1&per_page=100`, {  }),
        authFetch(`/brands`, {  }),
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

  function showMsg(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  async function createProposal(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body: Record<string, any> = {
        title: form.title, pitch: form.pitch, currency: form.currency,
        deliverables: form.deliverables || null,
        proposed_budget: form.proposed_budget ? Number(form.proposed_budget) * 100 : null,
      };
      if (form.brand_id) { body.brand_id = Number(form.brand_id); }
      else { body.brand_name = form.brand_name; body.brand_email = form.brand_email || null; }

      const res = await authFetch(`/brand-proposals`, {
        method: 'POST',  body: JSON.stringify(body),
      });
      if (res.ok) { await fetchAll(); resetForm(); showMsg('success', 'Pitch created successfully!'); }
      else { const j = await res.json(); showMsg('error', j.message ?? 'Failed to create pitch.'); }
    } catch { showMsg('error', 'Network error.'); }
  }

  async function deleteProposal(id: number, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!await confirm({ title: 'Delete Proposal', message: 'Delete this proposal?', variant: 'destructive' })) return;
    try {
      const res = await authFetch(`/brand-proposals/${id}`, { method: 'DELETE',  });
      if (res.ok) { await fetchAll(); showMsg('success', 'Proposal deleted.'); }
    } catch { showMsg('error', 'Network error.'); }
  }

  // Handle status update (drag & drop or select)
  async function updateStatus(proposalId: number, statusId: string) {
    if (['viewed', 'accepted'].includes(statusId)) {
      showMsg('error', 'Only the brand can mark a proposal as viewed or accepted.');
      return;
    }

    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal || proposal.status === statusId) return;

    // Optimistic UI update
    setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: statusId } : p));
    
    try {
      const res = await authFetch(`/brand-proposals/${proposalId}`, {
        method: 'PUT',
        
        body: JSON.stringify({ status: statusId }),
      });
      if (!res.ok) {
        if (statusId === 'sent' && proposal.status === 'draft') {
            await authFetch(`/brand-proposals/${proposalId}/send`, { method: 'POST',  });
        } else {
            const j = await res.json();
            showMsg('error', j.message ?? 'Failed to update status.');
            await fetchAll();
        }
      }
    } catch {
      await fetchAll(); // Revert on error
      showMsg('error', 'Network error while updating status.');
    }
  }

  function handleDrop(e: React.DragEvent, statusId: string) {
    e.preventDefault();
    setDragOverColumn(null);
    if (draggedItem) {
      updateStatus(draggedItem, statusId);
      setDraggedItem(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-xl bg-[#2164b6]/20 animate-pulse"></div>
          <Loader2 className="h-10 w-10 animate-spin text-[#2164b6] relative z-10" />
        </div>
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading Kanban board...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-6 lg:p-8 animate-in fade-in duration-500 overflow-hidden">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 mb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Brand Partnerships
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            Outreach & Proposals
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Pitch brands, manage your pipeline, and close sponsorships faster with a visual Kanban board.
          </p>
        </div>
        
        <button 
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-all duration-300 ${
            showForm 
              ? 'bg-muted text-foreground hover:bg-muted/80 shadow-none' 
              : 'bg-gradient-to-r from-[#2164b6] to-[#1a5091] text-white hover:-translate-y-0.5 hover:shadow-[#2164b6]/25'
          }`}
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Close Pitch Editor' : 'New Pitch Proposal'}
        </button>
      </div>

      {message && (
        <div className={`shrink-0 p-4 rounded-xl border text-sm font-bold flex items-center gap-2 mb-6 animate-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : null}
          {message.text}
        </div>
      )}

      {showForm && (
        <div className="shrink-0 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-6 shadow-xl mb-6 animate-in slide-in-from-top-4 duration-500">
          <div className="mb-6 flex items-center gap-3 border-b border-border/50 pb-4">
            <div className="p-2 rounded-lg bg-[#2164b6]/10 text-[#2164b6]">
              <SendHorizonal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Draft a New Pitch</h2>
              <p className="text-xs text-muted-foreground">Select a brand from our network or pitch an external brand.</p>
            </div>
          </div>
          
          <form onSubmit={createProposal} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Target Brand</Label>
                  <Select value={form.brand_id} onValueChange={v => setForm({ ...form, brand_id: v })}>
                    <SelectTrigger className="w-full h-12 rounded-xl border-border/50 bg-background/50 focus:ring-[#2164b6]/50">
                      <SelectValue placeholder="Select a registered brand..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">External Brand (Not in network)</SelectItem>
                      {brands.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                {(!form.brand_id || form.brand_id === 'none') && (
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-border/50 bg-muted/20 animate-in fade-in">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Brand Name</Label>
                      <Input value={form.brand_name} onChange={e => setForm({ ...form, brand_name: e.target.value })} className="h-10 rounded-lg bg-background" placeholder="Nike, Apple..." required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contact Email</Label>
                      <Input type="email" value={form.brand_email} onChange={e => setForm({ ...form, brand_email: e.target.value })} className="h-10 rounded-lg bg-background" placeholder="pr@brand.com" required />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pitch Title</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className="h-12 rounded-xl bg-background/50 border-border/50 focus:ring-[#2164b6]/50" placeholder="e.g. Sponsored TikTok Integration for Q4" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Budget</Label>
                    <div className="flex gap-2">
                      <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                        <SelectTrigger className="w-24 h-12 rounded-xl border-border/50 bg-background/50 focus:ring-[#2164b6]/50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NGN">NGN</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" min="0" value={form.proposed_budget} onChange={e => setForm({ ...form, proposed_budget: e.target.value })} className="flex-1 h-12 rounded-xl bg-background/50 border-border/50 focus:ring-[#2164b6]/50" placeholder="500,000" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Deliverables</Label>
                    <Input value={form.deliverables} onChange={e => setForm({ ...form, deliverables: e.target.value })} className="h-12 rounded-xl bg-background/50 border-border/50 focus:ring-[#2164b6]/50" placeholder="1x Reel, 2x Stories" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 flex flex-col h-full">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">The Pitch</Label>
                <Textarea 
                  value={form.pitch} 
                  onChange={e => setForm({ ...form, pitch: e.target.value })} 
                  required 
                  className="flex-1 min-h-[200px] rounded-xl bg-background/50 border-border/50 focus:ring-[#2164b6]/50 resize-none p-4" 
                  placeholder="Introduce yourself, highlight your audience demographics, and explain exactly why your content is the perfect fit for their upcoming campaign..." 
                />
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-border/50">
              <button type="submit" className="px-8 py-3 rounded-xl bg-[#2164b6] text-white text-sm font-bold hover:bg-[#1a5091] hover:shadow-lg transition-all duration-300">
                Save to Pipeline
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
        {KANBAN_STAGES.map(stage => {
          const stageProposals = proposals.filter(p => p.status === stage.id);
          
          return (
            <div 
              key={stage.id} 
              className={`flex flex-col min-w-[320px] max-w-[320px] rounded-2xl bg-muted/30 border border-border/50 overflow-hidden transition-colors duration-300 ${dragOverColumn === stage.id ? 'bg-muted/60 border-primary/50 border-dashed' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverColumn(stage.id); }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Column Header */}
              <div className={`p-4 border-b border-border/50 flex items-center justify-between backdrop-blur-md`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${stage.color.split(' ')[0].replace('/10', '')}`}></span>
                  <h3 className="font-bold text-foreground">{stage.label}</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-background text-xs font-bold text-muted-foreground shadow-sm">
                  {stageProposals.length}
                </span>
              </div>
              
              {/* Column Content */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
                {stageProposals.length === 0 ? (
                  <div className="h-full flex items-center justify-center p-8 text-center border-2 border-dashed border-transparent rounded-xl">
                    <p className="text-xs font-medium text-muted-foreground/50">Drop pitches here</p>
                  </div>
                ) : (
                  stageProposals.map(p => (
                    <div 
                      key={p.id} 
                      draggable
                      onDragStart={(e) => { setDraggedItem(p.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => { setDraggedItem(null); setDragOverColumn(null); }}
                      className="group cursor-grab active:cursor-grabbing rounded-xl bg-card border border-border/50 p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 truncate">
                          <div className={`p-1.5 rounded-lg ${stage.color}`}>
                            <Building2 className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-foreground truncate">{p.brand?.name ?? p.brand_name}</span>
                        </div>
                        <button onClick={(e) => deleteProposal(p.id, e)} className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      <h4 className="text-sm font-bold text-foreground leading-tight mb-2 line-clamp-2">{p.title}</h4>
                      
                      <div className="flex items-center justify-between mt-4">
                        {p.proposed_budget ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                            {formatPrice(p.proposed_budget, p.currency)}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">TBD</span>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                          
                          <select 
                            value={p.status}
                            onChange={(e) => updateStatus(p.id, e.target.value)}
                            className="text-[10px] bg-muted/50 border border-border/50 rounded px-1 py-0.5 text-muted-foreground outline-none focus:ring-1 focus:ring-primary md:sr-only md:focus:not-sr-only"
                            aria-label="Change status"
                          >
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="declined">Declined</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(150, 150, 150, 0.4); }
      `}} />
    </div>
  );
}
