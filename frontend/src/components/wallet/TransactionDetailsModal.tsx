import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TickSquare as CheckCircle, ArrowDown as ArrowDownLeft, ArrowUp as ArrowUpRight } from "@/components/icons";
import { Receipt, Copy } from "@phosphor-icons/react";
import type { TransactionRowData } from "./TransactionTable";
import { toast } from "sonner";

interface TransactionDetailsModalProps {
  transaction: TransactionRowData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TransactionDetailsModal({
  transaction,
  isOpen,
  onClose,
}: TransactionDetailsModalProps) {
  if (!transaction) return null;

  const isCredit = transaction.entry_type === "credit";
  const dateObj = new Date(transaction.created_at);
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : transaction.created_at;

  const copyRef = () => {
    navigator.clipboard.writeText(`TX-${transaction.id}-${transaction.wallet_type.toUpperCase()}`);
    toast.success("Transaction Reference copied to clipboard!");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="text-center sm:text-left space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Receipt weight="bold" className="h-5 w-5 text-[#1A68D4]" />
            Transaction Receipt
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Audited ledger record verified by MurihPay double-entry accounting.
          </DialogDescription>
        </DialogHeader>

        {/* Big Amount Card */}
        <div className="my-3 p-4 rounded-2xl bg-muted/30 border border-border text-center space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {isCredit ? "Funds Received" : "Funds Sent / Charged"}
          </p>
          <h2
            className={`text-2xl sm:text-3xl font-extrabold font-mono ${
              isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {isCredit ? "+" : "-"} {transaction.formatted || `$${(transaction.amount / 100).toFixed(2)}`}
          </h2>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            <CheckCircle weight="fill" className="h-3 w-3" />
            Confirmed & Settled
          </span>
        </div>

        {/* Details Key-Value Table */}
        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">Reference ID</span>
            <div className="flex items-center gap-1.5 font-mono font-bold text-foreground">
              <span>TX-{transaction.id}-{transaction.wallet_type.toUpperCase()}</span>
              <button
                type="button"
                onClick={copyRef}
                className="text-muted-foreground hover:text-foreground p-0.5"
                title="Copy reference"
              >
                <Copy weight="bold" className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">Description</span>
            <span className="font-semibold text-foreground max-w-[200px] truncate text-right">
              {transaction.description || "MurihPay Transfer"}
            </span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">Wallet Context</span>
            <span className="font-semibold uppercase text-foreground">
              {transaction.wallet_type} Wallet
            </span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">Timestamp</span>
            <span className="font-medium text-foreground text-right">{formattedDate}</span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">Direction / Flow</span>
            <span className="font-bold capitalize text-foreground flex items-center gap-1">
              {isCredit ? (
                <>
                  <ArrowDownLeft weight="bold" className="h-3.5 w-3.5 text-emerald-500" /> Credit Inflow
                </>
              ) : (
                <>
                  <ArrowUpRight weight="bold" className="h-3.5 w-3.5 text-rose-500" /> Debit Outflow
                </>
              )}
            </span>
          </div>

          {transaction.balance_after !== undefined && (
            <div className="flex justify-between items-center py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Balance After</span>
              <span className="font-mono font-bold text-foreground">
                ${(transaction.balance_after / 100).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="pt-3">
          <Button
            type="button"
            onClick={onClose}
            className="w-full h-10 bg-muted text-foreground hover:bg-muted/80 font-bold text-xs rounded-xl"
          >
            Close Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

