interface WalletBalanceBreakdownProps {
  pendingFormatted: string;
  reservedFormatted: string;
  escrowFormatted: string;
  totalFormatted: string;
  isBalanceHidden?: boolean;
}

/**
 * Integrated Ledger Summary Rail redesigned with Impeccable principles.
 * Replaces repetitive AI-style generic cards with a unified, cohesive financial summary rail.
 */
export function WalletBalanceBreakdown({
  pendingFormatted,
  reservedFormatted,
  escrowFormatted,
  totalFormatted,
  isBalanceHidden = false,
}: WalletBalanceBreakdownProps) {
  const metrics = [
    {
      label: "Total Book Balance",
      value: totalFormatted,
      description: "Available + In-flight",
      accent: "text-foreground font-extrabold",
      badge: "Consolidated",
    },
    {
      label: "Pending Clearance",
      value: pendingFormatted,
      description: "Settling via banking rails",
      accent: "text-amber-600 dark:text-amber-400 font-bold",
      badge: "In Flight",
    },
    {
      label: "Reserved Balance",
      value: reservedFormatted,
      description: "Security & dispute hold",
      accent: "text-[#1A68D4] dark:text-sky-400 font-bold",
      badge: "Protected",
    },
    {
      label: "Locked in Escrow",
      value: escrowFormatted,
      description: "Active milestone contracts",
      accent: "text-emerald-600 dark:text-emerald-400 font-bold",
      badge: "Secured",
    },
  ];

  return (
    <div className="w-full bg-card rounded-xl border border-border shadow-xs overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border/60">
        {metrics.map((item) => (
          <div
            key={item.label}
            className="p-4 sm:p-5 flex flex-col justify-between transition-colors hover:bg-muted/20"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {item.label}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
                {item.badge}
              </span>
            </div>

            <div>
              <p className={`text-lg sm:text-xl tracking-tight truncate ${item.accent}`}>
                {isBalanceHidden ? "••••••••" : item.value || "$0.00"}
              </p>
              <p className="text-[11px] text-muted-foreground/80 font-normal mt-0.5 truncate">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
