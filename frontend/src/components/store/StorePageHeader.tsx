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
        <div className="h-12 w-12 rounded-xl bg-[var(--shell-accent-solid)]/10 border border-[#087FFF]/20 flex items-center justify-center shrink-0 shadow-inner">
          <Storefront weight="fill" className="h-6 w-6 text-[var(--shell-accent)]" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Your Store
          </h1>
          <p className="text-xs text-[var(--shell-muted)] font-medium mt-0.5">
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
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-lg bg-[var(--shell-surface)] border border-[var(--shell-border)] text-[var(--shell-text)] hover:bg-[var(--shell-hover)] hover:text-white transition-all shadow-sm"
          >
            <ArrowSquareOut weight="bold" className="h-4 w-4 text-[var(--shell-muted)]" />
            Preview
          </a>
        )}

        {/* Share Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onShare}
          className="h-9 px-3.5 text-xs font-semibold rounded-lg bg-[var(--shell-surface)] border-[var(--shell-border)] text-[var(--shell-text)] hover:bg-[var(--shell-hover)] hover:text-white transition-all gap-1.5"
        >
          <ShareNetwork weight="bold" className="h-4 w-4 text-[var(--shell-muted)]" />
          Share
        </Button>

        {/* Publish/Unpublish Store Button */}
        <Button
          size="sm"
          onClick={onTogglePublish}
          disabled={isTogglingPublish}
          className={`h-9 px-4 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm ${
            isPublished
              ? 'bg-[var(--shell-surface)] hover:bg-[var(--shell-hover-strong)] text-white border border-[var(--shell-border)]'
              : 'bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white shadow-[#087FFF]/20'
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

