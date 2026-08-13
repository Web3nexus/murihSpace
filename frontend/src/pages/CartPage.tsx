import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Loader2, ShoppingBag } from 'lucide-react';
import { authFetch } from "@/lib/api/authFetch";





function formatPrice(cents: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const sym = symbols[currency] ?? currency + ' ';
  return sym + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

interface CartItem {
  id: number;
  physical_product_id: number;
  quantity: number;
  product: {
    id: number; title: string; price: number; currency: string;
    images: string[] | null; sku: string;
    stock_quantity: number; track_inventory: boolean;
    creator: { id: number; name: string; username: string };
    weight: number | null; weight_unit: string;
  } | null;
  line_total: number;
}

interface CartData {
  id: number;
  items: CartItem[];
  total: number;
  item_count: number;
}

export function CartPage() {
  const [cart, setCart] = useState<CartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCart = useCallback(async () => {
    try {
      const res = await authFetch(`/store/cart`, {  });
      if (res.ok) {
        const json = await res.json();
        setCart(json.data?.data ?? null);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  async function updateQty(itemId: number, quantity: number) {
    setUpdating(itemId);
    setMessage(null);
    try {
      const res = await authFetch(`/store/cart/items/${itemId}`, {
        method: 'PUT',
        
        body: JSON.stringify({ quantity }),
      });
      const json = await res.json();
      if (res.ok) {
        await fetchCart();
      } else {
        setMessage({ type: 'error', text: json.message ?? 'Failed to update.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setUpdating(null);
    }
  }

  async function removeItem(itemId: number) {
    setUpdating(itemId);
    setMessage(null);
    try {
      const res = await authFetch(`/store/cart/items/${itemId}`, {
        method: 'DELETE',
        
      });
      if (res.ok) {
        await fetchCart();
      } else {
        setMessage({ type: 'error', text: 'Failed to remove item.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setUpdating(null);
    }
  }

  async function clearCart() {
    setMessage(null);
    try {
      const res = await authFetch(`/store/cart`, {
        method: 'DELETE',
        
      });
      if (res.ok) {
        await fetchCart();
        setMessage({ type: 'success', text: 'Cart cleared.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    }
  }

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6 lg:p-8">
        <div className="flex flex-col items-center text-center gap-4 py-16">
          <ShoppingBag className="w-16 h-16 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700">Your cart is empty</h2>
          <p className="text-gray-500">Browse physical products to add items to your cart.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2164b6] to-[#1a5091] p-8 text-white">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart className="h-8 w-8 text-white/80" />
            <h1 className="text-2xl font-bold">Cart</h1>
          </div>
          <p className="text-sm text-white/70">{cart.item_count} item{cart.item_count !== 1 ? 's' : ''} in your cart</p>
        </div>
      </div>

      <div className="px-6 lg:px-8 space-y-6">
        {message && (
          <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'
          }`}>
            {message.text}
          </div>
        )}

        <div className="flex items-center justify-end">
          <button
            onClick={clearCart}
            className="text-xs font-bold text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Clear cart
          </button>
        </div>

        <div className="space-y-3">
          {cart.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 shadow-xs"
            >
              <div className="w-20 h-20 bg-muted/50 rounded-lg flex-shrink-0 overflow-hidden">
                {item.product?.images?.[0] ? (
                  <img src={item.product.images[0]} alt={item.product.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No img</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate text-foreground">{item.product?.title ?? 'Unknown product'}</h3>
                <p className="text-xs text-muted-foreground">by @{item.product?.creator?.username}</p>
                <p className="text-sm font-bold mt-1 text-foreground">
                  {item.product ? formatPrice(item.product.price, item.product.currency) : '—'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQty(item.id, Math.max(1, item.quantity - 1))}
                  disabled={updating === item.id || item.quantity <= 1}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-medium text-sm">
                  {updating === item.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : item.quantity}
                </span>
                <button
                  onClick={() => updateQty(item.id, item.quantity + 1)}
                  disabled={updating === item.id || (item.product?.track_inventory && item.quantity >= (item.product?.stock_quantity ?? 99))}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="text-right min-w-[80px]">
                <p className="font-bold text-foreground">{formatPrice(item.line_total)}</p>
                <button
                  onClick={() => removeItem(item.id)}
                  disabled={updating === item.id}
                  className="text-red-400 hover:text-red-600 mt-1 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Total</span>
            <span className="font-bold text-xl text-foreground">{formatPrice(cart.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
