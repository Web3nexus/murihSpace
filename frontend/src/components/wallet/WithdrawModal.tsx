import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Spinner, Bank } from "@phosphor-icons/react";
import { apiClient, type ApiError } from "@/lib/api/client";
import { toast } from "sonner";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalanceMinor: number;
  walletType: "system" | "creator" | "business";
  hasPin: boolean;
  onSuccess: () => void;
}

export function WithdrawModal({
  isOpen,
  onClose,
  availableBalanceMinor,
  walletType,
  hasPin = false,
  onSuccess,
}: WithdrawModalProps) {
  const [amountUsd, setAmountUsd] = useState("50");
  const [destCurrency, setDestCurrency] = useState("NGN");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{
    fee_usd: number;
    exchange_rate: number;
    estimated_payout: number;
  } | null>(null);

  const availableUsd = availableBalanceMinor / 100;

  const destCurrencies = [
    { code: "USD", symbol: "$", rate: 1.0 },
    { code: "NGN", symbol: "₦", rate: 1326.0 },
    { code: "KES", symbol: "KSh", rate: 129.5 },
    { code: "GHS", symbol: "GH₵", rate: 11.4 },
    { code: "EUR", symbol: "€", rate: 0.86 },
    { code: "GBP", symbol: "£", rate: 0.74 },
  ];

  // Calculate live estimate
  useEffect(() => {
    const raw = parseFloat(amountUsd) || 0;
    if (raw <= 0) {
      setPreview(null);
      return;
    }
    const currObj = destCurrencies.find((c) => c.code === destCurrency) || destCurrencies[0];
    const fee = Math.max(0.5, raw * 0.015); // 1.5% fee or min $0.50
    const net = Math.max(0, raw - fee);
    const estimated = net * currObj.rate;

    setPreview({
      fee_usd: fee,
      exchange_rate: currObj.rate,
      estimated_payout: estimated,
    });
  }, [amountUsd, destCurrency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = parseFloat(amountUsd) || 0;
    const cents = Math.round(raw * 100);

    if (cents < 500) {
      toast.error("Minimum withdrawal amount is $5.00 USD.");
      return;
    }
    if (cents > availableBalanceMinor) {
      toast.error("Withdrawal amount exceeds your available balance.");
      return;
    }
    if (hasPin && (!pin || pin.length !== 4)) {
      toast.error("Please enter your 4-digit transaction PIN.");
      return;
    }

    setLoading(true);
    try {
      await apiClient.post("/withdrawals", {
        amount: cents,
        currency: destCurrency,
        wallet_type: walletType,
        pin: pin || "0000",
      });

      toast.success(`Withdrawal request of $${raw.toFixed(2)} USD submitted to your bank!`);
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Withdrawal failed. Please check account details.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmountUsd("50");
    setPin("");
    onClose();
  };

  const currMeta = destCurrencies.find((c) => c.code === destCurrency) || destCurrencies[0];

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Bank weight="bold" className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Withdraw to Bank Account
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Disburse earnings directly from your USD balance into your local bank.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Available balance indicator */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Available to withdraw:</span>
            <span className="font-bold text-foreground">${availableUsd.toFixed(2)} USD</span>
          </div>

          {/* Amount and Currency inputs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="5"
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 text-lg font-bold bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#1A68D4]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Payout Currency
              </label>
              <select
                value={destCurrency}
                onChange={(e) => setDestCurrency(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-muted/30 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-[#1A68D4]"
              >
                {destCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payout & FX Breakdown Box */}
          {preview && (
            <div className="p-3.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 space-y-2 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Requested Gross:</span>
                <span className="font-semibold text-foreground">${parseFloat(amountUsd || "0").toFixed(2)} USD</span>
              </div>

              <div className="flex justify-between items-center text-muted-foreground">
                <span>Platform Withdrawal Fee:</span>
                <span className="text-rose-500 font-semibold">-${preview.fee_usd.toFixed(2)} USD</span>
              </div>

              <div className="flex justify-between items-center text-muted-foreground">
                <span>Live Exchange Rate:</span>
                <span className="font-mono text-foreground">
                  $1 = {currMeta.symbol}{preview.exchange_rate.toFixed(2)} {currMeta.code}
                </span>
              </div>

              <div className="pt-2 border-t border-emerald-500/20 flex justify-between items-center">
                <span className="font-bold text-foreground">Estimated Bank Credit:</span>
                <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  {currMeta.symbol}{preview.estimated_payout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currMeta.code}
                </span>
              </div>
            </div>
          )}

          {/* PIN Input if enabled */}
          {hasPin && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                4-Digit Security PIN
              </label>
              <div className="relative">
                <Lock weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 border border-border rounded-xl text-foreground tracking-widest font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#1A68D4]"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading || parseFloat(amountUsd || "0") < 5}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-xs"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Spinner weight="bold" className="h-4 w-4 animate-spin" /> Submitting Request...
                </span>
              ) : (
                <span>Confirm & Request Payout</span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

