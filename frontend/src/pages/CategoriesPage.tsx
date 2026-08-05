import { useState, useEffect, useCallback } from "react";
import { Tags, Plus, Loader2, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";
import { useConfirm } from "@/components/ui/DialogProvider";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Category {
  id: number; name: string; slug: string; product_count?: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/store/categories`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setCategories(list?.data ?? list ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const resetForm = () => { setName(""); setEditing(null); setShowForm(false); setMsg(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = editing
        ? await fetch(`${API_BASE}/store/categories/${editing.id}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify({ name: name.trim() }) })
        : await fetch(`${API_BASE}/store/categories`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ name: name.trim() }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      resetForm();
      fetchCategories();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
    } finally { setSaving(false); }
  };

  const confirm = useConfirm();

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: "Delete Category", message: "Delete this category?", variant: "destructive" })) return;
    await fetch(`${API_BASE}/store/categories/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    fetchCategories();
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Tags className="h-6 w-6 text-[#38A8D8]" /> Categories
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Organize products into categories.</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="text-sm font-bold gap-1.5">
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="border border-border rounded-2xl bg-card p-6 space-y-4">
          {msg && <div className={`p-3 rounded-xl text-xs font-bold ${msg.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>{msg.text}</div>}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground">Category Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Electronics" required />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving || !name.trim()} className="text-sm font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editing ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm} className="text-sm">Cancel</Button>
          </div>
        </form>
      )}

      {categories.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card">
          <Tags className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-bold">No categories</h3>
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden">
          <div className="divide-y divide-border/50">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3">
                  <Tags className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-bold text-foreground">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">/{c.slug}</p>
                  </div>
                  {c.product_count != null && <span className="text-[10px] text-muted-foreground ml-2">{c.product_count} products</span>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setEditing(c); setName(c.name); setShowForm(true); setMsg(null); }}><Edit className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
