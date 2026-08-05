import { useState, useEffect } from "react";
import { Image, Type, Video, Loader2, Save, CheckCircle2, AlertCircle, BookOpen } from "lucide-react";
import { AnimatedPage } from "@/components/common/AnimatedPage";
import { apiClient } from "@/lib/api/client";

interface StorySettings {
  story_type_image_enabled: string;
  story_type_text_enabled: string;
  story_type_video_enabled: string;
}

const STORY_TYPES = [
  {
    key: "story_type_image_enabled" as const,
    label: "Image Stories",
    description: "Users can create stories with image media.",
    icon: Image,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    key: "story_type_text_enabled" as const,
    label: "Text Stories",
    description: "Users can create text-only stories (no media, just caption).",
    icon: Type,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    key: "story_type_video_enabled" as const,
    label: "Video Stories",
    description: "Users can create stories with video media.",
    icon: Video,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
  },
];

export default function AdminStoriesPage() {
  const [settings, setSettings] = useState<StorySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get("/securegate/stories/settings")
      .then((res) => {
        const data = res.data?.data ?? res.data;
        if (data && typeof data === "object") setSettings(data as StorySettings);
      })
      .catch(() => setError("Failed to load story settings."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.put("/securegate/stories/settings", settings);
      setSuccess("Story type settings saved successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: keyof StorySettings) {
    if (!settings) return;
    setSettings({ ...settings, [key]: settings[key] === "1" ? "0" : "1" });
  }

  if (loading) {
    return (
      <AnimatedPage className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm font-semibold">Loading story settings…</span>
        </div>
      </AnimatedPage>
    );
  }

  const enabledCount = settings
    ? Object.values(settings).filter((v) => v === "1").length
    : 0;

  return (
    <AnimatedPage className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Story Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control which story types users can create on the platform.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl shadow-xs divide-y divide-border overflow-hidden">
        {STORY_TYPES.map(({ key, label, description, icon: Icon, color, bg }) => (
          <div key={key} className="flex items-center justify-between p-4 sm:p-5">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`p-2 rounded-xl ${bg} ${color} shrink-0 mt-0.5`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground">{label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings?.[key] === "1"}
              onClick={() => toggle(key)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2164b6] focus-visible:ring-offset-2 ${
                settings?.[key] === "1" ? "bg-[#2164b6]" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform ${
                  settings?.[key] === "1" ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-4 shadow-xs">
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{enabledCount}</span> of <span className="font-semibold text-foreground">{STORY_TYPES.length}</span> story types enabled
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Changes
        </button>
      </div>
    </AnimatedPage>
  );
}
