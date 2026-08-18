import React, { useState, useRef } from "react";
import { X, Upload, Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/api/authFetch";

interface StoryCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated?: () => void;
}

export const StoryCreateModal: React.FC<StoryCreateModalProps> = ({
  isOpen,
  onClose,
  onStoryCreated,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "followers">("public");
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setMsg(null);

    try {
      const formData = new FormData();
      if (file) formData.append("media", file);
      formData.append("caption", caption);
      formData.append("privacy", privacy);

      const res = await authFetch("/stories", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        if (onStoryCreated) onStoryCreated();
        onClose();
      } else {
        const json = await res.json().catch(() => ({}));
        setMsg(json.message || "Failed to publish story.");
      }
    } catch {
      setMsg("Network error publishing story.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" /> Create Story
          </h2>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {msg && (
          <div className="p-3 text-xs font-bold text-destructive bg-destructive/10 rounded-xl">
            {msg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,video/*"
            className="hidden"
          />

          {/* Media Preview Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative h-56 w-full rounded-2xl border-2 border-dashed border-border hover:border-secondary bg-muted/30 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group"
          >
            {previewUrl ? (
              file?.type.startsWith("video/") ? (
                <video src={previewUrl} controls className="h-full w-full object-cover" />
              ) : (
                <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
              )
            ) : (
              <div className="text-center p-4 space-y-2">
                <div className="h-12 w-12 rounded-full bg-secondary/15 flex items-center justify-center mx-auto text-secondary group-hover:scale-110 transition-transform">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold text-foreground">Click to upload photo or video</p>
                <p className="text-[10px] text-muted-foreground">Supports MP4, JPG, PNG, WEBP</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Story Caption / Text Overlay</label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's on your mind?..."
              rows={2}
              className="text-xs rounded-xl"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-muted-foreground">Audience Privacy:</span>
            <select
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value as any)}
              className="text-xs font-bold bg-muted border border-border rounded-xl px-3 py-1.5 outline-none"
            >
              <option value="public">Public (Everyone)</option>
              <option value="followers">Followers Only</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploading || (!file && !caption)}
              className="flex-1 font-bold text-xs bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              Publish Story
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
