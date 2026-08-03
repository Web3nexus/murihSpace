import { useState, useEffect, useCallback } from "react";
import { Gift, Loader2, Plus, Edit, Trash2, Check, AlertCircle, MoveVertical, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthToken } from "@/lib/auth/token";
import { useConfirm } from "@/components/ui/DialogProvider";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const CATEGORIES = ["standard", "premium", "limited", "exclusive"];

export default function AdminGiftsPage() {
  const [gifts, setGifts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [form, setForm] = useState({ name: "", coin_price: "", creator_earns: "", platform_commission: "", category: "standard", icon_url: "", animation_url: "", sort_order: "" });

  const fetchGifts = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, sRes] = await Promise.all([
        fetch(`${API_BASE}/securegate/gifts`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/securegate/gifts/stats`, { headers: getAuthHeaders() }),
      ]);
      if (gRes.ok) {
        const j = await gRes.json();
        setGifts(j?.data ?? []);
      }
      if (sRes.ok) {
        const j = await sRes.json();
        setStats(j?.data ?? null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGifts(); }, [fetchGifts]);

  const resetForm = () => setForm({ name: "", coin_price: "", creator_earns: "", platform_commission: "", category: "standard", icon_url: "", animation_url: "", sort_order: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    const body = { ...form, coin_price: parseInt(form.coin_price), creator_earns: parseInt(form.creator_earns), platform_commission: parseInt(form.platform_commission), sort_order: form.sort_order ? parseInt(form.sort_order) : 0 };

    try {
      const url = editing ? `${API_BASE}/securegate/gifts/${editing.id}` : `${API_BASE}/securegate/gifts`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST", headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMsg({ ok: true, text: editing ? "Gift updated." : "Gift created." });
        setShowForm(false); setEditing(null); resetForm(); fetchGifts();
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j.message || "Failed to save." });
      }
    } catch { setMsg({ ok: false, text: "Error." }); }
    finally { setSaving(false); }
  };

  const handleEdit = (gift: any) => {
    setForm({ name: gift.name, coin_price: String(gift.coin_price), creator_earns: String(gift.creator_earns), platform_commission: String(gift.platform_commission), category: gift.category, icon_url: gift.icon_url || "", animation_url: gift.animation_url || "", sort_order: String(gift.sort_order) });
    setEditing(gift); setShowForm(true);
  };

  const confirm = useConfirm();

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: "Delete Gift", message: "Delete this gift?", variant: "destructive" })) return;
    try {
      await fetch(`${API_BASE}/securegate/gifts/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      fetchGifts();
    } catch { /* ignore */ }
  };

  const handleToggle = async (gift: any) => {
    try {
      await fetch(`${API_BASE}/securegate/gifts/${gift.id}`, {
        method: "PUT", headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: !gift.is_active }),
      });
      fetchGifts();
    } catch { /* ignore */ }
  };

  const handleReorder = async () => {
    const order = gifts.map((g, i) => ({ id: g.id, sort_order: i }));
    try {
      await fetch(`${API_BASE}/securegate/gifts/reorder`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ order }),
      });
      setMsg({ ok: true, text: "Order updated." });
    } catch { setMsg({ ok: false, text: "Failed to reorder." }); }
  };

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#38A8D8]/20 text-[#38A8D8] text-xs font-semibold uppercase tracking-wider border border-[#38A8D8]/30">
            <Gift className="h-3.5 w-3.5" /> Admin
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Gift Management</h1>
          <p className="text-sm text-white/70 max-w-xl">Manage the virtual gift catalogue</p>
        </div>
        <Button
          onClick={() => { setShowForm(!showForm); setEditing(null); resetForm(); }}
          className="bg-[#38A8D8] hover:bg-[#2d94c2] text-white font-bold"
        >
          <Plus className="h-4 w-4 mr-2" />{showForm ? "Cancel" : "Add Gift"}
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Total Gifts', value: gifts.length, color: 'text-[#38A8D8]' },
            { label: 'Total Transactions', value: stats?.total_transactions ?? 0, color: 'text-emerald-500' },
            { label: 'Platform Commission', value: stats?.total_commission ?? 0, color: 'text-amber-500' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${
          msg.ok ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          {msg.ok ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{msg.text}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-bold text-foreground mb-4">{editing ? "Edit Gift" : "New Gift"}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div><Label>Coin Price *</Label><Input type="number" min="1" value={form.coin_price} onChange={e => setForm(f => ({ ...f, coin_price: e.target.value }))} required /></div>
            <div><Label>Creator Earns *</Label><Input type="number" min="0" value={form.creator_earns} onChange={e => setForm(f => ({ ...f, creator_earns: e.target.value }))} required /></div>
            <div><Label>Platform Commission *</Label><Input type="number" min="0" value={form.platform_commission} onChange={e => setForm(f => ({ ...f, platform_commission: e.target.value }))} required /></div>
            <div>
              <Label>Category</Label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>Sort Order</Label><Input type="number" min="0" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} /></div>
            <div><Label>Icon URL</Label><Input value={form.icon_url} onChange={e => setForm(f => ({ ...f, icon_url: e.target.value }))} /></div>
            <div><Label>Animation URL</Label><Input value={form.animation_url} onChange={e => setForm(f => ({ ...f, animation_url: e.target.value }))} /></div>
            <div className="md:col-span-3 flex gap-3">
              <Button type="submit" disabled={saving} className="bg-[#38A8D8] hover:bg-[#2d94c2] text-white font-bold">
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
            <Gift className="h-4 w-4 text-pink-500" /> Gift Catalogue
          </h2>
          <Button variant="outline" size="sm" onClick={handleReorder}><MoveVertical className="h-4 w-4 mr-1" />Save Order</Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : gifts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Gift className="h-10 w-10 text-muted-foreground/30" />
            <h3 className="text-sm font-bold text-muted-foreground">No gifts yet</h3>
            <p className="text-xs text-muted-foreground/60">Add your first gift to let creators receive coins</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {gifts.map((gift: any, idx: number) => (
              <div key={gift.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xs text-muted-foreground/50 w-6 shrink-0">{idx + 1}.</span>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-100 to-purple-50 border border-pink-200/60 flex items-center justify-center shrink-0">
                    {gift.icon_url ? <img src={gift.icon_url} className="w-6 h-6 object-contain" /> : <Gift className="w-5 h-5 text-pink-500" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground truncate">{gift.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                        gift.category === 'premium' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : gift.category === 'exclusive' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : gift.category === 'limited' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {gift.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {gift.coin_price} coins &middot; Creator earns {gift.creator_earns} &middot; Fee {gift.platform_commission}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-4">
                  <span className={`mr-2 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    gift.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {gift.is_active ? 'Active' : 'Disabled'}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => handleToggle(gift)} title={gift.is_active ? "Disable" : "Enable"}>
                    {gift.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(gift)} title="Edit">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(gift.id)} title="Delete">
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
