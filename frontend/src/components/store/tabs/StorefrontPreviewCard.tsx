import React from 'react';
import { Star } from '@/components/icons';
import { ArrowSquareOut } from '@/components/icons/rounded';
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
    <div className="bg-[#171D25] border border-[#29313C] rounded-2xl p-5 sm:p-6 transition-all shadow-sm h-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#29313C]/60 mb-4">
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

      {/* Visual Mockup Card (Fills available space) */}
      <div className="w-full flex-1 min-h-[210px] rounded-xl overflow-hidden border border-[#29313C] bg-[#0B0F14] relative p-5 flex flex-col justify-between group">
        {/* Background Layer: Cover or Curved Wave Gradient */}
        {coverUrl ? (
          <>
            <img
              src={coverUrl}
              alt="Store Cover"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F14]/90 via-[#0B0F14]/80 to-[#0B0F14]/65" />
          </>
        ) : (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Deep rich blue abstract gradient wave */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#08203E] via-[#0E3563] to-[#0A192F]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/30 via-transparent to-transparent opacity-80" />
            <div className="absolute -bottom-10 -right-10 w-72 h-72 rounded-full bg-[#087FFF]/20 blur-3xl" />
            <svg
              className="absolute inset-0 w-full h-full opacity-25"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
              viewBox="0 0 1000 300"
            >
              <path
                d="M0,150 C250,50 400,250 650,150 C800,80 900,220 1000,160 L1000,300 L0,300 Z"
                fill="rgba(8,127,255,0.25)"
              />
              <path
                d="M0,200 C300,100 450,280 750,180 C880,120 950,240 1000,210 L1000,300 L0,300 Z"
                fill="rgba(8,127,255,0.18)"
              />
            </svg>
          </div>
        )}

        {/* Content Layer */}
        <div className="relative z-10 space-y-3">
          {/* Top row: Avatar + Name + Handle */}
          <div className="flex items-center gap-3.5">
            <div className="h-14 w-14 rounded-full bg-[#087FFF] border-2 border-white/20 flex items-center justify-center text-white text-lg font-black shadow-lg overflow-hidden shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span>{userInitials || 'VI'}</span>
              )}
            </div>

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
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#F5F7FA]">
              {tagline || 'Welcome to my official creator storefront.'}
            </p>
            <p className="text-[11px] text-[#A7B0BE] line-clamp-2 leading-relaxed">
              {bio || 'Explore my digital products, community memberships, and exclusive content.'}
            </p>
          </div>
        </div>

        {/* Category Badges / Pills */}
        <div className="relative z-10 flex items-center gap-2 flex-wrap pt-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#202731]/80 backdrop-blur-sm border border-[#29313C] text-blue-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            Digital Products
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#202731]/80 backdrop-blur-sm border border-[#29313C] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Physical Products
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#202731]/80 backdrop-blur-sm border border-[#29313C] text-purple-400">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            Community
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#202731]/80 backdrop-blur-sm border border-[#29313C] text-amber-400">
            <Star className="h-3 w-3 text-amber-400" />
            Exclusive Content
          </span>
        </div>
      </div>
    </div>
  );
};
