import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Package,
  Loader2,
  FileText,
  Image,
  Headphones,
  Video,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Purchase } from '@/types/wallet';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('murihspace-token');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function categoryIcon(category?: string) {
  switch (category) {
    case 'ebook': return <FileText className="h-4 w-4" />;
    case 'template': return <Image className="h-4 w-4" />;
    case 'course': return <Video className="h-4 w-4" />;
    case 'audio': return <Headphones className="h-4 w-4" />;
    case 'graphics': return <Image className="h-4 w-4" />;
    default: return <Archive className="h-4 w-4" />;
  }
}

export function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const fetchPurchases = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/wallet/purchases`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setPurchases(json.data ?? []);
      }
    } catch (e) { console.error('Failed to fetch purchases', e); }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPurchases().finally(() => setIsLoading(false));
  }, [fetchPurchases]);

  const handleDownload = async (purchaseId: number) => {
    setDownloadingId(purchaseId);
    try {
      const res = await fetch(`${API_BASE}/wallet/purchases/${purchaseId}/download`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        window.open(json.data.download_url, '_blank');
      }
    } catch (e) { console.error('Failed to download', e); }
    setDownloadingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
          <Package className="h-6 w-6 text-secondary" />
          Purchase Library
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          View and download all your purchased digital products.
        </p>
      </div>

      {purchases.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card space-y-3">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <h3 className="text-sm font-bold text-foreground">No purchases yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Your purchased digital products will appear here once you complete a purchase.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {purchases.map((purchase) => (
            <div
              key={purchase.id}
              className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-md transition-all group"
            >
              {/* Product Cover */}
              <div className="h-36 bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center relative">
                {purchase.product?.cover_url ? (
                  <img src={purchase.product.cover_url} alt={purchase.product.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-secondary/40">
                    {categoryIcon(purchase.product?.category)}
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-card/80 text-muted-foreground border border-border/50 backdrop-blur-sm capitalize">
                    {purchase.product?.category ?? 'product'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 space-y-2.5">
                <h3 className="text-sm font-bold text-foreground truncate" title={purchase.product?.title}>
                  {purchase.product?.title ?? 'Unknown Product'}
                </h3>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{purchase.order?.order_number}</span>
                  <span className="capitalize">{purchase.order?.status}</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Downloads: {purchase.download_count}</span>
                  {purchase.product?.file_size_bytes && (
                    <span>{formatFileSize(purchase.product.file_size_bytes)}</span>
                  )}
                </div>

                {purchase.last_downloaded_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Last downloaded: {new Date(purchase.last_downloaded_at).toLocaleDateString()}
                  </p>
                )}

                <Button
                  size="sm"
                  onClick={() => handleDownload(purchase.id)}
                  disabled={downloadingId === purchase.id}
                  className="w-full text-xs font-bold gap-1.5 mt-1"
                >
                  {downloadingId === purchase.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {downloadingId === purchase.id ? 'Preparing...' : 'Download'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
