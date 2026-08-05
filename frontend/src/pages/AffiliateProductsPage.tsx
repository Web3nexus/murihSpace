import { useState, useEffect, useCallback } from "react";
import { Link2, Loader2, Plus, Copy, Check, ShoppingBag, Eye, Pencil, Trash2, X, DollarSign, MousePointerClick, ToggleLeft, ToggleRight, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";
import { useConfirm } from "@/components/ui/DialogProvider";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

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

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/affiliate/products?page=${page}&per_page=20`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setProducts(list?.data ?? list ?? []);
      setLastPage(list?.last_page ?? 1);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const resetForm = () => { setName(""); setUrl(""); setRate(""); setEditingId(null); setShowForm(false); };

  const openEdit = (p: AffiliateProduct) => {
    setName(p.name); setUrl(p.url); setRate(String(p.commission_rate));
    setEditingId(p.id); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    try {
      const isEdit = editingId !== null;
      await fetch(`${API_BASE}/affiliate/products${isEdit ? `/${editingId}` : ""}`, {
        method: isEdit ? "PUT" : "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ name: name.trim(), url: url.trim(), commission_rate: parseInt(rate) || 0 }),
      });
      resetForm();
      fetchProducts();
    } finally { setSaving(false); }
  };

  const confirm = useConfirm();

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: "Delete Affiliate Product", message: "Delete this affiliate product?", variant: "destructive" })) return;
    try {
      await fetch(`${API_BASE}/affiliate/products/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      fetchProducts();
    } catch { /* ignore */ }
  };

  const handleToggleStatus = async (p: AffiliateProduct) => {
    try {
      const res = await fetch(`${API_BASE}/affiliate/products/${p.id}`, {
        method: "PUT", headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      if (res.ok) fetchProducts();
    } catch { /* ignore */ }
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

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Link2 className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Affiliate Products
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Promote affiliate links and track referral commissions.</p>
        </div>
        <Button size="sm" className="bg-[#2164b6] hover:bg-[#1a5091] text-white text-xs font-bold"
          onClick={() => { resetForm(); setShowForm(!showForm); }}>
          <Plus className="h-4 w-4 mr-1" /> {showForm ? "Cancel" : "Add Product"}
        </Button>
      </div>

      {/* Summary Cards */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><ShoppingBag className="h-5 w-5 text-blue-500" /></div>
              <div><p className="text-2xl font-bold">{products.length}</p><p className="text-xs text-muted-foreground">Products</p></div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><MousePointerClick className="h-5 w-5 text-amber-500" /></div>
              <div><p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Clicks</p></div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><BarChart3 className="h-5 w-5 text-emerald-500" /></div>
              <div><p className="text-2xl font-bold">{convRate}{convRate !== "—" ? "%" : ""}</p><p className="text-xs text-muted-foreground">Conversion Rate</p></div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-purple-500" /></div>
              <div><p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p><p className="text-xs text-muted-foreground">Revenue</p></div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">{editingId ? "Edit Product" : "New Product"}</span>
            {editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm} className="h-6 w-6 p-0">
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Product name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hosting plan" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Affiliate URL</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Commission rate (%)</label>
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="10" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" className="bg-[#2164b6] hover:bg-[#1a5091] text-white text-xs font-bold" disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} {editingId ? "Update" : "Save"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={resetForm} className="text-xs">Cancel</Button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {products.length === 0 && (
          <p className="text-xs text-muted-foreground p-8 text-center">No affiliate products yet. Add your first one!</p>
        )}
        {products.map((p) => {
          const trackingUrl = `${API_BASE.replace("/api/v1", "")}/api/v1/l/affiliate/${p.id}`;
          return (
          <div key={p.id} className="p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground truncate">{p.name}</p>
                {!p.is_active && (
                  <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5">inactive</span>
                )}
                <span className="text-[10px] font-bold text-emerald-400 ml-auto">{p.commission_rate}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{p.url}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {p.clicks} clicks
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <ShoppingBag className="h-3 w-3" /> {p.conversions} conversions
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> ${p.revenue.toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {p.clicks > 0 ? `${((p.conversions / p.clicks) * 100).toFixed(1)}% conv` : "—"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleToggleStatus(p)} title={p.is_active ? "Deactivate" : "Activate"}>
                {p.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(p)} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-300" onClick={() => handleDelete(p.id)} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="text-[10px] font-bold gap-1.5"
                onClick={() => copyLink(trackingUrl, p.id)}>
                {copiedId === p.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedId === p.id ? "Copied!" : "Copy Link"}
              </Button>
            </div>
          </div>
          );
        })}
      </div>
      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Previous</button>
          <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
          <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
