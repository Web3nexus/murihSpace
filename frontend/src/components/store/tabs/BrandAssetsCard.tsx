import React from 'react';
import { Image as ImageIcon, Profile, Delete as Trash } from '@/components/icons';
import { ImageUploader } from '@/components/upload/ImageUploader';

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
    <div className="bg-[#171D25] border border-[#29313C] rounded-2xl p-5 sm:p-6 transition-all shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="pb-4 border-b border-[#29313C]/60 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-[#087FFF]" />
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Brand assets</h3>
            <p className="text-xs text-[#A7B0BE] mt-0.5">Upload images for your storefront.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Cover Image Upload Area */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-[#A7B0BE] uppercase tracking-wider">Cover image</span>
            <span className="text-[#5A6577] font-normal">Recommended 1200 × 400 px</span>
          </div>

          <div className="relative rounded-xl border border-dashed border-[#29313C] hover:border-[#087FFF]/60 bg-[#0B0F14]/70 transition-all overflow-hidden p-3 group">
            {coverUrl ? (
              <div className="relative h-24 rounded-lg overflow-hidden group">
                <img src={coverUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <ImageUploader
                    value={coverUrl}
                    onChange={onCoverChange}
                    label="Replace Cover"
                    folder="storefronts"
                  />
                  <button
                    type="button"
                    onClick={() => onCoverChange('')}
                    className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    title="Remove cover"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4 flex flex-col items-center justify-center text-center">
                <div className="h-9 w-9 rounded-full bg-[#202731] border border-[#29313C] flex items-center justify-center text-[#A7B0BE] mb-2">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div className="max-w-[240px]">
                  <ImageUploader
                    value=""
                    onChange={onCoverChange}
                    label="Click or drag to upload cover image"
                    folder="storefronts"
                  />
                </div>
                <p className="text-[10px] text-[#5A6577] mt-1">JPG, PNG or WebP (Max 5MB)</p>
              </div>
            )}
          </div>
        </div>

        {/* Avatar Image Upload Area */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-[#A7B0BE] uppercase tracking-wider">Avatar image</span>
            <span className="text-[#5A6577] font-normal">Recommended 400 × 400 px</span>
          </div>

          <div className="relative rounded-xl border border-dashed border-[#29313C] hover:border-[#087FFF]/60 bg-[#0B0F14]/70 transition-all overflow-hidden p-3 group">
            {avatarUrl ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full overflow-hidden border border-[#29313C] shrink-0">
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Custom Avatar Active</p>
                    <p className="text-[10px] text-[#A7B0BE]">Will show on your store badge</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ImageUploader
                    value={avatarUrl}
                    onChange={onAvatarChange}
                    label="Replace"
                    folder="avatars"
                  />
                  <button
                    type="button"
                    onClick={() => onAvatarChange('')}
                    className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    title="Remove avatar"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4 flex flex-col items-center justify-center text-center">
                <div className="h-9 w-9 rounded-full bg-[#202731] border border-[#29313C] flex items-center justify-center text-[#A7B0BE] mb-2">
                  <Profile className="h-5 w-5" />
                </div>
                <div className="max-w-[240px]">
                  <ImageUploader
                    value=""
                    onChange={onAvatarChange}
                    label="Click or drag to upload avatar"
                    folder="avatars"
                  />
                </div>
                <p className="text-[10px] text-[#5A6577] mt-1">JPG, PNG or WebP (Max 2MB)</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

