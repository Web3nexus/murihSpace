import { Coins } from "@/components/icons/rounded";;
import { Button } from "@/components/ui/button";

interface WalletMshCoinsWidgetProps {
  coinBalance: number;
  onBuyCoins: () => void;
  onViewAll?: () => void;
  isBalanceHidden?: boolean;
}

export function WalletMshCoinsWidget({
  coinBalance = 0,
  onBuyCoins,
  onViewAll,
  isBalanceHidden = false,
}: WalletMshCoinsWidgetProps) {
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span>MSH Coins</span>
        </h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            type="button"
            className="text-xs font-semibold text-[#1A68D4] hover:underline"
          >
            View All
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20 font-black text-sm">
          🪙
        </div>
        <div>
          <p className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
            {isBalanceHidden ? "••••" : `${coinBalance.toLocaleString()} MSH Coins`}
          </p>
          <p className="text-[11px] text-muted-foreground font-medium">
            100 coins = $1.00 USD peg
          </p>
        </div>
      </div>

      <Button
        type="button"
        onClick={onBuyCoins}
        className="w-full bg-[#1A68D4] hover:bg-[#1555AD] text-white font-bold text-sm h-10 rounded-xl shadow-xs transition-all duration-150"
      >
        <Coins weight="fill" className="h-4 w-4 mr-2" />
        Buy Coins
      </Button>
    </div>
  );
}

