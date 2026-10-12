import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { useConfirm } from "@/components/ui/DialogProvider";
import { useProfile } from "@/hooks/useProfile";
import {
  Plus,
  Spinner as Loader2,
  Pencil as Edit,
  Trash as Trash2,
  FileText,
  VideoCamera as Video,
  MusicNote as Music,
  Image as ImageIcon,
  Star,
  Heart,
  TrendUp,
  Users,
  Eye,
  Handshake,
  ChartBar,
  Broadcast,
  SealCheck,
  Check,
  WarningCircle,
  X,
  ShareNetwork,
  Clock,
  SquaresFour,
} from "@phosphor-icons/react";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/authFetch";

interface ContentItem {
  id: number;
  title: string;
  type: "video" | "article" | "audio" | "image";
  status: "draft" | "published";
  thumbnail_url?: string;
  created_at: string;
  views_count?: number;
}

const TYPE_ICONS: Record<string, typeof Video> = {
  video: Video,
  article: FileText,
  audio: Music,
  image: ImageIcon,
};

const TYPE_COLORS: Record<string, string> = {
  video: "bg-rose-500/15 text-rose-500",
  article: "bg-blue-500/15 text-blue-500",
  audio: "bg-purple-500/15 text-purple-500",
  image: "bg-emerald-500/15 text-emerald-500",
};

