import React from 'react';

export type StoreTabKey = 'overview' | 'products' | 'collections' | 'design' | 'settings';

interface StoreTabsNavProps {
  activeTab: StoreTabKey;
  onTabChange: (tab: StoreTabKey) => void;
}

const TABS: { key: StoreTabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'products', label: 'Products' },
  { key: 'collections', label: 'Collections' },
  { key: 'design', label: 'Store Design' },
  { key: 'settings', label: 'Settings' },
];

export const StoreTabsNav: React.FC<StoreTabsNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="border-b border-[#29313C] w-full">
      <nav className="flex space-x-8 -mb-px overflow-x-auto scrollbar-none" aria-label="Store Tabs">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`whitespace-nowrap py-3.5 px-1 text-sm font-semibold transition-all relative ${
                isActive
                  ? 'text-white'
                  : 'text-[#A7B0BE] hover:text-[#F5F7FA]'
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#087FFF] rounded-full" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

