import { useState, useEffect, useCallback } from "react";
import {
  Gift,
  Spinner as Loader2,
  Plus,
  Pencil as Edit,
  Trash as Trash2,
  Check,
  WarningCircle as AlertCircle,
  ArrowsVertical,
  ToggleLeft,
  ToggleRight,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/api/authFetch";
import { useConfirm } from "@/components/ui/DialogProvider";

const CATEGORIES = ["standard", "premium", "limited", "exclusive"];

const AVAILABLE_ASSETS = [
  { name: "Love", url: "/gifts/love.png" },
  { name: "Legit", url: "/gifts/legit.png" },
  { name: "Legit Gold", url: "/gifts/legit2.png" },
  { name: "Wine", url: "/gifts/wine.png" },
  { name: "Vintage Champagne", url: "/gifts/wine2.png" },
  { name: "Hookup", url: "/gifts/hookup.png" },
  { name: "Hookup Passion", url: "/gifts/hookup2.png" },
  { name: "Let's Hookup", url: "/gifts/lethookup.png" },
  { name: "Ankh of Life", url: "/gifts/ankh.png" },
  { name: "Party Time", url: "/gifts/party.png" },
  { name: "Hand of Fatima", url: "/gifts/handoffatima.png" },
  { name: "Aries", url: "/gifts/aries.png" },
  { name: "Taurus", url: "/gifts/taurus.png" },
  { name: "Gemini", url: "/gifts/gemini.png" },
  { name: "Cancer", url: "/gifts/cancer.png" },
  { name: "Leo", url: "/gifts/leo.png" },
  { name: "Virgo", url: "/gifts/virgo.png" },
  { name: "Church", url: "/gifts/church.png" },
  { name: "Mosque", url: "/gifts/mosque.png" },
  { name: "Mentor", url: "/gifts/mentor.png" },
  { name: "Anpu", url: "/gifts/anpu.png" },
  { name: "Shrine", url: "/gifts/shrine.png" },
  { name: "Golden Taurus", url: "/gifts/taurus2.png" },
  { name: "Master Key", url: "/gifts/master.png" },
  { name: "Supreme Master", url: "/gifts/master2.png" },
  { name: "Thoth Djehuti", url: "/gifts/thot_djehuti.png" },
  { name: "Thoth Djehuti Divine", url: "/gifts/thot_djehuti_2.png" },
  { name: "King", url: "/gifts/king.png" },
  { name: "Cruise", url: "/gifts/cruise.png" },
  { name: "Mansion", url: "/gifts/mansion.png" },
];

function getAssetUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const apiBase = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";
  const backendHost = apiBase.replace(/\/api\/v1\/?$/, "");
  return `${backendHost}${path.startsWith('/') ? '' : '/'}${path}`;
}

function safeArray<T = any>(val: any): T[] {
  if (Array.isArray(val)) return val;
  if (Array.isArray(val?.data)) return val.data;
  if (Array.isArray(val?.data?.data)) return val.data.data;
  if (Array.isArray(val?.gifts)) return val.gifts;
  return [];
}

