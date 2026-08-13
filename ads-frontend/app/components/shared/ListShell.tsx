import React from "react";
import { Button } from "../ui/button";

export interface ListShellProps {
  tabs: { id: string; label: string; active?: boolean }[];
  onTabChange?: (id: string) => void;
  toolbarActions: React.ReactNode;
  children: React.ReactNode;
  totalItems: number;
  itemsPerPage?: number;
}

export function ListShell({ tabs, onTabChange, toolbarActions, children, totalItems, itemsPerPage = 10 }: ListShellProps) {
  return (
    <div className="flex flex-col gap-0 max-w-[1400px] mx-auto w-full h-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm">
      {/* Tabs */}
      <div 
        role="tablist" 
        aria-label="Views" 
        className="flex items-center border-b border-slate-200 dark:border-slate-800 px-2 pt-2 bg-slate-50 dark:bg-slate-900/50"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.active ? "true" : "false"}
            onClick={() => onTabChange?.(tab.id)}
            className={`px-4 py-2 text-sm font-medium ${
              tab.active
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Control Bar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        {toolbarActions}
      </div>
      
      {/* Dense Data Grid */}
      <div className="overflow-x-auto">
        {children}
      </div>
      
      {/* Pagination Footer */}
      <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500">
        <div>Total {totalItems} items</div>
        <div className="flex items-center gap-4">
          <span>{itemsPerPage} / page</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" aria-label="Previous page" className="h-7 w-7 p-0" disabled>&lt;</Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-primary text-primary-foreground">1</Button>
            <Button variant="outline" size="sm" aria-label="Next page" className="h-7 w-7 p-0">&gt;</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
