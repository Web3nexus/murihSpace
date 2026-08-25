import { useState, useEffect, useCallback } from "react";
import { useConfirm } from "@/components/ui/DialogProvider";
import { useAuth } from "@/hooks/useAuth";
import { getAuthToken } from "@/lib/auth/token";
import { Link } from "react-router";
import { Package, Plus, Loader2, Edit, Trash2, Eye, EyeOff, AlertCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/authFetch";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { safeArray } from "@/lib/api/cacheStore";

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
  const { user } = useAuth();
  const role = user?.role ?? "creator";
  const isKycVerified = user?.kyc_status === 'verified';

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isKycError, setIsKycError] = useState(false);

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
    setLoading(true);
    setFetchError(null);
    setIsKycError(false);
    const token = getAuthToken();
    try {
      const endpoint = role === "vendor" ? `/store/physical-products/my?page=${page}&per_page=20` : `/store/products?page=${page}&per_page=20`;
      const res = await authFetch(endpoint, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        const j = await res.json();
        const raw = j?.data?.data ?? j?.data ?? j ?? [];
        const items = safeArray(raw).map((p: any) => ({
          id: p.id,
          title: p.title,
          price: p.price ?? 0,
          currency: p.currency ?? "USD",
          type: (p.sku ? "physical" : "digital") as "digital" | "physical",
          status: p.status ?? (p.is_active ? "published" : "draft"),
          sales_count: p.download_count ?? p.sales_count ?? 0,
          created_at: p.created_at ?? new Date().toISOString(),
        }));
        setProducts(items);
        setLastPage(j?.data?.last_page ?? j?.last_page ?? 1);
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.message ?? "Could not load products catalog. Identity verification or creator privileges required.";
        setFetchError(errMsg);

        if (
          res.status === 403 ||
          errMsg.toLowerCase().includes('kyc') ||
          errMsg.toLowerCase().includes('identity') ||
          errMsg.toLowerCase().includes('verification')
        ) {
          setIsKycError(true);
        }
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Network failure while fetching products.");
    } finally {
      setLoading(false);
    }
  }, [page, role]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const resetForm = () => { setTitle(""); setPrice("19.99"); setCurrency("USD"); setProductType("digital"); setEditing(null); setShowForm(false); setMsg(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !isKycVerified) return;
    setSaving(true);
    setMsg(null);
    const token = getAuthToken();
    try {
      const body = { title: title.trim(), price: Math.round(parseFloat(price) * 100), currency, type: productType };
      const endpoint = editing
        ? `/store/products/${editing.id}`
        : `/store/products`;
      const res = await authFetch(endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      resetForm();
      fetchProducts();
      setMsg({ ok: true, text: editing ? "Product updated." : "Product created." });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
    } finally { setSaving(false); }
  };

  const togglePublish = async (p: StoreProduct) => {
    const token = getAuthToken();
    const nextStatus = p.status === "published" ? "draft" : "published";
    try {
      await authFetch(`/store/products/${p.id}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchProducts();
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: 'Delete Product', message: 'Delete this product?', variant: 'destructive' })) return;
    const token = getAuthToken();
    try {
      await authFetch(`/store/products/${id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      fetchProducts();
    } catch { /* ignore */ }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-card border border-border text-foreground shadow-xs">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1877f2]/10 text-[#1877f2] text-xs font-bold uppercase tracking-wider border border-[#1877f2]/20">
            <Package className="h-3.5 w-3.5" /> Store Catalog
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Products</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage your digital and physical products.</p>
        </div>
        <ActionTooltip content={!isKycVerified ? "Identity verification (KYC) is required to add products." : "Create new product"}>
          <Button
            onClick={() => { if (isKycVerified) { resetForm(); setShowForm(true); } }}
            disabled={!isKycVerified}
            className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold h-10 px-4 rounded-xl shrink-0 gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" /> New Product
          </Button>
        </ActionTooltip>
      </div>

      {/* Error state with Verify KYC Now button */}
      {fetchError && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-xs font-bold text-destructive shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <span>{fetchError}</span>
          </div>
          {isKycError || !isKycVerified ? (
            <Link to="/app/kyc" className="shrink-0">
              <Button
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs h-8 px-4 rounded-xl gap-1.5 shadow-xs"
              >
                <ShieldCheck className="h-4 w-4" /> Verify KYC Now
              </Button>
            </Link>
          ) : (
            <Button
              onClick={() => fetchProducts()}
              size="sm"
              className="bg-destructive text-white hover:bg-destructive/90 font-bold text-xs h-8 px-3 rounded-xl gap-1.5 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="border border-border rounded-2xl bg-card p-6 space-y-4 shadow-xs">
          {msg && (
            <div className={`p-3 rounded-xl text-xs font-bold border ${
              msg.ok ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
            }`}>
              {msg.text}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-foreground uppercase tracking-wider">Title *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product title" required className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-foreground uppercase tracking-wider">Type</label>
              <select value={productType} onChange={(e) => setProductType(e.target.value as "digital" | "physical")} className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-bold text-foreground">
                <option value="digital">Digital Download</option>
                <option value="physical">Physical Product</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-foreground uppercase tracking-wider">Price</label>
              <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="font-mono h-10 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-foreground uppercase tracking-wider">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-bold text-foreground">
                {["USD", "NGN", "GBP", "EUR"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving || !title.trim() || !isKycVerified} className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold h-10 px-5 rounded-xl text-xs disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editing ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} className="h-10 rounded-xl text-xs">Cancel</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#1877f2]" />
        </div>
      ) : safeArray(products).length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card space-y-3 flex flex-col items-center justify-center">
          <Package className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <h3 className="text-sm font-bold text-foreground text-center">No products yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto text-center">
            {role === "creator"
              ? "Publish digital downloads, e-books, templates, and courses for your audience."
              : "Add physical merchandise and track your store inventory."}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            {role === "creator" && (
              <Link to="/app/store/digital">
                <Button disabled={!isKycVerified} className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs rounded-xl h-9 px-4 disabled:opacity-50">
                  Add Digital Product
                </Button>
              </Link>
            )}
            {role === "vendor" && (
              <Link to="/app/store/physical-products">
                <Button disabled={!isKycVerified} className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs rounded-xl h-9 px-4 disabled:opacity-50">
                  Add Physical Product
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border font-bold text-muted-foreground uppercase tracking-wider">
                <tr className="text-left">
                  {["Product", "Type", "Price", "Sales / Downloads", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-3.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {safeArray<StoreProduct>(products).map((p: StoreProduct) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4 font-bold text-foreground">{p.title}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        p.type === 'digital' ? 'bg-[#1877f2]/10 text-[#1877f2] border border-[#1877f2]/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                        {p.type}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-foreground">
                      {p.currency} {p.price ? (p.price / 100).toFixed(2) : "0.00"}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground font-medium">{p.sales_count ?? 0}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        p.status === 'published' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <ActionTooltip content={p.status === 'published' ? 'Unpublish' : 'Publish'}>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => togglePublish(p)}>
                            {p.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </ActionTooltip>
                        <ActionTooltip content="Edit product">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditing(p); setTitle(p.title); setPrice(String(p.price / 100)); setCurrency(p.currency); setProductType(p.type); setShowForm(true); setMsg(null); }}>
                            <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </Button>
                        </ActionTooltip>
                        <ActionTooltip content="Delete product">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </ActionTooltip>
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
        <div className="flex items-center justify-between border-t border-border px-6 py-3 bg-muted/10">
          <span className="text-xs text-muted-foreground font-medium">Page {page} of {lastPage}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-xl text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors">Previous</button>
            <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="px-3 py-1.5 rounded-xl text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
