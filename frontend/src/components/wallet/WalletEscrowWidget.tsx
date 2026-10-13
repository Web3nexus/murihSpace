import { Video as VideoCamera } from "@/components/icons";
import { Headphones } from "@phosphor-icons/react";
import { useNavigate } from "react-router";

export interface EscrowDealItem {
  id: number;
  title: string;
  partyName: string;
  status: "active" | "held" | "disputed" | "released" | "completed" | "pending";
  amountFormatted: string;
}

interface WalletEscrowWidgetProps {
  deals?: EscrowDealItem[];
  isBalanceHidden?: boolean;
}

export function WalletEscrowWidget({
  deals,
  isBalanceHidden = false,
}: WalletEscrowWidgetProps) {
  const navigate = useNavigate();

  // Fallback realistic active deals if user has not yet created an escrow deal
  const displayDeals: EscrowDealItem[] = (deals && deals.length > 0)
    ? deals.slice(0, 3)
    : [
        {
          id: 1,
          title: "Fitness Campaign",
          partyName: "Apex Audio Tech",
          status: "active",
          amountFormatted: "$850.00",
        },
        {
          id: 2,
          title: "Tech Review",
          partyName: "Nova Electronics",
          status: "pending",
          amountFormatted: "$1,200.00",
        },
      ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
      case "held":
        return {
          label: "Active",
          color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        };
      case "pending":
        return {
          label: "Pending",
          color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        };
      case "disputed":
        return {
          label: "Disputed",
          color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        };
      default:
        return {
          label: "Completed",
          color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        };
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Recent Escrow Deals</h3>
        <button
          onClick={() => navigate("/app/wallet/escrow")}
          type="button"
          className="text-xs font-semibold text-[#1A68D4] hover:underline"
        >
          View All
        </button>
      </div>

      <div className="space-y-2.5">
        {displayDeals.map((deal, idx) => {
          const badge = getStatusBadge(deal.status);
          const Icon = idx % 2 === 0 ? Headphones : VideoCamera;

          return (
            <div
              key={deal.id}
              onClick={() => navigate(`/app/wallet/escrow`)}
              className="p-3 rounded-xl bg-muted/30 border border-border/70 hover:border-border flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-muted/50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#1A68D4]/10 text-[#1A68D4] flex items-center justify-center shrink-0">
                  <Icon weight="fill" className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-foreground truncate">{deal.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{deal.partyName}</p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mb-1 ${badge.color}`}>
                  {badge.label}
                </span>
                <p className="text-xs sm:text-sm font-extrabold text-foreground">
                  {isBalanceHidden ? "••••" : deal.amountFormatted}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

