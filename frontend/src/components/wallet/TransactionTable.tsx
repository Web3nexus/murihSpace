import { useState, useMemo } from "react";
import {
  MagnifyingGlass,
  Funnel,
  CalendarBlank,
  DotsThree,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Coins,
  ShieldCheck,
  Bank,
  CheckCircle,
  Clock,
  WarningCircle,
} from "@phosphor-icons/react";

export interface TransactionRowData {
  id: number;
  wallet_type: string;
  type: string;
  entry_type: "debit" | "credit";
  amount: number;
  currency: string;
  formatted: string;
  description: string;
  created_at: string;
  status?: string;
  balance_after?: number;
}

interface TransactionTableProps {
  transactions: TransactionRowData[];
  onSelectTransaction: (tx: TransactionRowData) => void;
  isBalanceHidden?: boolean;
}

export function TransactionTable({
  transactions,
  onSelectTransaction,
  isBalanceHidden = false,
}: TransactionTableProps) {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filterTabs = [
    { id: "all", label: "All" },
    { id: "income", label: "Income" },
    { id: "expenses", label: "Expenses" },
    { id: "transfers", label: "Transfers" },
    { id: "escrow", label: "Escrow" },
    { id: "coins", label: "MSH Coins" },
  ];

  // Helper to resolve icon and color
  const resolveTransactionMeta = (tx: TransactionRowData) => {
    const isCredit = tx.entry_type === "credit";
    const desc = (tx.description || "").toLowerCase();
    const type = (tx.type || "").toLowerCase();

    if (desc.includes("coin") || type.includes("coin")) {
      return {
        icon: Coins,
        iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
        label: "MSH Coins",
      };
    }
    if (desc.includes("escrow") || type.includes("escrow")) {
      return {
        icon: ShieldCheck,
        iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        label: "Escrow",
      };
    }
    if (desc.includes("bank") || desc.includes("withdraw") || type.includes("withdraw")) {
      return {
        icon: Bank,
        iconBg: "bg-blue-500/10 text-[#1A68D4] dark:text-blue-400",
        label: "Withdrawal",
      };
    }
    if (desc.includes("gift") || type.includes("gift") || desc.includes("donation")) {
      return {
        icon: Gift,
        iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        label: "Gift",
      };
    }
    if (isCredit) {
      return {
        icon: ArrowDownLeft,
        iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        label: "Deposit",
      };
    }
    return {
      icon: ArrowUpRight,
      iconBg: "bg-sky-500/10 text-[#1A68D4] dark:text-sky-400",
      label: "Transfer",
    };
  };

  const resolveStatusMeta = (statusStr?: string) => {
    const s = (statusStr || "completed").toLowerCase();
    if (s === "pending") {
      return {
        label: "Pending",
        icon: Clock,
        style: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      };
    }
    if (s === "processing") {
      return {
        label: "Processing",
        icon: Clock,
        style: "bg-blue-500/10 text-[#1A68D4] dark:text-blue-400 border-blue-500/20",
      };
    }
    if (s === "failed" || s === "reversed") {
      return {
        label: "Failed",
        icon: WarningCircle,
        style: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
      };
    }
    return {
      label: "Completed",
      icon: CheckCircle,
      style: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    };
  };

  // Filter and search
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Category filter
      if (activeFilter === "income" && tx.entry_type !== "credit") return false;
      if (activeFilter === "expenses" && tx.entry_type !== "debit") return false;
      if (activeFilter === "transfers") {
        const desc = (tx.description || "").toLowerCase();
        const type = (tx.type || "").toLowerCase();
        if (!desc.includes("transfer") && !desc.includes("sent") && !type.includes("transfer")) return false;
      }
      if (activeFilter === "escrow") {
        const desc = (tx.description || "").toLowerCase();
        const type = (tx.type || "").toLowerCase();
        if (!desc.includes("escrow") && !type.includes("escrow")) return false;
      }
      if (activeFilter === "coins") {
        const desc = (tx.description || "").toLowerCase();
        const type = (tx.type || "").toLowerCase();
        if (!desc.includes("coin") && !type.includes("coin")) return false;
      }

      // Query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const desc = (tx.description || "").toLowerCase();
        const type = (tx.type || "").toLowerCase();
        return desc.includes(query) || type.includes(query) || tx.formatted.includes(query);
      }

      return true;
    });
  }, [transactions, activeFilter, searchQuery]);

  return (
    <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border shadow-xs space-y-4">
      {/* Header with Title & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground">Recent Transactions</h2>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlass weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transactions..."
              className="pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border/80 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#1A68D4] w-40 sm:w-56"
            />
          </div>

          <button
            type="button"
            className="p-2 rounded-lg border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title="Filter options"
          >
            <Funnel weight="bold" className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="p-2 rounded-lg border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title="Date range"
          >
            <CalendarBlank weight="bold" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Filter Tabs Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap focus:outline-none ${
                isActive
                  ? "bg-[#1A68D4] text-white shadow-xs font-bold"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Transactions Table */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border/80 bg-muted/10 space-y-2">
          <p className="text-sm font-semibold text-foreground">No transactions found</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? "No transactions match your current search criteria."
              : "Transactions and double-entry ledger records will appear here as activity occurs."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border/80 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredTransactions.map((tx) => {
                const meta = resolveTransactionMeta(tx);
                const status = resolveStatusMeta(tx.status);
                const isCredit = tx.entry_type === "credit";
                const Icon = meta.icon;
                const StatusIcon = status.icon;

                // Format timestamp
                const dateObj = new Date(tx.created_at);
                const dateStr = !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }) +
                    ", " +
                    dateObj.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : tx.created_at;

                return (
                  <tr
                    key={tx.id}
                    onClick={() => onSelectTransaction(tx)}
                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    {/* 1. Type Icon */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${meta.iconBg}`}>
                        <Icon weight="fill" className="h-4 w-4" />
                      </div>
                    </td>

                    {/* 2. Description */}
                    <td className="px-4 py-3">
                      <div className="max-w-[200px] sm:max-w-xs truncate">
                        <p className="font-semibold text-foreground truncate">
                          {tx.description || meta.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {tx.wallet_type ? `${tx.wallet_type.toUpperCase()} WALLET` : "MURIHPAY"}
                        </p>
                      </div>
                    </td>

                    {/* 3. Date & Time */}
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs font-medium">
                      {dateStr}
                    </td>

                    {/* 4. Status Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${status.style}`}>
                        <StatusIcon weight="fill" className="h-3 w-3 shrink-0" />
                        <span>{status.label}</span>
                      </span>
                    </td>

                    {/* 5. Amount */}
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <span
                        className={`font-bold font-mono text-xs sm:text-sm ${
                          isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {isBalanceHidden ? "••••" : `${isCredit ? "+" : "-"} ${tx.formatted || `$${(tx.amount / 100).toFixed(2)}`}`}
                      </span>
                    </td>

                    {/* 6. More Options Action */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTransaction(tx);
                        }}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="View Receipt"
                      >
                        <DotsThree weight="bold" className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

