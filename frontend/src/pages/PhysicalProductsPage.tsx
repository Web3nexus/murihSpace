import { getAuthToken } from "@/lib/auth/token";
import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router';
import { Package, Plus, Search, Edit, Trash2, Loader2, Check, AlertCircle, X, Eye, EyeOff, RotateCcw, Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiImageUploader } from "@/components/upload/ImageUploader";
import { authFetch } from "@/lib/api/authFetch";
import { PageHeader } from '@/components/ui/PageHeader';
import { SuccessBanner } from '@/components/ui/SuccessBanner';
import { FormErrorSummary } from '@/components/ui/FormErrorSummary';
import { ActionTooltip } from '@/components/ui/action-tooltip';

function formatPrice(cents: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const sym = symbols[currency] ?? currency + ' ';
  return sym + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function safeArray<T = any>(val: any): T[] {
  if (Array.isArray(val)) return val;
  if (Array.isArray(val?.data)) return val.data;
  if (Array.isArray(val?.data?.data)) return val.data.data;
  if (Array.isArray(val?.products)) return val.products;
  return [];
}

interface PhysicalProduct {
  id: number; creator_id: number;
  title: string; description: string | null; sku: string;
  price: number; currency: string; category: string | null;
  images: string[] | null;
  stock_quantity: number; low_stock_threshold: number;
  track_inventory: boolean; is_active: boolean;
  weight_unit: string; weight: number | null;
  length: number | null; width: number | null; height: number | null;
  origin_country: string | null;
  created_at: string;
  creator?: { id: number; name: string; username: string };
}

const CATEGORIES = [
  'clothing', 'accessories', 'electronics', 'home',
  'beauty', 'sports', 'food', 'art', 'other',
];

export function PhysicalProductsPage() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const role = user?.role ?? 'vendor';
  const isKycVerified = user?.kyc_status === 'verified';

  const [products, setProducts] = useState<PhysicalProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isKycError, setIsKycError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PhysicalProduct | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  // Form state
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fSku, setFSku] = useState('');
  const [fPrice, setFPrice] = useState('0');
  const [fCurrency, setFCurrency] = useState('NGN');
  const [fCategory, setFCategory] = useState('');
  const [fStock, setFStock] = useState('0');
  const [fLowStock, setFLowStock] = useState('5');
  const [fTrackInv, setFTrackInv] = useState(true);
  const [fActive, setFActive] = useState(true);
  const [fWeight, setFWeight] = useState('');
  const [fWeightUnit, setFWeightUnit] = useState('kg');
  const [fLength, setFLength] = useState('');
  const [fWidth, setFWidth] = useState('');
  const [fHeight, setFHeight] = useState('');
  const [fOrigin, setFOrigin] = useState('');
  const [fImages, setFImages] = useState<string[]>([]);

  // Stock adjust
  const [adjustingId, setAdjustingId] = useState<number | null>(null);
  const [adjQty, setAdjQty] = useState('0');
  const [adjReason, setAdjReason] = useState('');

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    setIsKycError(false);
    const token = getAuthToken();
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '20' });
      if (searchQuery) params.set('search', searchQuery);
      const res = await authFetch(`/store/physical-products/my?${params}`, {
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const json = await res.json();
        const items = safeArray<PhysicalProduct>(json);
        setProducts(items);
        setLastPage(json.last_page ?? json.data?.last_page ?? 1);
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.message ?? 'Failed to load physical products from store.';
        setHasError(true);
        setErrorMessage(errMsg);

        if (
          res.status === 403 ||
          errMsg.toLowerCase().includes('kyc') ||
          errMsg.toLowerCase().includes('identity') ||
          errMsg.toLowerCase().includes('verification')
        ) {
          setIsKycError(true);
        }
      }
    } catch {
      setHasError(true);
      setErrorMessage('Network connection failure while fetching physical products.');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const resetForm = () => {
    setFTitle(''); setFDesc(''); setFSku(''); setFPrice('0'); setFCurrency('NGN');
    setFCategory(''); setFStock('0'); setFLowStock('5'); setFTrackInv(true); setFActive(true);
    setFWeight(''); setFWeightUnit('kg'); setFLength(''); setFWidth(''); setFHeight('');
    setFOrigin(''); setFImages([]);
  };

  const openEdit = (p: PhysicalProduct) => {
    setFTitle(p.title); setFDesc(p.description ?? ''); setFSku(p.sku);
    setFPrice(String(p.price)); setFCurrency(p.currency); setFCategory(p.category ?? '');
    setFStock(String(p.stock_quantity)); setFLowStock(String(p.low_stock_threshold));
    setFTrackInv(p.track_inventory); setFActive(p.is_active);
    setFWeight(p.weight ? String(p.weight) : ''); setFWeightUnit(p.weight_unit);
    setFLength(p.length ? String(p.length) : ''); setFWidth(p.width ? String(p.width) : '');
    setFHeight(p.height ? String(p.height) : ''); setFOrigin(p.origin_country ?? '');
    setFImages(p.images ?? []);
    setEditing(p);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isKycVerified) return;
    setIsSubmitting(true);
    setMessage(null);

    const body: Record<string, unknown> = {
      title: fTitle, description: fDesc || null, sku: fSku,
      price: parseInt(fPrice, 10) || 0, currency: fCurrency,
      category: fCategory || null, stock_quantity: parseInt(fStock) || 0,
      low_stock_threshold: parseInt(fLowStock) || 5,
      track_inventory: fTrackInv, is_active: fActive,
      weight_unit: fWeightUnit, weight: fWeight ? parseFloat(fWeight) : null,
      length: fLength ? parseFloat(fLength) : null,
      width: fWidth ? parseFloat(fWidth) : null,
      height: fHeight ? parseFloat(fHeight) : null,
      origin_country: fOrigin || null,
      images: fImages.length > 0 ? fImages : null,
    };

    try {
      const endpoint = editing
        ? `/store/physical-products/${editing.id}`
        : `/store/physical-products`;
      const res = await authFetch(endpoint, {
        method: editing ? 'PUT' : 'POST', 
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to save product.');
      setShowForm(false);
      resetForm();
      setEditing(null);
      setMessage({ type: 'success', text: editing ? 'Product updated!' : 'Product created!' });
      fetchProducts();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Save failed.' });
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: 'Delete Product', message: 'Delete this physical product?', variant: 'destructive' })) return;
    try {
      const res = await authFetch(`/store/physical-products/${id}`, {
        method: 'DELETE', 
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Delete failed.');
      setProducts((prev) => safeArray(prev).filter((p) => p.id !== id));
      setMessage({ type: 'success', text: 'Product deleted.' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed.' });
    }
  };

  const handleToggleActive = async (p: PhysicalProduct) => {
    try {
      const res = await authFetch(`/store/physical-products/${p.id}`, {
        method: 'PUT', 
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed.');
      setProducts((prev) => safeArray(prev).map((x) => x.id === p.id ? (json.data ?? json) : x));
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed.' });
    }
  };

  const handleAdjustStock = async () => {
    if (!adjustingId || !adjQty) return;
    try {
      const res = await authFetch(`/store/physical-products/${adjustingId}/stock`, {
        method: 'POST', 
        body: JSON.stringify({ quantity: parseInt(adjQty), reason: adjReason || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Stock adjustment failed.');
      setAdjustingId(null);
      setAdjQty('0');
      setAdjReason('');
      setMessage({ type: 'success', text: json.message ?? 'Stock adjusted.' });
      fetchProducts();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Stock adjustment failed.' });
    }
  };

  const safeProductsList = safeArray<PhysicalProduct>(products);

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <PageHeader 
        title="Physical Products & Inventory"
        description="Manage physical merchandise, track stock levels, and fulfill orders."
        icon={<Package className="h-6 w-6 text-[#1877f2]" />}
        action={
          <ActionTooltip content={!isKycVerified ? "Complete identity verification (KYC) to add products" : "Add physical merchandise"}>
            <Button
              onClick={() => { if (isKycVerified) { resetForm(); setEditing(null); setShowForm(true); } }}
              disabled={!isKycVerified}
              className="bg-[#1877f2] text-white hover:bg-[#166fe5] font-bold h-10 px-4 rounded-xl shadow-xs gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          </ActionTooltip>
        }
      />

      {/* Role Guidance Banner if Creator */}
      {role === 'creator' && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              <strong>Creator Note:</strong> Creators publish Digital Products (eBooks, templates, courses). Physical merchandise & shipping inventory are managed by Vendors.
            </span>
          </div>
          <Link
            to="/app/store/digital"
            className="inline-flex items-center gap-1 font-bold underline hover:opacity-80 shrink-0"
          >
            Go to Digital Products &rarr;
          </Link>
        </div>
      )}

      {/* Message */}
      {message?.type === 'success' && (
        <SuccessBanner message={message.text} onClose={() => setMessage(null)} className="mb-2" />
      )}
      {message?.type === 'error' && (
        <FormErrorSummary errors={[message.text]} className="mb-2" />
      )}

      {/* Search */}
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products or SKU…"
          className="pl-9 h-9 rounded-xl bg-card border-border text-xs"
        />
      </div>

      {/* Grid / Loader / Retry Error */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-64 rounded-2xl bg-muted animate-pulse border border-border" />
          ))}
        </div>
      ) : hasError ? (
        <div className="p-12 text-center border border-destructive/20 rounded-3xl bg-destructive/5 space-y-4 max-w-lg mx-auto">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isKycError ? 'Identity Verification Required' : 'Failed to load physical products'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">{errorMessage || "An unexpected error occurred while communicating with the physical store API."}</p>
          </div>
          {isKycError || !isKycVerified ? (
            <Link to="/app/kyc">
              <Button className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs h-9 px-5 rounded-xl inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Verify KYC Now
              </Button>
            </Link>
          ) : (
            <Button
              onClick={fetchProducts}
              className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs h-9 px-5 rounded-xl inline-flex items-center gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          )}
        </div>
      ) : safeProductsList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-card flex flex-col items-center justify-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Package className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground text-center">{products.length === 0 ? 'No physical products yet' : 'No matching products'}</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto text-center">Add your first physical product to start selling merchandise.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {safeProductsList.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:shadow-md hover:border-[#1877f2]/30 transition-all duration-200 flex flex-col">
              {/* Image */}
              <div className="h-36 bg-muted relative overflow-hidden">
                {p.images && p.images.length > 0 ? (
                  <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                    <Package className="h-12 w-12" />
                  </div>
                )}
                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-card/90 backdrop-blur-md border border-border text-xs font-black text-foreground shadow-xs">
                  {formatPrice(p.price, p.currency)}
                </div>
                <Button
                  onClick={() => handleToggleActive(p)}
                  variant="secondary"
                  size="sm"
                  className={`absolute top-2.5 right-2.5 p-1.5 shadow-xs ${p.is_active ? '' : 'bg-muted-foreground text-muted hover:bg-muted-foreground/80'}`}
                  title={p.is_active ? 'Deactivate' : 'Activate'}
                >
                  {p.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </Button>
              </div>

              <div className="p-4 space-y-2 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-[#1877f2] uppercase tracking-wider">{p.category ?? 'General'}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">SKU: {p.sku}</span>
                </div>
                <h3 className="text-sm font-bold text-foreground line-clamp-1">{p.title}</h3>
                {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}

                {/* Stock indicator */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    {p.track_inventory ? (
                      p.stock_quantity <= 0 ? (
                        <span className="text-[10px] font-bold text-destructive flex items-center gap-1"><X className="h-3 w-3" /> Out of Stock</span>
                      ) : p.stock_quantity <= p.low_stock_threshold ? (
                        <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Low: {p.stock_quantity}</span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><Check className="h-3 w-3" /> {p.stock_quantity} in stock</span>
                      )
                      ) : (
                        <span className="text-[10px] text-muted-foreground">No tracking</span>
                      )}
                  </div>
                  {p.weight && <span className="text-[10px] text-muted-foreground">{p.weight} {p.weight_unit}</span>}
                </div>
              </div>

              <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <ActionTooltip content="Edit product">
                    <Button onClick={() => openEdit(p)} variant="ghost" size="sm" className="p-2"><Edit className="h-4 w-4" /></Button>
                  </ActionTooltip>
                  <ActionTooltip content="Delete product">
                    <Button onClick={() => handleDelete(p.id)} variant="ghost" size="sm" className="p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                  </ActionTooltip>
                </div>
                {p.track_inventory && (
                  <Button
                    onClick={() => { setAdjustingId(p.id); setAdjQty('0'); setAdjReason(''); }}
                    variant="secondary"
                    size="sm"
                    className="text-[10px] font-bold px-2.5 py-1.5 h-auto rounded-xl"
                  >
                    Adjust Stock
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Previous</button>
          <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
          <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs overflow-y-auto">
          <div className="border border-border rounded-2xl bg-card p-6 max-w-xl w-full shadow-2xl space-y-4 my-8">
            <h3 className="text-base font-bold text-foreground">{editing ? 'Edit Product' : 'Add Physical Product'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Title</label>
                  <Input type="text" value={fTitle} onChange={(e) => setFTitle(e.target.value)} required placeholder="e.g. Premium Cotton Hoodie" className="bg-muted border-border rounded-xl text-xs" />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Description</label>
                  <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={3} className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-[#1877f2] resize-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">SKU</label>
                  <Input type="text" value={fSku} onChange={(e) => setFSku(e.target.value)} required placeholder="HOODIE-BLK-001" className="bg-muted border-border rounded-xl text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Price (cents)</label>
                  <Input type="number" value={fPrice} onChange={(e) => setFPrice(e.target.value)} min={0} required className="bg-muted border-border rounded-xl text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Category</label>
                  <select value={fCategory} onChange={(e) => setFCategory(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl bg-muted border border-border outline-none focus-visible:ring-1 focus-visible:ring-[#1877f2] text-foreground">
                    <option value="">None</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Currency</label>
                  <select value={fCurrency} onChange={(e) => setFCurrency(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl bg-muted border border-border outline-none focus-visible:ring-1 focus-visible:ring-[#1877f2] text-foreground">
                    <option value="NGN">NGN</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Stock Qty</label>
                  <Input type="number" value={fStock} onChange={(e) => setFStock(e.target.value)} min={0} className="bg-muted border-border rounded-xl text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Low Stock Threshold</label>
                  <Input type="number" value={fLowStock} onChange={(e) => setFLowStock(e.target.value)} min={0} className="bg-muted border-border rounded-xl text-xs" />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={fTrackInv} onChange={(e) => setFTrackInv(e.target.checked)} className="h-4 w-4 accent-[#1877f2] rounded" />
                    <span className="text-xs font-bold text-foreground">Track Inventory</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={fActive} onChange={(e) => setFActive(e.target.checked)} className="h-4 w-4 accent-[#1877f2] rounded" />
                    <span className="text-xs font-bold text-foreground">Active</span>
                  </label>
                </div>
              </div>

              {/* Shipping dimensions */}
              <div className="p-3 rounded-2xl bg-muted/30 border border-border space-y-3">
                <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">Shipping Dimensions</p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-muted-foreground">Weight</label>
                    <Input type="number" step="0.1" value={fWeight} onChange={(e) => setFWeight(e.target.value)} placeholder="0" className="bg-muted border-border rounded-lg text-xs h-8" />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-muted-foreground">Unit</label>
                    <select value={fWeightUnit} onChange={(e) => setFWeightUnit(e.target.value)} className="w-full px-2 py-1.5 text-xs rounded-lg bg-muted border border-border outline-none focus-visible:ring-1 focus-visible:ring-[#1877f2] text-foreground">
                      <option value="kg">kg</option><option value="g">g</option><option value="lb">lb</option><option value="oz">oz</option>
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-muted-foreground">Length</label>
                    <Input type="number" step="0.1" value={fLength} onChange={(e) => setFLength(e.target.value)} placeholder="cm" className="bg-muted border-border rounded-lg text-xs h-8" />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-muted-foreground">W × H</label>
                    <div className="flex gap-1">
                      <Input type="number" step="0.1" value={fWidth} onChange={(e) => setFWidth(e.target.value)} placeholder="W" className="bg-muted border-border rounded-lg text-xs h-8" />
                      <Input type="number" step="0.1" value={fHeight} onChange={(e) => setFHeight(e.target.value)} placeholder="H" className="bg-muted border-border rounded-lg text-xs h-8" />
                    </div>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-muted-foreground">Origin Country (ISO 2-letter)</label>
                  <Input type="text" value={fOrigin} onChange={(e) => setFOrigin(e.target.value.toUpperCase().slice(0, 2))} placeholder="NG" maxLength={2} className="w-20 bg-muted border-border rounded-lg text-xs font-mono uppercase h-8" />
                </div>
              </div>

              <MultiImageUploader
                values={fImages}
                onChange={setFImages}
                folder="physical-products/images"
                label="Product Images"
                maxImages={10}
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting || !isKycVerified} className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs rounded-xl gap-1.5 disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {editing ? 'Update' : 'Create'} Product
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjust Modal */}
      {adjustingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="border border-border rounded-2xl bg-card p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Adjust Stock</h3>
            <p className="text-xs text-muted-foreground">Use positive values to add stock, negative to remove.</p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">Quantity change</label>
                <Input type="number" value={adjQty} onChange={(e) => setAdjQty(e.target.value)} placeholder="e.g. 5 or -2" className="bg-muted border-border rounded-xl text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">Reason (optional)</label>
                <Input type="text" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="e.g. Received new shipment" className="bg-muted border-border rounded-xl text-xs" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setAdjustingId(null)}>Cancel</Button>
              <Button onClick={handleAdjustStock} className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs rounded-xl">Apply Adjustment</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default PhysicalProductsPage;
