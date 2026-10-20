import React from 'react';
import { Plus, Document as FileText, Folder } from '@/components/icons';
import { Package } from '@/components/icons/rounded';
import { Button } from '@/components/ui/button';

interface ProductSummaryCardsProps {
  digitalCount: number;
  physicalCount: number;
  collectionsCount: number;
  onNavigateToDigital: () => void;
  onNavigateToPhysical: () => void;
  onNavigateToCollections: () => void;
  onAddProduct: () => void;
}

export const ProductSummaryCards: React.FC<ProductSummaryCardsProps> = ({
  digitalCount,
  physicalCount,
  collectionsCount,
  onNavigateToDigital,
  onNavigateToPhysical,
  onNavigateToCollections,
  onAddProduct,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Digital Products Card */}
      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }}
        onClick={onNavigateToDigital}
        className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-5 hover:border-[#087FFF]/50 cursor-pointer transition-all flex items-center justify-between group shadow-sm"
      >
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-[var(--shell-accent-solid)]/10 border border-[var(--shell-accent)]/20 flex items-center justify-center text-[var(--shell-accent)] shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--shell-muted)]">Digital products</p>
            <h4 className="text-2xl font-black text-white leading-tight mt-0.5">
              {digitalCount}
            </h4>
            <p className="text-[11px] text-[var(--shell-muted)] mt-0.5">
              {digitalCount === 0 ? 'No digital products yet.' : `${digitalCount} active item${digitalCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="h-8 w-8 rounded-full bg-[var(--shell-surface)] flex items-center justify-center text-[var(--shell-muted)] group-hover:text-white group-hover:bg-[#29313C] transition-all">
          <span className="text-sm font-bold">›</span>
        </div>
      </div>

      {/* 2. Physical Products Card */}
      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }}
        onClick={onNavigateToPhysical}
        className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-5 hover:border-emerald-500/50 cursor-pointer transition-all flex items-center justify-between group shadow-sm"
      >
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--shell-muted)]">Physical products</p>
            <h4 className="text-2xl font-black text-white leading-tight mt-0.5">
              {physicalCount}
            </h4>
            <p className="text-[11px] text-[var(--shell-muted)] mt-0.5">
              {physicalCount === 0 ? 'No physical products yet.' : `${physicalCount} active item${physicalCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="h-8 w-8 rounded-full bg-[var(--shell-surface)] flex items-center justify-center text-[var(--shell-muted)] group-hover:text-white group-hover:bg-[#29313C] transition-all">
          <span className="text-sm font-bold">›</span>
        </div>
      </div>

      {/* 3. Collections Card */}
      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }}
        onClick={onNavigateToCollections}
        className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-5 hover:border-purple-500/50 cursor-pointer transition-all flex items-center justify-between group shadow-sm"
      >
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Folder className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--shell-muted)]">Collections</p>
            <h4 className="text-2xl font-black text-white leading-tight mt-0.5">
              {collectionsCount}
            </h4>
            <p className="text-[11px] text-[var(--shell-muted)] mt-0.5">
              {collectionsCount === 0 ? 'No collections yet.' : `${collectionsCount} active collection${collectionsCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="h-8 w-8 rounded-full bg-[var(--shell-surface)] flex items-center justify-center text-[var(--shell-muted)] group-hover:text-white group-hover:bg-[#29313C] transition-all">
          <span className="text-sm font-bold">›</span>
        </div>
      </div>

      {/* 4. Action Card: Add your first product */}
      <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-5 flex flex-col justify-center items-center text-center shadow-sm relative overflow-hidden">
        <Button
          onClick={onAddProduct}
          className="w-full h-11 bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Plus className="h-4 w-4" />
          Add your first product
        </Button>
        <p className="text-[11px] text-[var(--shell-muted)] mt-2 font-medium">
          Create and publish products to your store.
        </p>
      </div>
    </div>
  );
};