export default function ContentStudioPage() {
  const confirm = useConfirm();
  const { profile } = useProfile();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<ContentItem["type"]>("video");
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");

  // Real Analytics
  const [analytics, setAnalytics] = useState<{
    followers: number;
    views: number;
    engagement: string;
    earnings: number;
  }>({
    followers: profile?.followers_count ?? 0,
    views: 0,
    engagement: "0.0%",
    earnings: (profile?.coins ?? 0) / 100,
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, aRes] = await Promise.all([
        authFetch(`/content?limit=50`),
        authFetch(`/analytics/overview`),
      ]);

      if (res.ok) {
        const j = await res.json();
        const list = j?.success ? j?.data : j;
        setItems(Array.isArray(list?.data ?? list) ? (list?.data ?? list) : []);
      }

      if (aRes.ok) {
        const aJson = await aRes.json();
        const aData = aJson?.data ?? aJson;
        if (aData) {
          const rev = aData?.revenue?.total ?? 0;
          const f = aData?.audience?.followers ?? profile?.followers_count ?? 0;
          const clicks = aData?.engagement?.referral_clicks ?? 0;
          const refs = aData?.engagement?.referrals ?? 0;
          const rate = clicks > 0 ? `${((refs / clicks) * 100).toFixed(1)}%` : "0.0%";

          setAnalytics({
            followers: f,
            views: 0,
            engagement: rate,
            earnings: rev > 0 ? rev / 100 : (profile?.coins ?? 0) / 100,
          });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load content studio");
    } finally {
      setLoading(false);
    }
  }, [profile?.followers_count, profile?.coins]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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
      const body = {
        title: title.trim(),
        type: contentType,
        thumbnail_url: thumbnailUrl || null,
      };
      const url = editing ? `/content/${editing.id}` : `/content`;
      const method = editing ? "PATCH" : "POST";
      const res = await authFetch(url, { method, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      setMsg({ ok: true, text: editing ? "Content updated." : "Content published successfully." });
      resetForm();
      fetchItems();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "Delete Content",
      message: "Are you sure you want to delete this content item? This action cannot be undone.",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      const res = await authFetch(`/content/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setItems((prev) => prev.filter((i) => i.id !== id));
      setMsg({ ok: true, text: "Content item deleted." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Delete failed" });
    }
  };

  const startEdit = (item: ContentItem) => {
    setEditing(item);
    setTitle(item.title);
    setContentType(item.type);
    setThumbnailUrl(item.thumbnail_url ?? "");
    setShowForm(true);
  };

  // Filtered items
  const filteredItems = items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (searchQuery.trim() && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const displayName = profile?.name ?? "Creator";
  const username = profile?.username ?? "creator";
  const avatarUrl = profile?.avatar_url ?? profile?.avatar;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-6 space-y-6 pb-20">
      {/* ── HEADER & IDENTITY BAR ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground tracking-tight">
            Creator Studio
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your publishing schedule, analyze reach, and access creator tools.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/app/settings/profile">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-bold rounded-xl">
              <Edit className="h-3.5 w-3.5" />
              <span>Edit Profile</span>
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
            className="h-9 gap-1.5 text-xs font-bold rounded-xl bg-[#1A68D4] hover:bg-[#1A68D4]/90 text-white shadow-sm"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus weight="bold" className="h-4 w-4" />}
            <span>{showForm ? "Cancel" : "Create Content"}</span>
          </Button>
        </div>
      </div>

      {/* ── CREATOR PROFILE IDENTITY CARD ──────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-full p-0.5 bg-gradient-to-tr from-[#1A68D4] to-blue-400">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="h-full w-full rounded-full bg-muted flex items-center justify-center font-bold text-foreground">
                  {displayName[0]?.toUpperCase() ?? "C"}
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-black text-foreground">{displayName}</h2>
              <SealCheck weight="fill" className="h-4 w-4 text-[#1A68D4]" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">@{username}</p>
            <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#1A68D4]/10 text-[#1A68D4] text-[11px] font-bold">
              <Star weight="fill" className="h-3 w-3" />
              <span>Creator Account</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <Link to={`/u/${username}`} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <Eye className="h-3.5 w-3.5" />
              <span>Public Profile</span>
            </Button>
          </Link>
          <Link to="/app/settings">
            <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <span>Settings</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* ── NOTIFICATIONS FEEDBACK ──────────────────────────────── */}
      {msg && (
        <div
          className={`flex items-center justify-between gap-3 p-3.5 rounded-xl text-xs font-semibold border ${
            msg.ok
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.ok ? <Check className="h-4 w-4" /> : <WarningCircle className="h-4 w-4" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="hover:opacity-75">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl text-xs font-semibold border bg-destructive/10 border-destructive/20 text-destructive">
          <div className="flex items-center gap-2">
            <WarningCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="hover:opacity-75">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── CREATE / EDIT CONTENT FORM ─────────────────────────── */}
      {showForm && (
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm animate-in fade-in"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              {editing ? "Edit Content Item" : "Create New Content"}
            </h3>
            <button type="button" onClick={resetForm} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Content Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Masterclass Episode 1: Building Audience"
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Format Type</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as ContentItem["type"])}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#1A68D4]"
              >
                <option value="video">Video / Reel</option>
                <option value="article">Article / Post</option>
                <option value="audio">Audio / Podcast</option>
                <option value="image">Image / Carousel</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Cover Thumbnail</label>
            <ImageUploader
              value={thumbnailUrl}
              onChange={(url) => setThumbnailUrl(url ?? "")}
              folder="content"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={resetForm} className="h-9 text-xs rounded-xl">
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="h-9 text-xs font-bold rounded-xl bg-[#1A68D4] hover:bg-[#1A68D4]/90 text-white"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editing ? "Save Changes" : "Publish Content"}
            </Button>
          </div>
        </form>
      )}

      {/* ── 4 PERFORMANCE OVERVIEW METRICS ─────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Performance Overview</h2>
          <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
            Last 30 Days
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Followers</span>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                <Users weight="bold" className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-black text-foreground">
              {analytics.followers.toLocaleString()}
            </div>
            <span className="text-[10px] font-semibold text-emerald-500 mt-0.5 block">+0% growth</span>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Views</span>
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
                <Eye weight="bold" className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-black text-foreground">
              {analytics.views.toLocaleString()}
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground mt-0.5 block">Total impressions</span>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Engagement</span>
              <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-500">
                <Heart weight="bold" className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-black text-foreground">{analytics.engagement}</div>
            <span className="text-[10px] font-semibold text-muted-foreground mt-0.5 block">Interaction rate</span>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Earnings</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                <TrendUp weight="bold" className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-black text-foreground">
              ${analytics.earnings.toFixed(2)}
            </div>
            <span className="text-[10px] font-semibold text-emerald-500 mt-0.5 block">Wallet & Escrow</span>
          </div>
        </div>
      </div>

      {/* ── 4 QUICK ACTIONS ROW ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-card hover:bg-muted/50 transition text-left group shadow-sm"
        >
          <div className="h-10 w-10 rounded-xl bg-[#1A68D4]/10 text-[#1A68D4] flex items-center justify-center shrink-0 group-hover:scale-105 transition">
            <Plus weight="bold" className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Create Post</div>
            <div className="text-[11px] text-muted-foreground">Publish to feed</div>
          </div>
        </button>

        <Link
          to="/app/events"
          className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-card hover:bg-muted/50 transition text-left group shadow-sm"
        >
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
            <Broadcast weight="fill" className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Go Live</div>
            <div className="text-[11px] text-muted-foreground">Live streaming</div>
          </div>
        </Link>

        <Link
          to="/app/brand-deals"
          className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-card hover:bg-muted/50 transition text-left group shadow-sm"
        >
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
            <Handshake weight="fill" className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Brand Deals</div>
            <div className="text-[11px] text-muted-foreground">Marketplace & briefs</div>
          </div>
        </Link>

        <Link
          to="/app/insights"
          className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-card hover:bg-muted/50 transition text-left group shadow-sm"
        >
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
            <ChartBar weight="fill" className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Analytics</div>
            <div className="text-[11px] text-muted-foreground">Detailed metrics</div>
          </div>
        </Link>
      </div>

      {/* ── CONSISTENCY GROWTH BANNER CARD ─────────────────────── */}
      <div className="rounded-2xl border border-[#1A68D4]/20 bg-gradient-to-r from-[#1A68D4]/10 via-blue-500/5 to-transparent p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendUp weight="bold" className="h-4 w-4 text-[#1A68D4]" />
              <h3 className="text-sm font-black text-foreground">Grow faster with consistency</h3>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              Publish regularly this week to increase algorithmic recommendation exposure and boost your follower reach.
            </p>
          </div>

          <div className="w-full sm:w-48 space-y-1.5 shrink-0">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-muted-foreground">Weekly Target</span>
              <span className="text-[#1A68D4]">2 / 3 posts</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-[#1A68D4] rounded-full w-[66%]" />
            </div>
          </div>
        </div>
      </div>

      {/* ── PUBLISHING TOOLS LIST ──────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">Publishing Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:bg-muted/40 transition text-left shadow-sm"
          >
            <div className="p-2 rounded-xl bg-[#1A68D4]/10 text-[#1A68D4] shrink-0">
              <FileText weight="bold" className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Create Post</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Draft, format, and publish to feed
              </div>
            </div>
          </button>

          <Link
            to="/app/marketing"
            className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:bg-muted/40 transition text-left shadow-sm"
          >
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 shrink-0">
              <Clock weight="bold" className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Post Schedule</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Plan upcoming posts and calendar view
              </div>
            </div>
          </Link>

          <Link
            to="/app/settings/connected-accounts"
            className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:bg-muted/40 transition text-left shadow-sm"
          >
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500 shrink-0">
              <ShareNetwork weight="bold" className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Cross-Post</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Distribute content across linked accounts
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* ── CONTENT LIBRARY SECTION ────────────────────────────── */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">Content Library</h2>
            <p className="text-xs text-muted-foreground">Manage your published media and drafts.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-muted rounded-xl p-0.5 text-xs">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  statusFilter === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("published")}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  statusFilter === "published" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Published
              </button>
              <button
                onClick={() => setStatusFilter("draft")}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  statusFilter === "draft" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Drafts
              </button>
            </div>

            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search content..."
              className="h-8 w-44 text-xs rounded-xl"
            />
          </div>
        </div>

        {loading ? (
          <div className="h-44 w-full flex items-center justify-center">
            <Loader2 weight="fill" className="h-6 w-6 animate-spin text-[#1A68D4]" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
              <SquaresFour className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground">No content items found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Start building your content library by publishing a video reel, article, or photo post.
            </p>
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="mt-4 h-8 text-xs font-bold rounded-xl bg-[#1A68D4] hover:bg-[#1A68D4]/90 text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              <span>Create Your First Content</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredItems.map((item) => {
              const Icon = TYPE_ICONS[item.type] ?? Video;
              const colorClass = TYPE_COLORS[item.type] ?? "bg-blue-500/15 text-blue-500";

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm hover:border-[#1A68D4]/30 transition group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl ${colorClass}`}>
                        <Icon weight="bold" className="h-4 w-4" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {item.type}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        item.status === "published"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  {item.thumbnail_url && (
                    <div className="h-32 w-full rounded-xl overflow-hidden bg-muted">
                      <img
                        src={item.thumbnail_url}
                        alt={item.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-bold text-foreground line-clamp-2">{item.title}</h4>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(item)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                      className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
