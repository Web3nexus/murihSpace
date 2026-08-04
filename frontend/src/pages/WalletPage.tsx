import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Plus,
  Lock,
  Loader2,
  RefreshCw,
  Clock,
  ShieldCheck,
  Building2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient, type ApiError } from "@/lib/api/client";
import { WalletBalanceCard } from "@/components/wallet/WalletBalanceCard";
import { InternalTransferModal } from "@/components/wallet/InternalTransferModal";
import { FeePreviewCard } from "@/components/wallet/FeePreviewCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface WalletItem {
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

interface TransactionItem {
  id: number;
  wallet_type: string;
  balance_category: string;
  type: string;
  entry_type: "debit" | "credit";
  amount: number;
  currency: string;
  formatted: string;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export function WalletPage() {
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [activeTab, setActiveTab] = useState<"system" | "creator" | "business">("system");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showDeposit, setShowDeposit] = useState(false);
  const [showInternalTransfer, setShowInternalTransfer] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  // Deposit Form
  const [depositAmount, setDepositAmount] = useState("");
  const [depositGateway, setDepositGateway] = useState("paystack");
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositFeePreview, setDepositFeePreview] = useState<any>(null);
  const [feePreviewLoading, setFeePreviewLoading] = useState(false);

  // Send Form
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendNote, setSendNote] = useState("");
  const [sendPin, setSendPin] = useState("");
  const [sendLoading, setSendLoading] = useState(false);

  // Pin Form
  const [pinInput, setPinInput] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  // Request sequencing: discard responses that belong to a superseded request.
  const transactionsRequestRef = useRef(0);
  const feePreviewRequestRef = useRef(0);

  const fetchWallets = useCallback(async () => {
    try {
      const res = await apiClient.get("/wallet");
      const list = res.data?.data || [];
      setWallets(list);
    } catch {
      toast.error("Failed to load wallets.");
    }
  }, []);

  const fetchTransactions = useCallback(async (typeFilter?: string) => {
    const requestId = ++transactionsRequestRef.current;
    setTransactions([]);
    try {
      const params: Record<string, string> = {};
      if (typeFilter) params.wallet_type = typeFilter;
      const res = await apiClient.get("/wallet/transactions", { params });
      if (requestId !== transactionsRequestRef.current) return;
      const items = res.data?.data || res.data?.items || [];
      setTransactions(Array.isArray(items) ? items : []);
    } catch {
      if (requestId === transactionsRequestRef.current) setTransactions([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchWallets(), fetchTransactions(activeTab)]).finally(() => setLoading(false));
  }, [fetchWallets, fetchTransactions, activeTab]);

  const activeWallet = wallets.find((w) => w.wallet_type === activeTab);
  const systemWallet = wallets.find((w) => w.wallet_type === "system");

  // Live fee preview for deposit
  const fetchDepositFeePreview = useCallback(async (amountStr: string, gateway: string) => {
    const requestId = ++feePreviewRequestRef.current;
    const minor = Math.round((parseFloat(amountStr) || 0) * 100);
    if (minor < 100) { setDepositFeePreview(null); return; }
    setFeePreviewLoading(true);
    try {
      const res = await apiClient.post("/wallet/fees/preview", {
        transaction_code: `DEPOSIT_${gateway.toUpperCase()}`,
        amount: minor,
        currency: "NGN",
        payment_method: gateway,
      });
      if (requestId !== feePreviewRequestRef.current) return;
      setDepositFeePreview(res.data?.data?.data || res.data?.data || null);
    } catch {
      if (requestId === feePreviewRequestRef.current) setDepositFeePreview(null);
    } finally {
      if (requestId === feePreviewRequestRef.current) setFeePreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showDeposit) return;
    const timer = setTimeout(() => fetchDepositFeePreview(depositAmount, depositGateway), 400);
    return () => clearTimeout(timer);
  }, [depositAmount, depositGateway, showDeposit, fetchDepositFeePreview]);

  // Handle Cash Deposit into System Wallet
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const minorAmount = Math.round((parseFloat(depositAmount) || 0) * 100);
    if (minorAmount < 100) {
      toast.error("Minimum deposit amount is ₦1.00");
      return;
    }

    setDepositLoading(true);
    try {
      const res = await apiClient.post("/wallet/deposit", {
        amount: minorAmount,
        payment_gateway: depositGateway,
        currency: "NGN",
      });

      if (res.data) {
        toast.success("Deposit successful! Your System Wallet has been credited.");
        closeDepositModal();
        setDepositAmount("");
        fetchWallets();
        fetchTransactions(activeTab);
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Failed to process deposit.");
    } finally {
      setDepositLoading(false);
    }
  };

  // Handle P2P Send
  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const minorAmount = Math.round((parseFloat(sendAmount) || 0) * 100);
    if (minorAmount <= 0) {
      toast.error("Enter a valid transfer amount.");
      return;
    }

    if (!sendRecipient) {
      toast.error("Enter recipient username.");
      return;
    }

    if (systemWallet?.has_pin && (!sendPin || sendPin.length !== 4)) {
      toast.error("Enter your 4-digit transaction PIN.");
      return;
    }

    setSendLoading(true);
    try {
      await apiClient.post("/wallet/transfers/send", {
        recipient_username: sendRecipient,
        amount: minorAmount,
        note: sendNote || undefined,
        ...(systemWallet?.has_pin ? { pin: sendPin } : {}),
      });

      toast.success(`Sent NGN ${parseFloat(sendAmount).toFixed(2)} to @${sendRecipient}!`);
      closeSendModal();
      setSendRecipient("");
      setSendAmount("");
      setSendNote("");
      fetchWallets();
      fetchTransactions(activeTab);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Transfer failed.");
    } finally {
      setSendLoading(false);
    }
  };

  // Handle Setup PIN
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length !== 4) {
      toast.error("PIN must be 4 digits.");
      return;
    }

    setPinLoading(true);
    try {
      await apiClient.post("/wallet/pin/setup", { pin: pinInput });
      toast.success("Transaction PIN configured!");
      closePinModal();
      fetchWallets();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Failed to set PIN.");
    } finally {
      setPinLoading(false);
    }
  };

  // Clear sensitive PIN fields whenever a dialog closes (cancel, escape, backdrop).
  const closeSendModal = () => {
    setSendPin("");
    setShowSendModal(false);
  };

  const closePinModal = () => {
    setPinInput("");
    setShowPinModal(false);
  };

  const closeDepositModal = () => {
    feePreviewRequestRef.current++;
    setDepositFeePreview(null);
    setFeePreviewLoading(false);
    setShowDeposit(false);
  };

  if (loading && wallets.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading your wallets...
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-3">
        <Wallet className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground font-medium">No wallets available yet.</p>
        <p className="text-sm text-muted-foreground">Your wallets will appear here once they are provisioned.</p>
      </div>
    );
  }

  // A selected wallet type may not exist for the current user's role. Render a
  // dedicated empty state rather than silently showing a different wallet.
  if (!activeWallet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-3">
        <Wallet className="h-10 w-10 text-muted-foreground" />
        <p className="text-foreground font-bold">No {activeTab} wallet found</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          You don&apos;t have a {activeTab} wallet yet. Wallets are provisioned based on your account role.
        </p>
      </div>
    );
  }

  const hasCreatorWallet = wallets.some((w) => w.wallet_type === "creator");
  const hasBusinessWallet = wallets.some((w) => w.wallet_type === "business");

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" /> MurihPay Multi-Wallet System
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Separate personal spending from creator & business earnings with double-entry ledger protection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSendModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-card border border-border text-foreground font-semibold text-sm rounded-xl hover:bg-accent transition shadow-sm"
          >
            <Send className="h-4 w-4 text-primary" /> Send Money
          </button>

          {!systemWallet?.has_pin && (
            <button
              onClick={() => setShowPinModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-sm rounded-xl hover:bg-amber-500/20 transition border border-amber-500/20"
            >
              <Lock className="h-4 w-4" /> Setup PIN
            </button>
          )}
        </div>
      </div>

      {/* Multi-Wallet Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("system")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
            activeTab === "system"
              ? "bg-primary text-primary-foreground shadow"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Wallet className="h-4 w-4" /> System Wallet (Personal)
        </button>

        {hasCreatorWallet && (
          <button
            onClick={() => setActiveTab("creator")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
              activeTab === "creator"
                ? "bg-purple-600 text-white shadow"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-4 w-4" /> Creator Earnings
          </button>
        )}

        {hasBusinessWallet && (
          <button
            onClick={() => setActiveTab("business")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
              activeTab === "business"
                ? "bg-emerald-600 text-white shadow"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="h-4 w-4" /> Business Revenue
          </button>
        )}
      </div>

      {/* Active Wallet Balance Card */}
      <WalletBalanceCard
        wallet={activeWallet}
        onDeposit={() => setShowDeposit(true)}
        onTransfer={() => setShowInternalTransfer(true)}
      />

      {/* Transaction History Section */}
      <div className="p-6 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Double-Entry Ledger History ({activeTab.toUpperCase()})
          </h2>
          <span className="text-xs text-muted-foreground">Real-time audited records</span>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No transaction entries recorded for this wallet yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Balance After</th>
                  <th className="px-4 py-3 font-semibold text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => {
                  const isCredit = tx.entry_type === "credit";
                  return (
                    <tr key={tx.id} className="hover:bg-muted/10 transition">
                      <td className="px-4 py-3 font-medium capitalize flex items-center gap-1.5">
                        {isCredit ? (
                          <ArrowDownLeft className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-rose-500 shrink-0" />
                        )}
                        <span>{(tx.type || "transaction").replace(/_/g, " ")}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{tx.balance_category}</td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground max-w-xs truncate">
                        {tx.description || "System transaction"}
                      </td>
                      <td className={`px-4 py-3 font-bold ${isCredit ? "text-emerald-500" : "text-foreground"}`}>
                        {isCredit ? "+" : "-"}{tx.formatted}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {tx.currency === "USD" ? "$" : tx.currency === "EUR" ? "€" : tx.currency === "GBP" ? "£" : "₦"}
                        {(tx.balance_after / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground text-right whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Internal Transfer Modal */}
      {showInternalTransfer && (activeTab === "creator" || activeTab === "business") && (
        <InternalTransferModal
          isOpen={showInternalTransfer}
          onClose={() => setShowInternalTransfer(false)}
          fromWalletType={activeTab}
          availableBalance={activeWallet.available}
          currency={activeWallet.currency}
          hasPin={Boolean(systemWallet?.has_pin)}
          onSuccess={() => {
            fetchWallets();
            fetchTransactions(activeTab);
          }}
        />
      )}

      {/* Deposit Modal */}
      <Dialog open={showDeposit} onOpenChange={(open) => (open ? setShowDeposit(true) : closeDepositModal())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-primary" /> Deposit Funds to System Wallet
            </DialogTitle>
            <DialogDescription>
              Add funds to your personal spending wallet using secure payment gateways.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDepositSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Deposit Amount (NGN ₦)
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="1000.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Payment Method
              </label>
              <select
                value={depositGateway}
                onChange={(e) => setDepositGateway(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="paystack">Paystack (Card, Bank Transfer, USSD)</option>
                <option value="flutterwave">Flutterwave</option>
              </select>
            </div>

            {/* Live fee preview */}
            {depositFeePreview && (
              <FeePreviewCard preview={depositFeePreview} type="deposit" />
            )}
            {feePreviewLoading && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating fees...
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={closeDepositModal}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={depositLoading || !depositAmount}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow hover:opacity-90 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {depositLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete Deposit"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Send P2P Modal */}
      <Dialog open={showSendModal} onOpenChange={(open) => (open ? setShowSendModal(true) : closeSendModal())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Send className="h-5 w-5 text-primary" /> Send Money to User
            </DialogTitle>
            <DialogDescription>Transfer System Wallet balance to another MurihSpace member.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Recipient Username
              </label>
              <input
                type="text"
                placeholder="username"
                value={sendRecipient}
                onChange={(e) => setSendRecipient(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Amount (NGN ₦)
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="500.00"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Thanks for your help!"
                value={sendNote}
                onChange={(e) => setSendNote(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {systemWallet?.has_pin && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Transaction PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="4-digit PIN"
                  value={sendPin}
                  onChange={(e) => setSendPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={closeSendModal}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendLoading || !sendRecipient || !sendAmount}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow hover:opacity-90 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {sendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Funds"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Setup PIN Modal */}
      <Dialog open={showPinModal} onOpenChange={(open) => (open ? setShowPinModal(true) : closePinModal())}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-amber-500" /> Setup Transaction PIN
            </DialogTitle>
            <DialogDescription>Set a 4-digit security PIN to authorize transfers and withdrawals.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePinSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                4-Digit PIN
              </label>
              <input
                type="password"
                maxLength={4}
                placeholder="1234"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={closePinModal}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pinLoading || pinInput.length !== 4}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow hover:opacity-90 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {pinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save PIN"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
