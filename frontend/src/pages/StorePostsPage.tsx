import { useState, useEffect, useCallback } from "react";
import { MessageSquareText, Plus, Loader2, Trash2, Edit, Eye, EyeOff, Check, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

type TextAlign = "left" | "center" | "right";

interface StorePost {
  id: number; creator_id: number; content: string;
  font_family: string; background_color: string; text_color: string; text_align: TextAlign;
  is_published: boolean; sort_order: number; created_at: string; updated_at: string;
}

const FONTS: { value: string; label: string; family: string }[] = [
  { value: "sans", label: "Sans Serif", family: "system-ui, -apple-system, sans-serif" },
  { value: "serif", label: "Serif", family: "Georgia, 'Times New Roman', serif" },
  { value: "mono", label: "Monospace", family: "'Courier New', Courier, monospace" },
  { value: "display", label: "Display", family: "Impact, 'Arial Black', sans-serif" },
  { value: "handwriting", label: "Handwriting", family: "'Segoe Script', 'Apple Chancery', cursive" },
];

const COLORS: { bg: string; text: string; label: string }[] = [
  { bg: "#1a1a2e", text: "#ffffff", label: "Midnight" },
  { bg: "#0f3460", text: "#ffffff", label: "Deep Blue" },
  { bg: "#16213e", text: "#e0e0ff", label: "Navy" },
  { bg: "#1b4332", text: "#ffffff", label: "Forest" },
  { bg: "#4a1942", text: "#f0e6f6", label: "Burgundy" },
  { bg: "#7f4f24", text: "#ffffff", label: "Warm Brown" },
  { bg: "#2c3e50", text: "#ecf0f1", label: "Slate" },
  { bg: "#9b2226", text: "#ffffff", label: "Coral" },
  { bg: "#3d348b", text: "#ffffff", label: "Royal" },
  { bg: "#1c1c1c", text: "#ffffff", label: "Charcoal" },
  { bg: "#ffffff", text: "#1a1a2e", label: "White" },
  { bg: "#f0f0f0", text: "#1a1a2e", label: "Light Gray" },
];

const ALIGNS = ["left", "center", "right"] as const;

export default function StorePostsPage() {
  const [posts, setPosts] = useState<StorePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StorePost | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [content, setContent] = useState("");
  const [fontFamily, setFontFamily] = useState("sans");
  const [bgColor, setBgColor] = useState("#1a1a2e");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textAlign, setTextAlign] = useState<TextAlign>("center");
  const [isPublished, setIsPublished] = useState(true);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/store/posts`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setPosts(json.data?.data ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const resetForm = () => {
    setContent(""); setFontFamily("sans"); setBgColor("#1a1a2e"); setTextColor("#ffffff");
    setTextAlign("center"); setIsPublished(true); setEditing(null); setShowForm(false); setMsg(null);
  };

  const openEdit = (post: StorePost) => {
    setContent(post.content); setFontFamily(post.font_family); setBgColor(post.background_color);
    setTextColor(post.text_color); setTextAlign(post.text_align); setIsPublished(post.is_published);
    setEditing(post); setShowForm(true); setMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true); setMsg(null);
    const body = { content: content.trim(), font_family: fontFamily, background_color: bgColor, text_color: textColor, text_align: textAlign, is_published: isPublished };
    try {
      const url = editing ? `${API_BASE}/store/posts/${editing.id}` : `${API_BASE}/store/posts`;
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (res.ok) {
        setMsg({ ok: true, text: editing ? "Post updated." : "Post created!" });
        resetForm(); fetchPosts();
      } else {
        const j = await res.json(); setMsg({ ok: false, text: j.message || "Failed to save." });
      }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this post?")) return;
    try {
      await fetch(`${API_BASE}/store/posts/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch { /* ignore */ }
  };

  const togglePublish = async (post: StorePost) => {
    try {
      await fetch(`${API_BASE}/store/posts/${post.id}`, {
        method: "PUT", headers: getAuthHeaders(),
        body: JSON.stringify({ is_published: !post.is_published }),
      });
      fetchPosts();
    } catch { /* ignore */ }
  };

  const selectedFont = FONTS.find((f) => f.value === fontFamily) ?? FONTS[0];

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <MessageSquareText className="h-6 w-6 text-secondary" />
            Store Posts
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Create styled text posts for your public storefront.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 shadow-xs transition-all">
          <Plus className="h-4 w-4" /> {showForm && !editing ? "Cancel" : "New Post"}
        </button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${msg.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
          {msg.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="border border-border rounded-2xl bg-card p-6 space-y-5 shadow-sm">
          <h2 className="text-sm font-bold text-foreground">{editing ? "Edit Post" : "New Post"}</h2>

          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider">Content</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={4}
              placeholder="What's on your mind?"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-secondary/50 transition-colors resize-none"
              maxLength={5000}
            />
            <p className="text-[10px] text-muted-foreground text-right">{content.length}/5000</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider">Font Style</label>
            <div className="flex gap-2 flex-wrap">
              {FONTS.map((f) => (
                <button key={f.value} type="button" onClick={() => setFontFamily(f.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    fontFamily === f.value
                      ? "bg-secondary text-secondary-foreground border-secondary shadow-sm"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground"
                  }`}
                  style={{ fontFamily: f.family }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider">Background Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c.bg + c.text} type="button" onClick={() => { setBgColor(c.bg); setTextColor(c.text); }}
                  className={`h-8 w-8 rounded-xl border-2 transition-all shrink-0 ${
                    bgColor === c.bg ? "border-secondary scale-110 shadow-md" : "border-border hover:scale-105"
                  }`}
                  style={{ backgroundColor: c.bg }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider">Alignment</label>
            <div className="flex gap-2">
              {ALIGNS.map((a) => (
                <button key={a} type="button" onClick={() => setTextAlign(a)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition-all border ${
                    textAlign === a
                      ? "bg-secondary text-secondary-foreground border-secondary shadow-sm"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)}
              className="rounded border-border accent-secondary" />
            Published (visible on storefront)
          </label>

          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider">Preview</label>
            <div className="rounded-2xl overflow-hidden border border-border" style={{ backgroundColor: bgColor }}>
              <div className="p-8 sm:p-12" style={{ fontFamily: selectedFont.family, textAlign: textAlign }}>
                <p className="text-lg sm:text-xl font-medium leading-relaxed whitespace-pre-wrap" style={{ color: textColor }}>
                  {content || "Your post will look like this..."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving || !content.trim()}
              className="text-xs font-bold bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Update Post" : "Create Post"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm} className="text-xs">Cancel</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-secondary" /></div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <MessageSquareText className="h-10 w-10 text-muted-foreground/30" />
          <h3 className="text-sm font-bold text-foreground">No posts yet</h3>
          <p className="text-xs text-muted-foreground">Create your first styled storefront post.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const font = FONTS.find((f) => f.value === post.font_family) ?? FONTS[0];
            return (
              <div key={post.id} className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
                <div className="p-6 sm:p-10" style={{ backgroundColor: post.background_color, fontFamily: font.family, textAlign: post.text_align }}>
                  <p className="text-base sm:text-lg font-medium leading-relaxed whitespace-pre-wrap" style={{ color: post.text_color }}>
                    {post.content}
                  </p>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-t border-border">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className={`px-2 py-0.5 rounded-full font-bold ${post.is_published ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                      {post.is_published ? "Published" : "Draft"}
                    </span>
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => togglePublish(post)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all" title={post.is_published ? "Unpublish" : "Publish"}>
                      {post.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => openEdit(post)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"><Edit className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDelete(post.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
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
