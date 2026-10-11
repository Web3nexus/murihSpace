import {
  Plus,
  ArrowUpRight,
  PaperPlaneRight,
  QrCode,
  ShieldCheck,
  Coins,
  ArrowsLeftRight,
} from "@phosphor-icons/react";

interface WalletActionToolbarProps {
  walletType: "system" | "creator" | "business";
  onDeposit: () => void;
  onWithdraw: () => void;
  onSendMoney: () => void;
  onReceiveMoney: () => void;
  onLockEscrow: () => void;
  onBuyCoins: () => void;
  onInternalTransfer?: () => void;
}

export function WalletActionToolbar({
  walletType,
  onDeposit,
  onWithdraw,
  onSendMoney,
  onReceiveMoney,
  onLockEscrow,
  onBuyCoins,
  onInternalTransfer,
}: WalletActionToolbarProps) {
  const isSystem = walletType === "system";

  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      {/* 1. Deposit Action */}
      <button
        onClick={onDeposit}
        type="button"
        className="flex flex-col items-center gap-1.5 group p-1 focus:outline-none"
      >
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#1A68D4] text-white flex items-center justify-center shadow-md transition-transform duration-200 group-hover:scale-105 group-hover:bg-[#1555AD] focus-visible:ring-2 focus-visible:ring-[#1A68D4]">
          <Plus weight="bold" className="h-5 w-5" />
        </div>
        <span className="text-[11px] sm:text-xs font-semibold text-foreground tracking-tight">Deposit</span>
      </button>

      {/* 2. Withdraw Action */}
      <button
        onClick={onWithdraw}
        type="button"
        className="flex flex-col items-center gap-1.5 group p-1 focus:outline-none"
      >
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-hover:bg-emerald-500/20">
          <ArrowUpRight weight="bold" className="h-5 w-5" />
        </div>
        <span className="text-[11px] sm:text-xs font-semibold text-foreground tracking-tight">Withdraw</span>
      </button>

      {/* 3. Send Money (P2P) */}
      {isSystem ? (
        <button
          onClick={onSendMoney}
          type="button"
          className="flex flex-col items-center gap-1.5 group p-1 focus:outline-none"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-sky-500/10 text-[#1A68D4] dark:bg-sky-500/20 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-hover:bg-sky-500/20">
            <PaperPlaneRight weight="fill" className="h-5 w-5" />
          </div>
          <span className="text-[11px] sm:text-xs font-semibold text-foreground tracking-tight">Send Money</span>
        </button>
      ) : (
        /* Transfer to System Personal Wallet for Creator/Business */
        <button
          onClick={onInternalTransfer}
          type="button"
          className="flex flex-col items-center gap-1.5 group p-1 focus:outline-none"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 dark:bg-indigo-500/20 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-hover:bg-indigo-500/20">
            <ArrowsLeftRight weight="bold" className="h-5 w-5" />
          </div>
          <span className="text-[11px] sm:text-xs font-semibold text-foreground tracking-tight">Transfer</span>
        </button>
      )}

      {/* 4. Receive (QR / Account Details) */}
      <button
        onClick={onReceiveMoney}
        type="button"
        className="flex flex-col items-center gap-1.5 group p-1 focus:outline-none"
      >
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-blue-500/10 text-[#1A68D4] dark:bg-blue-500/20 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-hover:bg-blue-500/20">
          <QrCode weight="bold" className="h-5 w-5" />
        </div>
        <span className="text-[11px] sm:text-xs font-semibold text-foreground tracking-tight">Receive</span>
      </button>

      {/* 5. Lock Escrow */}
      <button
        onClick={onLockEscrow}
        type="button"
        className="flex flex-col items-center gap-1.5 group p-1 focus:outline-none"
      >
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-hover:bg-amber-500/20">
          <ShieldCheck weight="fill" className="h-5 w-5" />
        </div>
        <span className="text-[11px] sm:text-xs font-semibold text-foreground tracking-tight">Lock Escrow</span>
      </button>

      {/* 6. Buy Coins */}
      <button
        onClick={onBuyCoins}
        type="button"
        className="flex flex-col items-center gap-1.5 group p-1 focus:outline-none"
      >
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 dark:bg-purple-500/20 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-hover:bg-purple-500/20">
          <Coins weight="fill" className="h-5 w-5" />
        </div>
        <span className="text-[11px] sm:text-xs font-semibold text-foreground tracking-tight">Buy Coins</span>
      </button>
    </div>
  );
}

