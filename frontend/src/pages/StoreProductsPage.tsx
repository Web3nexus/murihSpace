import { useState, useEffect, useCallback } from "react";
import { useConfirm } from "@/components/ui/DialogProvider";
import { Package, Plus, Loader2, Edit, Trash2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface StoreProduct {
  id: number;
  title: string;
  price: number;
  currency: string;
  type: "digital" | "physical";
  status: "draft" | "published";
  sales_count?: number;
  created_at: string;
}

export default function StoreProductsPage() {
  const confirm = useConfirm();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("19.99");
  const [currency, setCurrency] = useState("USD");
  const [productType, setProductType] = useState<"digital" | "physical">("digital");

  const fetchProducts = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/store/products?page=${page}&per_page=20`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load products");
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setProducts(list?.data ?? list ?? []);
      setLastPage(list?.last_page ?? 1);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load products");
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const resetForm = () => { setTitle(""); setPrice("19.99"); setCurrency("USD"); setProductType("digital"); setEditing(null); setShowForm(false); setMsg(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const body = { title: title.trim(), price: Math.round(parseFloat(price) * 100), currency, type: productType };
      const res = editing
        ? await fetch(`${API_BASE}/store/products/${editing.id}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(body) })
        : await fetch(`${API_BASE}/store/products`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      resetForm();
      fetchProducts();
      setMsg({ ok: true, text: editing ? "Product updated." : "Product created." });
      setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
    } finally { setSaving(false); }
  };

  const togglePublish = async (p: StoreProduct) => {
    await fetch(`${API_BASE}/store/products/${p.id}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify({ status: p.status === "published" ? "draft" : "published" }) });
    fetchProducts();
  };

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: 'Delete Product', message: 'Delete this product?', variant: 'destructive' })) return;
    await fetch(`${API_BASE}/store/products/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    fetchProducts();
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Package className="h-6 w-6 text-[#38A8D8]" /> Products
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Manage your digital and physical products.</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="text-sm font-bold gap-1.5">
          <Plus className="h-4 w-4" /> New Product
        </Button>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => fetchProducts()} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="border border-border rounded-2xl bg-card p-6 space-y-4">
          {msg && <div className={`p-3 rounded-xl text-xs font-bold ${msg.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>{msg.text}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product name" required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Type</label>
              <select value={productType} onChange={(e) => setProductType(e.target.value as "digital" | "physical")} className="w-full rounded-xl border border-border bg-card p-2.5 text-sm font-medium text-foreground">
                <option value="digital">Digital Download</option>
                <option value="physical">Physical Product</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Price</label>
              <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-xl border border-border bg-card p-2.5 text-sm font-medium text-foreground">
                {["USD", "NGN", "GBP", "EUR"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving || !title.trim()} className="text-sm font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editing ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm} className="text-sm">Cancel</Button>
          </div>
        </form>
      )}

      {products.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card">
          <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-bold">No products yet</h3>
          <p className="text-xs text-muted-foreground mt-1">Create your first product.</p>
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border">
                <tr className="text-left">
                  {["Product", "Type", "Price", "Sales", "Status", ""].map((h) => <th key={h} className="px-4 py-3 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{p.title}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.type === 'digital' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>{p.type}</span></td>
                    <td className="px-4 py-3 font-mono font-bold text-foreground">{p.currency} {p.price ? (p.price / 100).toFixed(2) : "0.00"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.sales_count ?? 0}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{p.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => togglePublish(p)}>{p.status === 'published' ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setEditing(p); setTitle(p.title); setPrice(String(p.price / 100)); setCurrency(p.currency); setProductType(p.type); setShowForm(true); setMsg(null); }}><Edit className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
