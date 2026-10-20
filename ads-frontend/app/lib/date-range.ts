/** Date-range presets for the top bar. The selected value lives in the ?range= URL parameter. */

export const DATE_RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "all", label: "All time" },
] as const;

export type DateRangeValue = (typeof DATE_RANGE_OPTIONS)[number]["value"];

export const DEFAULT_RANGE: DateRangeValue = "7d";

export function parseRange(raw: string | null): DateRangeValue {
  return DATE_RANGE_OPTIONS.some((o) => o.value === raw) ? (raw as DateRangeValue) : DEFAULT_RANGE;
}

function toIsoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Inclusive start and end days for the API. "All time" sends no bounds. */
export function rangeToParams(value: DateRangeValue, today: Date = new Date()): { start_date?: string; end_date?: string } {
  const option = DATE_RANGE_OPTIONS.find((o) => o.value === value);
  if (!option || !("days" in option)) return {};
  const start = new Date(today);
  start.setDate(start.getDate() - (option.days - 1));
  return { start_date: toIsoDay(start), end_date: toIsoDay(today) };
}
