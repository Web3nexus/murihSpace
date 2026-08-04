import { Receipt } from "lucide-react";

interface FeePreviewData {
  gross_amount: number;
  platform_fee: number;
  processing_fee: number;
  total_fee: number;
  fee_amount: number;
  net_amount: number;
  total_charged: number;
  currency: string;
  rule_name?: string | null;
  rule_code?: string | null;
}

interface FeePreviewCardProps {
  preview: FeePreviewData;
  type?: "deposit" | "transfer" | "withdrawal" | "creator_receipt";
}

export function FeePreviewCard({ preview, type = "transfer" }: FeePreviewCardProps) {
  const format = (minorUnits: number) => {
    const symbols: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" };
    const sym = symbols[preview.currency] ?? preview.currency + " ";
    return sym + (minorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const isCreatorReceipt = type === "creator_receipt";

  return (
    <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2 text-xs">
      <div className="flex items-center justify-between font-semibold text-foreground pb-2 border-b border-border">
        <span className="flex items-center gap-1.5">
          <Receipt className="h-4 w-4 text-primary" /> Fee Calculation Summary
        </span>
        {preview.rule_name && (
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] uppercase font-bold">
            {preview.rule_name}
          </span>
        )}
      </div>

      <div className="flex justify-between text-muted-foreground">
        <span>{isCreatorReceipt ? "Gift / Earnings Value" : "Transaction Amount"}:</span>
        <strong className="text-foreground">{format(preview.gross_amount)}</strong>
      </div>

      <div className="flex justify-between text-muted-foreground">
        <span>Platform Fee:</span>
        <strong className="text-foreground">{preview.platform_fee > 0 ? format(preview.platform_fee) : "FREE"}</strong>
      </div>

      {preview.processing_fee > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>Processing Fee:</span>
          <strong className="text-foreground">{format(preview.processing_fee)}</strong>
        </div>
      )}

      <div className="flex justify-between pt-2 border-t border-border font-bold text-sm text-foreground">
        <span>{isCreatorReceipt ? "Net Creator Amount" : "Net Recipient Amount"}:</span>
        <span className="text-emerald-500">{format(preview.net_amount)}</span>
      </div>

      <div className="flex justify-between text-muted-foreground text-[11px] pt-1">
        <span>Total Charged:</span>
        <strong className="text-foreground">{format(preview.total_charged)}</strong>
      </div>
    </div>
  );
}
