import { User, VideoCamera, Buildings } from "@phosphor-icons/react";

export type WalletContextType = "system" | "creator" | "business";

interface WalletSwitcherProps {
  activeTab: WalletContextType;
  onChange: (tab: WalletContextType) => void;
  hasCreatorWallet?: boolean;
  hasBusinessWallet?: boolean;
  disabled?: boolean;
}

export function WalletSwitcher({
  activeTab,
  onChange,
  hasCreatorWallet = true,
  hasBusinessWallet = true,
  disabled = false,
}: WalletSwitcherProps) {
  const tabs = [
    {
      id: "system" as WalletContextType,
      label: "Personal Wallet",
      icon: User,
      visible: true,
    },
    {
      id: "creator" as WalletContextType,
      label: "Creator Earnings",
      icon: VideoCamera,
      visible: hasCreatorWallet,
    },
    {
      id: "business" as WalletContextType,
      label: "Business Revenue",
      icon: Buildings,
      visible: hasBusinessWallet,
    },
  ].filter((t) => t.visible);

  return (
    <div
      role="tablist"
      aria-label="Wallet Type Selector"
      className="inline-flex p-1 bg-muted/60 dark:bg-muted/30 border border-border rounded-xl gap-1 max-w-full overflow-x-auto select-none"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A68D4] ${
              isActive
                ? "bg-[#1A68D4] text-white shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-background/80"
            }`}
          >
            <Icon
              weight={isActive ? "fill" : "regular"}
              className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-muted-foreground"}`}
            />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

