import { useState, useEffect, useCallback } from "react";
import { useConfirm } from "@/components/ui/DialogProvider";
import { Crown, Plus, Loader2, Edit, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface MembershipPlan {
  id: number;
  name: string;
  price: number;
  currency: string;
  interval: "monthly" | "yearly";
  status: "active" | "inactive";
  subscriber_count?: number;
  created_at: string;
}

export default function StoreMembershipsPage() {
  const confirm = useConfirm();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("9.99");
  const [currency, setCurrency] = useState("USD");
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/store/memberships?page=${page}&per_page=20`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setPlans(list?.data ?? list ?? []);
      setLastPage(list?.last_page ?? 1);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const resetForm = () => { setName(""); setPrice("9.99"); setCurrency("USD"); setInterval("monthly"); setEditing(null); setShowForm(false); setMsg(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const body = { name: name.trim(), price: Math.round(parseFloat(price) * 100), currency, interval };
      const res = editing
        ? await fetch(`${API_BASE}/store/memberships/${editing.id}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(body) })
        : await fetch(`${API_BASE}/store/memberships`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      resetForm();
      fetchPlans();
      setMsg({ ok: true, text: editing ? "Plan updated." : "Plan created." });
      setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
    } finally { setSaving(false); }
  };

  const toggleStatus = async (p: MembershipPlan) => {
    await fetch(`${API_BASE}/store/memberships/${p.id}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify({ status: p.status === "active" ? "inactive" : "active" }) });
    fetchPlans();
  };

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: 'Delete Plan', message: 'Delete this plan?', variant: 'destructive' })) return;
    await fetch(`${API_BASE}/store/memberships/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    fetchPlans();
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Crown className="h-6 w-6 text-[#38A8D8]" /> Memberships
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Create and manage recurring membership plans.</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="text-sm font-bold gap-1.5">
          <Plus className="h-4 w-4" /> New Plan
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="border border-border rounded-2xl bg-card p-6 space-y-4">
          {msg && <div className={`p-3 rounded-xl text-xs font-bold ${msg.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>{msg.text}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Plan Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Premium Membership" required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Billing Interval</label>
              <select value={interval} onChange={(e) => setInterval(e.target.value as "monthly" | "yearly")} className="w-full rounded-xl border border-border bg-card p-2.5 text-sm font-medium text-foreground">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Price</label>
              <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-xl border border-border bg-card p-2.5 text-sm font-medium text-foreground">
                {["USD", "NGN", "GBP", "EUR"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving || !name.trim()} className="text-sm font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editing ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm} className="text-sm">Cancel</Button>
          </div>
        </form>
      )}

      {plans.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card">
          <Crown className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-bold">No membership plans</h3>
          <p className="text-xs text-muted-foreground mt-1">Create your first membership plan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="border border-border rounded-2xl bg-card p-6 space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{p.name}</h3>
                    <p className="text-[10px] text-muted-foreground">{p.interval}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{p.status}</span>
              </div>
              <div>
                <span className="text-2xl font-black text-foreground">{p.currency} {p.price ? (p.price / 100).toFixed(2) : "0.00"}</span>
                <span className="text-xs text-muted-foreground">/{p.interval === 'monthly' ? 'mo' : 'yr'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3 w-3" /> {p.subscriber_count ?? 0} subscribers
              </div>
              <div className="flex gap-1 pt-2">
                <Button size="sm" variant="outline" className="text-[10px] h-7 flex-1" onClick={() => toggleStatus(p)}>{p.status === 'active' ? 'Deactivate' : 'Activate'}</Button>
                <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setEditing(p); setName(p.name); setPrice(String(p.price / 100)); setCurrency(p.currency); setInterval(p.interval); setShowForm(true); setMsg(null); }}><Edit className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
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
