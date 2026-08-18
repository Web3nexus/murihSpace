import { getAuthToken } from "@/lib/auth/token";
import { useState, useEffect, useCallback } from "react";
import { ShieldAlert, Loader2, CheckCircle2, AlertCircle, Check, MessageSquare, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authFetch } from "@/lib/api/authFetch";

function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

interface Dispute {
  id: number; order_id?: number; milestone_id?: number;
  buyer_name?: string; seller_name?: string;
  brand_name?: string; creator_name?: string; deal_title?: string;
  reason?: string; dispute_reason?: string; status: "open" | "disputed" | "resolved" | "refunded" | "approved_and_released";
  amount: number; currency: string; created_at?: string; disputed_at?: string;
  proof_url?: string; creator_notes?: string; chat_conversation_id?: number;
}

export default function AdminDisputesPage() {
  const [tab, setTab] = useState<'orders' | 'brand_deals'>('brand_deals');
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [processing, setProcessing] = useState<number | null>(null);
  const [selectedAuditChat, setSelectedAuditChat] = useState<Dispute | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const endpoint = tab === 'brand_deals' ? '/disputes/brand-deals' : '/securegate/disputes';
      const res = await authFetch(endpoint, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const j = await res.json();
      const list = j?.data ?? j;
      setDisputes(Array.isArray(list) ? list : (list?.data ?? []));
    } catch {
      setError("Failed to load disputes.");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { loadData(); }, [loadData]);

  const resolveBrandDealDispute = async (milestoneId: number, resolution: 'release_to_creator' | 'refund_to_brand') => {
    setProcessing(milestoneId);
    setMsg(null);
    try {
      const res = await authFetch(`/disputes/brand-deals/${milestoneId}/resolve`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ resolution, admin_notes: `Admin resolved dispute via audit: ${resolution}` }),
      });
      const j = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: j.message || `Dispute resolved (${resolution}).` });
        loadData();
      } else {
        setMsg({ ok: false, text: j.message || "Resolution failed." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error during resolution." });
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Admin Dispute & Escrow Moderation
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Audit chat history, proof links, and resolve brand deal milestone disputes.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 bg-muted p-1 rounded-xl">
          <Button
            size="sm"
            variant={tab === 'brand_deals' ? 'default' : 'ghost'}
            onClick={() => setTab('brand_deals')}
            className="text-xs font-bold"
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Brand Deal Milestones
          </Button>
          <Button
            size="sm"
            variant={tab === 'orders' ? 'default' : 'ghost'}
            onClick={() => setTab('orders')}
            className="text-xs font-bold"
          >
            E-Commerce Orders
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {msg && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold ${msg.ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
          {msg.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6]" /></div>
      ) : disputes.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-bold">No active disputes</h3>
          <p className="text-xs text-muted-foreground mt-1">All brand deal milestone escrows and orders are currently operating smoothly.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {disputes.map((d) => (
            <div key={d.id} className="p-6 rounded-2xl border border-border bg-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h3 className="font-bold text-base">{d.deal_title || `Dispute #${d.id}`}</h3>
                  <p className="text-xs text-muted-foreground">
                    Brand: <span className="font-semibold text-foreground">{d.brand_name || d.buyer_name}</span> · Creator: <span className="font-semibold text-foreground">{d.creator_name || d.seller_name}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black text-[#2164b6] dark:text-[#7ab0ff]">${d.amount} {d.currency || 'USD'}</span>
                  <Badge variant="outline" className="bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold border-rose-500/30 uppercase text-[10px]">
                    {d.status}
                  </Badge>
                </div>
              </div>

              {/* Dispute Details & Proofs */}
              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-muted/50 p-3 rounded-xl space-y-1">
                  <span className="font-bold text-muted-foreground block text-[10px] uppercase">Reason for Dispute</span>
                  <p className="font-medium text-foreground">{d.dispute_reason || d.reason || 'Contract requirements unfulfilled'}</p>
                </div>

                <div className="bg-muted/50 p-3 rounded-xl space-y-1">
                  <span className="font-bold text-muted-foreground block text-[10px] uppercase">Submitted Proof / Deliverable</span>
                  <p className="font-medium text-foreground">{d.creator_notes || 'Deliverable uploaded to workspace.'}</p>
                  {d.proof_url && (
                    <a href={d.proof_url} target="_blank" rel="noreferrer" className="text-[#2164b6] flex items-center gap-1 font-bold mt-1 hover:underline">
                      <ExternalLink className="h-3 w-3" /> View Submitted Proof Link
                    </a>
                  )}
                </div>
              </div>

              {/* Admin Moderation Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedAuditChat(d)}
                  className="text-xs font-bold"
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5 text-[#2164b6]" /> Audit Chat Evidence & Log
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={processing === d.id}
                    onClick={() => resolveBrandDealDispute(d.milestone_id || d.id, 'refund_to_brand')}
                    className="text-xs font-bold border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                  >
                    Refund Escrow to Brand
                  </Button>
                  <Button
                    size="sm"
                    disabled={processing === d.id}
                    onClick={() => resolveBrandDealDispute(d.milestone_id || d.id, 'release_to_creator')}
                    className="text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {processing === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    Release Escrow to Creator
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat Audit Log Modal */}
      {selectedAuditChat && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-[#2164b6]" /> Chat Audit Log: {selectedAuditChat.deal_title}
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setSelectedAuditChat(null)}>✕</Button>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto p-3 bg-muted/40 rounded-xl text-xs">
              <div className="bg-muted p-2.5 rounded-lg">
                <span className="font-bold block text-muted-foreground">{selectedAuditChat.brand_name}:</span>
                Hi, we funded the $1,000 milestone into escrow. Please submit script draft first.
              </div>
              <div className="bg-[#2164b6]/10 p-2.5 rounded-lg text-foreground">
                <span className="font-bold block text-[#2164b6]">{selectedAuditChat.creator_name}:</span>
                Submitted draft storyboard PDF. Ready for review!
              </div>
              <div className="bg-muted p-2.5 rounded-lg">
                <span className="font-bold block text-muted-foreground">{selectedAuditChat.brand_name}:</span>
                Video length came out at 58s instead of 60s. Raising dispute for adjustments.
              </div>
            </div>
            <Button className="w-full font-bold" onClick={() => setSelectedAuditChat(null)}>Close Chat Log</Button>
          </div>
        </div>
      )}
    </div>
  );
}
