import { useState, useEffect, useCallback } from "react";
import { Package, Loader2, Edit, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface InventoryItem {
  id: number; product_id: number; product_name: string; sku: string;
  quantity: number; low_stock_threshold: number; reserved: number;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [editQty, setEditQty] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/store/inventory`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setItems(list?.data ?? list ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleUpdate = async (id: number) => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/store/inventory/${id}`, {
        method: "PATCH", headers: getAuthHeaders(),
        body: JSON.stringify({ quantity: parseInt(editQty) }),
      });
      setEditing(null);
      fetchItems();
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <Package className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Inventory Management
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Track and manage product stock levels.</p>
      </div>

      {items.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card">
          <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-bold">No inventory items</h3>
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border">
                <tr className="text-left">
                  {["Product", "SKU", "In Stock", "Reserved", "Available", "Status", ""].map((h) => <th key={h} className="px-4 py-3 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item) => {
                  const available = item.quantity - item.reserved;
                  const low = item.quantity <= item.low_stock_threshold;
                  return (
                    <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">{item.product_name}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{item.sku}</td>
                      <td className="px-4 py-3 font-bold text-foreground">{item.quantity}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.reserved}</td>
                      <td className="px-4 py-3 font-bold">{available}</td>
                      <td className="px-4 py-3">
                        {low ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400">
                            <AlertTriangle className="h-3 w-3" /> Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">In Stock</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editing?.id === item.id ? (
                          <div className="flex gap-1 items-center">
                            <Input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)} className="w-20 h-7 text-xs" />
                            <Button size="sm" disabled={saving} onClick={() => handleUpdate(item.id)} className="h-7 text-[10px]">Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)} className="h-7 text-[10px]">Cancel</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setEditing(item); setEditQty(String(item.quantity)); }}>
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
