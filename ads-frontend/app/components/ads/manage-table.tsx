import { useRef } from "react";
import { Button } from "~/components/ui/button";
import { StatusChip } from "./status-chip";
import { METRIC_COLUMNS, type ColumnKey, type LevelConfig } from "~/lib/ads-levels";
import {
  type AdsRow,
  cpcOf,
  ctrOf,
  deliveryStatusOf,
  formatBudget,
  formatCount,
  formatMoneyOrDash,
  formatPercent,
  formatUsd,
  isToggleable,
} from "~/lib/ads-format";
import { cn } from "~/lib/utils";

export interface ManageTableProps {
  config: LevelConfig;
  rows: AdsRow[];
  visibleColumns: Set<ColumnKey>;
  pendingIds: Set<number>;
  onOpen: (row: AdsRow) => void;
  onToggle: (row: AdsRow) => void;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:rounded-sm";

function metricValue(row: AdsRow, key: ColumnKey): string {
  const t = row.totals;
  switch (key) {
    case "budget":
      return formatBudget(row);
    case "spend":
      return t ? formatUsd(t.spend / 100) : "—";
    case "impressions":
      return t ? formatCount(t.impressions) : "—";
    case "clicks":
      return t ? formatCount(t.clicks) : "—";
    case "ctr":
      return t ? formatPercent(ctrOf(t)) : "—";
    case "cpc":
      return t ? formatMoneyOrDash(cpcOf(t)) : "—";
    case "conversions":
      return t ? formatCount(t.conversions) : "—";
  }
}

/** On/off switch for a row. Completed and archived rows cannot be switched. */
export function StatusSwitch({
  row,
  pending,
  onToggle,
}: {
  row: AdsRow;
  pending: boolean;
  onToggle: (row: AdsRow) => void;
}) {
  const on = row.status === "active";
  const enabled = isToggleable(row) && !pending;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${row.name}: ${on ? "on" : "off"}. Switch ${on ? "off" : "on"}`}
      aria-disabled={!enabled}
      disabled={!isToggleable(row)}
      title={isToggleable(row) ? undefined : "Completed items cannot be switched"}
      onClick={() => enabled && onToggle(row)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        on ? "bg-primary" : "bg-slate-300 dark:bg-slate-600",
        pending && "animate-pulse",
        FOCUS_RING
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
          on ? "translate-x-[1.1rem]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function ManageTable({ config, rows, visibleColumns, pendingIds, onOpen, onToggle }: ManageTableProps) {
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const shownMetrics = METRIC_COLUMNS.filter((c) => config.columns.includes(c.key) && visibleColumns.has(c.key));

  // Roving focus: arrow keys move between row name buttons, Home and End jump to the ends.
  function handleKeyDown(event: React.KeyboardEvent<HTMLTableSectionElement>) {
    const buttons = Array.from(tbodyRef.current?.querySelectorAll<HTMLButtonElement>("button[data-row-focus]") ?? []);
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index === -1) return;
    let next = -1;
    if (event.key === "ArrowDown") next = Math.min(index + 1, buttons.length - 1);
    if (event.key === "ArrowUp") next = Math.max(index - 1, 0);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = buttons.length - 1;
    if (next !== -1) {
      event.preventDefault();
      buttons[next]?.focus();
    }
  }

  return (
    <>
      {/* Desktop and tablet: data table */}
      <div className="relative hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <caption className="sr-only">{config.title} with delivery metrics for the selected date range</caption>
          <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-medium">{config.nameHeader}</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              {shownMetrics.map((c) => (
                <th key={c.key} scope="col" className={cn("px-3 py-2.5 font-medium whitespace-nowrap", c.key !== "budget" && "text-right")}>
                  {c.label}
                </th>
              ))}
              <th scope="col" className="px-3 py-2.5 font-medium">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody ref={tbodyRef} onKeyDown={handleKeyDown} className="divide-y divide-border">
            {rows.map((row) => {
              const status = deliveryStatusOf(row, config.level);
              return (
                <tr key={row.id} className="transition-colors hover:bg-muted/40">
                  <td className="max-w-[15rem] px-3 py-2.5">
                    <button
                      type="button"
                      data-row-focus
                      onClick={() => onOpen(row)}
                      aria-haspopup="dialog"
                      className={cn("block max-w-full truncate rounded-sm text-left font-medium text-ads-accent-text hover:underline", FOCUS_RING)}
                    >
                      {row.name}
                    </button>
                    <span className="text-xs text-muted-foreground">ID {row.id}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <StatusSwitch row={row} pending={pendingIds.has(row.id)} onToggle={onToggle} />
                      <StatusChip status={status} />
                    </div>
                  </td>
                  {shownMetrics.map((c) => (
                    <td
                      key={c.key}
                      className={cn("px-3 py-2.5 tabular-nums whitespace-nowrap text-foreground", c.key !== "budget" && "text-right")}
                    >
                      {metricValue(row, c.key)}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onOpen(row)} aria-label={`View details for ${row.name}`}>
                      Details
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phone: stacked cards, no horizontal scrolling */}
      <ul className="flex flex-col gap-3 md:hidden" aria-label={`${config.title} list`}>
        {rows.map((row) => {
          const status = deliveryStatusOf(row, config.level);
          return (
            <li key={row.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpen(row)}
                    aria-haspopup="dialog"
                    className={cn("block max-w-full break-words rounded-sm text-left font-semibold text-ads-accent-text hover:underline", FOCUS_RING)}
                  >
                    {row.name}
                  </button>
                  <span className="text-xs text-muted-foreground">ID {row.id}</span>
                </div>
                <StatusChip status={status} className="shrink-0" />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Switch {row.status === "active" ? "on" : "off"}</span>
                <StatusSwitch row={row} pending={pendingIds.has(row.id)} onToggle={onToggle} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 text-sm">
                {METRIC_COLUMNS.filter((c) => config.columns.includes(c.key)).map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{c.label}</dt>
                    <dd className="font-medium tabular-nums text-foreground">
                      {metricValue(row, c.key)}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}
