import { Swap as ArrowsLeftRight } from "@/components/icons";
import { WifiHigh } from "@/components/icons/rounded";;

interface MurihPayDigitalCardProps {
  walletType: "system" | "creator" | "business";
  userName?: string;
  userTag?: string;
  availableBalance?: number;
  currency?: string;
  localCurrency?: string;
  localRate?: number;
  localFormatted?: string;
  isBalanceHidden?: boolean;
  showLocalCurrency?: boolean;
  onToggleCurrency?: () => void;
}

export function MurihPayDigitalCard({
  walletType,
  userName = "Vincent Adetuberu",
  userTag = "@vincent",
  availableBalance = 0,
  currency = "USD",
  localCurrency = "NGN",
  localRate = 1326.0,
  localFormatted,
  isBalanceHidden = false,
  showLocalCurrency = false,
  onToggleCurrency,
}: MurihPayDigitalCardProps) {
  const getSubhead = () => {
    switch (walletType) {
      case "creator":
        return "Creator Earnings";
      case "business":
        return "Business Revenue";
      default:
        return "Personal Wallet";
    }
  };

  const getFlag = (cur: string) => {
    switch (cur.toUpperCase()) {
      case "NGN":
        return "🇳🇬";
      case "KES":
        return "🇰🇪";
      case "GHS":
        return "🇬🇭";
      case "GBP":
        return "🇬🇧";
      case "EUR":
        return "🇪🇺";
      case "ZAR":
        return "🇿🇦";
      case "CAD":
        return "🇨🇦";
      case "AUD":
        return "🇦🇺";
      default:
        return "🇺🇸";
    }
  };

  const localSymbol = () => {
    switch (localCurrency.toUpperCase()) {
      case "NGN":
        return "₦";
      case "GBP":
        return "£";
      case "EUR":
        return "€";
      case "GHS":
        return "GH₵";
      case "KES":
        return "KSh";
      default:
        return `${localCurrency} `;
    }
  };

  const convertedAmount = availableBalance * (localRate || 1);
  const formattedUsd = `$${availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formattedLocal = localFormatted || `${localSymbol()}${convertedAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const activeDisplayAmount = showLocalCurrency ? formattedLocal : formattedUsd;
  const activeCurrencyCode = showLocalCurrency ? localCurrency : currency;

  return (
    <div
      className="relative w-full aspect-[1.586/1] max-w-[420px] rounded-2xl p-5 sm:p-6 text-white shadow-xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-2xl select-none"
      style={{
        background: "linear-gradient(135deg, #1A68D4 0%, #1555AD 55%, #0E3D7D 100%)",
        boxShadow: "0 16px 36px -10px rgba(26, 104, 212, 0.42), 0 4px 12px -2px rgba(0, 0, 0, 0.12)",
      }}
    >
      {/* Decorative subtle background waves */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 100% 0%, rgba(255, 255, 255, 0.4) 0%, transparent 60%),
                           radial-gradient(circle at 0% 100%, rgba(255, 255, 255, 0.25) 0%, transparent 50%)`,
        }}
      />
      <svg
        className="absolute right-0 top-0 h-full w-2/3 pointer-events-none opacity-15 stroke-white"
        fill="none"
        viewBox="0 0 300 200"
        preserveAspectRatio="none"
      >
        <path d="M50 0 C120 70, 180 130, 300 200" strokeWidth="1.5" />
        <path d="M120 0 C170 60, 220 120, 300 150" strokeWidth="1" />
        <path d="M0 50 C100 120, 190 160, 300 100" strokeWidth="1" />
      </svg>

      {/* Top Header: Brand Name + Wallet Subhead & Chip + Contactless */}
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-black tracking-tight drop-shadow-sm font-sans">
              MurihPay
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/15 text-white/90 border border-white/20">
              {getSubhead()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Subtle EMV chip */}
          <div className="w-8 h-6 rounded bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 shadow-sm border border-amber-400/60 flex items-center justify-center p-0.5 relative overflow-hidden opacity-90">
            <div className="w-full h-full border border-amber-700/30 rounded-[2px] grid grid-cols-3 gap-0.5 opacity-60">
              <div className="border-r border-amber-700/40" />
              <div className="border-r border-amber-700/40" />
              <div />
            </div>
          </div>
          <div className="flex items-center text-white/80">
            <WifiHigh weight="bold" className="h-4 w-4 rotate-90" />
          </div>
        </div>
      </div>

      {/* Hero Available Balance right on the Card */}
      <div className="relative z-10 my-auto py-2">
        <div className="flex items-center justify-between text-white/75 text-[11px] font-semibold uppercase tracking-wider mb-1">
          <span>Available Balance</span>
          {onToggleCurrency && localCurrency !== "USD" && (
            <button
              type="button"
              onClick={onToggleCurrency}
              className="flex items-center gap-1 text-[10px] font-semibold text-white/90 bg-white/15 hover:bg-white/25 transition-colors px-2 py-0.5 rounded-md border border-white/20 cursor-pointer"
              title="Toggle USD / Local currency"
            >
              <ArrowsLeftRight className="w-3 h-3" />
              <span>Switch to {showLocalCurrency ? "USD" : localCurrency}</span>
            </button>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight drop-shadow-sm font-sans">
            {isBalanceHidden ? "••••••••" : activeDisplayAmount}
          </span>
          <span className="text-xs sm:text-sm font-bold text-white/80">
            {activeCurrencyCode}
          </span>
        </div>

        {/* Live FX conversion line if local currency is distinct */}
        {localCurrency !== "USD" && (
          <p className="text-[11px] font-medium text-white/80 mt-1 flex items-center gap-1.5 drop-shadow-sm">
            <span>
              {isBalanceHidden
                ? "≈ ••••••••"
                : showLocalCurrency
                ? `≈ ${formattedUsd} USD`
                : `≈ ${formattedLocal} ${localCurrency}`}
            </span>
            <span className="text-white/50">·</span>
            <span className="text-white/70 text-[10px]">
              1 USD = {localSymbol()}{Number(localRate).toLocaleString()}
            </span>
          </p>
        )}
      </div>

      {/* Bottom Area: User Name/Tag & Currency Pill (No Visa logo, no fake card numbers, no expiry) */}
      <div className="relative z-10 flex items-end justify-between pt-1 border-t border-white/15">
        <div className="space-y-0.5 min-w-0 max-w-[70%]">
          <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">Account Holder</p>
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
              {userName}
            </span>
            {userTag && (
              <span className="text-xs font-medium text-white/80 shrink-0">
                {userTag.startsWith("@") ? userTag : `@${userTag}`}
              </span>
            )}
          </div>
        </div>

        {/* Currency indicator badge */}
        <div className="flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-full border border-white/20 text-xs font-bold text-white shadow-sm">
          <span>{getFlag(activeCurrencyCode)}</span>
          <span>{activeCurrencyCode}</span>
        </div>
      </div>
    </div>
  );
}
