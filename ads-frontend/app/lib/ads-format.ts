/** Shared formatting and status rules for the Ads Manager tables. */

export type AdsLevel = "campaigns" | "ad-groups" | "ads";

export type DeliveryStatus = "active" | "paused" | "not_delivering" | "completed";

export interface AdsTotals {
  impressions: number;
  clicks: number;
  spend: number; // minor units (cents)
  conversions: number;
  conversion_value: number;
}

export interface AdsRow {
  id: number;
  name: string;
  status: string;
  review_status?: string;
  review_notes?: string | null;
  objective?: string;
  budget_type?: string | null;
  budget_amount?: number | string | null;
  start_time?: string | null;
  end_time?: string | null;
  created_at?: string | null;
  totals?: AdsTotals;
  [key: string]: unknown;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const count = new Intl.NumberFormat("en-US");

export function formatUsd(major: number): string {
  return usd.format(major);
}

export function formatCount(value: number): string {
  return count.format(value);
}

/** Budget amounts are stored as entered in USD (major units). */
export function formatBudget(row: AdsRow): string {
  const amount = row.budget_amount;
  if (amount === null || amount === undefined || amount === "") return "—";
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  const suffix = row.budget_type === "lifetime" ? " lifetime" : row.budget_type === "daily" ? " / day" : "";
  return `${formatUsd(value)}${suffix}`;
}

export function ctrOf(totals: AdsTotals): number | null {
  if (!totals.impressions) return null;
  return totals.clicks / totals.impressions;
}

export function cpcOf(totals: AdsTotals): number | null {
  if (!totals.clicks) return null;
  return totals.spend / 100 / totals.clicks;
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatMoneyOrDash(value: number | null): string {
  return value === null ? "—" : formatUsd(value);
}

export const STATUS_LABELS: Record<DeliveryStatus, string> = {
  active: "Active",
  paused: "Paused",
  not_delivering: "Not delivering",
  completed: "Completed",
};

/**
 * Maps the stored status and real delivery data onto the four chips.
 * - Completed: archived/completed rows, or active rows past their end time.
 * - Paused: the advertiser paused it.
 * - Not delivering: active, but waiting on review (campaigns) or no impressions in the selected range.
 * - Active: active, approved where review applies, and has impressions.
 */
export function deliveryStatusOf(row: AdsRow, level: AdsLevel, now: Date = new Date()): DeliveryStatus {
  if (row.status === "completed" || row.status === "archived") return "completed";
  if (row.status === "paused") return "paused";
  if (row.status !== "active") return "not_delivering";
  if (row.end_time && new Date(row.end_time).getTime() < now.getTime()) return "completed";
  if (level === "campaigns" && row.review_status && row.review_status !== "approved") return "not_delivering";
  if (!row.totals || row.totals.impressions === 0) return "not_delivering";
  return "active";
}

/** Only active and paused rows can be switched; completed rows are read-only. */
export function isToggleable(row: AdsRow): boolean {
  return row.status === "active" || row.status === "paused";
}
