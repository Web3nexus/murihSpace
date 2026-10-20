import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins, Spinner } from "@/components/icons/rounded";;
import { apiClient, type ApiError } from "@/lib/api/client";
import { toast } from "sonner";

interface CoinPackData {
  id: number;
  name: string;
  coins: number;
  bonus_coins: number;
  total_coins: number;
  price: number; // in cents
  price_usd: number;
  formatted_usd: string;
  badge?: string;
}

interface BuyCoinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCoinBalance: number;
  onSuccess: () => void;
}

export function BuyCoinsModal({
  isOpen,
  onClose,
  currentCoinBalance,
  onSuccess,
}: BuyCoinsModalProps) {
  const [packs, setPacks] = useState<CoinPackData[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<number | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPacks = async () => {
      setLoadingPacks(true);
      try {
        const res = await apiClient.get("/coins/packs");
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setPacks(list);
        if (list.length > 0 && selectedPackId === null) {
          const pop = list.find((p: CoinPackData) => p.badge?.toLowerCase().includes("popular"));
          setSelectedPackId(pop ? pop.id : list[0].id);
        }
      } catch {
        const fallback: CoinPackData[] = [
          { id: 1, name: "Starter", coins: 100, bonus_coins: 0, total_coins: 100, price: 100, price_usd: 1.0, formatted_usd: "$1.00", badge: "Popular" },
          { id: 2, name: "Bronze", coins: 500, bonus_coins: 50, total_coins: 550, price: 500, price_usd: 5.0, formatted_usd: "$5.00", badge: "+50 bonus" },
          { id: 3, name: "Silver", coins: 1000, bonus_coins: 150, total_coins: 1150, price: 1000, price_usd: 10.0, formatted_usd: "$10.00", badge: "+150 bonus" },
          { id: 4, name: "Gold", coins: 2500, bonus_coins: 400, total_coins: 2900, price: 2500, price_usd: 25.0, formatted_usd: "$25.00", badge: "+400 bonus" },
          { id: 5, name: "Platinum", coins: 5000, bonus_coins: 1000, total_coins: 6000, price: 5000, price_usd: 50.0, formatted_usd: "$50.00", badge: "+1,000 bonus" },
        ];
        setPacks(fallback);
        setSelectedPackId(1);
      } finally {
        setLoadingPacks(false);
      }
    };

    fetchPacks();
  }, [isOpen, selectedPackId]);

  const handlePurchase = async () => {
    if (!selectedPackId) return;

    setPurchasing(true);
    try {
      await apiClient.post("/coins/purchase", {
        coin_pack_id: selectedPackId,
      });

      const selected = packs.find((p) => p.id === selectedPackId);
      toast.success(`Successfully purchased ${selected?.total_coins.toLocaleString() || ""} MSH Coins!`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Coin purchase failed.");
    } finally {
      setPurchasing(false);
    }
  };

  const selectedPack = packs.find((p) => p.id === selectedPackId);

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Coins weight="fill" className="h-5 w-5 text-amber-500" />
            Buy MSH Coins
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Coins are used for tipping creators, unlocking digital products, and live gifts.
          </DialogDescription>
        </DialogHeader>

        {/* Current Balance Bar */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              🪙
            </div>
            <div>
              <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">Your Current Balance</p>
              <p className="text-sm font-black text-foreground">
                {currentCoinBalance.toLocaleString()} MSH Coins
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">100 = $1.00</span>
        </div>

        {/* Coin Packages List */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Coin Package</p>

          {loadingPacks ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-xs">
              <Spinner weight="bold" className="h-4 w-4 animate-spin mr-2" /> Loading packages...
            </div>
          ) : (
            packs.map((pack) => {
              const isSelected = selectedPackId === pack.id;
              return (
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }}
                  key={pack.id}
                  onClick={() => setSelectedPackId(pack.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                    isSelected
                      ? "border-[var(--shell-accent)] bg-[var(--shell-accent-solid)]/5 ring-1 ring-[var(--shell-accent)]"
                      : "border-border hover:border-border/80 bg-card hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center font-black text-xs shrink-0">
                      🪙
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {pack.coins.toLocaleString()} Coins
                        </span>
                        {pack.badge && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              pack.badge.toLowerCase().includes("popular")
                                ? "bg-[var(--shell-accent-solid)]/10 text-[var(--shell-accent)] border border-[var(--shell-accent)]/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {pack.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {pack.formatted_usd || `$${(pack.price / 100).toFixed(2)}`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-extrabold text-sm text-foreground">
                      {pack.formatted_usd || `$${(pack.price / 100).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            type="button"
            disabled={!selectedPackId || purchasing}
            onClick={handlePurchase}
            className="w-full h-11 bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white font-bold text-sm rounded-xl shadow-xs"
          >
            {purchasing ? (
              <span className="flex items-center gap-2">
                <Spinner weight="bold" className="h-4 w-4 animate-spin" /> Processing Payment...
              </span>
            ) : (
              <span>Proceed to Payment ({selectedPack?.formatted_usd || "$1.00"})</span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

