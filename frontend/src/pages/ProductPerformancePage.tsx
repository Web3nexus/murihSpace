import { useState, useEffect, useCallback } from "react";
import { BarChart3, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface ProductStats {
  product_id: number; product_name: string; total_sales: number;
  total_revenue: number; currency: string; trend: "up" | "down" | "stable";
}

export default function ProductPerformancePage() {
  const [stats, setStats] = useState<ProductStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/analytics/products`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setStats(list?.data ?? list ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  const totalRevenue = stats.reduce((sum, s) => sum + s.total_revenue, 0);
  const totalSales = stats.reduce((sum, s) => sum + s.total_sales, 0);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <BarChart3 className="h-6 w-6 text-[#38A8D8]" /> Product Performance
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Analytics for your product performance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border rounded-2xl bg-card p-5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Revenue</p>
          <p className="text-2xl font-black text-foreground mt-1">{stats[0]?.currency ?? 'USD'} {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="border border-border rounded-2xl bg-card p-5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Sales</p>
          <p className="text-2xl font-black text-foreground mt-1">{totalSales}</p>
        </div>
      </div>

      {stats.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card">
          <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-bold">No data yet</h3>
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border">
                <tr className="text-left">
                  {["Product", "Sales", "Revenue", "Trend"].map((h) => <th key={h} className="px-4 py-3 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {stats.map((s) => (
                  <tr key={s.product_id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{s.product_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.total_sales}</td>
                    <td className="px-4 py-3 font-mono font-bold text-foreground">{s.currency} {s.total_revenue.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {s.trend === 'up' ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : s.trend === 'down' ? <TrendingDown className="h-4 w-4 text-rose-400" /> : <Minus className="h-4 w-4 text-muted-foreground" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
