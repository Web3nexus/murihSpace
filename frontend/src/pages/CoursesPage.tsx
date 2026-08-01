import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Plus,
  Loader2,
  Check,
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Film,
  FileText,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Users,
} from "lucide-react";
import { ImageUploader } from "@/components/upload/ImageUploader";
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

interface Module {
  id?: number;
  title: string;
  sort_order: number;
  lessons: Lesson[];
}

interface Lesson {
  id?: number;
  title: string;
  video_url?: string;
  duration_minutes?: number;
  is_free: boolean;
  sort_order: number;
}

interface Course {
  id: number;
  title: string;
  description?: string;
  thumbnail_url?: string;
  price: number;
  currency: string;
  status: "draft" | "published";
  student_count?: number;
  modules?: Module[];
  created_at?: string;
  lessons_count?: number;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setCoverUrl] = useState("");
  const [price, setPrice] = useState("29.99");
  const [currency, setCurrency] = useState("USD");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [modules, setModules] = useState<Module[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchCourses = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/courses?page=${page}&per_page=20`, { headers: getAuthHeaders() });
      if (res.ok) {
        const j = await res.json();
        const paginator = j?.success ? j?.data : j;
        setCourses(paginator?.data ?? paginator ?? []);
        setLastPage(paginator?.last_page ?? 1);
      } else setError("Failed to load courses.");
    } catch { setError("Unable to connect."); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const resetForm = () => {
    setTitle(""); setDescription(""); setCoverUrl(""); setPrice("29.99");
    setCurrency("USD"); setStatus("draft"); setModules([]);
    setEditing(null); setMsg(null);
  };

  const openEdit = (course: Course) => {
    setTitle(course.title);
    setDescription(course.description || "");
    setCoverUrl(course.thumbnail_url || "");
    setPrice(course.price.toFixed(2));
    setCurrency(course.currency || "USD");
    setStatus(course.status);
    setModules(course.modules || []);
    setEditing(course);
    setShowForm(true);
    setMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const body = {
      title, description, thumbnail_url: thumbnailUrl,
      price: parseFloat(price),
      currency, status, modules,
    };
    try {
      const url = editing
        ? `${API_BASE}/courses/${editing.id}`
        : `${API_BASE}/courses`;
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (res.ok) {
        setMsg({ ok: true, text: editing ? "Course updated." : "Course created!" });
        setShowForm(false);
        resetForm();
        fetchCourses();
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j.message || "Failed to save." });
      }
    } catch { setMsg({ ok: false, text: "Network error." }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this course and all its modules?")) return;
    try {
      await fetch(`${API_BASE}/courses/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      setCourses((prev) => prev.filter((c) => c.id !== id));
    } catch { setError("Failed to delete."); }
  };

  const handleToggleStatus = async (course: Course) => {
    const newStatus = course.status === "published" ? "draft" : "published";
    try {
      const res = await fetch(`${API_BASE}/courses/${course.id}`, {
        method: "PUT", headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) setCourses((prev) => prev.map((c) => c.id === course.id ? { ...c, status: newStatus } : c));
    } catch { /* ignore */ }
  };

  const addModule = () => {
    setModules((prev) => [...prev, { title: `Module ${prev.length + 1}`, sort_order: prev.length, lessons: [] }]);
  };

  const updateModule = (idx: number, data: Partial<Module>) => {
    setModules((prev) => prev.map((m, i) => i === idx ? { ...m, ...data } : m));
  };

  const removeModule = (idx: number) => {
    setModules((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLesson = (modIdx: number) => {
    setModules((prev) => prev.map((m, i) => i !== modIdx ? m : {
      ...m, lessons: [...m.lessons, { title: "", is_free: false, sort_order: m.lessons.length }],
    }));
  };

  const updateLesson = (modIdx: number, lesIdx: number, data: Partial<Lesson>) => {
    setModules((prev) => prev.map((m, i) => i !== modIdx ? m : {
      ...m, lessons: m.lessons.map((l, j) => j === lesIdx ? { ...l, ...data } : l),
    }));
  };

  const removeLesson = (modIdx: number, lesIdx: number) => {
    setModules((prev) => prev.map((m, i) => i !== modIdx ? m : {
      ...m, lessons: m.lessons.filter((_, j) => j !== lesIdx),
    }));
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <BookOpen className="h-6 w-6 text-secondary" />
            Online Courses & Masterclasses
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Create and manage your video courses.</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 shadow-xs transition-all"
        >
          <Plus className="h-4 w-4" /> New Course
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-secondary" /></div>
      ) : courses.length === 0 && !showForm ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/30" />
          <h3 className="text-sm font-bold text-foreground">No courses yet</h3>
          <p className="text-xs text-muted-foreground">Create your first online course.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <div key={course.id} className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
              <div className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-14 w-20 rounded-xl bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Film className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground truncate">{course.title}</p>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        course.status === "published" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                      }`}>
                        {course.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{course.student_count || 0} students</span>
                      <span className="flex items-center gap-1">
                        <span>${course.price.toFixed(2)}</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleToggleStatus(course)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all" title={course.status === "published" ? "Unpublish" : "Publish"}>
                    {course.status === "published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openEdit(course)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(course.id)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"><Trash2 className="h-4 w-4" /></button>
                  <button onClick={() => setExpanded(expanded === course.id ? null : course.id)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                    {expanded === course.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {expanded === course.id && (
                <div className="border-t border-border px-4 py-3 space-y-2 bg-muted/10">
                  <p className="text-xs text-muted-foreground">{course.description || "No description."}</p>
                  <div className="flex gap-2 text-[10px] text-muted-foreground">
                    <span>{course.modules?.length || 0} modules</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-secondary" /> {editing ? "Edit Course" : "Create Course"}
              </h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">&times;</button>
            </div>

            {msg && (
              <div className={`mb-4 flex items-center gap-2 rounded-xl p-3 text-xs font-bold ${
                msg.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
              }`}>
                {msg.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                {msg.text}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Mastering Digital Art" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-secondary/50 transition-colors" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Course overview and what students will learn..." className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-secondary/50 transition-colors resize-none" />
                </div>
                <div>
                  <ImageUploader
                    value={thumbnailUrl}
                    onChange={setCoverUrl}
                    folder="courses/thumbnails"
                    label="Course Thumbnail"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Price</label>
                    <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-secondary/50 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Currency</label>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-secondary/50 transition-colors">
                      {["USD", "EUR", "GBP", "NGN"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-secondary/50 transition-colors">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>

              {/* Modules */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Modules & Lessons</label>
                  <button type="button" onClick={addModule} className="text-[11px] font-bold text-secondary hover:underline flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Add Module
                  </button>
                </div>
                {modules.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No modules yet. Add your first module.</p>
                )}
                {modules.map((mod, mi) => (
                  <div key={mi} className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                      <input value={mod.title} onChange={(e) => updateModule(mi, { title: e.target.value })} placeholder={`Module ${mi + 1}`} className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-secondary/50" />
                      <button type="button" onClick={() => addLesson(mi)} className="text-[10px] font-bold text-secondary hover:underline shrink-0">+ Lesson</button>
                      <button type="button" onClick={() => removeModule(mi)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    {mod.lessons.map((les, li) => (
                      <div key={li} className="flex items-center gap-2 pl-6">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                        <input value={les.title} onChange={(e) => updateLesson(mi, li, { title: e.target.value })} placeholder="Lesson title" className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-[11px] text-foreground focus:outline-none focus:border-secondary/50" />
                        <input value={les.duration_minutes || ""} onChange={(e) => updateLesson(mi, li, { duration_minutes: parseInt(e.target.value) || 0 })} placeholder="Min" className="w-14 rounded-lg border border-border bg-background px-2 py-1.5 text-[10px] text-foreground focus:outline-none focus:border-secondary/50" title="Duration in minutes" />
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer shrink-0">
                          <input type="checkbox" checked={les.is_free} onChange={(e) => updateLesson(mi, li, { is_free: e.target.checked })} className="rounded border-border" />
                          Free
                        </label>
                        <button type="button" onClick={() => removeLesson(mi, li)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-secondary text-secondary-foreground px-4 py-2.5 text-xs font-bold hover:bg-secondary/90 disabled:opacity-50 shadow-xs transition-all">
                  {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : editing ? "Update Course" : "Create Course"}
                </button>
              </div>
            </form>
          </div>
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
