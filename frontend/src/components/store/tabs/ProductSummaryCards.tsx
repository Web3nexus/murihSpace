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
      <div
        onClick={onNavigateToDigital}
        className="bg-[#171D25] border border-[#29313C] rounded-2xl p-5 hover:border-[#087FFF]/50 cursor-pointer transition-all flex items-center justify-between group shadow-sm"
      >
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#A7B0BE]">Digital products</p>
            <h4 className="text-2xl font-black text-white leading-tight mt-0.5">
              {digitalCount}
            </h4>
            <p className="text-[11px] text-[#5A6577] mt-0.5">
              {digitalCount === 0 ? 'No digital products yet.' : `${digitalCount} active item${digitalCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="h-8 w-8 rounded-full bg-[#202731] flex items-center justify-center text-[#5A6577] group-hover:text-white group-hover:bg-[#29313C] transition-all">
          <span className="text-sm font-bold">›</span>
        </div>
      </div>

      {/* 2. Physical Products Card */}
      <div
        onClick={onNavigateToPhysical}
        className="bg-[#171D25] border border-[#29313C] rounded-2xl p-5 hover:border-emerald-500/50 cursor-pointer transition-all flex items-center justify-between group shadow-sm"
      >
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#A7B0BE]">Physical products</p>
            <h4 className="text-2xl font-black text-white leading-tight mt-0.5">
              {physicalCount}
            </h4>
            <p className="text-[11px] text-[#5A6577] mt-0.5">
              {physicalCount === 0 ? 'No physical products yet.' : `${physicalCount} active item${physicalCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="h-8 w-8 rounded-full bg-[#202731] flex items-center justify-center text-[#5A6577] group-hover:text-white group-hover:bg-[#29313C] transition-all">
          <span className="text-sm font-bold">›</span>
        </div>
      </div>

      {/* 3. Collections Card */}
      <div
        onClick={onNavigateToCollections}
        className="bg-[#171D25] border border-[#29313C] rounded-2xl p-5 hover:border-purple-500/50 cursor-pointer transition-all flex items-center justify-between group shadow-sm"
      >
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Folder className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#A7B0BE]">Collections</p>
            <h4 className="text-2xl font-black text-white leading-tight mt-0.5">
              {collectionsCount}
            </h4>
            <p className="text-[11px] text-[#5A6577] mt-0.5">
              {collectionsCount === 0 ? 'No collections yet.' : `${collectionsCount} active collection${collectionsCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="h-8 w-8 rounded-full bg-[#202731] flex items-center justify-center text-[#5A6577] group-hover:text-white group-hover:bg-[#29313C] transition-all">
          <span className="text-sm font-bold">›</span>
        </div>
      </div>

      {/* 4. Action Card: Add your first product */}
      <div className="bg-[#171D25] border border-[#29313C] rounded-2xl p-5 flex flex-col justify-center items-center text-center shadow-sm relative overflow-hidden">
        <Button
          onClick={onAddProduct}
          className="w-full h-11 bg-[#087FFF] hover:bg-[#0770E3] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Plus className="h-4 w-4" />
          Add your first product
        </Button>
        <p className="text-[11px] text-[#A7B0BE] mt-2 font-medium">
          Create and publish products to your store.
        </p>
      </div>
    </div>
  );
};

