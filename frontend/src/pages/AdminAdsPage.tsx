import { useState, useEffect, useCallback } from "react";
import { AlertCircle, DollarSign, Loader2, Megaphone, Search, ThumbsUp, ThumbsDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

const REVIEW_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-orange-100 text-orange-700",
  removed: "bg-gray-100 text-gray-500",
};

export default function AdminAdsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"campaigns" | "revenue">("campaigns");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, sRes, rRes] = await Promise.all([
        fetch(`${API_BASE}/securegate/ads`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/securegate/ads/stats`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/securegate/ads/revenue`, { headers: getAuthHeaders() }),
      ]);
      if (cRes.ok) { const j = await cRes.json(); setCampaigns(j?.data ?? j); }
      if (sRes.ok) setStats(await sRes.json());
      if (rRes.ok) setRevenue(await rRes.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (id: number, action: string) => {
    let reason: string | null = null;
    if (action === "reject" || action === "suspend") {
      reason = prompt(`Reason for ${action}ing:`);
      if (!reason) return;
    }
    if (action === "remove" && !confirm("Permanently remove this campaign?")) return;

    try {
      const url = `${API_BASE}/securegate/ads/${id}/${action}`;
      const opts: RequestInit = { method: action === "remove" ? "DELETE" : "POST", headers: getAuthHeaders() };
      if (reason) opts.body = JSON.stringify({ reason });
      const res = await fetch(url, opts);
      if (res.ok) fetchData();
    } catch { /* ignore */ }
  };

  const filtered = campaigns.filter((c: any) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.user?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="w-6 h-6 text-purple-500" /> Advertisements</h1>
          <p className="text-sm text-gray-500 mt-1">Review, approve, and manage platform advertisements</p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === "campaigns" ? "default" : "outline"} size="sm" onClick={() => setTab("campaigns")}>Campaigns</Button>
          <Button variant={tab === "revenue" ? "default" : "outline"} size="sm" onClick={() => setTab("revenue")}>Revenue</Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total Campaigns</p>
            <p className="text-2xl font-bold">{stats.total_campaigns}</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active_campaigns}</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Pending Review</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending_review}</p>
          </div>
        </div>
      )}

      {tab === "revenue" && revenue && (
        <div className="bg-white border rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-500" /> Advertising Revenue</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-3xl font-bold">${parseFloat(revenue.total_revenue || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Campaigns</p>
              <p className="text-3xl font-bold">{revenue.active_campaigns}</p>
            </div>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search campaigns by name or advertiser..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold">{filtered.length} Campaigns</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No campaigns found.</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((c: any) => (
              <div key={c.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{c.name}</h3>
                      <Badge className={STATUS_COLORS[c.status] || ""}>{c.status}</Badge>
                      <Badge className={REVIEW_COLORS[c.review_status] || ""}>{c.review_status}</Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      by {c.user?.name || "Unknown"} ({c.user?.role})
                      {c.total_budget && <span className="ml-3">Budget: ${c.total_budget}</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Created {new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleAction(c.id, "approve")} className="text-green-600" title="Approve"><ThumbsUp className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleAction(c.id, "reject")} className="text-red-600" title="Reject"><ThumbsDown className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleAction(c.id, "suspend")} className="text-yellow-600" title="Suspend"><AlertCircle className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleAction(c.id, "remove")} className="text-red-600" title="Remove"><X className="w-4 h-4" /></Button>
                  </div>
                </div>
                {c.review_notes && <p className="text-xs text-red-500 mt-1">Notes: {c.review_notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
