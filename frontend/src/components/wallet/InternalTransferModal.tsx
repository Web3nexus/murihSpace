import { useState } from "react";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { apiClient, type ApiError } from "@/lib/api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface InternalTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromWalletType: "creator" | "business";
  availableBalance: number; // in minor units
  currency: string;
  hasPin: boolean;
  onSuccess: () => void;
}

export function InternalTransferModal({
  isOpen,
  onClose,
  fromWalletType,
  availableBalance,
  currency,
  hasPin,
  onSuccess,
}: InternalTransferModalProps) {
  const [amountInput, setAmountInput] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const amountMinor = Math.round((parseFloat(amountInput) || 0) * 100);
  const maxAvailable = availableBalance / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountMinor <= 0) {
      toast.error("Enter a valid transfer amount.");
      return;
    }

    if (amountMinor > availableBalance) {
      toast.error("Transfer amount exceeds available balance.");
      return;
    }

    if (hasPin && (!pin || pin.length !== 4)) {
      toast.error("Enter your 4-digit transaction PIN.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post("/wallet/internal-transfer", {
        from_wallet_type: fromWalletType,
        to_wallet_type: "system",
        amount: amountMinor,
        pin: pin || undefined,
      });

      if (res.data) {
        toast.success(`Transferred ${currency} ${parseFloat(amountInput).toFixed(2)} to System Wallet!`);
        onSuccess();
        onClose();
        setAmountInput("");
        setPin("");
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Failed to complete internal transfer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ArrowRight className="h-5 w-5 text-primary" /> Internal Wallet Transfer
          </DialogTitle>
          <DialogDescription>
            Transfer earnings from your <strong className="capitalize text-foreground">{fromWalletType} Wallet</strong> to your <strong className="text-foreground">System Wallet</strong> to make purchases, buy gifts, or send tips.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground flex justify-between items-center">
            <span>Available to transfer:</span>
            <strong className="text-foreground font-semibold">{currency} {maxAvailable.toFixed(2)}</strong>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Amount ({currency})
            </label>
            <input
              type="number"
              step="0.01"
              min="1"
              max={maxAvailable}
              placeholder="0.00"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {hasPin && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <Lock className="h-3 w-3" /> Transaction PIN
              </label>
              <input
                type="password"
                maxLength={4}
                placeholder="4-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !amountInput || parseFloat(amountInput) <= 0}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow hover:opacity-90 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Transfer"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
