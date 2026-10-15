import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Image as ImageIcon, Profile, Delete as Trash } from '@/components/icons';
import { Spinner } from '@/components/icons/rounded';
import { getAuthToken } from '@/lib/auth/token';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
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

interface CompactDropzoneProps {
  label: string;
  recommendedText: string;
  value?: string;
  onChange: (url: string) => void;
  folder: string;
  maxSizeMB: number;
  iconType: 'image' | 'profile';
}

const CompactDropzone: React.FC<CompactDropzoneProps> = ({
  label,
  recommendedText,
  value,
  onChange,
  folder,
  maxSizeMB,
  iconType,
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setUploading(true);
      setError(null);
      try {
        const url = await uploadFile(file, folder);
        if (url) onChange(url);
        else setError("Upload returned no URL.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
      }
      setUploading(false);
    },
    [folder, onChange]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    maxSize: maxSizeMB * 1024 * 1024,
    multiple: false,
    noClick: Boolean(value),
  });

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className="text-[#A7B0BE] uppercase tracking-wider">{label}</span>
        <span className="text-[#5A6577] font-normal">{recommendedText}</span>
      </div>

      {uploading ? (
        <div className="h-[76px] rounded-xl border border-dashed border-[#29313C] bg-[#0B0F14]/70 flex items-center justify-center gap-2.5">
          <Spinner weight="bold" className="h-4 w-4 animate-spin text-[#087FFF]" />
          <span className="text-xs text-[#A7B0BE]">Uploading {label.toLowerCase()}...</span>
        </div>
      ) : value ? (
        iconType === 'image' ? (
          <div className="relative h-[76px] rounded-xl border border-[#29313C] bg-[#0B0F14] overflow-hidden group">
            <img src={value} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <input {...getInputProps()} />
              <button
                type="button"
                onClick={open}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#202731] border border-[#29313C] text-white hover:bg-[#29313C] transition-colors"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                title="Remove cover"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="relative h-[76px] rounded-xl border border-[#29313C] bg-[#0B0F14] px-3.5 flex items-center justify-between group">
            <input {...getInputProps()} />
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full overflow-hidden border border-[#29313C] shrink-0">
                <img src={value} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Custom Avatar Active</p>
                <p className="text-[10px] text-[#A7B0BE]">Displayed on your store badge</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={open}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#202731] border border-[#29313C] text-white hover:bg-[#29313C] transition-colors"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                title="Remove avatar"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
      ) : (
        <div
          {...getRootProps()}
          className={`h-[76px] rounded-xl border border-dashed transition-all flex flex-col items-center justify-center cursor-pointer p-2 ${
            isDragActive
              ? 'border-[#087FFF] bg-[#087FFF]/10'
              : 'border-[#29313C] hover:border-[#087FFF]/60 bg-[#0B0F14]/70'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex items-center gap-2 text-[#A7B0BE] mb-0.5">
            {iconType === 'image' ? (
              <ImageIcon className="h-4 w-4 text-[#A7B0BE]" />
            ) : (
              <Profile className="h-4 w-4 text-[#A7B0BE]" />
            )}
            <span className="text-xs font-medium text-[#F5F7FA]">
              {isDragActive
                ? `Drop ${label.toLowerCase()} here`
                : `Click or drag to upload ${label.toLowerCase()}`}
            </span>
          </div>
          <p className="text-[10px] text-[#5A6577]">JPG, PNG or WebP (Max {maxSizeMB}MB)</p>
        </div>
      )}

      {error && <p className="text-[11px] font-semibold text-red-400 mt-1">{error}</p>}
    </div>
  );
};

interface BrandAssetsCardProps {
  coverUrl?: string;
  avatarUrl?: string;
  onCoverChange: (url: string) => void;
  onAvatarChange: (url: string) => void;
}

export const BrandAssetsCard: React.FC<BrandAssetsCardProps> = ({
  coverUrl,
  avatarUrl,
  onCoverChange,
  onAvatarChange,
}) => {
  return (
    <div className="bg-[#171D25] border border-[#29313C] rounded-2xl p-5 sm:p-6 transition-all shadow-sm h-full flex flex-col justify-between">
      {/* Header */}
      <div className="pb-4 border-b border-[#29313C]/60 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-[#087FFF]" />
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Brand assets</h3>
            <p className="text-xs text-[#A7B0BE] mt-0.5">Upload images for your storefront.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3.5 flex-1 flex flex-col justify-center">
        {/* Cover Image Upload Area */}
        <CompactDropzone
          label="Cover image"
          recommendedText="Recommended 1200 × 400 px"
          value={coverUrl}
          onChange={onCoverChange}
          folder="storefronts"
          maxSizeMB={5}
          iconType="image"
        />

        {/* Avatar Image Upload Area */}
        <CompactDropzone
          label="Avatar image"
          recommendedText="Recommended 400 × 400 px"
          value={avatarUrl}
          onChange={onAvatarChange}
          folder="avatars"
          maxSizeMB={2}
          iconType="profile"
        />
      </div>
    </div>
  );
};
