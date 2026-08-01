import { useState, useEffect, useCallback } from "react";
import { Film, Plus, Loader2, Edit, Trash2, Eye, EyeOff, FileText, Video, Music, Image } from "lucide-react";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface ContentItem {
  id: number;
  title: string;
  type: "video" | "article" | "audio" | "image";
  status: "draft" | "published";
  thumbnail_url?: string;
  created_at: string;
  views_count?: number;
}

const TYPE_ICONS: Record<string, typeof Video> = { video: Video, article: FileText, audio: Music, image: Image };
const TYPE_COLORS: Record<string, string> = {
  video: "bg-rose-500/20 text-rose-400",
  article: "bg-blue-500/20 text-blue-400",
  audio: "bg-purple-500/20 text-purple-400",
  image: "bg-emerald-500/20 text-emerald-400",
};

export default function ContentStudioPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<ContentItem["type"]>("video");
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/content?limit=50`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setItems(Array.isArray(list?.data ?? list) ? (list?.data ?? list) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load content");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => {
    setTitle("");
    setContentType("video");
    setThumbnailUrl("");
    setEditing(null);
    setShowForm(false);
    setMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const body = { title: title.trim(), type: contentType, thumbnail_url: thumbnailUrl || null };
      const url = editing ? `${API_BASE}/content/${editing.id}` : `${API_BASE}/content`;
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      setMsg({ ok: true, text: editing ? "Content updated." : "Content created." });
      resetForm();
      fetchItems();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this content?")) return;
    try {
      const res = await fetch(`${API_BASE}/content/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Delete failed");
      fetchItems();
    } catch { /* ignore */ }
  };

  const togglePublish = async (item: ContentItem) => {
    const newStatus = item.status === "published" ? "draft" : "published";
    try {
      await fetch(`${API_BASE}/content/${item.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      fetchItems();
    } catch { /* ignore */ }
  };

  const startEdit = (item: ContentItem) => {
    setEditing(item);
    setTitle(item.title);
    setContentType(item.type);
    setThumbnailUrl(item.thumbnail_url ?? "");
    setShowForm(true);
    setMsg(null);
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Film className="h-6 w-6 text-[#38A8D8]" /> Content Studio
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Create and manage your digital content.</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="text-sm font-bold gap-1.5">
          <Plus className="h-4 w-4" /> New Content
        </Button>
      </div>

      {error && <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400">{error}</div>}

      {showForm && (
        <form onSubmit={handleSave} className="border border-border rounded-2xl bg-card p-6 space-y-4">
          {msg && <div className={`p-3 rounded-xl text-xs font-bold ${msg.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>{msg.text}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My content title" required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Type</label>
              <select value={contentType} onChange={(e) => setContentType(e.target.value as ContentItem["type"])} className="w-full rounded-xl border border-border bg-card p-2.5 text-sm font-medium text-foreground">
                <option value="video">Video</option>
                <option value="article">Article</option>
                <option value="audio">Audio</option>
                <option value="image">Image</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <ImageUploader
              value={thumbnailUrl}
              onChange={setThumbnailUrl}
              folder="content/thumbnails"
              label="Thumbnail"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving || !title.trim()} className="text-sm font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm} className="text-sm">Cancel</Button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card">
          <Film className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-bold">No content yet</h3>
          <p className="text-xs text-muted-foreground mt-1">Create your first piece of content.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type] ?? FileText;
            return (
              <div key={item.id} className="border border-border rounded-2xl bg-card overflow-hidden hover:shadow-md transition-shadow group">
                {item.thumbnail_url ? (
                  <div className="aspect-video bg-muted overflow-hidden">
                    <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <Icon className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`p-1 rounded-lg ${TYPE_COLORS[item.type] ?? 'bg-muted text-muted-foreground'}`}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {item.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground line-clamp-2">{item.title}</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {item.views_count != null && `${item.views_count} views · `}
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                  <div className="flex gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => togglePublish(item)} title={item.status === 'published' ? 'Unpublish' : 'Publish'}>
                      {item.status === 'published' ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => startEdit(item)}><Edit className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
