import React, { useState, useEffect, useCallback } from 'react';
import { getAuthToken } from '@/lib/auth/token';
import { authFetch } from '@/lib/api/authFetch';
import { safeArray } from '@/lib/api/cacheStore';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/DialogProvider';
import { Plus, Search, Delete as Trash2, Document as FileText } from '@/components/icons';
import { Package, Spinner } from '@/components/icons/rounded';

interface StoreProduct {
  id: number;
  title: string;
  price: number;
  currency: string;
  type: 'digital' | 'physical';
  status: 'draft' | 'published';
  sales_count?: number;
  created_at: string;
  sku?: string;
}

export const StoreProductsTab: React.FC = () => {
  const confirm = useConfirm();

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [filterType, setFilterType] = useState<'all' | 'digital' | 'physical'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productType, setProductType] = useState<'digital' | 'physical'>('digital');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('19.99');
  const [currency, setCurrency] = useState('USD');
  const [description, setDescription] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = getAuthToken();

    try {
      const [digRes, physRes] = await Promise.allSettled([
        authFetch('/store/products?per_page=100', {
          headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        }),
        authFetch('/store/physical-products/my?per_page=100', {
          headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        }),
      ]);

      const unified: StoreProduct[] = [];

      if (digRes.status === 'fulfilled' && digRes.value.ok) {
        const j = await digRes.value.json();
        const raw = j?.data?.data ?? j?.data ?? j ?? [];
        safeArray(raw).forEach((p: any) => {
          unified.push({
            id: p.id,
            title: p.title,
            price: p.price ?? 0,
            currency: p.currency ?? 'USD',
            type: 'digital',
            status: p.status ?? 'draft',
            sales_count: p.download_count ?? p.sales_count ?? 0,
            created_at: p.created_at ?? new Date().toISOString(),
          });
        });
      }

      if (physRes.status === 'fulfilled' && physRes.value.ok) {
        const j = await physRes.value.json();
        const raw = j?.data?.data ?? j?.data ?? j?.products ?? [];
        safeArray(raw).forEach((p: any) => {
          unified.push({
            id: p.id,
            title: p.title,
            price: p.price ? p.price / 100 : 0,
            currency: p.currency ?? 'USD',
            type: 'physical',
            status: p.is_active ? 'published' : 'draft',
            sales_count: p.sales_count ?? 0,
            created_at: p.created_at ?? new Date().toISOString(),
            sku: p.sku,
          });
        });
      }

      setProducts(unified);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    const token = getAuthToken();

    try {
      const endpoint = productType === 'digital' ? '/store/products' : '/store/physical-products';
      const body = productType === 'digital'
        ? {
            title: title.trim(),
            description: description.trim(),
            price: parseFloat(price) || 0,
            currency,
            status: 'draft',
          }
        : {
            title: title.trim(),
            description: description.trim(),
            price: Math.round((parseFloat(price) || 0) * 100),
            currency,
            sku: `SKU-${Date.now().toString(36).toUpperCase()}`,
            stock_quantity: 10,
          };

      const res = await authFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? 'Failed to create product');
      }

      setShowAddModal(false);
      setTitle('');
      setDescription('');
      setPrice('19.99');
      fetchProducts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error creating product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (product: StoreProduct) => {
    if (
      !(await confirm({
        title: 'Delete Product',
        message: `Are you sure you want to delete "${product.title}"?`,
        variant: 'destructive',
      }))
    )
      return;

    const token = getAuthToken();
    const endpoint =
      product.type === 'digital'
        ? `/store/products/${product.id}`
        : `/store/physical-products/${product.id}`;

    try {
      const res = await authFetch(endpoint, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message || 'Failed to delete product. Please try again.');
        return;
      }

      fetchProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error deleting product.');
    }
  };

  const filtered = products.filter((p) => {
    if (filterType !== 'all' && p.type !== filterType) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (searchQuery.trim() && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 pt-2">
      {/* Top Bar: Search, Filters & Add Product Button */}
      <div className="bg-[#171D25] border border-[#29313C] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5A6577]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by title..."
              className="w-full bg-[#0B0F14] border border-[#29313C] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-[#5A6577] focus:outline-none focus:border-[#087FFF]"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-[#0B0F14] border border-[#29313C] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#087FFF]"
          >
            <option value="all">All Types</option>
            <option value="digital">Digital Products</option>
            <option value="physical">Physical Products</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-[#0B0F14] border border-[#29313C] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#087FFF]"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <Button
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="h-9 px-4 text-xs font-bold rounded-xl bg-[#087FFF] hover:bg-[#0770E3] text-white flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Product List / Table */}
      <div className="bg-[#171D25] border border-[#29313C] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <Spinner weight="bold" className="h-7 w-7 animate-spin text-[#087FFF] mx-auto" />
            <p className="text-xs text-[#A7B0BE]">Loading products catalog…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center px-4 space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-[#202731] border border-[#29313C] flex items-center justify-center text-[#5A6577] mx-auto">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">No products found</p>
              <p className="text-xs text-[#A7B0BE] mt-0.5">
                {products.length === 0
                  ? 'Get started by creating your first digital or physical product.'
                  : 'Try adjusting your search or filters.'}
              </p>
            </div>
            {products.length === 0 && (
              <Button
                size="sm"
                onClick={() => setShowAddModal(true)}
                className="mt-2 bg-[#087FFF] hover:bg-[#0770E3] text-white text-xs font-bold rounded-xl"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create Product
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#29313C] bg-[#11161D] text-[11px] font-bold text-[#A7B0BE] uppercase tracking-wider">
                  <th className="py-3.5 px-5">Product</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Price</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Sales</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#29313C]/60 text-xs">
                {filtered.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="hover:bg-[#202731]/40 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            item.type === 'digital'
                              ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {item.type === 'digital' ? (
                            <FileText className="h-4 w-4" />
                          ) : (
                            <Package className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white line-clamp-1">{item.title}</p>
                          <p className="text-[10px] text-[#5A6577] mt-0.5">
                            Created {new Date(item.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.type === 'digital'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-semibold text-white">
                      {item.currency === 'USD' ? '$' : item.currency + ' '}
                      {item.price.toFixed(2)}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            item.status === 'published' ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                        />
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-[#A7B0BE] font-medium">
                      {item.sales_count ?? 0}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 rounded-lg text-[#5A6577] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#171D25] border border-[#29313C] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#29313C]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-[#087FFF]" />
                Add New Product
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#A7B0BE] hover:text-white text-xs font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-[#0B0F14] p-1 rounded-xl border border-[#29313C]">
                <button
                  type="button"
                  onClick={() => setProductType('digital')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    productType === 'digital'
                      ? 'bg-[#087FFF] text-white'
                      : 'text-[#A7B0BE] hover:text-white'
                  }`}
                >
                  Digital Product
                </button>
                <button
                  type="button"
                  onClick={() => setProductType('physical')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    productType === 'physical'
                      ? 'bg-[#087FFF] text-white'
                      : 'text-[#A7B0BE] hover:text-white'
                  }`}
                >
                  Physical Product
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A7B0BE] mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Creator Masterclass eBook"
                  required
                  className="w-full bg-[#0B0F14] border border-[#29313C] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[#5A6577] focus:outline-none focus:border-[#087FFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#A7B0BE] mb-1">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    className="w-full bg-[#0B0F14] border border-[#29313C] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#087FFF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#A7B0BE] mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-[#0B0F14] border border-[#29313C] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#087FFF]"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="NGN">NGN (₦)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A7B0BE] mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell buyers what they get..."
                  className="w-full bg-[#0B0F14] border border-[#29313C] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[#5A6577] focus:outline-none focus:border-[#087FFF] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                  className="bg-[#202731] border-[#29313C] text-[#A7B0BE] hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-[#087FFF] hover:bg-[#0770E3] text-white font-bold"
                >
                  {isSubmitting ? 'Creating…' : 'Create Product'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

