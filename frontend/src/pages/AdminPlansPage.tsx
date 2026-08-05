import { useState, useEffect, useCallback } from "react";
import { Crown, Loader2, Users, DollarSign, ToggleLeft, ToggleRight, Search, Percent, Save, X, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatAmount(amount: number, currency = "NGN"): string {
  const symbols: Record<string, string> = { NGN: "\u20A6", USD: "$", GBP: "\u00A3", EUR: "\u20AC" };
  return (symbols[currency] ?? currency + " ") + (amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
        active ? "bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] shadow-xs" : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

interface PlanItem {
  id: number; name: string; description: string | null; price: number;
  currency: string; billing_cycle: string; is_active: boolean;
  features: string[] | null; subscriber_count: number; created_at: string;
  creator: { id: number; name: string; username: string } | null;
}

interface PlanSummary {
  total_plans: number; active_plans: number; total_subscribers: number;
  mrr: number; creators_with_plans: number;
}

interface FeeConfig {
  id: number; fee_type: string; name: string; percentage: number;
  flat_fee: number; currency: string; is_active: boolean; description: string | null;
}

export function AdminPlansPage() {
  const [tab, setTab] = useState<"plans" | "fees">("plans");

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <span className="px-2.5 py-0.5 rounded-full bg-[#2164b6]/20 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-semibold uppercase tracking-wider border border-[#2164b6]/30">Admin</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Plans &amp; Platform Fees</h1>
          <p className="text-sm text-white/70 max-w-xl">Manage subscription plans and configure platform fee rates.</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border pb-3">
        <TabButton active={tab === "plans"} onClick={() => setTab("plans")}>
          <span className="flex items-center gap-1.5"><Crown className="h-3.5 w-3.5" />Subscription Plans</span>
        </TabButton>
        <TabButton active={tab === "fees"} onClick={() => setTab("fees")}>
          <span className="flex items-center gap-1.5"><Percent className="h-3.5 w-3.5" />Platform Fees</span>
        </TabButton>
      </div>

      {tab === "plans" && <PlansTab />}
      {tab === "fees" && <FeesTab />}
    </div>
  );
}

function PlansTab() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [summary, setSummary] = useState<PlanSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchPlans = useCallback(async () => {
    setFetchError(null);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "50" });
      if (search) params.set("search", search);
      const res = await fetch(`${API_BASE}/securegate/plans?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load plans");
      const j = await res.json();
      setPlans(j.data?.data?.data ?? j.data?.data ?? []);
      setSummary(j.data?.summary ?? null);
      setLastPage(j.data?.data?.last_page ?? 1);
    } catch (e) { setFetchError(e instanceof Error ? e.message : "Failed to load plans"); }
    finally { setIsLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  async function toggleActive(id: number) {
    try {
      const res = await fetch(`${API_BASE}/securegate/plans/${id}/toggle`, { method: "POST", headers: getAuthHeaders() });
      const j = await res.json();
      if (res.ok) { setMessage({ type: "success", text: "Plan toggled." }); fetchPlans(); }
      else { setMessage({ type: "error", text: j.message ?? "Failed." }); }
    } catch { setMessage({ type: "error", text: "Network error." }); }
  }

  if (isLoading) return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 w-full mx-auto max-w-[1400px] p-6 lg:p-10">
      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setIsLoading(true); fetchPlans(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 border ${
          message.type === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
        }`}>{message.text}</div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Plans", value: summary.total_plans, icon: Crown, color: "text-[#2164b6] dark:text-[#7ab0ff]" },
            { label: "Active Plans", value: summary.active_plans, icon: ToggleRight, color: "text-emerald-500" },
            { label: "Active Subscribers", value: summary.total_subscribers, icon: Users, color: "text-blue-500" },
            { label: "MRR", value: formatAmount(summary.mrr), icon: DollarSign, color: "text-purple-500" },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <Icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search plans..." className="pl-9 text-sm" />
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-card">
          <Crown className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <h3 className="text-base font-semibold text-foreground">No subscription plans</h3>
          <p className="text-xs text-muted-foreground">Creators haven't created any plans yet.</p>
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
          <div className="divide-y divide-border/50">
            {plans.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-xl ${p.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"} shrink-0`}>
                    <Crown className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground truncate">{p.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${p.is_active ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      @{p.creator?.username ?? "?"} &middot; {formatAmount(p.price, p.currency)}/{p.billing_cycle} &middot; {p.subscriber_count} subscribers
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Button variant="ghost" size="icon" onClick={() => toggleActive(p.id)} title={p.is_active ? "Deactivate" : "Activate"}>
                    {p.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

function FeesTab() {
  const [fees, setFees] = useState<FeeConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ percentage: string; flat_fee: string }>({ percentage: "", flat_fee: "" });

  const fetchFees = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/securegate/fees`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load fees");
      const j = await res.json();
      const d = j.success ? j.data : j;
      setFees(Array.isArray(d) ? d : d?.data ?? []);
    } catch (e) { setFetchError(e instanceof Error ? e.message : "Failed to load fees"); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchFees(); }, [fetchFees]);

  function startEdit(fee: FeeConfig) {
    setEditingId(fee.id);
    setEditValues({ percentage: String(fee.percentage), flat_fee: String(Math.round(fee.flat_fee / 100)) });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: number) {
    const pct = parseFloat(editValues.percentage);
    const flat = parseFloat(editValues.flat_fee);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100 || !Number.isFinite(flat) || flat < 0) {
      setMessage({ type: "error", text: "Enter a percentage between 0 and 100 and a non-negative flat fee." });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/securegate/fees/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          percentage: pct,
          flat_fee: Math.round(flat * 100),
        }),
      });
      const j = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Fee rate updated." });
        setEditingId(null);
        fetchFees();
      } else {
        setMessage({ type: "error", text: j.message ?? "Failed to update." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    }
  }

  async function toggleFee(id: number, current: boolean) {
    try {
      const res = await fetch(`${API_BASE}/securegate/fees/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: !current }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Fee toggled." });
        fetchFees();
      } else {
        const j = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: j.message ?? "Failed to toggle fee." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    }
  }

  const feeLabels: Record<string, string> = {
    digital_product: "Digital Products",
    physical_product: "Physical Products",
    subscription: "Subscriptions",
    withdrawal: "Withdrawals",
    transfer: "P2P Transfers",
    escrow: "Escrow Holdings",
  };

  if (isLoading) return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setIsLoading(true); fetchFees(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 border justify-between ${
          message.type === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Configure platform fee rates applied to transactions. Changes take effect immediately.
        </p>
        <Button variant="ghost" size="sm" onClick={fetchFees} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {fees.map(fee => {
          const isEditing = editingId === fee.id;
          return (
            <div key={fee.id} className={`rounded-2xl border bg-card p-5 transition-all ${fee.is_active ? "border-border" : "border-dashed border-border/50 opacity-60"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-bold text-foreground">{feeLabels[fee.fee_type] ?? fee.name}</h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      fee.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                    }`}>
                      {fee.is_active ? "Active" : "Disabled"}
                    </span>
                  </div>
                  {fee.description && (
                    <p className="text-xs text-muted-foreground mb-3">{fee.description}</p>
                  )}

                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Percentage</span>
                      {isEditing ? (
                        <div className="flex items-center gap-1 mt-1">
                          <Input
                            value={editValues.percentage}
                            onChange={e => setEditValues(v => ({ ...v, percentage: e.target.value }))}
                            className="w-20 h-8 text-sm text-right"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      ) : (
                        <p className="text-lg font-black text-foreground mt-0.5">{fee.percentage}%</p>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Flat Fee</span>
                      {isEditing ? (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-muted-foreground">{fee.currency === "NGN" ? "\u20A6" : "$"}</span>
                          <Input
                            value={editValues.flat_fee}
                            onChange={e => setEditValues(v => ({ ...v, flat_fee: e.target.value }))}
                            className="w-24 h-8 text-sm text-right"
                            type="number"
                            min="0"
                          />
                        </div>
                      ) : (
                        <p className="text-lg font-black text-foreground mt-0.5">
                          {fee.flat_fee > 0 ? formatAmount(fee.flat_fee, fee.currency) : "None"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isEditing ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8 gap-1">
                        <X className="h-3.5 w-3.5" /> Cancel
                      </Button>
                      <Button size="sm" onClick={() => saveEdit(fee.id)} className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-500 text-white">
                        <Save className="h-3.5 w-3.5" /> Save
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => toggleFee(fee.id, fee.is_active)} className="h-8">
                        {fee.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(fee)} className="h-8 gap-1">
                        <Percent className="h-3.5 w-3.5" /> Edit Rate
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
