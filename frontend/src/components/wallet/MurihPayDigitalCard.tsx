import { WifiHigh } from "@phosphor-icons/react";

interface MurihPayDigitalCardProps {
  walletType: "system" | "creator" | "business";
  cardholderName?: string;
  maskedNumber?: string;
  expiry?: string;
  isBalanceHidden?: boolean;
}

export function MurihPayDigitalCard({
  walletType,
  cardholderName = "MURTIHPAY MEMBER",
  maskedNumber = "5495 7381 3759 2321",
  expiry = "09/28",
  isBalanceHidden = false,
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

  return (
    <div
      className="relative w-full aspect-[1.586/1] max-w-[380px] rounded-2xl p-5 sm:p-6 text-white shadow-xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-2xl select-none"
      style={{
        background: "linear-gradient(135deg, #1A68D4 0%, #1555AD 60%, #0E3D7D 100%)",
        boxShadow: "0 14px 35px -8px rgba(26, 104, 212, 0.45), 0 4px 10px -2px rgba(0, 0, 0, 0.1)",
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

      {/* Top Header: Brand Name + Wallet Subhead & Contactless */}
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-black tracking-tight drop-shadow-sm font-sans">
              MurihPay
            </span>
          </div>
          <p className="text-xs font-medium text-white/80 tracking-wide mt-0.5">
            {getSubhead()}
          </p>
        </div>

        <div className="flex items-center gap-1 text-white/80">
          <WifiHigh weight="bold" className="h-5 w-5 rotate-90" />
        </div>
      </div>

      {/* Middle: EMV Chip Graphic */}
      <div className="relative z-10 my-auto pt-1">
        <div className="w-11 h-8 rounded-md bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 shadow-sm border border-amber-400/60 flex items-center justify-center p-1 relative overflow-hidden">
          <div className="w-full h-full border border-amber-700/30 rounded-[3px] grid grid-cols-3 gap-0.5 opacity-60">
            <div className="border-r border-amber-700/40" />
            <div className="border-r border-amber-700/40" />
            <div />
          </div>
        </div>
      </div>

      {/* Bottom Area: Card Number, Name, Expiry, Logo */}
      <div className="relative z-10 space-y-2.5">
        <div className="font-mono text-base sm:text-lg font-medium tracking-[0.2em] sm:tracking-[0.22em] text-white/95 drop-shadow-sm">
          {isBalanceHidden ? "•••• •••• •••• ••••" : maskedNumber}
        </div>

        <div className="flex items-end justify-between pt-1">
          <div className="space-y-0.5 max-w-[65%]">
            <p className="text-[9px] uppercase tracking-wider text-white/70 font-medium">Cardholder</p>
            <p className="text-xs sm:text-sm font-bold tracking-wider text-white truncate uppercase">
              {cardholderName || "MURTIHPAY USER"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="space-y-0.5 text-right">
              <p className="text-[9px] uppercase tracking-wider text-white/70 font-medium">Valid Thru</p>
              <p className="text-xs font-mono font-semibold text-white/90">{expiry}</p>
            </div>

            {/* Visa / Brand Watermark Logo */}
            <div className="italic font-black text-lg sm:text-xl tracking-tighter text-white drop-shadow-sm pl-1 font-serif">
              VISA
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

