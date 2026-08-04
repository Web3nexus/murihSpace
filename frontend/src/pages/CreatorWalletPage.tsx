import { useState, useEffect, useCallback } from "react";
import { Sparkles, ArrowUpRight, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { WalletBalanceCard } from "@/components/wallet/WalletBalanceCard";
import { InternalTransferModal } from "@/components/wallet/InternalTransferModal";

interface CreatorWalletData {
  id: number;
  wallet_type: "creator";
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

export default function CreatorWalletPage() {
  const [wallet, setWallet] = useState<CreatorWalletData | null>(null);
  const [systemWallet, setSystemWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const fetchWallet = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError(false);
    try {
      const [cRes, sRes] = await Promise.all([
        apiClient.get("/wallet/type/creator"),
        apiClient.get("/wallet/type/system"),
      ]);

      if (cRes.data?.data) setWallet(cRes.data.data);
      if (sRes.data?.data) setSystemWallet(sRes.data.data);
    } catch {
      toast.error("Failed to load Creator Wallet.");
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet(true);
  }, [fetchWallet]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading Creator Wallet...
      </div>
    );
  }

  if (error || !wallet) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <p>Unable to load Creator Wallet.</p>
        <button
          onClick={() => fetchWallet(true)}
          className="text-purple-600 underline text-sm hover:opacity-80 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" /> Creator Earnings Wallet
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Receives conference gifts, live tips, membership earnings, and creator services.
          </p>
        </div>

        <button
          onClick={() => setShowTransfer(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow transition"
        >
          <ArrowUpRight className="h-4 w-4" /> Transfer to System Wallet
        </button>
      </div>

      <WalletBalanceCard
        wallet={wallet}
        onTransfer={() => setShowTransfer(true)}
      />

      <div className="p-6 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5 text-purple-500" /> Creator Earnings Rule
        </h2>
        <p className="text-sm text-muted-foreground">
          Earnings in your Creator Wallet cannot be spent directly for purchases or gift sending.
          To spend your creator earnings, use the <strong className="text-foreground">Transfer to System Wallet</strong> button above.
        </p>
      </div>

      {showTransfer && (
        <InternalTransferModal
          isOpen={showTransfer}
          onClose={() => setShowTransfer(false)}
          fromWalletType="creator"
          availableBalance={wallet.available}
          currency={wallet.currency}
          hasPin={Boolean(systemWallet?.has_pin)}
          onSuccess={fetchWallet}
        />
      )}
    </div>
  );
}
