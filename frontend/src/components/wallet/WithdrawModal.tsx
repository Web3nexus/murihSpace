import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Wallet as Bank } from "@/components/icons";
import { Spinner } from "@/components/icons/rounded";;
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

// Mirrors WithdrawalController's `min:100` validation on amount (USD cents).
const MIN_WITHDRAWAL_CENTS = 100;

const DEST_CURRENCIES = [
  { code: "USD", symbol: "$" },
  { code: "NGN", symbol: "₦" },
  { code: "KES", symbol: "KSh" },
  { code: "GHS", symbol: "GH₵" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
];

// Shape of POST /withdrawals/preview. Fees and FX come from the backend, never from the client.
interface WithdrawalPreview {
  fee_usd: number;
  net_usd: number;
  rate: number;
  estimated_payout_formatted: string;
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
  // Preview is tagged with the amount and currency it was requested for, so a stale quote is never shown.
  const [preview, setPreview] = useState<{ key: string; data: WithdrawalPreview } | null>(null);
  const availableUsd = availableBalanceMinor / 100;

  const amountCents = Math.round((parseFloat(amountUsd) || 0) * 100);
  const meetsMinimum = amountCents >= MIN_WITHDRAWAL_CENTS;
  const previewKey = `${amountCents}:${destCurrency}`;
  const activePreview = meetsMinimum && preview?.key === previewKey ? preview.data : null;

  // Live estimate from the backend, debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    if (!isOpen || !meetsMinimum) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiClient.post<WithdrawalPreview>("/withdrawals/preview", {
          amount: amountCents,
          destination_currency: destCurrency,
          wallet_type: walletType,
        });
        if (!cancelled) setPreview({ key: previewKey, data: res.data });
      } catch {
        if (!cancelled) setPreview(null);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, amountCents, destCurrency, walletType, meetsMinimum, previewKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = parseFloat(amountUsd) || 0;
    const cents = Math.round(raw * 100);

    if (cents < MIN_WITHDRAWAL_CENTS) {
      toast.error("Minimum withdrawal amount is $1.00 USD.");
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

  const currMeta = DEST_CURRENCIES.find((c) => c.code === destCurrency) || DEST_CURRENCIES[0];

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
              <label htmlFor="withdraw-amount" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">
                  $
                </span>
                <input
                  id="withdraw-amount"
                  type="number"
                  step="0.01"
                  min="1"
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 text-lg font-bold bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--shell-accent)]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="f-nents-wallet-withdrawmodal-tsx-155" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Payout Currency
              </label>
              <select id="f-nents-wallet-withdrawmodal-tsx-155"
                value={destCurrency}
                onChange={(e) => setDestCurrency(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-muted/30 border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--shell-accent)]"
              >
                {DEST_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payout & FX Breakdown Box */}
          {activePreview && (
            <div className="p-3.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 space-y-2 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Requested Gross:</span>
                <span className="font-semibold text-foreground">${parseFloat(amountUsd || "0").toFixed(2)} USD</span>
              </div>

              <div className="flex justify-between items-center text-muted-foreground">
                <span>Platform Withdrawal Fee:</span>
                <span className="text-rose-500 font-semibold">-${activePreview.fee_usd.toFixed(2)} USD</span>
              </div>

              <div className="flex justify-between items-center text-muted-foreground">
                <span>Live Exchange Rate:</span>
                <span className="font-mono text-foreground">
                  $1 = {currMeta.symbol}{activePreview.rate.toFixed(2)} {currMeta.code}
                </span>
              </div>

              <div className="pt-2 border-t border-emerald-500/20 flex justify-between items-center">
                <span className="font-bold text-foreground">Estimated Bank Credit:</span>
                <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  {activePreview.estimated_payout_formatted}
                </span>
              </div>
            </div>
          )}

          {/* PIN Input if enabled */}
          {hasPin && (
            <div>
              <label htmlFor="f-nents-wallet-withdrawmodal-tsx-204" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                4-Digit Security PIN
              </label>
              <div className="relative">
                <Lock weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input id="f-nents-wallet-withdrawmodal-tsx-204"
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 border border-border rounded-xl text-foreground tracking-widest font-mono text-center focus:outline-none focus:ring-1 focus:ring-[var(--shell-accent)]"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading || !meetsMinimum}
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

