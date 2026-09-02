import { useState, useEffect, useCallback } from "react";
import { Music, Loader2, Plus, Edit, Trash2, Check, AlertCircle, Play, Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/api/authFetch";
import { useConfirm } from "@/components/ui/DialogProvider";

const CATEGORIES = ["General", "Ambient", "Acoustic", "Electronic", "Hip Hop", "Cinematic", "Pop", "Jazz"];

function safeArray<T = any>(val: any): T[] {
  if (Array.isArray(val)) return val;
  if (Array.isArray(val?.data)) return val.data;
  if (Array.isArray(val?.data?.data)) return val.data.data;
  return [];
}

export default function AdminSoundLibraryPage() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Audio preview player
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const [form, setForm] = useState({
    title: "",
    artist: "",
    audio_url: "",
    cover_url: "",
    duration: "180",
    category: "General",
    is_active: true,
  });

  const confirm = useConfirm();

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/securegate/sound-tracks`);
      if (res.ok) {
        const j = await res.json();
        setTracks(safeArray(j));
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracks();
    return () => {
      if (audioEl) audioEl.pause();
    };
  }, [fetchTracks]);

  const togglePlay = (track: any) => {
    if (playingId === track.id) {
      if (audioEl) audioEl.pause();
      setPlayingId(null);
      return;
    }

    if (audioEl) audioEl.pause();
    const newAudio = new Audio(track.audio_url);
    newAudio.play().catch(() => {
      setMsg({ ok: false, text: "Cannot play audio file from URL." });
    });
    newAudio.onended = () => setPlayingId(null);
    setAudioEl(newAudio);
    setPlayingId(track.id);
  };

  const resetForm = () => {
    setForm({
      title: "",
      artist: "",
      audio_url: "",
      cover_url: "",
      duration: "180",
      category: "General",
      is_active: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const body = {
      ...form,
      duration: parseInt(form.duration) || 0,
    };

    try {
      const url = editing ? `/securegate/sound-tracks/${editing.id}` : `/securegate/sound-tracks`;
      const res = await authFetch(url, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMsg({ ok: true, text: editing ? "Sound track updated." : "Sound track created." });
        setShowForm(false);
        setEditing(null);
        resetForm();
        fetchTracks();
      } else {
        const err = await res.json();
        setMsg({ ok: false, text: err.message || "Failed to save track." });
      }
    } catch {
      setMsg({ ok: false, text: "Server error occurred." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: "Delete Sound Track",
      message: "Are you sure you want to delete this sound track?",
    });
    if (!ok) return;

    try {
      const res = await authFetch(`/securegate/sound-tracks/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTracks((prev) => prev.filter((t) => t.id !== id));
        setMsg({ ok: true, text: "Track deleted." });
      }
    } catch {
      setMsg({ ok: false, text: "Failed to delete track." });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Music className="w-6 h-6 text-amber-500" />
            Sound & Music Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage royalty-free background music and audio tracks available for streamers and live meetings.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setEditing(null);
            setShowForm(!showForm);
          }}
          className="gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
        >
          <Plus className="w-4 h-4" /> Add Sound Track
        </Button>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
            msg.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          }`}
        >
          {msg.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-card border border-border space-y-4 max-w-2xl">
          <h2 className="text-lg font-bold text-foreground">{editing ? "Edit Sound Track" : "Add New Sound Track"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Track Title *</Label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Lofi Chill Sunset"
              />
            </div>
            <div className="space-y-2">
              <Label>Artist / Creator</Label>
              <Input
                value={form.artist}
                onChange={(e) => setForm({ ...form, artist: e.target.value })}
                placeholder="e.g. Murih Vibes"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Audio URL (Streaming / Object Storage) *</Label>
              <Input
                required
                type="url"
                value={form.audio_url}
                onChange={(e) => setForm({ ...form, audio_url: e.target.value })}
                placeholder="https://bucket.murihspace.com/audio/track.mp3"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Duration (Seconds)</Label>
              <Input
                type="number"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                placeholder="180"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "Save Changes" : "Create Track"}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : tracks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card border border-border">
          <Music className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground">No sound tracks added yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Upload audio files so streamers can play background music.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tracks.map((track) => (
            <div key={track.id} className="p-5 rounded-2xl bg-card border border-border flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => togglePlay(track)}
                      className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center hover:bg-amber-500 hover:text-black transition"
                    >
                      {playingId === track.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </button>
                    <div>
                      <h3 className="font-bold text-foreground text-sm line-clamp-1">{track.title}</h3>
                      <p className="text-xs text-muted-foreground">{track.artist || "Unknown Artist"}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                    {track.category}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5" />
                  {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, "0")}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(track);
                      setForm({
                        title: track.title,
                        artist: track.artist || "",
                        audio_url: track.audio_url,
                        cover_url: track.cover_url || "",
                        duration: track.duration?.toString() || "180",
                        category: track.category || "General",
                        is_active: track.is_active,
                      });
                      setShowForm(true);
                    }}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    onClick={() => handleDelete(track.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
