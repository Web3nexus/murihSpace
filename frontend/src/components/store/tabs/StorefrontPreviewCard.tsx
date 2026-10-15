import React from 'react';
import { Show as Eye, Star } from '@/components/icons';
import { Package, ArrowSquareOut } from '@/components/icons/rounded';
import { Button } from '@/components/ui/button';

interface StorefrontPreviewCardProps {
  displayName: string;
  shortCode: string;
  tagline: string;
  bio: string;
  coverUrl?: string;
  avatarUrl?: string;
  userInitials: string;
  publicUrl: string;
}

export const StorefrontPreviewCard: React.FC<StorefrontPreviewCardProps> = ({
  displayName,
  shortCode,
  tagline,
  bio,
  coverUrl,
  avatarUrl,
  userInitials,
  publicUrl,
}) => {
  const openLiveStore = () => {
    window.open(publicUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-[#171D25] border border-[#29313C] rounded-2xl p-5 sm:p-6 transition-all shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#29313C]/60 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-[#087FFF]" />
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Storefront preview</h3>
            <p className="text-xs text-[#A7B0BE] mt-0.5">This is how your store will appear to visitors.</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={openLiveStore}
          className="h-8 px-3 text-xs font-semibold rounded-lg bg-[#202731] border-[#29313C] text-[#F5F7FA] hover:bg-[#29313C] hover:text-white transition-all gap-1.5"
        >
          <ArrowSquareOut className="h-3.5 w-3.5 text-[#A7B0BE]" />
          Preview Store
        </Button>
      </div>

      {/* Visual Mockup Card */}
      <div className="w-full rounded-2xl overflow-hidden border border-[#29313C] bg-[#0B0F14] relative group">
        {/* Cover Banner */}
        <div className="h-36 sm:h-44 w-full relative overflow-hidden bg-gradient-to-r from-[#08203E] via-[#103E73] to-[#0A192F]">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt="Store Cover"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/30 via-transparent to-transparent opacity-70" />
              <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full bg-[#087FFF]/15 blur-3xl" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0B0F14] to-transparent opacity-90" />
        </div>

        {/* Content container inside preview */}
        <div className="p-4 sm:p-5 pt-0 relative -mt-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3.5 mb-3.5">
            {/* Avatar */}
            <div className="h-16 w-16 rounded-full bg-[#087FFF] border-2 border-[#0B0F14] flex items-center justify-center text-white text-lg font-black shadow-lg overflow-hidden shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span>{userInitials || 'VI'}</span>
              )}
            </div>

            {/* Name & Handle */}
            <div className="space-y-0.5">
              <h4 className="text-base font-bold text-white leading-tight">
                {displayName || 'Vincent'}
              </h4>
              <p className="text-xs text-[#087FFF] font-medium">
                @{shortCode || 'web3nexus'}
              </p>
            </div>
          </div>

          {/* Tagline & Bio */}
          <div className="space-y-1 mb-4">
            <p className="text-xs font-semibold text-[#F5F7FA]">
              {tagline || 'Welcome to my official creator storefront.'}
            </p>
            <p className="text-[11px] text-[#A7B0BE] line-clamp-2 leading-relaxed">
              {bio || 'Explore my digital products, community memberships, and exclusive content.'}
            </p>
          </div>

          {/* Category Badges / Pills matching reference */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#202731] border border-[#29313C] text-blue-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Digital Products
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#202731] border border-[#29313C] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Physical Products
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#202731] border border-[#29313C] text-purple-400">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              Community
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#202731] border border-[#29313C] text-amber-400">
              <Star className="h-3 w-3 text-amber-400" />
              Exclusive Content
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

