import {
  Wallet as Wallet,
  ShieldCheck as ShieldCheck,
  Clock as Clock,
  Lock as Lock,
  Scales as Scales,
  ArrowUpRight as ArrowUpRight
} from "@phosphor-icons/react";

interface WalletBalanceData {
  id: number;
  wallet_type: "system" | "creator" | "business";
  available: number;
  pending: number;
  reserved: number;
  escrow: number;
  withdrawable: number;
  non_withdrawable: number;
  disputed: number;
  total: number;
  currency: string;
  amount_usd?: number;
  coins?: number;
  local_currency?: string;
  local_rate?: number;
  local_formatted?: string;
  formatted: {
    available: string;
    pending: string;
    reserved: string;
    escrow: string;
    total: string;
  };
  has_pin: boolean;
  status: string;
}

interface WalletBalanceCardProps {
  wallet: WalletBalanceData;
  onDeposit?: () => void;
  onTransfer?: () => void;
  onWithdraw?: () => void;
}

export function WalletBalanceCard({ wallet, onDeposit, onTransfer, onWithdraw }: WalletBalanceCardProps) {
  const isSystem = wallet.wallet_type === "system";
  const isCreator = wallet.wallet_type === "creator";
  const isBusiness = wallet.wallet_type === "business";

  const getGlassRefraction = () => {
    if (isCreator) return "before:bg-[radial-gradient(ellipse_70%_40%_at_20%_-10%,rgba(168,85,247,0.18),transparent_70%)]";
    if (isBusiness) return "before:bg-[radial-gradient(ellipse_70%_40%_at_20%_-10%,rgba(16,185,129,0.18),transparent_70%)]";
    return "before:bg-[radial-gradient(ellipse_70%_40%_at_20%_-10%,rgba(14,165,233,0.18),transparent_70%)]";
  };

  const getLabel = () => {
    if (isCreator) return "Creator Earnings Wallet";
    if (isBusiness) return "Business Revenue Wallet";
    return "System Personal Spending Wallet";
  };

  return (
    <div className={`relative overflow-hidden p-5 sm:p-6 rounded-2xl backdrop-blur-2xl bg-gradient-to-br from-white/[0.09] via-slate-900/60 to-black/80 text-white border border-white/[0.18] shadow-[0_16px_48px_rgba(0,0,0,0.45)] space-y-6 before:pointer-events-none before:absolute before:inset-0 ${getGlassRefraction()} after:pointer-events-none after:absolute after:top-0 after:inset-x-8 after:h-[1.5px] after:bg-gradient-to-r after:from-transparent after:via-white/45 after:to-transparent`}>
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] text-white/90 text-xs font-semibold uppercase tracking-wider backdrop-blur-md border border-white/20 shadow-sm">
            <Wallet weight="fill" className="h-3.5 w-3.5 text-primary" /> {getLabel()}
          </span>
          <div className="mt-3">
            <p className="text-xs text-white/60 font-medium uppercase tracking-wider">Available Balance</p>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5 drop-shadow-sm">{wallet.formatted.available}</h2>
            {wallet.local_formatted && wallet.currency === 'USD' && wallet.local_currency && wallet.local_currency !== 'USD' && (
              <p className="text-xs text-white/80 font-medium mt-1 flex items-center gap-1.5">
                <span>≈ {wallet.local_formatted}</span>
                <span className="text-[10px] text-white/70 bg-white/[0.08] backdrop-blur-sm border border-white/10 px-1.5 py-0.5 rounded font-medium">
                  {wallet.local_currency} estimate
                </span>
              </p>
            )}
            {wallet.coins !== undefined && isSystem && (
              <p className="text-xs text-amber-300/90 font-medium mt-1 flex items-center gap-1">
                <span>🪙</span> {wallet.coins.toLocaleString()} MSH Coins <span className="text-white/40 text-[11px] font-normal">(100 coins = $1.00)</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isSystem && onDeposit && (
            <button
              onClick={onDeposit}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-[0_4px_16px_rgba(0,122,255,0.35)] hover:brightness-110 active:scale-[0.98] transition backdrop-blur-md border border-primary/40"
            >
              Deposit Funds
            </button>
          )}

          {!isSystem && onTransfer && (
            <button
              onClick={onTransfer}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.12] hover:bg-white/[0.20] active:scale-[0.98] text-white font-bold text-sm shadow-sm transition backdrop-blur-md border border-white/20"
            >
              <ArrowUpRight weight="fill" className="h-4 w-4" /> Transfer to System Wallet
            </button>
          )}

          {!isSystem && onWithdraw && (
            <button
              onClick={onWithdraw}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] active:scale-[0.98] text-white font-semibold text-sm transition backdrop-blur-md border border-white/15"
            >
              Withdraw
            </button>
          )}
        </div>
      </div>

      {/* Granular Balance Category Breakdown Grid with Liquid Glass cards */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/[0.12]">
        <div className="p-3 rounded-xl bg-white/[0.04] backdrop-blur-md border border-white/[0.08] hover:bg-white/[0.07] transition shadow-sm">
          <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
            <Clock weight="fill" className="h-3.5 w-3.5 text-amber-400" /> Pending
          </div>
          <p className="text-sm font-bold text-white mt-1">{wallet.formatted.pending}</p>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.04] backdrop-blur-md border border-white/[0.08] hover:bg-white/[0.07] transition shadow-sm">
          <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
            <Lock weight="fill" className="h-3.5 w-3.5 text-blue-400" /> Reserved
          </div>
          <p className="text-sm font-bold text-white mt-1">{wallet.formatted.reserved}</p>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.04] backdrop-blur-md border border-white/[0.08] hover:bg-white/[0.07] transition shadow-sm">
          <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
            <ShieldCheck weight="fill" className="h-3.5 w-3.5 text-emerald-400" /> Escrow
          </div>
          <p className="text-sm font-bold text-white mt-1">{wallet.formatted.escrow}</p>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.04] backdrop-blur-md border border-white/[0.08] hover:bg-white/[0.07] transition shadow-sm">
          <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
            <Scales weight="fill" className="h-3.5 w-3.5 text-purple-400" /> Total Balance
          </div>
          <p className="text-sm font-bold text-white mt-1">{wallet.formatted.total}</p>
        </div>
      </div>
    </div>
  );
}
