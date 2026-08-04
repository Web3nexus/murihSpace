import { Wallet, ShieldCheck, Clock, Lock, Scale, ArrowUpRight } from "lucide-react";

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

  const getGradient = () => {
    if (isCreator) return "from-purple-950 via-indigo-900 to-slate-900 border-purple-800/40";
    if (isBusiness) return "from-emerald-950 via-teal-900 to-slate-900 border-emerald-800/40";
    return "from-[#102840] via-[#173852] to-slate-900 border-sky-800/40";
  };

  const getLabel = () => {
    if (isCreator) return "Creator Earnings Wallet";
    if (isBusiness) return "Business Revenue Wallet";
    return "System Personal Spending Wallet";
  };

  return (
    <div className={`p-6 sm:p-8 rounded-2xl bg-gradient-to-br ${getGradient()} text-white border shadow-xl space-y-6`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm border border-white/10">
            <Wallet className="h-3.5 w-3.5 text-primary" /> {getLabel()}
          </span>
          <div className="mt-3">
            <p className="text-xs text-white/70 font-medium uppercase tracking-wider">Available Balance</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-0.5">{wallet.formatted.available}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isSystem && onDeposit && (
            <button
              onClick={onDeposit}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow hover:opacity-90 transition"
            >
              Deposit Funds
            </button>
          )}

          {!isSystem && onTransfer && (
            <button
              onClick={onTransfer}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-sm shadow hover:bg-white/90 transition"
            >
              <ArrowUpRight className="h-4 w-4" /> Transfer to System Wallet
            </button>
          )}

          {!isSystem && onWithdraw && (
            <button
              onClick={onWithdraw}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-sm transition backdrop-blur-sm"
            >
              Withdraw
            </button>
          )}
        </div>
      </div>

      {/* Granular Balance Category Breakdown Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/10">
        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
            <Clock className="h-3.5 w-3.5 text-amber-400" /> Pending
          </div>
          <p className="text-sm font-bold text-white mt-1">{wallet.formatted.pending}</p>
        </div>

        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
            <Lock className="h-3.5 w-3.5 text-blue-400" /> Reserved
          </div>
          <p className="text-sm font-bold text-white mt-1">{wallet.formatted.reserved}</p>
        </div>

        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Escrow
          </div>
          <p className="text-sm font-bold text-white mt-1">{wallet.formatted.escrow}</p>
        </div>

        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
            <Scale className="h-3.5 w-3.5 text-purple-400" /> Total Balance
          </div>
          <p className="text-sm font-bold text-white mt-1">{wallet.formatted.total}</p>
        </div>
      </div>
    </div>
  );
}
