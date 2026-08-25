import { useState, useEffect, useCallback } from "react";
import { Coins, Loader2, Plus, Edit, Trash2, Check, AlertCircle, MoveVertical, ToggleLeft, ToggleRight, BadgePercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { authFetch } from "@/lib/api/authFetch";
import { useConfirm } from "@/components/ui/DialogProvider";
import { getCachedData, setCachedData } from "@/lib/api/cacheStore";

interface CoinPack {
  id: number;
  name: string;
  coins: number;
  bonus_coins: number;
  price: number;
  currency: string;
  badge: string | null;
  is_active: boolean;
  sort_order: number;
}

function safeArray<T = any>(val: any): T[] {
  if (Array.isArray(val)) return val;
  if (Array.isArray(val?.data)) return val.data;
  if (Array.isArray(val?.data?.data)) return val.data.data;
  if (Array.isArray(val?.packs)) return val.packs;
  return [];
}

const CACHE_KEY_ADMIN_PACKS = "admin_coin_packs";

export default function AdminCoinPacksPage() {
  const [packs, setPacks] = useState<CoinPack[]>(() => getCachedData<CoinPack[]>(CACHE_KEY_ADMIN_PACKS) ?? []);
  const [loading, setLoading] = useState<boolean>(!getCachedData(CACHE_KEY_ADMIN_PACKS));
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CoinPack | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [form, setForm] = useState({ name: "", coins: "", bonus_coins: "", price: "", currency: "NGN", badge: "", sort_order: "" });

  const fetchPacks = useCallback(async (isSilent = false) => {
    if (!isSilent && !getCachedData(CACHE_KEY_ADMIN_PACKS)) {
      setLoading(true);
    }
    try {
      const res = await authFetch(`/securegate/coin-packs`, {});
      if (res.ok) {
        const j = await res.json();
        const parsed = safeArray<CoinPack>(j);
        setPacks(parsed);
        setCachedData(CACHE_KEY_ADMIN_PACKS, parsed);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchPacks(Boolean(getCachedData(CACHE_KEY_ADMIN_PACKS)));
  }, [fetchPacks]);

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
      const url = editing ? `/securegate/coin-packs/${editing.id}` : `/securegate/coin-packs`;
      const res = await authFetch(url, {
        method: editing ? "PUT" : "POST", 
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMsg({ ok: true, text: editing ? "Coin pack updated." : "Coin pack created." });
        setShowForm(false); setEditing(null); resetForm(); fetchPacks(true);
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j.message || "Failed to save." });
      }
    } catch { setMsg({ ok: false, text: "Error." }); }
    finally { setSaving(false); }
  };

  const handleEdit = (pack: CoinPack) => {
    setForm({ name: pack.name, coins: String(pack.coins), bonus_coins: String(pack.bonus_coins || 0), price: String(pack.price), currency: pack.currency || "NGN", badge: pack.badge || "", sort_order: String(pack.sort_order) });
    setEditing(pack); setShowForm(true);
  };

  const confirm = useConfirm();

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: "Delete Coin Pack", message: "Delete this coin pack?", variant: "destructive" })) return;
    // Optimistic deletion
    setPacks((prev) => prev.filter((p) => p.id !== id));
    try {
      await authFetch(`/securegate/coin-packs/${id}`, { method: "DELETE" });
      fetchPacks(true);
    } catch {
      fetchPacks(true);
    }
  };

  const handleToggle = async (pack: CoinPack) => {
    const nextStatus = !pack.is_active;
    // Optimistic update
    setPacks((prev) => prev.map((p) => (p.id === pack.id ? { ...p, is_active: nextStatus } : p)));
    try {
      await authFetch(`/securegate/coin-packs/${pack.id}`, {
        method: "PUT", 
        body: JSON.stringify({ is_active: nextStatus }),
      });
      fetchPacks(true);
    } catch {
      fetchPacks(true);
    }
  };

  const handleReorder = async () => {
    const safePacks = safeArray(packs);
    const order = safePacks.map((p, i) => ({ id: p.id, sort_order: i }));
    try {
      await authFetch(`/securegate/coin-packs/reorder`, {
        method: "POST", 
        body: JSON.stringify({ order }),
      });
      setMsg({ ok: true, text: "Order updated." });
      fetchPacks(true);
    } catch { setMsg({ ok: false, text: "Failed to reorder." }); }
  };

  const formatPrice = (p: CoinPack) => `${p.currency} ${((p.price || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const safePacksList = safeArray<CoinPack>(packs);

  return (
    <div className="w-full mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header - Meta Dark Surface */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-card border border-border text-foreground shadow-xs">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1877f2]/10 text-[#1877f2] text-xs font-bold uppercase tracking-wider border border-[#1877f2]/20">
            <Coins className="h-3.5 w-3.5" /> SecureGate Admin
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Coin Packs</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Define the coin packs users can buy to fund their wallet.</p>
        </div>
        <ActionTooltip content={showForm ? "Close form" : "Create new coin pack"}>
          <Button
            onClick={() => { setShowForm(!showForm); setEditing(null); resetForm(); }}
            className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold h-10 px-4 rounded-xl"
          >
            <Plus className="h-4 w-4 mr-2" />{showForm ? "Cancel" : "Add Coin Pack"}
          </Button>
        </ActionTooltip>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border ${
          msg.ok ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
        }`}>
          {msg.ok ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{msg.text}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
          <h2 className="text-sm font-bold text-foreground mb-4">{editing ? "Edit Coin Pack" : "New Coin Pack"}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="md:col-span-3 space-y-1">
              <Label className="text-xs font-bold">Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Starter, Popular, Pro" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1"><Label className="text-xs font-bold">Coins *</Label><Input type="number" min="1" value={form.coins} onChange={e => setForm(f => ({ ...f, coins: e.target.value }))} required className="h-10 rounded-xl" /></div>
            <div className="space-y-1"><Label className="text-xs font-bold">Bonus Coins</Label><Input type="number" min="0" value={form.bonus_coins} onChange={e => setForm(f => ({ ...f, bonus_coins: e.target.value }))} className="h-10 rounded-xl" /></div>
            <div className="space-y-1"><Label className="text-xs font-bold">Price (minor units) *</Label><Input type="number" min="1" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required className="h-10 rounded-xl" /></div>
            <div className="space-y-1"><Label className="text-xs font-bold">Currency</Label><Input value={form.currency} maxLength={3} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} className="h-10 rounded-xl" /></div>
            <div className="space-y-1"><Label className="text-xs font-bold">Badge</Label><Input value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} placeholder="e.g. Popular, Best value" className="h-10 rounded-xl" /></div>
            <div className="space-y-1"><Label className="text-xs font-bold">Sort Order</Label><Input type="number" min="0" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} className="h-10 rounded-xl" /></div>
            <div className="md:col-span-3 flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold h-10 px-5 rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}{editing ? "Update" : "Create"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }} className="h-10 rounded-xl">Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-muted/20">
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-500" /> Coin Packs
          </h2>
          <ActionTooltip content="Save sort order">
            <Button variant="outline" size="sm" onClick={handleReorder} className="text-xs font-bold rounded-xl"><MoveVertical className="h-4 w-4 mr-1" />Save Order</Button>
          </ActionTooltip>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : safePacksList.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-16 text-center">
            <Coins className="h-10 w-10 text-muted-foreground/30" />
            <h3 className="text-xs font-bold text-muted-foreground">No coin packs yet</h3>
            <p className="text-[11px] text-muted-foreground/70">Add your first pack to let users fund their wallet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {safePacksList.map((pack: CoinPack, idx: number) => (
              <div key={pack.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xs text-muted-foreground/50 w-6 shrink-0 font-bold">{idx + 1}.</span>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Coins className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-foreground truncate">{pack.name}</p>
                      {pack.badge && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          <BadgePercent className="h-3 w-3" />{pack.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate font-medium">
                      {(pack.coins || 0).toLocaleString()} coins{pack.bonus_coins ? ` + ${pack.bonus_coins} bonus` : ""} &middot; {formatPrice(pack)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-4">
                  <span className={`mr-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    pack.is_active ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {pack.is_active ? 'Active' : 'Disabled'}
                  </span>
                  <ActionTooltip content={pack.is_active ? "Disable pack" : "Enable pack"}>
                    <Button variant="ghost" size="icon" onClick={() => handleToggle(pack)}>
                      {pack.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </ActionTooltip>
                  <ActionTooltip content="Edit pack">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(pack)}>
                      <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                  </ActionTooltip>
                  <ActionTooltip content="Delete pack">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(pack.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </ActionTooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
