import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { StatusChip } from "./status-chip";
import {
  type AdsLevel,
  type AdsRow,
  cpcOf,
  ctrOf,
  deliveryStatusOf,
  formatBudget,
  formatCount,
  formatMoneyOrDash,
  formatPercent,
  formatUsd,
} from "~/lib/ads-format";

const OBJECTIVE_LABELS: Record<string, string> = {
  awareness: "Awareness",
  traffic: "Traffic",
  engagement: "Engagement",
  followers: "Followers",
  community_growth: "Community growth",
  product_sales: "Product sales",
};

const LEVEL_NOUN: Record<AdsLevel, string> = {
  campaigns: "Campaign",
  "ad-groups": "Ad group",
  ads: "Ad",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function text(value: unknown): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-foreground">{children}</dd>
    </div>
  );
}

function explain(status: ReturnType<typeof deliveryStatusOf>, row: AdsRow, level: AdsLevel): string {
  switch (status) {
    case "paused":
      return "Paused by the advertiser. Resume it to start delivery.";
    case "completed":
      return row.status === "archived" ? "Archived. It no longer delivers." : "The end time has passed.";
    case "not_delivering":
      if (level === "campaigns" && row.review_status && row.review_status !== "approved") {
        return `Waiting on review (review status: ${row.review_status}).`;
      }
      return "Active, but no impressions are recorded for the selected date range.";
    case "active":
      return "Delivering: impressions are recorded for the selected date range.";
  }
}

export function DetailSheet({
  row,
  level,
  rangeLabel,
  onClose,
}: {
  row: AdsRow | null;
  level: AdsLevel;
  rangeLabel: string;
  onClose: () => void;
}) {
  const noun = LEVEL_NOUN[level];
  const status = row ? deliveryStatusOf(row, level) : "active";
  const totals = row?.totals;

  return (
    <Sheet open={row !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {row && (
          <>
            <SheetHeader className="pr-10">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{noun} details</p>
              <SheetTitle className="break-words text-lg">{row.name}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <StatusChip status={status} />
                <span className="text-xs">ID {row.id}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 pb-6">
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">{explain(status, row, level)}</p>

              <section aria-labelledby="detail-performance">
                <h3 id="detail-performance" className="mb-1 text-sm font-semibold">Performance, {rangeLabel}</h3>
                {totals && totals.impressions === 0 && totals.clicks === 0 && totals.spend === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">No data yet for this date range.</p>
                ) : (
                  <dl className="divide-y divide-border">
                    <Field label="Spend">{totals ? formatUsd(totals.spend / 100) : "—"}</Field>
                    <Field label="Impressions">{totals ? formatCount(totals.impressions) : "—"}</Field>
                    <Field label="Clicks">{totals ? formatCount(totals.clicks) : "—"}</Field>
                    <Field label="CTR">{totals ? formatPercent(ctrOf(totals)) : "—"}</Field>
                    <Field label="CPC">{totals ? formatMoneyOrDash(cpcOf(totals)) : "—"}</Field>
                    <Field label="Conversions">{totals ? formatCount(totals.conversions) : "—"}</Field>
                  </dl>
                )}
              </section>

              <section aria-labelledby="detail-settings">
                <h3 id="detail-settings" className="mb-1 text-sm font-semibold">Settings</h3>
                <dl className="divide-y divide-border">
                  {level === "campaigns" && (
                    <>
                      <Field label="Objective">{OBJECTIVE_LABELS[text(row.objective)] ?? text(row.objective)}</Field>
                      <Field label="Budget">{formatBudget(row)}</Field>
                      <Field label="Review status">{text(row.review_status)}</Field>
                      <Field label="Review notes">{text(row.review_notes)}</Field>
                    </>
                  )}
                  {level === "ad-groups" && (
                    <>
                      <Field label="Campaign ID">{text(row.campaign_id)}</Field>
                      <Field label="Budget">{formatBudget(row)}</Field>
                      <Field label="Optimization goal">{text(row.optimization_goal)}</Field>
                      <Field label="Bid strategy">{text(row.bid_strategy)}</Field>
                    </>
                  )}
                  {level === "ads" && (
                    <>
                      <Field label="Ad group ID">{text(row.ad_group_id)}</Field>
                      <Field label="Headline">{text(row.headline)}</Field>
                      <Field label="Call to action">{text(row.cta_type)}</Field>
                      <Field label="Destination">{text(row.destination_url)}</Field>
                    </>
                  )}
                  <Field label="Start">{formatDate(row.start_time as string | null)}</Field>
                  <Field label="End">{formatDate(row.end_time as string | null)}</Field>
                  <Field label="Created">{formatDate(row.created_at)}</Field>
                </dl>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
