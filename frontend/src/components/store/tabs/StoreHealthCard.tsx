import React from 'react';
import { TickSquare as Check, Image as ImageIcon } from '@/components/icons';
import { Package, LinkSimple } from '@/components/icons/rounded';

interface StoreHealthCardProps {
  hasCover: boolean;
  hasProducts: boolean;
  hasLinks: boolean;
  onNavigateToCover?: () => void;
  onNavigateToProducts?: () => void;
  onNavigateToLinks?: () => void;
}

export const StoreHealthCard: React.FC<StoreHealthCardProps> = ({
  hasCover,
  hasProducts,
  hasLinks,
  onNavigateToCover,
  onNavigateToProducts,
  onNavigateToLinks,
}) => {
  const items = [
    { completed: hasCover },
    { completed: hasProducts },
    { completed: hasLinks },
  ];
  const completedCount = items.filter((i) => i.completed).length;
  const percentage = Math.round((completedCount / items.length) * 100);

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-5 sm:p-6 transition-all shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="pb-4 border-b border-[var(--shell-border)]/60 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-[var(--shell-accent-solid)]" />
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Store health</h3>
            <p className="text-xs text-[var(--shell-muted)] mt-0.5">Complete these steps to publish your store.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Circular Progress Gauge */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
            <circle
              cx="36"
              cy="36"
              r={radius}
              stroke="#202731"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="36"
              cy="36"
              r={radius}
              stroke="#087FFF"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-black text-white">{percentage}%</span>
          </div>
        </div>

        {/* Action checklist */}
        <div className="flex-1 w-full space-y-2.5">
          {/* Item 1: Add cover image */}
          <button
            type="button"
            onClick={onNavigateToCover}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[var(--shell-surface)]/60 hover:bg-[var(--shell-hover)] border border-[var(--shell-border)]/50 hover:border-[#29313C] transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-4 w-4 rounded-full border flex items-center justify-center transition-colors ${
                  hasCover
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-[#424F60] bg-transparent'
                }`}
              >
                {hasCover && <Check className="h-2.5 w-2.5" />}
              </div>
              <div className="h-8 w-8 rounded-lg bg-[var(--shell-accent-solid)]/10 border border-[var(--shell-accent)]/20 flex items-center justify-center text-[var(--shell-accent)] shrink-0">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-[#087FFF] transition-colors">
                  Add a cover image
                </p>
                <p className="text-[11px] text-[var(--shell-muted)]">Make your store stand out</p>
              </div>
            </div>
            <span className="text-xs text-[var(--shell-muted)] group-hover:text-white transition-colors">›</span>
          </button>

          {/* Item 2: Add products */}
          <button
            type="button"
            onClick={onNavigateToProducts}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[var(--shell-surface)]/60 hover:bg-[var(--shell-hover)] border border-[var(--shell-border)]/50 hover:border-[#29313C] transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-4 w-4 rounded-full border flex items-center justify-center transition-colors ${
                  hasProducts
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-[#424F60] bg-transparent'
                }`}
              >
                {hasProducts && <Check className="h-2.5 w-2.5" />}
              </div>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <Package className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-[#087FFF] transition-colors">
                  Add products
                </p>
                <p className="text-[11px] text-[var(--shell-muted)]">List your digital or physical products</p>
              </div>
            </div>
            <span className="text-xs text-[var(--shell-muted)] group-hover:text-white transition-colors">›</span>
          </button>

          {/* Item 3: Add external links */}
          <button
            type="button"
            onClick={onNavigateToLinks}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[var(--shell-surface)]/60 hover:bg-[var(--shell-hover)] border border-[var(--shell-border)]/50 hover:border-[#29313C] transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-4 w-4 rounded-full border flex items-center justify-center transition-colors ${
                  hasLinks
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-[#424F60] bg-transparent'
                }`}
              >
                {hasLinks && <Check className="h-2.5 w-2.5" />}
              </div>
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <LinkSimple className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-[#087FFF] transition-colors">
                  Add external links
                </p>
                <p className="text-[11px] text-[var(--shell-muted)]">Connect your social media and other platforms</p>
              </div>
            </div>
            <span className="text-xs text-[var(--shell-muted)] group-hover:text-white transition-colors">›</span>
          </button>
        </div>
      </div>
    </div>
  );
};

