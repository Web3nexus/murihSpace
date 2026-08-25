import { getAuthToken } from "@/lib/auth/token";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router';
import {
  Package,
  Plus,
  Search,
  Download,
  Edit,
  Trash2,
  FileText,
  Loader2,
  UploadCloud,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Truck,
  ShieldCheck,
} from 'lucide-react';
import { ImageUploader } from '@/components/upload/ImageUploader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { DigitalProduct, ProductCategory, ProductStatus } from '@/types/digitalProduct';
import { authFetch } from "@/lib/api/authFetch";
import { FormErrorSummary } from '@/components/ui/FormErrorSummary';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionTooltip } from '@/components/ui/action-tooltip';

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'ebook', label: 'E-Book' },
  { value: 'template', label: 'Template' },
  { value: 'course', label: 'Course Assets' },
  { value: 'audio', label: 'Audio & Podcast' },
  { value: 'graphics', label: 'Graphics & Design' },
  { value: 'other', label: 'Other Asset' },
];

function safeArray<T = any>(val: any): T[] {
  if (Array.isArray(val)) return val;
  if (Array.isArray(val?.data)) return val.data;
  if (Array.isArray(val?.data?.data)) return val.data.data;
  if (Array.isArray(val?.products)) return val.products;
  return [];
}