export default function AdminGiftsPage() {
  const [gifts, setGifts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [form, setForm] = useState({
    name: "",
    coin_price: "",
    creator_earns: "",
    platform_commission: "",
    category: "standard",
    icon_url: "",
    animation_url: "",
    sort_order: "",
  });

  const fetchGifts = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, sRes] = await Promise.all([
        authFetch(`/securegate/gifts`),
        authFetch(`/securegate/gifts/stats`),
      ]);
      if (gRes.ok) {
        const j = await gRes.json();
        setGifts(safeArray(j));
      } else {
        const err = await gRes.json().catch(() => ({}));
        setMsg({ ok: false, text: err.message || "Failed to load gifts catalogue." });
      }
      if (sRes.ok) {
        const j = await sRes.json();
        setStats(j?.data ?? null);
      }
    } catch {
      setMsg({ ok: false, text: "Network error loading gifts." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGifts();
  }, [fetchGifts]);

  const resetForm = () =>
    setForm({
      name: "",
      coin_price: "",
      creator_earns: "",
      platform_commission: "",
      category: "standard",
      icon_url: "",
      animation_url: "",
      sort_order: "",
    });

  const handlePriceChange = (val: string) => {
    const price = parseInt(val) || 0;
    // Default 85% creator / 15% platform commission
    const creator = Math.floor(price * 0.85);
    const platform = price - creator;
    setForm((f) => ({
      ...f,
      coin_price: val,
      creator_earns: f.creator_earns === "" || parseInt(f.creator_earns) === 0 ? String(creator) : f.creator_earns,
      platform_commission: f.platform_commission === "" || parseInt(f.platform_commission) === 0 ? String(platform) : f.platform_commission,
    }));
  };

  const handleSelectAssetPreset = (asset: { name: string; url: string }) => {
    setForm((f) => ({
      ...f,
      icon_url: asset.url,
      name: f.name === "" ? asset.name : f.name,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const body = {
      ...form,
      coin_price: parseInt(form.coin_price) || 1,
      creator_earns: parseInt(form.creator_earns) || 0,
      platform_commission: parseInt(form.platform_commission) || 0,
      sort_order: form.sort_order ? parseInt(form.sort_order) : 0,
    };

    try {
      const url = editing ? `/securegate/gifts/${editing.id}` : `/securegate/gifts`;
      const res = await authFetch(url, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMsg({ ok: true, text: editing ? "Gift updated successfully." : "Gift created successfully." });
        setShowForm(false);
        setEditing(null);
        resetForm();
        fetchGifts();
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j.message || "Failed to save gift." });
      }
    } catch {
      setMsg({ ok: false, text: "Server error saving gift." });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (gift: any) => {
    setForm({
      name: gift.name,
      coin_price: String(gift.coin_price),
      creator_earns: String(gift.creator_earns),
      platform_commission: String(gift.platform_commission),
      category: gift.category,
      icon_url: gift.icon_url || "",
      animation_url: gift.animation_url || "",
      sort_order: String(gift.sort_order),
    });
    setEditing(gift);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirm = useConfirm();

  const handleDelete = async (id: number) => {
    if (
      !(await confirm({
        title: "Delete Gift",
        message: "Are you sure you want to delete this gift from the catalog?",
        variant: "destructive",
      }))
    )
      return;
    try {
      const res = await authFetch(`/securegate/gifts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMsg({ ok: true, text: "Gift deleted successfully." });
        fetchGifts();
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j.message || "Failed to delete gift." });
      }
    } catch {
      setMsg({ ok: false, text: "Failed to delete gift." });
    }
  };

  const handleToggle = async (gift: any) => {
    try {
      const res = await authFetch(`/securegate/gifts/${gift.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !gift.is_active }),
      });
      if (res.ok) {
        fetchGifts();
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j.message || "Failed to toggle status." });
      }
    } catch {
      setMsg({ ok: false, text: "Error toggling status." });
    }
  };

  const handleReorder = async () => {
    const order = gifts.map((g, i) => ({ id: g.id, sort_order: i + 1 }));
    try {
      const res = await authFetch(`/securegate/gifts/reorder`, {
        method: "POST",
        body: JSON.stringify({ orders: order, order }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Catalog order saved successfully." });
        fetchGifts();
      } else {
        setMsg({ ok: false, text: "Failed to update gift order." });
      }
    } catch {
      setMsg({ ok: false, text: "Failed to reorder." });
    }
  };

  const filteredGifts = safeArray(gifts).filter((g: any) => {
    const matchesCat = selectedCategory === "all" || g.category === selectedCategory;
    const matchesSearch =
      searchTerm === "" ||
      g.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.icon_url?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-4 lg:p-10">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-xl border border-white/10">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2164b6]/30 text-[#7ab0ff] text-xs font-bold uppercase tracking-wider border border-[#2164b6]/40">
            <Gift weight="fill" className="h-3.5 w-3.5" /> Virtual Currency & Gifting
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Gift Management</h1>
          <p className="text-sm text-white/80 max-w-xl">
            Configure all 30 gift pack items, coin pricing, creator earnings split, platform fees, and live status.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm(!showForm);
            setEditing(null);
            resetForm();
          }}
          className="bg-[#2164b6] hover:bg-[#2d94c2] text-white font-bold shadow-md h-11 px-5 rounded-xl transition-all"
        >
          <Plus weight="bold" className="h-4 w-4 mr-2" />
          {showForm ? "Cancel" : "Add New Gift"}
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {[
            { label: "Total Gifts", value: gifts.length, color: "text-[#2164b6] dark:text-[#7ab0ff]" },
            { label: "Active in App", value: gifts.filter((g) => g.is_active).length, color: "text-emerald-500" },
            {
              label: "Gifts Sent",
              value: stats?.total_transactions ?? stats?.total_sent_count ?? 0,
              color: "text-purple-500",
            },
            {
              label: "Platform Revenue",
              value: `${stats?.total_commission ?? stats?.total_platform_commission ?? 0} coins`,
              color: "text-amber-500",
            },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/40 bg-card p-4 text-center shadow-sm">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Notification Message */}
      {msg && (
        <div
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm border font-medium transition-all ${
            msg.ok
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
          }`}
        >
          {msg.ok ? <Check weight="bold" className="h-4 w-4 shrink-0" /> : <AlertCircle weight="bold" className="h-4 w-4 shrink-0" />}
          {msg.text}
        </div>
      )}

      {/* Add / Edit Gift Form */}
      {showForm && (
        <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-md space-y-5">
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div>
              <h2 className="text-lg font-black text-foreground">
                {editing ? `Edit Gift: ${editing.name}` : "Create New Gift"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Set accurate pricing, creator revenue percentage, and select the gift asset.
              </p>
            </div>
            {form.icon_url && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/40 border border-border/40">
                <span className="text-xs text-muted-foreground">Preview:</span>
                <img
                  src={getAssetUrl(form.icon_url)}
                  alt="preview"
                  className="w-8 h-8 object-contain"
                  onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                />
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Asset Preset Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Select from 30 Official Gift Pack Assets (or type custom URL below)
              </Label>
              <div className="max-h-36 overflow-y-auto p-2.5 rounded-xl bg-muted/20 border border-border/40 grid grid-cols-5 sm:grid-cols-10 gap-2">
                {AVAILABLE_ASSETS.map((asset) => {
                  const isSelected = form.icon_url === asset.url;
                  return (
                    <button
                      key={asset.url}
                      type="button"
                      onClick={() => handleSelectAssetPreset(asset)}
                      title={asset.name}
                      className={`flex flex-col items-center p-1.5 rounded-xl transition-all border text-center ${
                        isSelected
                          ? "bg-primary/20 border-primary ring-2 ring-primary/30"
                          : "bg-background/80 border-border/50 hover:bg-muted/50"
                      }`}
                    >
                      <img src={getAssetUrl(asset.url)} alt={asset.name} className="w-8 h-8 object-contain" />
                      <span className="text-[10px] font-bold text-foreground/80 truncate w-full mt-1">
                        {asset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <Label>Gift Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Love, Legit, King, Anpu"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Coin Price *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.coin_price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="e.g. 50"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Creator Earns (Coins) *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.creator_earns}
                  onChange={(e) => setForm((f) => ({ ...f, creator_earns: e.target.value }))}
                  placeholder="e.g. 42"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Platform Commission *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.platform_commission}
                  onChange={(e) => setForm((f) => ({ ...f, platform_commission: e.target.value }))}
                  placeholder="e.g. 8"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                  placeholder="e.g. 1"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label>Icon Asset URL *</Label>
                <Input
                  value={form.icon_url}
                  onChange={(e) => setForm((f) => ({ ...f, icon_url: e.target.value }))}
                  placeholder="/gifts/love.png or https://..."
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#2164b6] hover:bg-[#2d94c2] text-white font-bold h-10 px-6 rounded-xl"
              >
                {saving ? <Loader2 weight="bold" className="w-4 h-4 mr-2 animate-spin" /> : null}
                {editing ? "Save Changes" : "Create Gift"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Catalog Table Container */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search gifts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 rounded-xl text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto">
              {["all", ...CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wider transition-all ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={handleReorder} className="rounded-xl text-xs font-bold">
            <ArrowsVertical weight="bold" className="h-3.5 w-3.5 mr-1.5" />
            Save Display Order
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 weight="bold" className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-medium">Loading gift catalogue...</p>
          </div>
        ) : filteredGifts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Gift weight="fill" className="h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-sm font-bold text-foreground">No gifts found</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {searchTerm || selectedCategory !== "all"
                ? "Try adjusting your search or category filter."
                : "Add your first gift pack to allow creators to receive gifts."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filteredGifts.map((gift: any, idx: number) => {
              const assetUrl = getAssetUrl(gift.icon_url);
              return (
                <div
                  key={gift.id}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/15 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <span className="text-xs font-bold text-muted-foreground/40 w-6 shrink-0 text-center">
                      #{gift.sort_order || idx + 1}
                    </span>

                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-blue-500/10 border border-border/60 flex items-center justify-center shrink-0 p-1 shadow-inner">
                      {assetUrl ? (
                        <img
                          src={assetUrl}
                          alt={gift.name}
                          className="w-full h-full object-contain drop-shadow-sm"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Gift weight="fill" className="w-6 h-6 text-pink-500" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-foreground truncate">{gift.name}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                            gift.category === "premium"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                              : gift.category === "exclusive"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : gift.category === "limited"
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              : "bg-muted text-muted-foreground border-border/40"
                          }`}
                        >
                          {gift.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        <span className="font-bold text-amber-500">{gift.coin_price} coins</span> &middot; Creator:{" "}
                        <span className="font-medium text-emerald-500">{gift.creator_earns}</span> &middot; Fee:{" "}
                        <span className="font-medium text-muted-foreground">{gift.platform_commission}</span>
                        {gift.icon_url && (
                          <span className="ml-2 font-mono text-[10px] text-muted-foreground/60">
                            ({gift.icon_url})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-4">
                    <span
                      className={`mr-2 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                        gift.is_active
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-muted/60 text-muted-foreground border border-border/40"
                      }`}
                    >
                      {gift.is_active ? "Active" : "Disabled"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggle(gift)}
                      title={gift.is_active ? "Click to Disable" : "Click to Enable"}
                      className="h-8 w-8 rounded-lg"
                    >
                      {gift.is_active ? (
                        <ToggleRight className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <ToggleLeft weight="fill" className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(gift)}
                      title="Edit Price and Settings"
                      className="h-8 w-8 rounded-lg"
                    >
                      <Edit weight="bold" className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(gift.id)}
                      title="Delete Gift"
                      className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    >
                      <Trash2 weight="bold" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
