import { useState, useEffect, useCallback, useRef } from "react";
import { Wallet as WalletIcon, ShieldDone as ShieldCheck, Show as Eye, Hide as EyeSlash, Swap as ArrowsClockwise, Lock } from "@/components/icons";
import { Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";
import { apiClient, type ApiError } from "@/lib/api/client";
import { useAuth } from "@/hooks/useAuth";
import { MurihPayDigitalCard } from "@/components/wallet/MurihPayDigitalCard";
import { WalletSwitcher, type WalletContextType } from "@/components/wallet/WalletSwitcher";
import { WalletActionToolbar } from "@/components/wallet/WalletActionToolbar";
import { WalletBalanceBreakdown } from "@/components/wallet/WalletBalanceBreakdown";
import { TransactionTable, type TransactionRowData } from "@/components/wallet/TransactionTable";
import { WalletMshCoinsWidget } from "@/components/wallet/WalletMshCoinsWidget";
import { WalletQuickActionsWidget } from "@/components/wallet/WalletQuickActionsWidget";
import { WalletSpendingOverviewWidget } from "@/components/wallet/WalletSpendingOverviewWidget";
import { WalletEscrowWidget } from "@/components/wallet/WalletEscrowWidget";
import { InternalTransferModal } from "@/components/wallet/InternalTransferModal";
import { BuyCoinsModal } from "@/components/wallet/BuyCoinsModal";
import { SendMoneyModal } from "@/components/wallet/SendMoneyModal";
import { ReceiveMoneyModal } from "@/components/wallet/ReceiveMoneyModal";
import { WithdrawModal } from "@/components/wallet/WithdrawModal";
import { CreateEscrowModal } from "@/components/wallet/CreateEscrowModal";
import { TransactionDetailsModal } from "@/components/wallet/TransactionDetailsModal";
import { Button } from "@/components/ui/button";
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
  local_currency?: string;
  local_rate?: number;
  local_formatted?: string;
  coins?: number;
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

interface CountryOption {
  iso2: string;
  name: string;
  flag?: string;
}

interface DepositTaxPreview {
  amount: number;
  tax: number;
  tax_rate: number | null;
  tax_name: string | null;
  tax_type: string | null;
  tax_country_code: string | null;
  total_charged: number;
}

interface WalletPageProps {
  initialTab?: WalletContextType;
}

export function WalletPage({ initialTab = "system" }: WalletPageProps) {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [activeTab, setActiveTab] = useState<WalletContextType>(initialTab);
  const [transactions, setTransactions] = useState<TransactionRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [showLocalCurrency, setShowLocalCurrency] = useState(false);

  // Modals state
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showLockEscrow, setShowLockEscrow] = useState(false);
  const [showBuyCoins, setShowBuyCoins] = useState(false);
  const [showInternalTransfer, setShowInternalTransfer] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TransactionRowData | null>(null);

  // Deposit Form state
  const [depositAmount, setDepositAmount] = useState("50");
  const [depositGateway, setDepositGateway] = useState("paystack");
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositFeePreview, setDepositFeePreview] = useState<any>(null);
  const [depositCountries, setDepositCountries] = useState<CountryOption[]>([]);
  const [depositCountry, setDepositCountry] = useState("");
  const [depositTaxPreview, setDepositTaxPreview] = useState<DepositTaxPreview | null>(null);

  // Setup PIN Form state
  const [pinInput, setPinInput] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  const transactionsRequestRef = useRef(0);
  const feePreviewRequestRef = useRef(0);
  const taxPreviewRequestRef = useRef(0);

  // Fetch wallets
  const fetchWallets = useCallback(async () => {
    try {
      const res = await apiClient.get("/wallet");
      const body = res.data;
      const raw = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.data?.data)
        ? body.data.data
        : body?.data && typeof body.data === "object" && body.data.id
        ? [body.data]
        : [];
      setWallets(raw);
    } catch {
      toast.error("Failed to load wallets.");
      setWallets([]);
    }
  }, []);

  const handleProvision = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post("/wallet/provision");
      const body = res.data;
      const raw = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.data?.data)
        ? body.data.data
        : body?.data && typeof body.data === "object" && body.data.id
        ? [body.data]
        : [];
      setWallets(raw);
      if (raw.length > 0) {
        toast.success("Wallets provisioned successfully.");
      }
    } catch {
      await fetchWallets();
    } finally {
      setLoading(false);
    }
  };

  // Fetch ledger transactions
  const fetchTransactions = useCallback(async (typeFilter?: string) => {
    const requestId = ++transactionsRequestRef.current;
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

  const safeWallets = Array.isArray(wallets) ? wallets : [];
  const activeWallet = safeWallets.find((w) => w?.wallet_type === activeTab) ?? safeWallets[0] ?? null;
  const systemWallet = safeWallets.find((w) => w?.wallet_type === "system") ?? safeWallets[0] ?? null;
  const walletCurrency = systemWallet?.currency || activeWallet?.currency || "USD";
  const localCurrency = activeWallet?.local_currency || "NGN";
  const localRate = activeWallet?.local_rate ?? 1326.0;
  const localFormatted = activeWallet?.local_formatted;
  const availableDollars = (activeWallet?.available ?? 0) / 100.0;

  const totalSpentNumber = transactions
    .filter((tx) => tx.entry_type === "debit")
    .reduce((sum, tx) => sum + (tx.amount ?? 0), 0);
  const totalSpentFormatted = totalSpentNumber > 0
    ? `$${totalSpentNumber.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "$0.00";

  const hasCreatorWallet = safeWallets.some((w) => w.wallet_type === "creator");
  const hasBusinessWallet = safeWallets.some((w) => w.wallet_type === "business");

  // Live fee preview for deposit
  const fetchDepositFeePreview = useCallback(async (amountStr: string, gateway: string, curr: string) => {
    const requestId = ++feePreviewRequestRef.current;
    const minor = Math.round((parseFloat(amountStr) || 0) * 100);
    if (minor < 100) {
      setDepositFeePreview(null);
      return;
    }
    try {
      const res = await apiClient.post("/wallet/fees/preview", {
        transaction_code: `DEPOSIT_${gateway.toUpperCase()}`,
        amount: minor,
        currency: curr || "USD",
        payment_method: gateway,
      });
      if (requestId !== feePreviewRequestRef.current) return;
      setDepositFeePreview(res.data?.data?.data || res.data?.data || null);
    } catch {
      if (requestId === feePreviewRequestRef.current) setDepositFeePreview(null);
    }
  }, []);

  useEffect(() => {
    if (!showDeposit) return;
    const timer = setTimeout(() => fetchDepositFeePreview(depositAmount, depositGateway, walletCurrency), 400);
    return () => clearTimeout(timer);
  }, [depositAmount, depositGateway, showDeposit, walletCurrency, fetchDepositFeePreview]);

  // Live tax preview for deposit
  const fetchDepositTax = useCallback(async (amountStr: string, countryCode: string) => {
    const requestId = ++taxPreviewRequestRef.current;
    const minor = Math.round((parseFloat(amountStr) || 0) * 100);
    if (minor < 100) {
      setDepositTaxPreview(null);
      return;
    }
    try {
      const res = await apiClient.post("/wallet/deposit-estimate", {
        amount: minor,
        ...(countryCode ? { country_code: countryCode } : {}),
      });
      if (requestId !== taxPreviewRequestRef.current) return;
      setDepositTaxPreview(res.data?.data?.data || res.data?.data || null);
    } catch {
      if (requestId === taxPreviewRequestRef.current) setDepositTaxPreview(null);
    }
  }, []);

  useEffect(() => {
    if (!showDeposit) return;
    const timer = setTimeout(() => fetchDepositTax(depositAmount, depositCountry), 400);
    return () => clearTimeout(timer);
  }, [depositAmount, depositCountry, showDeposit, fetchDepositTax]);

  const loadDepositCountries = useCallback(async () => {
    try {
      const res = await apiClient.get("/countries");
      const raw = res.data?.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(res.data) ? res.data : [];
      const mapped = list.map((c: { iso2?: string; flag?: string; name?: string }) => ({
        iso2: c.iso2 ?? "",
        flag: c.flag,
        name: c.name ?? c.iso2 ?? "",
      }));
      setDepositCountries((prev) => (mapped.length ? mapped : prev));
    } catch {}
  }, []);

  useEffect(() => {
    if (showDeposit) loadDepositCountries();
  }, [showDeposit, loadDepositCountries]);

  // Handle Cash Deposit Submit
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const minorAmount = Math.round((parseFloat(depositAmount) || 0) * 100);
    if (minorAmount < 100) {
      toast.error("Minimum deposit amount is $1.00 USD.");
      return;
    }

    setDepositLoading(true);
    try {
      const res = await apiClient.post("/wallet/deposit", {
        amount: minorAmount,
        payment_gateway: depositGateway,
        currency: walletCurrency,
        ...(depositCountry ? { country_code: depositCountry } : {}),
      });

      if (res.data) {
        toast.success("Deposit successful! Your System Wallet has been credited.");
        setShowDeposit(false);
        setDepositAmount("50");
        fetchWallets();
        fetchTransactions(activeTab);
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Deposit processing failed.");
    } finally {
      setDepositLoading(false);
    }
  };

  // Handle PIN Submit
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length !== 4) {
      toast.error("PIN must be exactly 4 digits.");
      return;
    }

    setPinLoading(true);
    try {
      await apiClient.post("/wallet/pin/setup", { pin: pinInput });
      toast.success("Transaction PIN successfully configured!");
      setPinInput("");
      setShowPinModal(false);
      fetchWallets();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Failed to configure PIN.");
    } finally {
      setPinLoading(false);
    }
  };

  if (loading && wallets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[460px] text-muted-foreground space-y-3">
        <ArrowsClockwise weight="bold" className="h-7 w-7 animate-spin text-[#1A68D4]" />
        <p className="text-sm font-semibold">Loading MurihPay Financial Hub...</p>
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[460px] text-center space-y-3 p-6 max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-[#1A68D4]/10 text-[#1A68D4] flex items-center justify-center">
          <WalletIcon weight="fill" className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Welcome to MurihPay Financial Hub</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Initialize your multi-currency accounts and double-entry ledger to start managing funds, tipping creators, and locking escrow.
        </p>
        <Button
          size="sm"
          onClick={handleProvision}
          className="mt-2 bg-[#1A68D4] hover:bg-[#1555AD] text-white font-bold text-xs h-10 px-4 rounded-xl"
        >
          <ArrowsClockwise weight="bold" className="h-4 w-4 mr-2" />
          Initialize & Provision Wallets
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            MurihPay Wallet
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your wallets, payments, and transactions securely
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Eye visibility toggle in header */}
          <button
            type="button"
            onClick={() => setIsBalanceHidden((prev) => !prev)}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title={isBalanceHidden ? "Show Balances" : "Hide Balances"}
          >
            {isBalanceHidden ? (
              <>
                <EyeSlash weight="bold" className="h-4 w-4 text-[#1A68D4]" />
                <span className="hidden sm:inline">Hidden</span>
              </>
            ) : (
              <>
                <Eye weight="bold" className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">Visible</span>
              </>
            )}
          </button>

          {/* Security & Settings Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPinModal(true)}
            className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl border border-border text-foreground hover:bg-muted font-bold text-xs flex items-center gap-1.5 shadow-2xs"
          >
            <ShieldCheck weight="fill" className="h-4 w-4 text-[#1A68D4]" />
            <span>Security & Settings</span>
          </Button>
        </div>
      </div>

      {/* 2. Wallet Context Switcher (Personal | Creator | Business) */}
      <div>
        <WalletSwitcher
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab)}
          hasCreatorWallet={hasCreatorWallet}
          hasBusinessWallet={hasBusinessWallet}
        />
      </div>

      {/* 3. Main Dashboard Grid (Left: 68-70%, Right: 30-32%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Hero Financial Zone: Digital Card with Available Balance on Card + Action Suite */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Digital Payment Card with Available Balance directly on it */}
            <div className="md:col-span-6 flex justify-center md:justify-start">
              <MurihPayDigitalCard
                walletType={activeTab}
                userName={user?.name || "Vincent Adetuberu"}
                userTag={user?.username || "@vincent"}
                availableBalance={availableDollars}
                currency={walletCurrency}
                localCurrency={localCurrency}
                localRate={localRate}
                localFormatted={localFormatted}
                isBalanceHidden={isBalanceHidden}
                showLocalCurrency={showLocalCurrency}
                onToggleCurrency={() => setShowLocalCurrency((prev) => !prev)}
              />
            </div>

            {/* Financial Actions Suite (No box-in-a-box) */}
            <div className="md:col-span-6 flex flex-col justify-center gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Financial Actions</h2>
                  <p className="text-xs text-muted-foreground">Peer transfers, payouts & escrow</p>
                </div>
                {localCurrency !== "USD" && (
                  <button
                    type="button"
                    onClick={() => setShowLocalCurrency((prev) => !prev)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    {showLocalCurrency ? "View in USD" : `View in ${localCurrency}`}
                  </button>
                )}
              </div>

              {/* Action Buttons Toolbar */}
              <WalletActionToolbar
                walletType={activeTab}
                onDeposit={() => setShowDeposit(true)}
                onWithdraw={() => setShowWithdraw(true)}
                onSendMoney={() => setShowSend(true)}
                onReceiveMoney={() => setShowReceive(true)}
                onLockEscrow={() => setShowLockEscrow(true)}
                onBuyCoins={() => setShowBuyCoins(true)}
                onInternalTransfer={() => setShowInternalTransfer(true)}
              />
            </div>
          </div>

          {/* Unified Ledger Summary Rail (Replaces repetitive AI boxes) */}
          <WalletBalanceBreakdown
            pendingFormatted={activeWallet?.formatted?.pending || "$0.00"}
            reservedFormatted={activeWallet?.formatted?.reserved || "$0.00"}
            escrowFormatted={activeWallet?.formatted?.escrow || "$0.00"}
            totalFormatted={activeWallet?.formatted?.total || "$0.00"}
            isBalanceHidden={isBalanceHidden}
          />

          {/* Recent Transactions Table */}
          <TransactionTable
            transactions={transactions}
            onSelectTransaction={(tx) => setSelectedTx(tx)}
            isBalanceHidden={isBalanceHidden}
          />
        </div>

        {/* Right Rail Column: Pinned Sticky so it does NOT scroll away */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6 lg:self-start">
          {/* 1. MSH Coins Widget */}
          <WalletMshCoinsWidget
            coinBalance={systemWallet?.coins ?? activeWallet?.coins ?? 0}
            onBuyCoins={() => setShowBuyCoins(true)}
            isBalanceHidden={isBalanceHidden}
          />

          {/* 2. Quick Actions List Widget */}
          <WalletQuickActionsWidget
            isVerified={user?.kyc_status === "approved" || user?.kyc_status === "verified"}
            onOpenLimits={() => toast.info("Daily transfer limit: $10,000.00 USD (Level 2 Verified).")}
            onOpenPaymentMethods={() => toast.info("Supported methods: Direct Bank Wire, Card, Paystack, Flutterwave.")}
            onOpenStatements={() => toast.info("Monthly statement export is ready.")}
          />

          {/* 3. Spending Overview Donut Chart (Real data from ledger debits) */}
          <WalletSpendingOverviewWidget
            totalSpent={totalSpentFormatted}
            isBalanceHidden={isBalanceHidden}
          />

          {/* 4. Recent Escrow Deals Widget */}
          <WalletEscrowWidget isBalanceHidden={isBalanceHidden} />
        </div>
      </div>

      {/* ── All Financial Action Modals ───────────────────────────────── */}

      {/* 1. Deposit Funds Modal */}
      <Dialog open={showDeposit} onOpenChange={(val) => !val && setShowDeposit(false)}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <WalletIcon weight="bold" className="h-5 w-5 text-[#1A68D4]" />
              Deposit Funds (USD Base)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Deposit cash into your System Wallet securely via payment gateway.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDepositSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Deposit Amount ($ USD)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="50.00"
                  className="w-full pl-8 pr-16 py-2.5 text-xl font-bold bg-muted/30 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-[#1A68D4]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">
                  USD
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Payment Gateway
              </label>
              <select
                value={depositGateway}
                onChange={(e) => setDepositGateway(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold bg-muted/30 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-[#1A68D4]"
              >
                <option value="paystack">Paystack (Debit/Credit Card, Bank, USSD)</option>
                <option value="stripe">Stripe (International Cards, Apple Pay)</option>
                <option value="flutterwave">Flutterwave (African Cards, Mobile Money)</option>
              </select>
            </div>

            {depositCountries.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Billing Country (Tax Resolution)
                </label>
                <select
                  value={depositCountry}
                  onChange={(e) => setDepositCountry(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-muted/30 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-[#1A68D4]"
                >
                  <option value="">Select country (optional)</option>
                  {depositCountries.map((c) => (
                    <option key={c.iso2} value={c.iso2}>
                      {c.flag ? `${c.flag} ` : ""}{c.name} ({c.iso2})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* VAT/Fee Preview if loaded */}
            {(depositTaxPreview || depositFeePreview) && (
              <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs space-y-1 text-muted-foreground">
                {depositTaxPreview && (
                  <div className="flex justify-between">
                    <span>Gross Top-up:</span>
                    <span className="font-semibold text-foreground">${(depositTaxPreview.amount / 100).toFixed(2)}</span>
                  </div>
                )}
                {depositFeePreview?.processing_fee > 0 && (
                  <div className="flex justify-between">
                    <span>Processing Fee:</span>
                    <span className="font-semibold text-foreground">${(depositFeePreview.processing_fee / 100).toFixed(2)}</span>
                  </div>
                )}
                {depositTaxPreview && depositTaxPreview.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Tax ({depositTaxPreview.tax_name || "VAT"}):</span>
                    <span className="font-semibold text-foreground">+${(depositTaxPreview.tax / 100).toFixed(2)}</span>
                  </div>
                )}
                {depositTaxPreview && (
                  <div className="pt-1 border-t border-border/60 flex justify-between font-bold text-foreground">
                    <span>Total Charged:</span>
                    <span>${(depositTaxPreview.total_charged / 100).toFixed(2)} USD</span>
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={depositLoading || (parseFloat(depositAmount) || 0) < 1}
              className="w-full h-11 bg-[#1A68D4] hover:bg-[#1555AD] text-white font-bold text-sm rounded-xl shadow-xs"
            >
              {depositLoading ? (
                <span className="flex items-center gap-2">
                  <Spinner weight="bold" className="h-4 w-4 animate-spin" /> Processing Deposit...
                </span>
              ) : (
                <span>Confirm Deposit</span>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Withdraw Modal */}
      <WithdrawModal
        isOpen={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        availableBalanceMinor={activeWallet?.available ?? 0}
        walletType={activeTab}
        hasPin={activeWallet?.has_pin ?? false}
        onSuccess={() => {
          fetchWallets();
          fetchTransactions(activeTab);
        }}
      />

      {/* 3. Send Money Modal */}
      <SendMoneyModal
        isOpen={showSend}
        onClose={() => setShowSend(false)}
        walletCurrency={walletCurrency}
        hasPin={activeWallet?.has_pin ?? false}
        onSuccess={() => {
          fetchWallets();
          fetchTransactions(activeTab);
        }}
      />

      {/* 4. Receive Money Modal */}
      <ReceiveMoneyModal
        isOpen={showReceive}
        onClose={() => setShowReceive(false)}
        username={user?.username || user?.name || "user"}
        walletId={activeWallet?.id || 1}
        currency={walletCurrency}
      />

      {/* 5. Buy Coins Modal */}
      <BuyCoinsModal
        isOpen={showBuyCoins}
        onClose={() => setShowBuyCoins(false)}
        currentCoinBalance={systemWallet?.coins ?? activeWallet?.coins ?? 0}
        onSuccess={() => {
          fetchWallets();
          fetchTransactions(activeTab);
        }}
      />

      {/* 6. Lock Escrow Modal */}
      <CreateEscrowModal
        isOpen={showLockEscrow}
        onClose={() => setShowLockEscrow(false)}
        availableBalanceMinor={activeWallet?.available ?? 0}
        onSuccess={() => {
          fetchWallets();
          fetchTransactions(activeTab);
        }}
      />

      {/* 7. Internal Transfer Modal */}
      {showInternalTransfer && (
        <InternalTransferModal
          isOpen={showInternalTransfer}
          onClose={() => setShowInternalTransfer(false)}
          fromWalletType={activeTab === "system" ? "creator" : activeTab}
          availableBalance={activeWallet?.available ?? 0}
          currency={walletCurrency}
          hasPin={activeWallet?.has_pin ?? false}
          onSuccess={() => {
            fetchWallets();
            fetchTransactions(activeTab);
          }}
        />
      )}

      {/* 8. Transaction Receipt Modal */}
      <TransactionDetailsModal
        transaction={selectedTx}
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
      />

      {/* 9. Configure 4-digit PIN Modal */}
      <Dialog open={showPinModal} onOpenChange={(val) => !val && setShowPinModal(false)}>
        <DialogContent className="sm:max-w-xs p-6 text-center">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center justify-center gap-2 text-lg font-bold">
              <Lock weight="bold" className="h-5 w-5 text-[#1A68D4]" />
              Security PIN
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Set or update your 4-digit transaction authorization PIN.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePinSubmit} className="space-y-4 pt-2">
            <input
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-full py-3 text-2xl font-bold tracking-[0.5em] text-center font-mono bg-muted/40 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-[#1A68D4]"
            />

            <Button
              type="submit"
              disabled={pinLoading || pinInput.length !== 4}
              className="w-full h-10 bg-[#1A68D4] hover:bg-[#1555AD] text-white font-bold text-xs rounded-xl"
            >
              {pinLoading ? "Configuring..." : "Save Transaction PIN"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default WalletPage;
