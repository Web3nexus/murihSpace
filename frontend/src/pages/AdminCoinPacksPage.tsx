import { useState, useEffect, useCallback } from "react";
import { Coins, Loader2, Plus, Edit, Trash2, Check, AlertCircle, MoveVertical, ToggleLeft, ToggleRight, BadgePercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthToken } from "@/lib/auth/token";
import { useConfirm } from "@/components/ui/DialogProvider";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function AdminCoinPacksPage() {
  const [packs, setPacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [form, setForm] = useState({ name: "", coins: "", bonus_coins: "", price: "", currency: "NGN", badge: "", sort_order: "" });

  const fetchPacks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/securegate/coin-packs`, { headers: getAuthHeaders() });
      if (res.ok) { const j = await res.json(); setPacks(j?.data ?? j ?? []); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPacks(); }, [fetchPacks]);

  const resetForm = () => setForm({ name: "", coins: "", bonus_coins: "", price: "", currency: "NGN", badge: "", sort_order: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    const body = {
      ...form,
      coins: parseInt(form.coins),
      bonus_coins: form.bonus_coins ? parseInt(form.bonus_coins) : 0,
      price: parseInt(form.price),
      sort_order: form.sort_order ? parseInt(form.sort_order) : 0,
      is_active: editing ? editing.is_active : true,
    };

    try {
      const url = editing ? `${API_BASE}/securegate/coin-packs/${editing.id}` : `${API_BASE}/securegate/coin-packs`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST", headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMsg({ ok: true, text: editing ? "Coin pack updated." : "Coin pack created." });
        setShowForm(false); setEditing(null); resetForm(); fetchPacks();
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j.message || "Failed to save." });
      }
    } catch { setMsg({ ok: false, text: "Error." }); }
    finally { setSaving(false); }
  };

  const handleEdit = (pack: any) => {
    setForm({ name: pack.name, coins: String(pack.coins), bonus_coins: String(pack.bonus_coins || 0), price: String(pack.price), currency: pack.currency || "NGN", badge: pack.badge || "", sort_order: String(pack.sort_order) });
    setEditing(pack); setShowForm(true);
  };

  const confirm = useConfirm();

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: "Delete Coin Pack", message: "Delete this coin pack?", variant: "destructive" })) return;
    try {
      await fetch(`${API_BASE}/securegate/coin-packs/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      fetchPacks();
    } catch { /* ignore */ }
  };

  const handleToggle = async (pack: any) => {
    try {
      await fetch(`${API_BASE}/securegate/coin-packs/${pack.id}`, {
        method: "PUT", headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: !pack.is_active }),
      });
      fetchPacks();
    } catch { /* ignore */ }
  };

  const handleReorder = async () => {
    const order = packs.map((p, i) => ({ id: p.id, sort_order: i }));
    try {
      await fetch(`${API_BASE}/securegate/coin-packs/reorder`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ order }),
      });
      setMsg({ ok: true, text: "Order updated." });
    } catch { setMsg({ ok: false, text: "Failed to reorder." }); }
  };

  const formatPrice = (p: any) => `${p.currency} ${(p.price / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2164b6]/20 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-semibold uppercase tracking-wider border border-[#2164b6]/30">
            <Coins className="h-3.5 w-3.5" /> Admin
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Coin Packs</h1>
          <p className="text-sm text-white/70 max-w-xl">Define the coin packs users can buy to fund their wallet</p>
        </div>
        <Button
          onClick={() => { setShowForm(!showForm); setEditing(null); resetForm(); }}
          className="bg-[#2164b6] hover:bg-[#2d94c2] text-white font-bold"
        >
          <Plus className="h-4 w-4 mr-2" />{showForm ? "Cancel" : "Add Coin Pack"}
        </Button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${
          msg.ok ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          {msg.ok ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{msg.text}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-bold text-foreground mb-4">{editing ? "Edit Coin Pack" : "New Coin Pack"}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Starter, Popular, Pro" />
            </div>
            <div><Label>Coins *</Label><Input type="number" min="1" value={form.coins} onChange={e => setForm(f => ({ ...f, coins: e.target.value }))} required /></div>
            <div><Label>Bonus Coins</Label><Input type="number" min="0" value={form.bonus_coins} onChange={e => setForm(f => ({ ...f, bonus_coins: e.target.value }))} /></div>
            <div><Label>Price (minor units) *</Label><Input type="number" min="1" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required /></div>
            <div><Label>Currency</Label><Input value={form.currency} maxLength={3} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} /></div>
            <div><Label>Badge</Label><Input value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} placeholder="e.g. Popular, Best value" /></div>
            <div><Label>Sort Order</Label><Input type="number" min="0" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} /></div>
            <div className="md:col-span-3 flex gap-3">
              <Button type="submit" disabled={saving} className="bg-[#2164b6] hover:bg-[#2d94c2] text-white font-bold">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}{editing ? "Update" : "Create"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-muted/30">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-500" /> Coin Packs
          </h2>
          <Button variant="outline" size="sm" onClick={handleReorder}><MoveVertical className="h-4 w-4 mr-1" />Save Order</Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : packs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Coins className="h-10 w-10 text-muted-foreground/30" />
            <h3 className="text-sm font-bold text-muted-foreground">No coin packs yet</h3>
            <p className="text-xs text-muted-foreground/60">Add your first pack to let users fund their wallet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {packs.map((pack: any, idx: number) => (
              <div key={pack.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xs text-muted-foreground/50 w-6 shrink-0">{idx + 1}.</span>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-yellow-50 border border-amber-200/60 flex items-center justify-center shrink-0">
                    <Coins className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground truncate">{pack.name}</p>
                      {pack.badge && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          <BadgePercent className="h-3 w-3" />{pack.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {pack.coins.toLocaleString()} coins{pack.bonus_coins ? ` + ${pack.bonus_coins} bonus` : ""} &middot; {formatPrice(pack)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-4">
                  <span className={`mr-2 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    pack.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {pack.is_active ? 'Active' : 'Disabled'}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => handleToggle(pack)} title={pack.is_active ? "Disable" : "Enable"}>
                    {pack.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(pack)} title="Edit">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(pack.id)} title="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
