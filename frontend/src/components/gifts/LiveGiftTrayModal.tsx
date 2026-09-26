import { useState, useEffect, useCallback } from "react";
import {
  Wallet as Wallet,
  PaperPlaneRight as Send,
  Spinner as Loader2,
  Sparkle as Sparkle
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { apiClient, type ApiError } from "@/lib/api/client";
import { FeePreviewCard } from "@/components/wallet/FeePreviewCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface GiftItem {
  id: number;
  name: string;
  coin_price: number; // in MSH Coins
  icon?: string;
  category?: string;
}

interface LiveGiftTrayModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: number;
  recipientName: string;
  sessionId?: string;
  streamId?: number;
  onGiftSent?: (gift?: GiftItem, amount?: number) => void;
}

export function LiveGiftTrayModal({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  sessionId,
  streamId,
  onGiftSent,
}: LiveGiftTrayModalProps) {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [systemBalance, setSystemBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [feePreview, setFeePreview] = useState<any>(null);

  const fetchGiftsAndWallet = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, wRes] = await Promise.all([
        apiClient.get("/gifts/catalogue"),
        apiClient.get("/wallet/type/system"),
      ]);

      const giftList = gRes.data?.data || gRes.data || [];
      setGifts(giftList);
      if (giftList.length > 0) setSelectedGift(giftList[0]);

      if (wRes.data?.data) {
        setSystemBalance(wRes.data.data.available);
      }
    } catch {
      toast.error("Failed to load gifts catalogue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchGiftsAndWallet();
  }, [isOpen, fetchGiftsAndWallet]);

  // Pre-flight fee calculation when selected gift changes
  useEffect(() => {
    if (!selectedGift) { setFeePreview(null); return; }
    let isMounted = true;

    apiClient
      .post("/wallet/fees/preview", {
        transaction_code: "GIFT_RECEIVING",
        amount: selectedGift.coin_price,
        currency: "NGN",
      })
      .then((res) => {
        if (isMounted) setFeePreview(res.data?.data?.data || res.data?.data || null);
      })
      .catch(() => {
        if (isMounted) setFeePreview(null);
      });

    return () => { isMounted = false; };
  }, [selectedGift]);

  const handleSendGift = async () => {
    if (!selectedGift) return;

    if (systemBalance !== null && systemBalance < selectedGift.coin_price) {
      toast.error("Insufficient MSH Coins balance. Please top up your wallet first.");
      return;
    }

    setSending(true);
    try {
      if (streamId) {
        await apiClient.post(`/live/${streamId}/gift`, {
          gift_id: selectedGift.id,
          message: `Sent ${selectedGift.name}`,
        });
      } else {
        await apiClient.post("/gifts/send", {
          gift_id: selectedGift.id,
          recipient_id: recipientId,
          session_id: sessionId,
          wallet_type: "system",
        });
      }

      toast.success(`Sent ${selectedGift.name} to ${recipientName}!`);
      if (onGiftSent) onGiftSent(selectedGift, selectedGift.coin_price);
      onClose();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Failed to send gift.");
    } finally {
      setSending(false);
    }
  };

  const formattedBalance = systemBalance !== null ? systemBalance.toLocaleString() : "0";

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkle weight="fill" className="h-5 w-5 text-purple-500" /> Send Live Gift to {recipientName}
          </DialogTitle>
          <DialogDescription>
            Gifts are debited in <strong className="text-foreground">MSH Coins (🪙)</strong> from your available balance and credited directly to the creator.
          </DialogDescription>
        </DialogHeader>

        {/* Sender Balance Info Banner */}
        <div className="p-3 rounded-lg bg-muted/40 border flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <Wallet weight="fill" className="h-4 w-4 text-primary" /> MSH Coins Available:
          </span>
          <strong className="text-foreground text-sm font-bold flex items-center gap-1">
            <span>🪙</span> {formattedBalance} MSH
          </strong>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
            <Loader2 weight="fill" className="h-5 w-5 animate-spin mr-2" /> Loading gift tray...
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Gift Item Selection Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1">
              {gifts.map((gift) => {
                const isSelected = selectedGift?.id === gift.id;
                return (
                  <button
                    key={gift.id}
                    onClick={() => setSelectedGift(gift)}
                    className={`p-3 rounded-lg border text-center transition flex flex-col items-center justify-between ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary  ring-2 ring-primary/30"
                        : "bg-card border-border hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span className="text-xl mb-1">{gift.icon || "🎁"}</span>
                    <span className="text-xs font-bold truncate w-full">{gift.name}</span>
                    <span className="text-[11px] font-semibold text-muted-foreground mt-0.5 flex items-center justify-center gap-0.5">
                      <span>🪙</span> {gift.coin_price.toLocaleString()} MSH
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Fee Breakdown Preview */}
            {feePreview && <FeePreviewCard preview={feePreview} type="creator_receipt" />}

            {/* Action Controls */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border-none text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendGift}
                disabled={sending || !selectedGift}
                className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send weight="fill" className="h-4 w-4" /> Send Gift ({selectedGift ? `${selectedGift.coin_price.toLocaleString()} MSH` : ""})</>}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
