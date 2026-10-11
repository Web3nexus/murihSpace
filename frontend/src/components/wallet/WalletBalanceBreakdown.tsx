import { Clock, Lock, ShieldCheck, ChartBar } from "@phosphor-icons/react";

interface WalletBalanceBreakdownProps {
  pendingFormatted: string;
  reservedFormatted: string;
  escrowFormatted: string;
  totalFormatted: string;
  isBalanceHidden?: boolean;
}

export function WalletBalanceBreakdown({
  pendingFormatted,
  reservedFormatted,
  escrowFormatted,
  totalFormatted,
  isBalanceHidden = false,
}: WalletBalanceBreakdownProps) {
  const items = [
    {
      label: "Pending",
      value: pendingFormatted,
      icon: Clock,
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20",
    },
    {
      label: "Reserved",
      value: reservedFormatted,
      icon: Lock,
      iconBg: "bg-sky-500/10 text-[#1A68D4] dark:bg-sky-500/20",
    },
    {
      label: "Escrow",
      value: escrowFormatted,
      icon: ShieldCheck,
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20",
    },
    {
      label: "Total Balance",
      value: totalFormatted,
      icon: ChartBar,
      iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 dark:bg-indigo-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="p-3.5 sm:p-4 rounded-xl bg-card border border-border shadow-xs flex items-center gap-3 transition-colors hover:border-border/80"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.iconBg}`}>
              <Icon weight="fill" className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground truncate">{item.label}</p>
              <p className="text-base sm:text-lg font-bold text-foreground tracking-tight truncate mt-0.5">
                {isBalanceHidden ? "••••••" : item.value || "$0.00"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

