import React from 'react';
import { Storefront, ShareNetwork, ArrowSquareOut, Spinner } from '@/components/icons/rounded';
import { Button } from '@/components/ui/button';

interface StoreHeaderProps {
  isPublished: boolean;
  isTogglingPublish: boolean;
  onTogglePublish: () => void;
  onShare: () => void;
  shortCode?: string;
}

export const StorePageHeader: React.FC<StoreHeaderProps> = ({
  isPublished,
  isTogglingPublish,
  onTogglePublish,
  onShare,
  shortCode,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
      <div className="flex items-center gap-3.5">
        <div className="h-12 w-12 rounded-xl bg-[#087FFF]/10 border border-[#087FFF]/20 flex items-center justify-center shrink-0 shadow-inner">
          <Storefront weight="fill" className="h-6 w-6 text-[#087FFF]" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Your Store
          </h1>
          <p className="text-xs text-[#A7B0BE] font-medium mt-0.5">
            Build your storefront, publish products, and manage your catalog.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
        {/* Status Pill Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            isPublished
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isPublished ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          {isPublished ? 'Published' : 'Draft'}
        </div>

        {/* Preview Button */}
        {shortCode && (
          <a
            href={`/store/${encodeURIComponent(shortCode)}?preview=true`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-lg bg-[#171D25] border border-[#29313C] text-[#F5F7FA] hover:bg-[#202731] hover:text-white transition-all shadow-sm"
          >
            <ArrowSquareOut weight="bold" className="h-4 w-4 text-[#A7B0BE]" />
            Preview
          </a>
        )}

        {/* Share Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onShare}
          className="h-9 px-3.5 text-xs font-semibold rounded-lg bg-[#171D25] border-[#29313C] text-[#F5F7FA] hover:bg-[#202731] hover:text-white transition-all gap-1.5"
        >
          <ShareNetwork weight="bold" className="h-4 w-4 text-[#A7B0BE]" />
          Share
        </Button>

        {/* Publish/Unpublish Store Button */}
        <Button
          size="sm"
          onClick={onTogglePublish}
          disabled={isTogglingPublish}
          className={`h-9 px-4 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm ${
            isPublished
              ? 'bg-[#202731] hover:bg-[#29313C] text-white border border-[#29313C]'
              : 'bg-[#087FFF] hover:bg-[#0770E3] text-white shadow-[#087FFF]/20'
          }`}
        >
          {isTogglingPublish ? (
            <Spinner weight="bold" className="h-4 w-4 animate-spin text-white" />
          ) : (
            <ArrowSquareOut weight="bold" className="h-4 w-4" />
          )}
          {isPublished ? 'Unpublish Store' : 'Publish Store'}
        </Button>
      </div>
    </div>
  );
};

