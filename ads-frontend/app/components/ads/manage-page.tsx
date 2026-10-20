import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { AdsApiError, adsRequest } from "~/lib/ads-api";
import {
  type AdsRow,
  type DeliveryStatus,
  STATUS_LABELS,
  cpcOf,
  ctrOf,
  deliveryStatusOf,
  formatCount,
  formatMoneyOrDash,
  formatPercent,
  formatUsd,
} from "~/lib/ads-format";
import { DATE_RANGE_OPTIONS, parseRange, rangeToParams, type DateRangeValue } from "~/lib/date-range";
import { LEVELS, METRIC_COLUMNS, type ColumnKey, type LevelConfig } from "~/lib/ads-levels";
import { DetailSheet } from "./detail-sheet";
import { KpiCards, type KpiItem } from "./kpi-cards";
import { ManageTable } from "./manage-table";
import { cn } from "~/lib/utils";

const PAGE_SIZE = 20;
const API_PAGE_SIZE = 100;
const MAX_API_PAGES = 5; // up to 500 rows are loaded for client-side search, filters and paging

interface AccountSummary {
  spend_usd: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

const STATUS_FILTERS: ("all" | DeliveryStatus)[] = ["all", "active", "paused", "not_delivering", "completed"];

function columnStorageKey(config: LevelConfig) {
  return `ads-manager-columns:${config.level}`;
}

function loadColumns(config: LevelConfig): Set<ColumnKey> {
  const all = new Set<ColumnKey>(config.columns);
  try {
    const raw = window.localStorage.getItem(columnStorageKey(config));
    if (!raw) return all;
    const saved = JSON.parse(raw) as string[];
    const next = new Set(config.columns.filter((c) => saved.includes(c)));
    return next;
  } catch {
    return all;
  }
}

function saveColumns(config: LevelConfig, columns: Set<ColumnKey>) {
  try {
    window.localStorage.setItem(columnStorageKey(config), JSON.stringify([...columns]));
  } catch {
    /* storage unavailable: the choice simply is not remembered */
  }
}

async function fetchAllRows(endpoint: string, range: DateRangeValue, signal: AbortSignal) {
  const rows: AdsRow[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const body = await adsRequest<any>(endpoint, {
      params: { ...rangeToParams(range), per_page: API_PAGE_SIZE, page },
      signal,
    });
    const items: AdsRow[] = Array.isArray(body) ? body : body?.data ?? [];
    rows.push(...items);
    lastPage = Array.isArray(body) ? 1 : Number(body?.last_page ?? 1);
    page += 1;
  } while (page <= lastPage && page <= MAX_API_PAGES);
  return { rows, truncated: page <= lastPage };
}

export function ManagePage({ config }: { config: LevelConfig }) {
  const [params, setParams] = useSearchParams();
  const range = parseRange(params.get("range"));
  const rangeLabel = DATE_RANGE_OPTIONS.find((o) => o.value === range)?.label ?? "";

  const [rows, setRows] = useState<AdsRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DeliveryStatus>("all");
  const [page, setPage] = useState(1);

  const [visible, setVisible] = useState<Set<ColumnKey>>(() => new Set(config.columns));
  const [columnsOpen, setColumnsOpen] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());
  const [toggleError, setToggleError] = useState("");
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    setVisible(loadColumns(config));
  }, [config]);

  // Load the rows for this level and date range.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    fetchAllRows(config.endpoint, range, controller.signal)
      .then(({ rows: loaded, truncated: more }) => {
        setRows(loaded);
        setTruncated(more);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRows([]);
        setLoadError(error instanceof AdsApiError ? error.message : "Could not reach the Ads service.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [config.endpoint, range, reloadKey]);

  // Account-level totals for the summary cards.
  useEffect(() => {
    const controller = new AbortController();
    setAccountLoading(true);
    adsRequest<any>("/analytics/report", { params: rangeToParams(range), signal: controller.signal })
      .then((body) => {
        const s = body?.summary;
        setAccount(
          s
            ? {
                spend_usd: Number(s.spend_usd ?? 0),
                impressions: Number(s.impressions ?? 0),
                clicks: Number(s.clicks ?? 0),
                conversions: Number(s.conversions ?? 0),
              }
            : null
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setAccount(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAccountLoading(false);
      });
    return () => controller.abort();
  }, [range, reloadKey]);

  const kpiItems: KpiItem[] = useMemo(() => {
    const hasDelivery = !!account && (account.impressions > 0 || account.spend_usd > 0 || account.clicks > 0);
    const ctr = account && account.impressions > 0 ? account.clicks / account.impressions : null;
    const cpc = account && account.clicks > 0 ? account.spend_usd / account.clicks : null;
    const pick = (value: string) => (hasDelivery ? value : null);
    return [
      { label: "Spend", value: pick(formatUsd(account?.spend_usd ?? 0)), hint: rangeLabel },
      { label: "Impressions", value: pick(formatCount(account?.impressions ?? 0)) },
      { label: "Clicks", value: pick(formatCount(account?.clicks ?? 0)) },
      { label: "CTR", value: ctr === null ? null : formatPercent(ctr) },
      { label: "CPC", value: cpc === null ? null : formatMoneyOrDash(cpc) },
      { label: "Conversions", value: pick(formatCount(account?.conversions ?? 0)) },
    ];
  }, [account, rangeLabel]);

  const now = useMemo(() => new Date(), [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (needle && !row.name.toLowerCase().includes(needle) && !String(row.id).includes(needle)) return false;
      if (statusFilter !== "all" && deliveryStatusOf(row, config.level, now) !== statusFilter) return false;
      return true;
    });
  }, [rows, query, statusFilter, config.level, now]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selected = selectedId === null ? null : rows.find((r) => r.id === selectedId) ?? null;

  function updateRange(value: string) {
    const next = new URLSearchParams(params);
    next.set("range", value);
    setParams(next, { replace: true });
  }

  function toggleColumn(key: ColumnKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveColumns(config, next);
      return next;
    });
  }

  async function toggleStatus(row: AdsRow) {
    const nextStatus = row.status === "active" ? "paused" : "active";
    setToggleError("");
    setPendingIds((prev) => new Set(prev).add(row.id));
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r)));
    try {
      await adsRequest(`${config.endpoint}/${row.id}`, { method: "PUT", body: { status: nextStatus } });
      setAnnouncement(`${row.name} is now ${nextStatus}.`);
    } catch (error) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: row.status } : r)));
      const reason = error instanceof AdsApiError ? error.message : "Check your connection and try again.";
      setToggleError(`Could not change "${row.name}". ${reason}`);
      setAnnouncement(`Could not change ${row.name}.`);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  }

  const hasFilters = query.trim() !== "" || statusFilter !== "all";
  const noun = config.singular;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{config.title}</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${rows.length} ${noun}${rows.length === 1 ? "" : "s"}${truncated ? `, showing the first ${rows.length}` : ""} · ${rangeLabel}`}
          </p>
        </div>
      </header>

      <KpiCards items={kpiItems} loading={accountLoading} />

      <section aria-label={`${config.title} list`} className="flex min-w-0 flex-col gap-3">
        {/* Filter and search bar */}
        <div className="flex flex-wrap items-center gap-2" role="search">
          <label htmlFor={`${config.level}-search`} className="sr-only">
            Search {config.title.toLowerCase()} by name or ID
          </label>
          <Input
            id={`${config.level}-search`}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or ID"
            className="h-8 w-full sm:w-64"
          />

          <label htmlFor={`${config.level}-status`} className="sr-only">
            Filter by status
          </label>
          <select
            id={`${config.level}-status`}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "all" | DeliveryStatus);
              setPage(1);
            }}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value} className="bg-background">
                {value === "all" ? "All statuses" : STATUS_LABELS[value]}
              </option>
            ))}
          </select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          )}

          <div className="relative ml-auto">
            <Button
              variant="outline"
              size="sm"
              aria-expanded={columnsOpen}
              aria-controls={`${config.level}-columns`}
              onClick={() => setColumnsOpen((open) => !open)}
            >
              Columns
            </Button>
            {columnsOpen && (
              <div
                id={`${config.level}-columns`}
                role="group"
                aria-label="Show columns"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setColumnsOpen(false);
                }}
                className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-border bg-popover p-2 text-sm text-popover-foreground shadow-md"
              >
                {METRIC_COLUMNS.filter((c) => config.columns.includes(c.key)).map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={visible.has(c.key)}
                      onChange={() => toggleColumn(c.key)}
                      className="h-4 w-4 accent-brand focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    {c.label}
                  </label>
                ))}
                <p className="px-2 pt-2 text-xs text-muted-foreground">Name and status always show.</p>
              </div>
            )}
          </div>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
        {toggleError && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {toggleError}
          </p>
        )}

        {/* Table body and states */}
        {loading ? (
          <div role="status" aria-live="polite" className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
            <span className="sr-only">Loading {config.title.toLowerCase()}…</span>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6">
            <p className="font-medium text-foreground">Could not load {config.title.toLowerCase()}.</p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border bg-card p-6">
            <p className="font-semibold text-foreground">{config.emptyTitle}</p>
            <p className="text-sm text-muted-foreground">{config.emptyCopy}</p>
            {config.createTo && (
              <Button size="sm" className="mt-1" render={<Link to={config.createTo} />}>
                Create campaign
              </Button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border bg-card p-6">
            <p className="font-semibold text-foreground">No {config.title.toLowerCase()} match these filters.</p>
            <Button variant="outline" size="sm" onClick={() => { setQuery(""); setStatusFilter("all"); setPage(1); }}>
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            <ManageTable
              config={config}
              rows={pageRows}
              visibleColumns={visible}
              pendingIds={pendingIds}
              onOpen={(row) => setSelectedId(row.id)}
              onToggle={toggleStatus}
            />

            <nav aria-label={`${config.title} pages`} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                {filtered.length === 0 ? "" : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
                  Previous
                </Button>
                <span className={cn("tabular-nums text-foreground")} aria-current="page">
                  {safePage} / {pageCount}
                </span>
                <Button variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} aria-label="Next page">
                  Next
                </Button>
              </div>
            </nav>
          </>
        )}
      </section>

      <DetailSheet row={selected} level={config.level} rangeLabel={rangeLabel} onClose={() => setSelectedId(null)} />
    </div>
  );
}