export function DigitalProductsPage() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const role = user?.role ?? 'creator';
  const isKycVerified = user?.kyc_status === 'verified';

  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isKycError, setIsKycError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<DigitalProduct | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [price, setPrice] = useState('9.99');
  const [isFree, setIsFree] = useState(false);
  const [category, setCategory] = useState<ProductCategory>('ebook');
  const [status, setStatus] = useState<ProductStatus>('published');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    setIsKycError(false);
    const token = getAuthToken();
    try {
      const res = await authFetch(`/store/products?page=${page}&per_page=20`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const json = await res.json();
        const items = safeArray<DigitalProduct>(json);
        setProducts(items);
        setLastPage(json.data?.last_page ?? json.last_page ?? 1);
      } else {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson.message ?? 'Failed to load digital products from server.';
        setHasError(true);
        setErrorMessage(msg);

        // Check if error is KYC or authorization related
        if (
          res.status === 403 ||
          msg.toLowerCase().includes('kyc') ||
          msg.toLowerCase().includes('identity') ||
          msg.toLowerCase().includes('verification')
        ) {
          setIsKycError(true);
        }
      }
    } catch (e) {
      console.error('Failed to fetch products', e);
      setHasError(true);
      setErrorMessage('Network failure while fetching products.');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openCreateModal = () => {
    if (!isKycVerified) return;
    setEditingProduct(null);
    setTitle('');
    setDescription('');
    setCoverUrl('');
    setPrice('9.99');
    setIsFree(false);
    setCategory('ebook');
    setStatus('published');
    setSelectedFile(null);
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (p: DigitalProduct) => {
    setEditingProduct(p);
    setTitle(p.title);
    setDescription(p.description ?? '');
    setCoverUrl(p.cover_url ?? '');
    setPrice(p.price.toString());
    setIsFree(p.is_free);
    setCategory(p.category);
    setStatus(p.status);
    setSelectedFile(null);
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = getAuthToken();
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    if (coverUrl) formData.append('cover_url', coverUrl);
    formData.append('price', isFree ? '0' : price);
    formData.append('is_free', isFree ? '1' : '0');
    formData.append('category', category);
    formData.append('status', status);
    if (selectedFile) formData.append('file', selectedFile);

    const endpoint = editingProduct
      ? `/store/products/${editingProduct.id}`
      : `/store/products`;

    if (editingProduct) {
      formData.append('_method', 'PUT');
    }

    try {
      const res = await authFetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to save product.');

      setShowModal(false);
      fetchProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePublish = async (p: DigitalProduct) => {
    const token = getAuthToken();
    const nextStatus = p.status === 'published' ? 'draft' : 'published';

    try {
      const res = await authFetch(`/store/products/${p.id}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        setProducts((prev) =>
          safeArray(prev).map((item) => (item.id === p.id ? { ...item, status: nextStatus } : item))
        );
      }
    } catch (e) { console.error('Failed to toggle publish', e); }
  };

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: 'Delete Digital Product', message: 'Are you sure you want to delete this digital product?', variant: 'destructive' })) return;
    const token = getAuthToken();

    try {
      const res = await authFetch(`/store/products/${id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        setProducts((prev) => safeArray(prev).filter((p) => p.id !== id));
      }
    } catch (e) { console.error('Failed to delete product', e); }
  };

  const handleDownload = async (id: number) => {
    const token = getAuthToken();
    try {
      const res = await authFetch(`/products/${id}/download`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { /* ignore */ }
  };

  const safeProductsList = safeArray<DigitalProduct>(products);

  const filteredProducts = safeProductsList.filter((p) => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <PageHeader 
        title="Digital Products Catalog"
        description="Create, publish, and manage downloadable assets (E-books, templates, audio, course materials)."
        icon={<Package className="h-6 w-6 text-[#1877f2]" />}
        action={
          <ActionTooltip content={!isKycVerified ? "Complete identity verification (KYC) to add products" : "Create new digital product"}>
            <Button
              onClick={openCreateModal}
              disabled={!isKycVerified}
              className="shrink-0 bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold h-10 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Digital Product
            </Button>
          </ActionTooltip>
        }
      />

      {/* Role Guidance Banner if Vendor */}
      {role === 'vendor' && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs">
          <div className="flex items-center gap-2.5">
            <Truck className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              <strong>Vendor Note:</strong> As a Vendor, physical merchandise and shipping inventory are managed in your Physical Products portal.
            </span>
          </div>
          <Link
            to="/app/store/physical-products"
            className="inline-flex items-center gap-1 font-bold underline hover:opacity-80 shrink-0"
          >
            Go to Physical Products &rarr;
          </Link>
        </div>
      )}

      {/* Role Guidance Banner if Creator */}
      {role === 'creator' && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-[#1877f2]/10 border border-[#1877f2]/20 text-[#1877f2] text-xs font-medium">
          <Sparkles className="h-4 w-4 shrink-0 text-[#1877f2]" />
          <span>
            <strong>Creator Store:</strong> Publish digital products, eBooks, downloadable templates, and course files for instant download by your audience.
          </span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-[#1877f2] text-white shadow-xs'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All Products ({safeProductsList.length})
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setSelectedCategory(c.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === c.value
                  ? 'bg-[#1877f2] text-white shadow-xs'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-card border border-border outline-none focus:ring-1 focus:ring-[#1877f2]"
          />
        </div>
      </div>

      {/* Products Grid / Error Retry / Skeleton */}
      {isLoading ? (
        <div className="py-20 text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-[#1877f2] mx-auto" />
          <p className="text-xs text-muted-foreground font-medium">Loading products catalog…</p>
        </div>
      ) : hasError ? (
        <div className="p-12 text-center border border-destructive/20 rounded-3xl bg-destructive/5 space-y-4 max-w-lg mx-auto">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isKycError ? 'Identity Verification Required' : 'Failed to load digital products'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {errorMessage || 'An unexpected error occurred while communicating with the store.'}
            </p>
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
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card space-y-3 flex flex-col items-center justify-center">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <h3 className="text-sm font-bold text-foreground text-center">No digital products found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto text-center">
            Click "Add Digital Product" to create your first e-book, template, or downloadable asset.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="border border-border rounded-2xl bg-card overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              {/* Cover Preview */}
              <div className="h-36 bg-muted relative overflow-hidden">
                {p.cover_url ? (
                  <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                    <FileText className="h-12 w-12" />
                  </div>
                )}

                {/* Price Pill */}
                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-card/90 backdrop-blur-md border border-border text-xs font-black text-foreground shadow-xs">
                  {p.is_free ? 'FREE' : `$${Number(p.price).toFixed(2)}`}
                </div>

                {/* Status Toggle Badge */}
                <button
                  onClick={() => handleTogglePublish(p)}
                  className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider shadow-xs transition-transform active:scale-95 ${
                    p.status === 'published'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {p.status}
                </button>
              </div>

              {/* Product Info */}
              <div className="p-4 space-y-2 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-[#1877f2] uppercase tracking-wider">
                    {CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                    <Download className="h-3 w-3 text-[#1877f2]" /> {p.download_count} downloads
                  </span>
                </div>

                <h3 className="text-sm font-bold text-foreground line-clamp-1">{p.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {p.description ?? 'No description provided.'}
                </p>

                {p.file_original_name && (
                  <p className="text-[11px] font-mono text-muted-foreground/80 truncate pt-1">
                    📎 {p.file_original_name}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <ActionTooltip content="Edit product">
                    <button
                      onClick={() => openEditModal(p)}
                      className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </ActionTooltip>
                  <ActionTooltip content="Delete product">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-2 rounded-xl hover:bg-destructive/10 text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </ActionTooltip>
                </div>

                {p.file_original_name && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(p.id)}
                    className="h-8 text-xs font-semibold gap-1.5 rounded-xl"
                  >
                    <Download className="h-3.5 w-3.5 text-[#1877f2]" />
                    Download File
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Product Modal */}
      {showModal && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="sm:max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border shadow-2xl rounded-2xl p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                {editingProduct ? 'Edit Digital Product' : 'Add New Digital Product'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set product pricing, details, and upload your private downloadable file.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <FormErrorSummary errors={[error]} className="mb-4" />
            )}

            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label htmlFor="dp-title" className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Product Title
                </label>
                <input
                  id="dp-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Creator Growth Playbook 2026"
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-[#1877f2]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="dp-category" className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    id="dp-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProductCategory)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-[#1877f2] capitalize"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="dp-status" className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Status
                  </label>
                  <select
                    id="dp-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProductStatus)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-[#1877f2] capitalize"
                  >
                    <option value="published">Published (Live)</option>
                    <option value="draft">Draft (Hidden)</option>
                  </select>
                </div>
              </div>

              {/* Free vs Paid Toggle & Price */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Free Download</span>
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => setIsFree(e.target.checked)}
                    className="h-4 w-4 accent-[#1877f2] rounded"
                  />
                </div>

                {!isFree && (
                  <div className="space-y-1.5 pt-1">
                    <label htmlFor="dp-price" className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Price (USD $)
                    </label>
                    <input
                      id="dp-price"
                      type="number"
                      step="0.01"
                      min="0.99"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="9.99"
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-card border border-border outline-none focus:ring-1 focus:ring-[#1877f2] font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="dp-description" className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  id="dp-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is included in this digital product?"
                  rows={3}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-[#1877f2] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <ImageUploader
                  value={coverUrl}
                  onChange={setCoverUrl}
                  folder="digital-products/covers"
                  label="Cover Image"
                />
              </div>

              {/* Private File Upload Dropzone */}
              <div className="space-y-1.5">
                <label htmlFor="dp-file" className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Private Product File (E-Book PDF, ZIP, MP3)
                </label>

                <input
                  id="dp-file"
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  className="p-4 border-2 border-dashed border-border hover:border-[#1877f2] rounded-2xl bg-muted/20 text-center cursor-pointer transition-colors space-y-1"
                >
                  <UploadCloud className="h-6 w-6 text-[#1877f2] mx-auto" />
                  <p className="text-xs font-semibold text-foreground">
                    {selectedFile ? selectedFile.name : editingProduct?.file_original_name ?? 'Click to select private file'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Files are saved in secure private storage. Maximum 100MB.
                  </p>
                </div>
              </div>

              <DialogFooter className="pt-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="text-xs font-bold bg-[#1877f2] hover:bg-[#166fe5] text-white gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : editingProduct ? (
                    'Update Product'
                  ) : (
                    'Create Product'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
export default DigitalProductsPage;
