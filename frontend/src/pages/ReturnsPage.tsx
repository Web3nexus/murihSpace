import { useState, useEffect, useCallback } from "react";
import { RotateCcw, Loader2, CheckCircle2, XCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = localStorage.getItem("murihspace-token") || localStorage.getItem("auth_token");
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface ReturnRequest {
  id: number; order_id: number; product_name: string; reason: string;
  status: "pending" | "approved" | "rejected"; created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-400",
  approved: "bg-emerald-500/20 text-emerald-400",
  rejected: "bg-rose-500/20 text-rose-400",
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchReturns = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/store/returns`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setReturns(list?.data ?? list ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const handleAction = async (id: number, action: "approve" | "reject") => {
    setProcessing(id);
    try {
      await fetch(`${API_BASE}/store/returns/${id}`, {
        method: "PATCH", headers: getAuthHeaders(),
        body: JSON.stringify({ status: action === "approve" ? "approved" : "rejected" }),
      });
      fetchReturns();
    } finally { setProcessing(null); }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  return (
    <div className="w-full mx-auto max-w-[1000px] space-y-6 p-6 lg:p-10">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <RotateCcw className="h-6 w-6 text-[#38A8D8]" /> Returns Management
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Process customer returns and exchanges.</p>
      </div>

      {returns.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card">
          <RotateCcw className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-bold">No return requests</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map((r) => (
            <div key={r.id} className="border border-border rounded-2xl bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <div className="flex items-center gap-3 min-w-0">
                  <RotateCcw className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{r.product_name}</p>
                    <p className="text-[11px] text-muted-foreground">Order #{r.order_id} · {new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              {expanded === r.id && (
                <div className="px-4 pb-4 pt-2 border-t border-border/50 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Reason</p>
                    <p className="text-xs text-foreground mt-1">{r.reason}</p>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" disabled={processing === r.id} onClick={() => handleAction(r.id, "approve")} className="text-[10px] h-7 gap-1">
                        {processing === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={processing === r.id} onClick={() => handleAction(r.id, "reject")} className="text-[10px] h-7 gap-1 text-destructive">
                        <XCircle className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
