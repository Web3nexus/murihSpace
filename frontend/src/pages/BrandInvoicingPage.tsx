import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Loader2, CheckCircle, Send, Trash2, Building2, AlertCircle, X, Download, FileSpreadsheet, Sparkles, DollarSign } from 'lucide-react';
import { authFetch } from "@/lib/api/authFetch";
import { useConfirm } from '@/components/ui/DialogProvider';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { SuccessBanner } from '@/components/ui/SuccessBanner';
import { FormErrorSummary } from '@/components/ui/FormErrorSummary';





function formatPrice(cents: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const sym = symbols[currency] ?? currency + ' ';
  return sym + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

interface Invoice {
  id: number; invoice_number: string; brand_name: string;
  brand_email: string | null; amount: number; currency: string;
  description: string | null; status: string;
  due_date: string | null; paid_at: string | null;
  notes: string | null; created_at: string;
  deal: { id: number; title: string } | null;
}

const INVOICE_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted/50 text-muted-foreground border-border/50',
  sent: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  paid: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  overdue: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  cancelled: 'bg-muted text-muted-foreground border-border',
};



export function BrandInvoicingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [deals, setDeals] = useState<{ id: number; title: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    brand_deal_id: '', brand_name: '', brand_email: '',
    amount: '', currency: 'NGN', description: '', due_date: '', notes: '',
  });

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [iRes, dRes] = await Promise.all([
        authFetch(`/brand-invoices`, {  }),
        authFetch(`/brand-deals`, {  }),
      ]);
      if (iRes.ok) { const j = await iRes.json(); setInvoices(j.data?.data ?? []); }
      if (dRes.ok) { const j = await dRes.json(); setDeals(j.data?.data?.map((d: any) => ({ id: d.id, title: d.title })) ?? []); }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function showMsg(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  function resetForm() {
    setForm({ brand_deal_id: '', brand_name: '', brand_email: '', amount: '', currency: 'NGN', description: '', due_date: '', notes: '' });
    setShowForm(false);
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!form.brand_name || !form.amount) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {
        brand_name: form.brand_name, 
        brand_email: form.brand_email || null,
        amount: Math.round(Number(form.amount) * 100), 
        currency: form.currency,
        description: form.description || null, 
        due_date: form.due_date || null,
        notes: form.notes || null,
      };
      if (form.brand_deal_id) body.brand_deal_id = Number(form.brand_deal_id);

      const res = await authFetch(`/brand-invoices`, {
        method: 'POST',  body: JSON.stringify(body),
      });
      if (res.ok) { 
        await fetchAll(); 
        resetForm(); 
        showMsg('success', 'Invoice generated successfully.'); 
      } else { 
        const j = await res.json(); 
        showMsg('error', j.message ?? 'Failed to generate invoice.'); 
      }
    } catch { showMsg('error', 'Network error.'); }
    finally { setSaving(false); }
  }

  async function markSent(id: number) {
    try {
      const res = await authFetch(`/brand-invoices/${id}/mark-sent`, { method: 'POST',  });
      if (res.ok) { await fetchAll(); showMsg('success', 'Invoice marked as sent.'); }
    } catch { showMsg('error', 'Network error.'); }
  }

  async function markPaid(id: number) {
    try {
      const res = await authFetch(`/brand-invoices/${id}/mark-paid`, { method: 'POST',  });
      if (res.ok) { await fetchAll(); showMsg('success', 'Payment recorded!'); }
    } catch { showMsg('error', 'Network error.'); }
  }

  const confirm = useConfirm();

  async function deleteInvoice(id: number) {
    if (!await confirm({ title: "Delete Invoice", message: "Are you sure you want to delete this invoice? This cannot be undone.", variant: "destructive" })) return;
    try {
      const res = await authFetch(`/brand-invoices/${id}`, { method: 'DELETE',  });
      if (res.ok) { await fetchAll(); showMsg('success', 'Invoice deleted.'); }
    } catch { showMsg('error', 'Network error.'); }
  }

  const handleDownloadPDF = (_id: number, invoiceNum: string) => {
    // In a real app, this would trigger a backend PDF generation.
    // For now, we simulate it by calling window.print().
    window.print();
    showMsg('success', `Exporting invoice ${invoiceNum} to PDF...`);
  };

  const totalPending = invoices.filter(i => (i.status === 'draft' || i.status === 'sent') && i.currency === 'NGN').reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid' && i.currency === 'NGN').reduce((s, i) => s + i.amount, 0);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-xl bg-[#2164b6]/20 animate-pulse"></div>
          <Loader2 className="h-10 w-10 animate-spin text-[#2164b6] relative z-10" />
        </div>
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading Invoices...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-6 lg:p-8 animate-in fade-in duration-500 pb-24">
      {/* Header Section */}
      <PageHeader 
        title="Invoicing & Payments"
        description="Generate professional invoices for your brand deals, track sent invoices, and monitor your earnings."
        badge={
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            Brand Partnerships
          </div>
        }
        action={
          <button 
            onClick={() => { if(showForm) resetForm(); else setShowForm(true); }}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-all duration-300 ${
              showForm 
                ? 'bg-muted text-foreground hover:bg-muted/80 shadow-none' 
                : 'bg-gradient-to-r from-[#2164b6] to-[#1a5091] text-white hover:-translate-y-0.5 hover:shadow-[#2164b6]/25'
            }`}
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel Creation' : 'Generate Invoice'}
          </button>
        }
      />

      {message?.type === 'success' && (
        <SuccessBanner message={message.text} onClose={() => setMessage(null)} className="animate-in slide-in-from-top-2" />
      )}
      {message?.type === 'error' && (
        <FormErrorSummary errors={[message.text]} className="animate-in slide-in-from-top-2" />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
        <StatCard icon={FileText} label="Total Invoices" value={String(invoices.length)} color="bg-blue-500 text-blue-500" />
        <StatCard icon={AlertCircle} label="Outstanding" value={formatPrice(totalPending)} color="bg-amber-500 text-amber-500" />
        <StatCard icon={CheckCircle} label="Total Paid" value={formatPrice(totalPaid)} color="bg-emerald-500 text-emerald-500" />
      </div>

      {showForm && (
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl shadow-xl overflow-hidden animate-in slide-in-from-top-4 duration-500">
          <div className="p-6 border-b border-border/50 flex items-center gap-4 bg-background/50">
            <div className="p-2.5 rounded-xl bg-[#2164b6]/10 text-[#2164b6] shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Create New Invoice</h2>
              <p className="text-xs text-muted-foreground mt-1">Fill out the details below to generate a professional PDF invoice for the brand.</p>
            </div>
          </div>
          
          <form onSubmit={createInvoice} className="p-6 space-y-8">
            {/* Brand Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" /> Brand Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Related Brand Deal (Optional)</label>
                  <select 
                    value={form.brand_deal_id} 
                    onChange={e => {
                      const dealId = e.target.value;
                      setForm(f => ({ ...f, brand_deal_id: dealId }));
                      // Auto-fill brand name if possible based on deal
                    }}
                    className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all appearance-none"
                  >
                    <option value="">Select a deal...</option>
                    {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Brand Name</label>
                  <input 
                    value={form.brand_name} 
                    onChange={e => setForm({ ...form, brand_name: e.target.value })} 
                    required
                    placeholder="e.g. Nike, Spotify"
                    className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Brand Contact Email</label>
                  <input 
                    type="email"
                    value={form.brand_email} 
                    onChange={e => setForm({ ...form, brand_email: e.target.value })} 
                    placeholder="billing@brand.com"
                    className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all" 
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-border/50 w-full"></div>

            {/* Invoice Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" /> Invoice Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description of Services</label>
                  <input 
                    value={form.description} 
                    onChange={e => setForm({ ...form, description: e.target.value })} 
                    required
                    placeholder="e.g. 1x Instagram Reel + Link in Bio"
                    className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Due Date</label>
                  <input 
                    type="date"
                    value={form.due_date} 
                    onChange={e => setForm({ ...form, due_date: e.target.value })} 
                    className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all" 
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-border/50 w-full"></div>

            {/* Payment */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" /> Payment Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Currency</label>
                  <select 
                    value={form.currency} 
                    onChange={e => setForm({ ...form, currency: e.target.value })} 
                    className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all appearance-none"
                  >
                    <option value="NGN">NGN (₦)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Amount</label>
                  <input 
                    type="number" min="0" step="0.01"
                    value={form.amount} 
                    onChange={e => setForm({ ...form, amount: e.target.value })} 
                    required
                    placeholder="0.00"
                    className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all text-xl" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Additional Notes or Payment Terms</label>
                <textarea 
                  value={form.notes} 
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. Payment due via wire transfer within 30 days."
                  className="w-full rounded-xl bg-background border border-border/50 p-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all resize-none h-24" 
                />
              </div>
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
                disabled={saving}
                className="px-8 py-3 rounded-xl bg-[#2164b6] text-white text-sm font-bold hover:bg-[#1a5091] hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Generate Invoice
              </button>
            </div>
          </form>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center gap-4 py-24 rounded-3xl border border-dashed border-border/50 bg-card/30 backdrop-blur-sm">
          <div className="w-20 h-20 rounded-3xl bg-[#2164b6]/10 flex items-center justify-center mb-2">
            <FileSpreadsheet className="h-10 w-10 text-[#2164b6]" />
          </div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">No invoices yet</h2>
          <p className="text-sm text-muted-foreground max-w-md">Professionalize your brand deals by generating and sending beautifully formatted PDF invoices.</p>
          <button 
            onClick={() => setShowForm(true)}
            className="mt-4 px-6 py-3 rounded-xl bg-background border border-border/50 text-foreground font-bold hover:bg-muted transition-colors"
          >
            Create First Invoice
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {invoices.map((inv) => (
            <div key={inv.id} className="group relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-5 md:p-6 transition-all duration-300 hover:shadow-lg hover:border-primary/30 flex flex-col h-full">
              
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-muted text-muted-foreground">
                      #{inv.invoice_number}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${INVOICE_STATUS_STYLES[inv.status] || 'bg-muted text-muted-foreground'}`}>
                      {inv.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground truncate">{inv.brand_name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{inv.description || 'No description provided'}</p>
                </div>
                
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black text-foreground">{formatPrice(inv.amount, inv.currency)}</p>
                  {inv.due_date && (
                    <p className={`text-xs font-bold mt-1 ${inv.status === 'overdue' ? 'text-rose-500' : 'text-muted-foreground'}`}>
                      Due: {new Date(inv.due_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Deal Link (Optional) */}
              {inv.deal && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-background border border-border/50 mb-6 mt-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-bold text-foreground">Linked Deal:</span>
                  <span className="text-xs text-muted-foreground truncate">{inv.deal.title}</span>
                </div>
              )}
              {!inv.deal && <div className="mb-6 mt-2"></div>}

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleDownloadPDF(inv.id, inv.invoice_number)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border/50 text-xs font-bold text-foreground hover:bg-muted transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                  {inv.brand_email && inv.status === 'draft' && (
                    <button 
                      onClick={() => markSent(inv.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 text-xs font-bold hover:bg-blue-500 hover:text-white transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" /> Send
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5">
                  {inv.status !== 'paid' && (
                    <button 
                      onClick={() => markPaid(inv.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500 hover:text-white transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
                    </button>
                  )}
                  {inv.status === 'draft' && (
                    <button 
                      onClick={() => deleteInvoice(inv.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                      title="Delete Draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
