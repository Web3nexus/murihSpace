import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Scan as QrCode, TickSquare as Check } from "@/components/icons";
import { Copy } from "@/components/icons/rounded";;
import { toast } from "sonner";

interface ReceiveMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  walletId: number | string;
  currency: string;
}

export function ReceiveMoneyModal({
  isOpen,
  onClose,
  username,
  walletId,
  currency = "USD",
}: ReceiveMoneyModalProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`@${username}`);
    setCopied(true);
    toast.success("Username copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-sm p-6 text-center">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center justify-center gap-2 text-lg font-bold">
            <QrCode weight="bold" className="h-5 w-5 text-[#1A68D4]" />
            Receive Money
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Share your MurihPay username or scan the QR code to receive instant deposits.
          </DialogDescription>
        </DialogHeader>

        {/* QR Code Container */}
        <div className="my-3 flex flex-col items-center justify-center">
          <div className="p-4 bg-white rounded-2xl border border-border shadow-xs inline-block">
            {/* Clean SVG QR code graphic */}
            <svg className="w-40 h-40 text-slate-900" viewBox="0 0 100 100" fill="currentColor">
              {/* Corner position markers */}
              <rect x="10" y="10" width="22" height="22" rx="4" />
              <rect x="14" y="14" width="14" height="14" fill="white" />
              <rect x="17" y="17" width="8" height="8" />

              <rect x="68" y="10" width="22" height="22" rx="4" />
              <rect x="72" y="14" width="14" height="14" fill="white" />
              <rect x="75" y="17" width="8" height="8" />

              <rect x="10" y="68" width="22" height="22" rx="4" />
              <rect x="14" y="72" width="14" height="14" fill="white" />
              <rect x="17" y="75" width="8" height="8" />

              {/* Data modules pattern */}
              <rect x="36" y="12" width="5" height="5" />
              <rect x="45" y="12" width="5" height="5" />
              <rect x="54" y="12" width="5" height="5" />
              <rect x="36" y="24" width="5" height="5" />
              <rect x="48" y="24" width="8" height="5" />
              <rect x="12" y="38" width="5" height="5" />
              <rect x="22" y="38" width="5" height="5" />
              <rect x="36" y="38" width="8" height="8" />
              <rect x="50" y="38" width="5" height="5" />
              <rect x="60" y="38" width="8" height="5" />
              <rect x="75" y="38" width="5" height="5" />
              <rect x="85" y="38" width="5" height="5" />
              <rect x="38" y="52" width="5" height="8" />
              <rect x="48" y="52" width="8" height="5" />
              <rect x="62" y="52" width="5" height="5" />
              <rect x="75" y="52" width="8" height="8" />
              <rect x="38" y="68" width="8" height="5" />
              <rect x="52" y="68" width="5" height="5" />
              <rect x="62" y="68" width="8" height="5" />
              <rect x="38" y="80" width="5" height="8" />
              <rect x="48" y="80" width="8" height="8" />
              <rect x="62" y="80" width="5" height="5" />
              <rect x="75" y="80" width="8" height="8" />
            </svg>
          </div>

          <p className="text-base font-extrabold text-foreground mt-3">
            @{username || "user"}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            MurihPay ID: #{walletId || "0"} · {currency}
          </p>
        </div>

        {/* Copy Button */}
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleCopy}
            className="flex-1 h-10 bg-[#1A68D4] hover:bg-[#1555AD] text-white font-bold text-xs rounded-xl"
          >
            {copied ? (
              <span className="flex items-center gap-1.5">
                <Check weight="bold" className="h-4 w-4" /> Copied!
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Copy weight="bold" className="h-4 w-4" /> Copy Username
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

