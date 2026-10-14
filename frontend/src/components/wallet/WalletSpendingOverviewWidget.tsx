import { ArrowDown as CaretDown } from "@/components/icons";

interface WalletSpendingOverviewWidgetProps {
  totalSpent?: string;
  isBalanceHidden?: boolean;
}

export function WalletSpendingOverviewWidget({
  totalSpent = "$1,240",
  isBalanceHidden = false,
}: WalletSpendingOverviewWidgetProps) {
  const timeframe = "Last 30 days";

  const segments = [
    { label: "MSH Coins", percent: 45, color: "#2164b6", strokeDash: "45 55", strokeOffset: "0" },
    { label: "Transfers", percent: 25, color: "#F59E0B", strokeDash: "25 75", strokeOffset: "-45" },
    { label: "Escrow", percent: 20, color: "#10B981", strokeDash: "20 80", strokeOffset: "-70" },
    { label: "Other", percent: 10, color: "#8B5CF6", strokeDash: "10 90", strokeOffset: "-90" },
  ];

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Spending Overview</h3>
        <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted/40 px-2 py-1 rounded-md border border-border/50">
          <span>{timeframe}</span>
          <CaretDown weight="bold" className="h-3 w-3" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pt-1">
        {/* Donut chart */}
        <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            {/* Background ring */}
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-muted/30"
            />
            {/* Segments */}
            {segments.map((seg) => (
              <circle
                key={seg.label}
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke={seg.color}
                strokeWidth="4"
                strokeDasharray={seg.strokeDash}
                strokeDashoffset={seg.strokeOffset}
                pathLength="100"
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            ))}
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
            <span className="text-xs sm:text-sm font-extrabold text-foreground">
              {isBalanceHidden ? "••••" : totalSpent}
            </span>
            <span className="text-[9px] text-muted-foreground font-semibold">Total Spent</span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-1.5 flex-1 min-w-0">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-muted-foreground truncate">{seg.label}</span>
              </div>
              <span className="font-bold text-foreground ml-2 shrink-0">{seg.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

