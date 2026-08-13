import { useState, useEffect, useCallback } from "react";
import { Link2, Loader2, Plus, Copy, Check, ShoppingBag, Eye, Pencil, Trash2, X, DollarSign, MousePointerClick, ToggleLeft, ToggleRight, BarChart3, Sparkles, ExternalLink } from "lucide-react";
import { authFetch } from "@/lib/api/authFetch";
import { useConfirm } from "@/components/ui/DialogProvider";
import { StatCard } from "@/components/ui/StatCard";





interface AffiliateProduct {
  id: number; name: string; url: string; commission_rate: number;
  clicks: number; conversions: number; revenue: number;
  is_active: boolean; created_at: string;
}



export default function AffiliateProductsPage() {
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await authFetch(`/affiliate/products?page=${page}&per_page=20`, {  });
      if (!res.ok) throw new Error();
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setProducts(list?.data ?? list ?? []);
      setLastPage(list?.last_page ?? 1);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const resetForm = () => { setName(""); setUrl(""); setRate(""); setEditingId(null); setShowForm(false); };

  const openEdit = (p: AffiliateProduct) => {
    setName(p.name); setUrl(p.url); setRate(String(p.commission_rate));
    setEditingId(p.id); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    try {
      const isEdit = editingId !== null;
      const res = await authFetch(`/affiliate/products${isEdit ? `/${editingId}` : ""}`, {
        method: isEdit ? "PUT" : "POST", 
        body: JSON.stringify({ 
          name: name.trim(), 
          url: url.trim(), 
          commission_rate: Math.min(100, Math.max(0, parseInt(rate, 10) || 0))
        }),
      });
      if (res.ok) {
        showMsg('success', isEdit ? 'Product updated successfully.' : 'Product added successfully.');
        resetForm();
        fetchProducts();
      } else {
        const j = await res.json();
        showMsg('error', j.message ?? 'Failed to save product.');
      }
    } catch { showMsg('error', 'Network error.'); }
    finally { setSaving(false); }
  };

  const confirm = useConfirm();

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: "Delete Affiliate Product", message: "Are you sure you want to delete this product? Analytics data will be lost.", variant: "destructive" })) return;
    try {
      const res = await authFetch(`/affiliate/products/${id}`, { method: "DELETE",  });
      if (res.ok) {
        showMsg('success', 'Product deleted.');
        fetchProducts();
      } else {
        showMsg('error', 'Failed to delete product.');
      }
    } catch { showMsg('error', 'Network error.'); }
  };

  const handleToggleStatus = async (p: AffiliateProduct) => {
    try {
      const res = await authFetch(`/affiliate/products/${p.id}`, {
        method: "PUT", 
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      if (res.ok) fetchProducts();
      else showMsg('error', 'Failed to toggle product status.');
    } catch { showMsg('error', 'Network error.'); }
  };

  const copyLink = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalClicks = products.reduce((s, p) => s + p.clicks, 0);
  const totalConversions = products.reduce((s, p) => s + p.conversions, 0);
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const convRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : "—";

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="relative">
        <div className="absolute inset-0 rounded-full blur-xl bg-[#2164b6]/20 animate-pulse"></div>
        <Loader2 className="h-10 w-10 animate-spin text-[#2164b6] relative z-10" />
      </div>
      <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading Products...</p>
    </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-6 lg:p-8 animate-in fade-in duration-500 pb-24">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-20">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Monetization
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            Affiliate Products
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Promote products to your audience, generate trackable links, and earn commissions on every successful referral.
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
          {showForm ? 'Cancel Creation' : 'Add New Product'}
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

      {/* Summary Cards */}
      {products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 animate-in slide-in-from-bottom-4 duration-500">
          <StatCard icon={ShoppingBag} label="Active Links" value={String(products.length)} color="bg-blue-500 text-blue-500" />
          <StatCard icon={MousePointerClick} label="Total Clicks" value={totalClicks.toLocaleString()} color="bg-amber-500 text-amber-500" />
          <StatCard icon={BarChart3} label="Conversion Rate" value={`${convRate}${convRate !== "—" ? "%" : ""}`} color="bg-emerald-500 text-emerald-500" />
          <StatCard icon={DollarSign} label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} color="bg-purple-500 text-purple-500" />
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl shadow-xl overflow-hidden animate-in slide-in-from-top-4 duration-500">
          <div className="p-6 border-b border-border/50 flex items-center gap-4 bg-background/50">
            <div className="p-2.5 rounded-xl bg-[#2164b6]/10 text-[#2164b6] shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{editingId ? 'Edit Affiliate Product' : 'Add Affiliate Product'}</h2>
              <p className="text-xs text-muted-foreground mt-1">Provide the details to generate your unique tracking link.</p>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Product Name</label>
                <input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required
                  placeholder="e.g. Premium Hosting Plan"
                  className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Commission Rate (%)</label>
                <input 
                  type="number" min="0" max="100"
                  value={rate} 
                  onChange={e => setRate(e.target.value)} 
                  placeholder="e.g. 15"
                  className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all" 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Destination URL</label>
              <input 
                type="url"
                value={url} 
                onChange={e => setUrl(e.target.value)} 
                required
                placeholder="https://example.com/product"
                className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 transition-all" 
              />
            </div>
            
            <div className="pt-6 border-t border-border/50 flex items-center justify-end gap-3">
              <button 
                type="button" 
                onClick={resetForm}
                className="px-6 py-3 rounded-xl bg-muted text-foreground text-sm font-bold hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={saving}
                className="px-8 py-3 rounded-xl bg-[#2164b6] text-white text-sm font-bold hover:bg-[#1a5091] hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Update Product' : 'Generate Trackable Link'}
              </button>
            </div>
          </form>
        </div>
      )}

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center gap-4 py-24 rounded-3xl border border-dashed border-border/50 bg-card/30 backdrop-blur-sm">
          <div className="w-20 h-20 rounded-3xl bg-[#2164b6]/10 flex items-center justify-center mb-2">
            <Link2 className="h-10 w-10 text-[#2164b6]" />
          </div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">No products yet</h2>
          <p className="text-sm text-muted-foreground max-w-md">Start monetizing your audience by promoting affiliate products and tracking performance in real-time.</p>
          <button 
            onClick={() => setShowForm(true)}
            className="mt-4 px-6 py-3 rounded-xl bg-background border border-border/50 text-foreground font-bold hover:bg-muted transition-colors"
          >
            Add First Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => {
            const trackingUrl = `${import.meta.env.VITE_PUBLIC_LINK_BASE_URL || import.meta.env.VITE_API_BASE_URL.replace("/api/v1", "")}/api/v1/l/affiliate/${p.id}`;
            const itemConvRate = p.clicks > 0 ? ((p.conversions / p.clicks) * 100).toFixed(1) : "0.0";
            
            return (
              <div key={p.id} className={`group relative rounded-2xl border ${p.is_active ? 'border-border/50 hover:border-primary/30' : 'border-border/30 opacity-75'} bg-card/50 backdrop-blur-xl p-5 md:p-6 transition-all duration-300 flex flex-col h-full`}>
                
                {/* Header Info */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-foreground truncate" title={p.name}>{p.name}</h3>
                      {!p.is_active && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">Inactive</span>
                      )}
                    </div>
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 w-fit max-w-full">
                      <span className="truncate">{p.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                  
                  <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex-col group-hover:scale-105 transition-transform">
                    <span className="text-[10px] font-bold uppercase tracking-wider -mb-1 opacity-70">Rate</span>
                    <span className="text-sm font-black">{p.commission_rate}%</span>
                  </div>
                </div>
                
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6 mt-auto">
                  <div className="bg-background rounded-xl border border-border/50 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Eye className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Clicks</span>
                    </div>
                    <p className="text-lg font-black text-foreground">{p.clicks}</p>
                  </div>
                  <div className="bg-background rounded-xl border border-border/50 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Sales</span>
                    </div>
                    <p className="text-lg font-black text-foreground">{p.conversions}</p>
                  </div>
                  <div className="bg-background rounded-xl border border-border/50 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Conv.</span>
                    </div>
                    <p className="text-lg font-black text-foreground">{itemConvRate}%</p>
                  </div>
                  <div className="bg-background rounded-xl border border-border/50 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Earned</span>
                    </div>
                    <p className="text-lg font-black text-emerald-500">${p.revenue.toFixed(2)}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto">
                  <button 
                    onClick={() => copyLink(trackingUrl, p.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      copiedId === p.id 
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                        : 'bg-background border border-border/50 text-foreground hover:bg-muted'
                    }`}
                  >
                    {copiedId === p.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === p.id ? "Copied!" : "Copy Link"}
                  </button>
                  
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleToggleStatus(p)} 
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title={p.is_active ? "Deactivate" : "Activate"}
                    >
                      {p.is_active ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => openEdit(p)} 
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Edit Product"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(p.id)} 
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
              </div>
            );
          })}
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
