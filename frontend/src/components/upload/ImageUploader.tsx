import { useState, useCallback, useId } from "react";
import { Upload, X, Loader2, ImageIcon, GripVertical } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  accept?: string;
  label?: string;
  maxSizeMB?: number;
}

interface MultiImageUploaderProps {
  values: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  accept?: string;
  label?: string;
  maxImages?: number;
  maxSizeMB?: number;
}

async function uploadFile(file: File, folder: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message ?? j.error ?? `Upload failed (${res.status}).`);
  }
  const j = await res.json();
  const d = j?.success ? j?.data : j;
  const unwrapped = d?.data ?? d;
  return unwrapped?.url ?? "";
}

function UploadZone({
  uploading,
  accept,
  getRootProps, getInputProps, isDragActive,
}: {
  uploading: boolean;
  accept?: string;
  getRootProps: () => object;
  getInputProps: () => object;
  isDragActive: boolean;
}) {
  if (uploading) {
    return (
      <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#2164b6] dark:text-[#7ab0ff] mx-auto" />
        <span className="text-xs text-muted-foreground mt-2 block">Uploading...</span>
      </div>
    );
  }
  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-[#2164b6]/50 hover:bg-muted/50 transition-all focus:outline-none focus:border-[#2164b6] ${isDragActive ? "border-[#2164b6] bg-[#2164b6]/5" : "border-border"}`}
    >
      <input {...getInputProps()} accept={accept} />
      <ImageIcon className="h-8 w-8 text-muted-foreground/50 mx-auto" />
      <span className="text-xs text-muted-foreground mt-2 block">
        {isDragActive ? "Drop file here" : "Click or drag to upload"}
      </span>
    </div>
  );
}

export function ImageUploader({ value, onChange, folder = "uploads", accept = "image/*", label, maxSizeMB = 10 }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadFile(file, folder);
      if (url) onChange(url); else setError("Upload returned no URL.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    }
    setUploading(false);
  }, [folder, onChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    maxSize: maxSizeMB * 1024 * 1024,
    multiple: false,
  });

  const clear = () => onChange("");

  return (
    <div className="space-y-2">
      {label && <label className="text-xs font-bold text-muted-foreground">{label}</label>}
      {value ? (
        <div className="relative rounded-xl overflow-hidden bg-muted group">
          <img
            src={value}
            alt=""
            className="w-full h-28 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2">
            <button type="button" onClick={() => document.getElementById(inputId)?.click()}
              className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-white/20 text-white hover:bg-white/40 transition-all">
              <Upload className="h-4 w-4" />
            </button>
            <button type="button" onClick={clear}
              className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-rose-500/40 text-white hover:bg-rose-500/60 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            id={inputId}
            type="file"
            accept={accept}
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              setError(null);
              try { const url = await uploadFile(file, folder); if (url) onChange(url); else setError("Upload returned no URL."); } catch (err) { setError(err instanceof Error ? err.message : "Upload failed. Please try again."); }
              setUploading(false);
            }}
          />
        </div>
      ) : (
        <UploadZone uploading={uploading} accept={accept} getRootProps={getRootProps} getInputProps={getInputProps} isDragActive={isDragActive} />
      )}
      {error && <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function MultiImageUploader({ values, onChange, folder = "uploads", accept = "image/*", label, maxImages = 10, maxSizeMB = 10 }: MultiImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (accepted: File[]) => {
    if (values.length + accepted.length > maxImages) {
      accepted = accepted.slice(0, maxImages - values.length);
    }
    setUploading(true);
    setError(null);
    const urls: string[] = [];
    for (const file of accepted) {
      try {
        const url = await uploadFile(file, folder);
        if (url) urls.push(url); else setError("One or more uploads returned no URL.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
      }
    }
    onChange([...values, ...urls]);
    setUploading(false);
  }, [folder, onChange, values, maxImages]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: maxImages - values.length,
    maxSize: maxSizeMB * 1024 * 1024,
    disabled: values.length >= maxImages,
  });

  const remove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const move = (from: number, to: number) => {
    const next = [...values];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {label && <label className="text-xs font-bold text-muted-foreground">{label}</label>}
      {values.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {values.map((url, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden bg-muted aspect-square">
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                {i > 0 && (
                  <button type="button" onClick={() => move(i, i - 1)}
                    className="p-1 rounded bg-white/20 text-white hover:bg-white/40">
                    <GripVertical className="h-3 w-3 rotate-90" />
                  </button>
                )}
                <button type="button" onClick={() => remove(i)}
                  className="p-1 rounded bg-rose-500/40 text-white hover:bg-rose-500/60">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          {values.length < maxImages && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg aspect-square flex items-center justify-center cursor-pointer hover:border-[#2164b6]/50 hover:bg-muted/50 transition-all ${isDragActive ? "border-[#2164b6] bg-[#2164b6]/5" : "border-border"}`}
            >
              <div className="text-center">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[#2164b6] dark:text-[#7ab0ff] mx-auto" />
                ) : (
                  <>
                    <ImageIcon className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                    <span className="text-[10px] text-muted-foreground mt-1 block">Add</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {values.length === 0 && (
        <UploadZone uploading={uploading} accept={accept} getRootProps={getRootProps} getInputProps={getInputProps} isDragActive={isDragActive} />
      )}
      {error && <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
