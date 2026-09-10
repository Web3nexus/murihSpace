import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { useConfirm } from "@/components/ui/DialogProvider";
import {
  Crown as Crown,
  Plus as Plus,
  Spinner as Loader2,
  Pencil as Edit,
  Trash as Trash2,
  Users as Users,
  UsersThree,
  ChatCircleDots,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/authFetch";





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
      const res = await authFetch(`/store/memberships?page=${page}&per_page=20`, {  });
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
        ? await authFetch(`/store/memberships/${editing.id}`, { method: "PATCH",  body: JSON.stringify(body) })
        : await authFetch(`/store/memberships`, { method: "POST",  body: JSON.stringify(body) });
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
    await authFetch(`/store/memberships/${p.id}`, { method: "PATCH",  body: JSON.stringify({ status: p.status === "active" ? "inactive" : "active" }) });
    fetchPlans();
  };

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: 'Delete Plan', message: 'Delete this plan?', variant: 'destructive' })) return;
    await authFetch(`/store/memberships/${id}`, { method: "DELETE",  });
    fetchPlans();
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 weight="fill" className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-4 lg:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2.5">
            <Crown weight="fill" className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Memberships
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Create and manage recurring membership plans.</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="text-sm font-bold gap-1.5">
          <Plus weight="fill" className="h-4 w-4" /> New Plan
        </Button>
      </div>

      {/* Consolidation Notice */}
      <div className="rounded-2xl border border-secondary/25 bg-secondary/10 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UsersThree weight="fill" className="h-5 w-5 text-secondary" />
            <h2 className="text-sm font-bold text-foreground">
              Memberships have moved to Communities & Groups
            </h2>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Recurring subscription tiers and memberships are now managed directly where your members interact — inside your Communities and Groups.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/app/communities"
            className="px-3.5 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <UsersThree weight="fill" className="h-4 w-4" /> Go to Communities
          </Link>
          <Link
            to="/app/groups"
            className="px-3.5 py-2 rounded-xl bg-card border border-border text-foreground text-xs font-bold hover:bg-muted transition-all flex items-center gap-1.5"
          >
            <ChatCircleDots weight="fill" className="h-4 w-4" /> Go to Groups
          </Link>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="border-none rounded-lg bg-card p-4 space-y-4">
          {msg && <div className={`p-3 rounded-lg text-xs font-bold ${msg.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>{msg.text}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Plan Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Premium Membership" required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Billing Interval</label>
              <select value={interval} onChange={(e) => setInterval(e.target.value as "monthly" | "yearly")} className="w-full rounded-lg border-none bg-card p-2.5 text-sm font-medium text-foreground">
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
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-lg border-none bg-card p-2.5 text-sm font-medium text-foreground">
                {["USD", "NGN", "GBP", "EUR"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving || !name.trim()} className="text-sm font-bold">
              {saving ? <Loader2 weight="fill" className="h-4 w-4 animate-spin mr-2" /> : null}{editing ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm} className="text-sm">Cancel</Button>
          </div>
        </form>
      )}

      {plans.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card">
          <Crown weight="fill" className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-bold">No membership plans</h3>
          <p className="text-xs text-muted-foreground mt-1">Create your first membership plan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="border-none rounded-lg bg-card p-4 space-y-4 hover: transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Crown weight="fill" className="h-5 w-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{p.name}</h3>
                    <p className="text-[10px] text-muted-foreground">{p.interval}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{p.status}</span>
              </div>
              <div>
                <span className="text-xl font-black text-foreground">{p.currency} {p.price ? (p.price / 100).toFixed(2) : "0.00"}</span>
                <span className="text-xs text-muted-foreground">/{p.interval === 'monthly' ? 'mo' : 'yr'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users weight="fill" className="h-3 w-3" /> {p.subscriber_count ?? 0} subscribers
              </div>
              <div className="flex gap-1 pt-2">
                <Button size="sm" variant="outline" className="text-[10px] h-7 flex-1" onClick={() => toggleStatus(p)}>{p.status === 'active' ? 'Deactivate' : 'Activate'}</Button>
                <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setEditing(p); setName(p.name); setPrice(String(p.price / 100)); setCurrency(p.currency); setInterval(p.interval); setShowForm(true); setMsg(null); }}><Edit weight="fill" className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => handleDelete(p.id)}><Trash2 weight="fill" className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-bold border-none bg-card hover:bg-muted disabled:opacity-40">Previous</button>
          <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
          <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="px-3 py-1.5 rounded-lg text-xs font-bold border-none bg-card hover:bg-muted disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
