import { cn } from "~/lib/utils";
import { STATUS_LABELS, type DeliveryStatus } from "~/lib/ads-format";

const STYLES: Record<DeliveryStatus, { chip: string; dot: string }> = {
  active: {
    chip: "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/30",
    dot: "bg-emerald-600 dark:bg-emerald-400",
  },
  paused: {
    chip: "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/30",
    dot: "bg-slate-500 dark:bg-slate-400",
  },
  not_delivering: {
    chip: "bg-amber-50 text-amber-900 ring-amber-600/25 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/30",
    dot: "bg-amber-600 dark:bg-amber-400",
  },
  completed: {
    chip: "bg-slate-50 text-slate-600 ring-slate-400/30 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-600/50",
    dot: "bg-slate-400 dark:bg-slate-500",
  },
};

/** Status chip: colour plus a dot plus the text label, so meaning never relies on colour alone. */
export function StatusChip({ status, className }: { status: DeliveryStatus; className?: string }) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        style.chip,
        className
      )}
    >
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {STATUS_LABELS[status]}
    </span>
  );
}
