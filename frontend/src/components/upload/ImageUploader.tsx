import { useState, useRef } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = localStorage.getItem("murihspace-token") || localStorage.getItem("auth_token");
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  accept?: string;
  label?: string;
}

export function ImageUploader({ value, onChange, folder = "uploads", accept = "image/*", label }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", folder);

      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: form,
      });

      const j = await res.json();
      const d = j?.success ? j?.data : j;
      const unwrapped = d?.data ?? d;
      const url = unwrapped?.url ?? "";
      if (url) {
        setPreview(url);
        onChange(url);
      }
    } catch {
      // ignore
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clear = () => {
    setPreview("");
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {label && <label className="text-xs font-bold text-muted-foreground">{label}</label>}
      {preview ? (
        <div className="relative rounded-xl overflow-hidden bg-muted group">
          <img src={preview} alt="" className="w-full h-28 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-white/20 text-white hover:bg-white/40 transition-all">
              <Upload className="h-4 w-4" />
            </button>
            <button type="button" onClick={clear}
              className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-rose-500/40 text-white hover:bg-rose-500/60 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          role="button"
          tabIndex={0}
          className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-[#38A8D8]/50 hover:bg-muted/50 transition-all focus:outline-none focus:border-[#38A8D8]"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-[#38A8D8]" />
              <span className="text-xs text-muted-foreground">Uploading...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground">Click or drag to upload</span>
            </div>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
    </div>
  );
}
