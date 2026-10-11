import {
  SlidersHorizontal,
  CreditCard,
  ShieldCheck,
  CheckCircle,
  FileText,
  Question,
  CaretRight,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router";

interface WalletQuickActionsWidgetProps {
  isVerified?: boolean;
  onOpenLimits?: () => void;
  onOpenPaymentMethods?: () => void;
  onOpenStatements?: () => void;
}

export function WalletQuickActionsWidget({
  isVerified = true,
  onOpenLimits,
  onOpenPaymentMethods,
  onOpenStatements,
}: WalletQuickActionsWidgetProps) {
  const navigate = useNavigate();

  const actions = [
    {
      label: "Transaction Limits",
      icon: SlidersHorizontal,
      onClick: onOpenLimits,
    },
    {
      label: "Payment Methods",
      icon: CreditCard,
      onClick: onOpenPaymentMethods,
    },
    {
      label: "Escrow Deals",
      icon: ShieldCheck,
      onClick: () => navigate("/app/wallet/escrow"),
    },
    {
      label: "Account Verification",
      icon: CheckCircle,
      badge: isVerified ? "Verified" : "Pending",
      badgeColor: isVerified
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      onClick: () => navigate("/app/kyc"),
    },
    {
      label: "Statements",
      icon: FileText,
      onClick: onOpenStatements,
    },
    {
      label: "Help & Support",
      icon: Question,
      onClick: () => navigate("/app/messages/support"),
    },
  ];

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
      <h3 className="text-sm font-bold text-foreground">Quick Actions</h3>

      <div className="divide-y divide-border/60">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.label}
              type="button"
              onClick={act.onClick}
              className="w-full flex items-center justify-between py-2.5 px-1 group hover:bg-muted/40 rounded-lg transition-colors text-left focus:outline-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
                  <Icon weight="bold" className="h-4 w-4" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                  {act.label}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {act.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${act.badgeColor}`}>
                    {act.badge}
                  </span>
                )}
                <CaretRight weight="bold" className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

