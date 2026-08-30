import { useState, useRef } from "react";
import { Upload, Film, Image as ImageIcon, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { authFetch } from "@/lib/api/authFetch";

export interface MediaUploadResult {
  uuid: string;
  url: string;
  stream_url?: string;
  thumbnail_url?: string;
  media_type: "image" | "video" | "audio" | "document";
  original_name: string;
  size_bytes: number;
}

interface MediaUploaderProps {
  onUploadSuccess: (media: MediaUploadResult) => void;
  folder?: string;
  ownerType?: string;
  ownerId?: number;
  acceptedTypes?: string;
  maxSizeMb?: number;
  label?: string;
}

export function MediaUploader({
  onUploadSuccess,
  folder = "uploads",
  ownerType,
  ownerId,
  acceptedTypes = "image/*,video/*",
  maxSizeMb = 100,
  label = "Upload Image or Video",
}: MediaUploaderProps) {
  const [status, setStatus] = useState<"idle" | "requesting" | "uploading" | "processing" | "ready" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mediaResult, setMediaResult] = useState<MediaUploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pollStatus = async (mediaUuid: string) => {
    let attempts = 0;
    const maxAttempts = 60; // Poll for up to 3 minutes

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await authFetch(`/media/${mediaUuid}/status`);
        if (res.ok) {
          const j = await res.json();
          if (j.is_ready || j.processing_status === "completed") {
            clearInterval(interval);
            setStatus("ready");
            const completeRes: MediaUploadResult = {
              uuid: j.uuid,
              url: j.url,
              stream_url: j.stream_url,
              thumbnail_url: j.thumbnail_url,
              media_type: j.url?.match(/\.(mp4|webm|m3u8)/i) ? "video" : "image",
              original_name: "",
              size_bytes: 0,
            };
            setMediaResult(completeRes);
            onUploadSuccess(completeRes);
          } else if (j.processing_status === "failed") {
            clearInterval(interval);
            setStatus("error");
            setErrorMsg(j.processing_error || "Media processing failed.");
          }
        }
      } catch (err) {
        console.error("Error polling media status:", err);
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setStatus("ready"); // Fallback to ready with original URL
      }
    }, 3000);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeMb * 1024 * 1024) {
      setStatus("error");
      setErrorMsg(`File exceeds maximum size limit of ${maxSizeMb}MB.`);
      return;
    }

    setStatus("requesting");
    setErrorMsg(null);
    setProgress(0);

    try {
      // 1. Request Signed Upload Authorization URL
      const authRes = await authFetch("/media/signed-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          folder,
          owner_type: ownerType,
          owner_id: ownerId,
        }),
      });

      if (!authRes.ok) {
        const errJson = await authRes.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to authorize upload.");
      }

      const authData = await authRes.json();
      const { upload_url, upload_mode, headers, media } = authData.data;

      // 2. Perform Direct Upload (Direct S3 Presigned or API Endpoint)
      setStatus("uploading");

      if (upload_mode === "direct_s3") {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", upload_url, true);

          if (headers) {
            Object.entries(headers).forEach(([k, v]) => {
              xhr.setRequestHeader(k, v as string);
            });
          }

          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              const pct = Math.round((evt.loaded / evt.total) * 100);
              setProgress(pct);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Direct S3 upload failed with HTTP status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error("Network error during direct storage upload."));
          xhr.send(file);
        });
      } else {
        // Multipart API upload fallback
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        const apiRes = await authFetch("/upload", {
          method: "POST",
          body: formData,
        });

        if (!apiRes.ok) throw new Error("API upload failed.");
      }

      // 3. Notify Backend Upload Completion
      setStatus("processing");
      const completeRes = await authFetch("/media/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_uuid: media.uuid }),
      });

      if (completeRes.ok) {
        const compJson = await completeRes.json();
        const m = compJson.data;

        if (m.processing_status === "completed") {
          setStatus("ready");
          const result: MediaUploadResult = {
            uuid: m.uuid,
            url: m.url,
            stream_url: m.stream_url,
            thumbnail_url: m.thumbnail_url,
            media_type: m.media_type,
            original_name: m.original_name,
            size_bytes: m.size_bytes,
          };
          setMediaResult(result);
          onUploadSuccess(result);
        } else {
          // Poll until FFmpeg / processing finishes
          pollStatus(media.uuid);
        }
      } else {
        setStatus("ready");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setStatus("error");
      setErrorMsg(err.message || "An unexpected error occurred during upload.");
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        onChange={handleFileSelect}
        className="hidden"
      />

      {status === "idle" && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-border hover:border-primary/50 bg-card hover:bg-muted/20 rounded-2xl p-6 flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
        >
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">{label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Direct Contabo Object Storage · Up to {maxSizeMb}MB
            </p>
          </div>
        </button>
      )}

      {(status === "requesting" || status === "uploading") && (
        <div className="border border-border rounded-2xl p-5 bg-card space-y-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Uploading directly to Object Storage...
            </span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === "processing" && (
        <div className="border border-border rounded-2xl p-5 bg-card flex items-center gap-3 text-xs font-bold text-foreground">
          <RefreshCw className="h-4 w-4 animate-spin text-amber-500 shrink-0" />
          <div>
            <p>Processing & Optimizing Media...</p>
            <p className="text-[10px] font-normal text-muted-foreground">
              Generating thumbnails, HLS video streams, and WebP formats.
            </p>
          </div>
        </div>
      )}

      {status === "ready" && mediaResult && (
        <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {mediaResult.media_type === "video" ? (
              <Film className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <ImageIcon className="h-5 w-5 text-emerald-500 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-bold text-foreground truncate">Upload & Processing Complete</p>
              <p className="text-[10px] text-muted-foreground truncate">{mediaResult.url}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setMediaResult(null);
            }}
            className="text-[10px] font-bold text-primary hover:underline shrink-0"
          >
            Change
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="border border-destructive/30 bg-destructive/5 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg || "Upload failed."}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="font-bold hover:underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
