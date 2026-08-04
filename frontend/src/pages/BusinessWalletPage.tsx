import { useState, useEffect, useCallback } from "react";
import { Building2, ArrowUpRight, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { WalletBalanceCard } from "@/components/wallet/WalletBalanceCard";
import { InternalTransferModal } from "@/components/wallet/InternalTransferModal";

interface BusinessWalletData {
  id: number;
  wallet_type: "business";
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

export default function BusinessWalletPage() {
  const [wallet, setWallet] = useState<BusinessWalletData | null>(null);
  const [systemWallet, setSystemWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showTransfer, setShowTransfer] = useState(false);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.all([
        apiClient.get("/wallet/type/business"),
        apiClient.get("/wallet/type/system"),
      ]);

      if (bRes.data?.data) setWallet(bRes.data.data);
      if (sRes.data?.data) setSystemWallet(sRes.data.data);
    } catch {
      toast.error("Failed to load Business Wallet.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  if (loading || !wallet) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading Business Wallet...
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-emerald-500" /> Business Revenue Wallet
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Receives product sales, order revenues, escrow releases, and store fulfillment earnings.
          </p>
        </div>

        <button
          onClick={() => setShowTransfer(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow transition"
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
          <Clock className="h-5 w-5 text-emerald-500" /> Store Earnings & Internal Transfers
        </h2>
        <p className="text-sm text-muted-foreground">
          Store order funds are held safely in <strong className="text-foreground">Escrow</strong> during fulfillment. Once orders are completed, funds move to <strong className="text-foreground">Available</strong> balance.
          To spend business earnings internally, transfer them to your <strong className="text-foreground">System Wallet</strong>.
        </p>
      </div>

      {showTransfer && (
        <InternalTransferModal
          isOpen={showTransfer}
          onClose={() => setShowTransfer(false)}
          fromWalletType="business"
          availableBalance={wallet.available}
          currency={wallet.currency}
          hasPin={Boolean(systemWallet?.has_pin)}
          onSuccess={fetchWallet}
        />
      )}
    </div>
  );
}
