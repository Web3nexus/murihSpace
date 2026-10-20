import { logger } from "@/lib/logger";
import { asApiError } from "@/lib/apiError";
import { useState, useEffect, useCallback, useId } from "react";
import { Link } from "react-router";
import { Show as Eye, Chat as ChatCircleDots, N2User as Users, Document as FileText, Calendar, ArrowUp, ArrowDown, ArrowDown as CaretDown, Plus, DangerSquare as WarningCircle, TimeCircle as Clock, ArrowRight } from "@/components/icons";
import { Broadcast, Handshake, Spinner } from "@/components/icons/rounded";;
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/api/authFetch";
import { AnimatedPage } from "@/components/common/AnimatedPage";

interface TimeSeriesPoint {
  date: string;
  label: string;
  views: number;
  engagement: number;
  net_follows: number;
  reach: number;
}

interface ContentPerformanceItem {
  id: number;
  title: string;
  thumbnail: string | null;
  created_at: string;
  views: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
}

interface AudienceData {
  total_followers: number;
  growth_rate: number;
  returning_percentage: number;
  top_locations: { name: string; percentage: number }[];
  activity_peak: string;
}

interface ProfileStatusData {
  name: string;
  username: string;
  avatar: string | null;
  profile_views: number;
  followers: number;
  engagement_rate: string;
  weekly_progress: number;
}

interface PlannedContentItem {
  id: number;
  title: string;
  date: string;
  status: string;
}

interface MetricSummary {
  value: number;
  delta: number;
}

interface CreatorPerformanceData {
  summary: {
    views: MetricSummary;
    engagement: MetricSummary;
    net_follows: MetricSummary;
    reach: MetricSummary;
  };
  time_series: TimeSeriesPoint[];
  top_content: ContentPerformanceItem[];
  audience: AudienceData;
  profile_status: ProfileStatusData;
  planned_content: PlannedContentItem[];
}

type MetricKey = "views" | "engagement" | "net_follows" | "reach";
type DateRange = "7d" | "28d" | "90d";

const METRIC_CONFIG: Record<
  MetricKey,
  { label: string; icon: typeof Eye; format: (v: number) => string }
> = {
  views: {
    label: "Views",
    icon: Eye,
    format: (v) => v.toLocaleString(),
  },
  engagement: {
    label: "Engagement",
    icon: ChatCircleDots,
    format: (v) => v.toLocaleString(),
  },
  net_follows: {
    label: "Net follows",
    icon: Users,
    format: (v) => v.toLocaleString(),
  },
  reach: {
    label: "Reach",
    icon: Broadcast,
    format: (v) => v.toLocaleString(),
  },
};

function formatCompactTime(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const diffDays = Math.floor(diffSec / 86400);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function PerformanceChart({
  data,
  metric,
}: {
  data: TimeSeriesPoint[];
  metric: MetricKey;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const chartGradientId = useId();

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
        No trend data available for this range
      </div>
    );
  }

  const values = data.map((d) => d[metric]);
  const maxVal = Math.max(...values, 5);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const width = 800;
  const height = 240;
  const paddingX = 40;
  const paddingY = 30;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = data.map((d, idx) => {
    const x = paddingX + (idx / (data.length - 1 || 1)) * chartWidth;
    const y = height - paddingY - ((d[metric] - minVal) / range) * chartHeight;
    return { x, y, point: d, val: d[metric] };
  });

  const pathD = points.reduce((acc, p, idx) => {
    if (idx === 0) return `M ${p.x} ${p.y}`;
    const prev = points[idx - 1];
    const cpX1 = prev.x + (p.x - prev.x) / 2;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (p.x - prev.x) / 2;
    const cpY2 = p.y;
    return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p.x} ${p.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  // Y-axis ticks
  const yTicks = [0, Math.round(maxVal * 0.5), maxVal];

  // X-axis sampled labels
  const step = Math.ceil(data.length / 6);
  const sampledLabels = data.filter((_, idx) => idx % step === 0 || idx === data.length - 1);

  return (
    <div className="relative w-full select-none pt-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-56 sm:h-64 overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={chartGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2164b6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2164b6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {yTicks.map((tick, i) => {
          const y = height - paddingY - ((tick - minVal) / range) * chartHeight;
          return (
            <g key={i}>
              <line
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="currentColor"
                strokeDasharray="3 3"
                className="text-[#DADDE1] dark:text-[#3E4042]/70"
                strokeWidth="1"
              />
              <text
                x={paddingX - 8}
                y={y + 3}
                textAnchor="end"
                className="text-[10px] fill-[#65676B] dark:fill-[#B0B3B8] font-medium"
              >
                {tick.toLocaleString()}
              </text>
            </g>
          );
        })}

        {/* Gradient fill */}
        <path d={areaD} fill={`url(#${chartGradientId})`} />

        {/* Main curved line */}
        <path
          d={pathD}
          fill="none"
          stroke="#2164b6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover vertical indicator & dot */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <g>
            <line
              x1={points[hoveredIdx].x}
              y1={paddingY}
              x2={points[hoveredIdx].x}
              y2={height - paddingY}
              stroke="#2164b6"
              strokeDasharray="2 2"
              strokeWidth="1.5"
              className="opacity-70"
            />
            <circle
              cx={points[hoveredIdx].x}
              cy={points[hoveredIdx].y}
              r="5"
              fill="#2164b6"
              stroke="#FFFFFF"
              strokeWidth="2"
              className="drop-shadow-sm"
            />
          </g>
        )}

        {/* Interactive capture rectangles */}
        {points.map((p, idx) => {
          const sliceWidth = chartWidth / (points.length || 1);
          return (
            <rect
              key={idx}
              x={p.x - sliceWidth / 2}
              y={0}
              width={sliceWidth}
              height={height}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          );
        })}
      </svg>

      {/* Floating tooltip */}
      {hoveredIdx !== null && points[hoveredIdx] && (
        <div
          className="absolute z-20 pointer-events-none -translate-x-1/2 -top-1 px-2.5 py-1 rounded-md bg-[#050505] text-white text-[11px] font-semibold shadow-md whitespace-nowrap"
          style={{
            left: `${(points[hoveredIdx].x / width) * 100}%`,
          }}
        >
          <span>
            {points[hoveredIdx].point.label}:{" "}
            <strong className="text-[var(--shell-accent)]">
              {METRIC_CONFIG[metric].format(points[hoveredIdx].val)}
            </strong>{" "}
            {METRIC_CONFIG[metric].label.toLowerCase()}
          </span>
        </div>
      )}

      {/* X-axis date labels */}
      <div className="flex justify-between px-10 pt-1 text-[11px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
        {sampledLabels.map((lbl, idx) => (
          <span key={idx}>{lbl.label}</span>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<DateRange>("28d");
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("views");
  const [data, setData] = useState<CreatorPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Reset loading in the render that changes the range, rather than in the fetch effect.
  const [prevRange, setPrevRange] = useState(range);
  if (prevRange !== range) {
    setPrevRange(range);
    setLoading(true);
    setError(null);
  }

  const fetchInsights = useCallback(async (r: DateRange) => {
    try {
      const res = await authFetch(`/analytics/creator-performance?range=${r}`);
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Your session has expired. Please sign in to view insights.");
        }
        let serverMessage = `Server responded with status ${res.status}`;
        try {
          const errData = await res.json();
          if (errData?.message) serverMessage = errData.message;
        } catch { /* ignored: best-effort, failure is non-fatal */ }
        throw new Error(serverMessage);
      }

      const raw = await res.json();
      const payload: CreatorPerformanceData | null =
        raw?.data?.summary
          ? raw.data
          : raw?.data?.data?.summary
          ? raw.data.data
          : raw?.summary
          ? raw
          : null;

      if (payload && payload.summary) {
        setData(payload);
      } else {
        throw new Error("Invalid response format received from analytics service.");
      }
    } catch (err: unknown) {
      const apiErr = asApiError(err);
      logger.error("Failed to load insights:", err);
      const message =
        err instanceof Error
          ? apiErr.message
          : typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to load performance insights. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchInsights(range);
    })();
  }, [range, fetchInsights]);

  if (loading && !data) {
    return (
      <AnimatedPage className="w-full min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner weight="bold" className="h-7 w-7 animate-spin text-[var(--shell-accent)]" />
          <p className="text-xs font-semibold text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
            Loading creator insights…
          </p>
        </div>
      </AnimatedPage>
    );
  }

  if (error && !data) {
    return (
      <AnimatedPage className="w-full min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm bg-white dark:bg-[var(--shell-surface)] p-6 rounded-lg shadow-xs">
          <WarningCircle weight="fill" className="h-8 w-8 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)]">Unable to Load Insights</h2>
          <p className="text-xs text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">{error}</p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => { setLoading(true); setError(null); fetchInsights(range); }}
              className="px-4 py-2 rounded-lg bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white text-xs font-semibold transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => {
                setError(null);
                setData({
                  summary: {
                    views: { value: 0, delta: 0 },
                    engagement: { value: 0, delta: 0 },
                    net_follows: { value: 0, delta: 0 },
                    reach: { value: 0, delta: 0 },
                  },
                  time_series: [],
                  top_content: [],
                  audience: {
                    total_followers: 0,
                    growth_rate: 0,
                    returning_percentage: 0,
                    top_locations: [{ name: "Worldwide", percentage: 100 }],
                    activity_peak: "No recent activity",
                  },
                  profile_status: {
                    name: user?.name || "Creator",
                    username: user?.username || "creator",
                    avatar: user?.avatar || null,
                    profile_views: 0,
                    followers: 0,
                    engagement_rate: "0%",
                    weekly_progress: 0,
                  },
                  planned_content: [],
                });
              }}
              className="px-4 py-2 rounded-lg bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] text-[var(--shell-text)] dark:text-[var(--shell-text)] text-xs font-semibold hover:bg-[var(--shell-hover)] transition-colors"
            >
              View Baseline
            </button>
          </div>
        </div>
      </AnimatedPage>
    );
  }

  const summary = data?.summary ?? {
    views: { value: 0, delta: 0 },
    engagement: { value: 0, delta: 0 },
    net_follows: { value: 0, delta: 0 },
    reach: { value: 0, delta: 0 },
  };

  const hasZeroActivity =
    summary.views.value === 0 &&
    summary.engagement.value === 0 &&
    summary.net_follows.value === 0 &&
    (!data?.top_content || data.top_content.length === 0);

  return (
    <AnimatedPage className="w-full min-h-full bg-[var(--shell-canvas)] dark:bg-[var(--shell-canvas)] text-[var(--shell-text)] dark:text-[var(--shell-text)] py-5 px-3 sm:px-6">
      <div className="max-w-[1240px] mx-auto flex flex-col lg:flex-row gap-6 items-start">
        {/* ── MAIN INSIGHTS AREA (700–850px) ── */}
        <div className="flex-1 min-w-0 w-full max-w-[850px] space-y-5">
          {/* 1. Insights Page Identity Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[var(--shell-surface)] p-4 sm:p-5 rounded-lg shadow-xs">
            <div>
              <h1 className="text-2xl sm:text-[26px] font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)] tracking-tight leading-tight">
                Insights
              </h1>
              <p className="text-xs sm:text-[13px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)] mt-1">
                Understand how your content, audience and creator business are performing.
              </p>
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
              <div className="relative">
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value as DateRange)}
                  className="appearance-none h-9 pl-3 pr-8 rounded-lg bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] text-[var(--shell-text)] dark:text-[var(--shell-text)] text-xs font-semibold border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--shell-accent)]/40 transition-all"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="28d">Last 28 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
                <CaretDown
                  weight="bold"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--shell-muted)] dark:text-[var(--shell-muted)] pointer-events-none"
                />
              </div>
            </div>
          </div>

          {/* 2. Empty State if brand new account with 0 data */}
          {hasZeroActivity && (
            <div className="bg-white dark:bg-[var(--shell-surface)] rounded-lg shadow-xs p-8 text-center space-y-3 flex flex-col items-center justify-center">
              <div className="h-12 w-12 rounded-full bg-[var(--shell-accent-solid)]/10 text-[var(--shell-accent)] flex items-center justify-center mx-auto">
                <Users weight="fill" className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)] text-center">
                No performance data yet
              </h3>
              <p className="text-xs sm:text-sm text-[var(--shell-muted)] dark:text-[var(--shell-muted)] max-w-md mx-auto leading-relaxed text-center">
                Once you publish content, your views, engagement and audience insights will automatically appear here.
              </p>
              <Link to="/app/feed" className="inline-block pt-1 text-center">
                <button className="px-4 py-2 rounded-lg bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white text-xs font-bold transition-colors">
                  Create your first post
                </button>
              </Link>
            </div>
          )}

          {/* 3. Primary Performance Area (Metric Selectors + Interactive Chart) */}
          <div className="bg-white dark:bg-[var(--shell-surface)] rounded-lg shadow-xs p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[17px] font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)]">
                  Performance Overview
                </h2>
                <p className="text-[12px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
                  Select a metric below to visualize trends over the past{" "}
                  {range === "7d" ? "7 days" : range === "90d" ? "90 days" : "28 days"}.
                </p>
              </div>
            </div>

            {/* Unified Metric Selectors Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {(["views", "engagement", "net_follows", "reach"] as MetricKey[]).map((key) => {
                const metricMeta = METRIC_CONFIG[key];
                const itemSummary = summary[key];
                const isSelected = selectedMetric === key;
                const isUp = itemSummary.delta >= 0;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedMetric(key)}
                    className={`flex flex-col text-left p-3 rounded-lg border transition-all cursor-pointer select-none ${
                      isSelected
                        ? "border-[var(--shell-accent)] bg-[var(--shell-accent-tint)]/70 dark:bg-[var(--shell-accent-tint)]/50 shadow-2xs"
                        : "border-[var(--shell-border)] dark:border-[var(--shell-border)] hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span
                        className={`text-[12px] font-semibold truncate ${
                          isSelected
                            ? "text-[var(--shell-accent)] dark:text-[var(--shell-accent)]"
                            : "text-[var(--shell-muted)] dark:text-[var(--shell-muted)]"
                        }`}
                      >
                        {metricMeta.label}
                      </span>
                      <metricMeta.icon
                        weight="fill"
                        className={`h-4 w-4 shrink-0 ${
                          isSelected
                            ? "text-[var(--shell-accent)] dark:text-[var(--shell-accent)]"
                            : "text-[var(--shell-muted)] dark:text-[var(--shell-muted)]"
                        }`}
                      />
                    </div>

                    <div className="text-[22px] sm:text-[24px] font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)] tracking-tight leading-tight">
                      {metricMeta.format(itemSummary.value)}
                    </div>

                    <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold">
                      {isUp ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <ArrowUp weight="bold" className="h-3 w-3" />
                          {itemSummary.delta}%
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                          <ArrowDown weight="bold" className="h-3 w-3" />
                          {Math.abs(itemSummary.delta)}%
                        </span>
                      )}
                      <span className="text-[var(--shell-muted)] dark:text-[var(--shell-muted)] font-normal text-[10px]">
                        vs prior period
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Performance Line Chart */}
            <div className="pt-2 border-t border-[var(--shell-border)] dark:border-[var(--shell-border)]">
              <PerformanceChart data={data?.time_series ?? []} metric={selectedMetric} />
            </div>
          </div>

          {/* 4. Content Performance Section */}
          <div className="bg-white dark:bg-[var(--shell-surface)] rounded-lg shadow-xs p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--shell-border)] dark:border-[var(--shell-border)] pb-3">
              <div>
                <h2 className="text-[17px] font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)]">
                  Content Performance
                </h2>
                <p className="text-[12px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
                  Recent posts and stories performance
                </p>
              </div>
              <Link
                to="/app/feed"
                className="text-xs font-semibold text-[var(--shell-accent)] dark:text-[var(--shell-accent)] hover:underline flex items-center gap-1"
              >
                <span>View all posts</span>
                <ArrowRight weight="bold" className="h-3 w-3" />
              </Link>
            </div>

            {/* Content Rows */}
            {(!data?.top_content || data.top_content.length === 0) ? (
              <p className="text-xs text-[var(--shell-muted)] dark:text-[var(--shell-muted)] py-4 text-center">
                No recent posts published in this date range.
              </p>
            ) : (
              <div className="divide-y divide-[#DADDE1] dark:divide-[#3E4042]">
                {data.top_content.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 py-3 hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)] -mx-2 px-2 rounded-lg transition-colors"
                  >
                    {/* Thumbnail: 76px x 52px, 6px radius */}
                    <div className="w-[76px] h-[52px] rounded-[6px] overflow-hidden bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] shrink-0 flex items-center justify-center text-muted-foreground">
                      {post.thumbnail ? (
                        <img
                          src={post.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText weight="fill" className="h-5 w-5 text-[var(--shell-muted)] dark:text-[var(--shell-muted)]" />
                      )}
                    </div>

                    {/* Post Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[var(--shell-text)] dark:text-[var(--shell-text)] line-clamp-1 leading-snug">
                        {post.title}
                      </p>
                      <p className="text-[11px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)] mt-0.5 flex items-center gap-2">
                        <span>{formatCompactTime(post.created_at)}</span>
                        <span>·</span>
                        <span>Post</span>
                      </p>
                    </div>

                    {/* Metrics Values */}
                    <div className="flex items-center gap-4 sm:gap-6 text-right shrink-0">
                      <div>
                        <p className="text-[13px] font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)]">
                          {post.views.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">Views</p>
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)]">
                          {post.engagement.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">Engaged</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Audience Insights Section */}
          <div className="bg-white dark:bg-[var(--shell-surface)] rounded-lg shadow-xs p-4 sm:p-5 space-y-4">
            <div className="border-b border-[var(--shell-border)] dark:border-[var(--shell-border)] pb-3">
              <h2 className="text-[17px] font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)]">
                Audience Insights
              </h2>
              <p className="text-[12px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
                Growth, retention, and geographic reach
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Follower Growth & Retention */}
              <div className="p-3.5 rounded-lg bg-[var(--shell-subtle)] dark:bg-[#2F3031] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
                    Followers Retention
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    +{data?.audience?.growth_rate ?? 0}% growth
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[var(--shell-text)] dark:text-[var(--shell-text)] font-medium">Returning Viewers</span>
                      <span className="font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)]">
                        {data?.audience?.returning_percentage ?? 0}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--shell-hover)] dark:bg-[var(--shell-hover)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--shell-accent-solid)]"
                        style={{ width: `${data?.audience?.returning_percentage ?? 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs border-t border-[var(--shell-border)] dark:border-[var(--shell-border)]">
                    <span className="text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">Peak Activity Hours:</span>
                    <span className="font-semibold text-[var(--shell-text)] dark:text-[var(--shell-text)] flex items-center gap-1">
                      <Clock weight="fill" className="h-3.5 w-3.5 text-[var(--shell-accent)]" />
                      {data?.audience?.activity_peak ?? "No recent activity"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Top Locations */}
              <div className="p-3.5 rounded-lg bg-[var(--shell-subtle)] dark:bg-[#2F3031] space-y-2">
                <span className="text-xs font-semibold text-[var(--shell-muted)] dark:text-[var(--shell-muted)] block mb-1">
                  Top Locations
                </span>
                {(!data?.audience?.top_locations || data.audience.top_locations.length === 0) ? (
                  <p className="text-xs text-[var(--shell-muted)] dark:text-[var(--shell-muted)] py-2 text-center">
                    No location data available yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.audience.top_locations.map((loc) => (
                      <div key={loc.name}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-[var(--shell-text)] dark:text-[var(--shell-text)] font-medium">{loc.name}</span>
                          <span className="font-bold text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">{loc.percentage}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[var(--shell-hover)] dark:bg-[var(--shell-hover)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--shell-accent-solid)]"
                            style={{ width: `${loc.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT CONTEXT PANEL (280–320px) ── */}
        <div className="w-full lg:w-[300px] xl:w-[320px] shrink-0 space-y-4">
          {/* 1. Profile Status Widget */}
          <div className="bg-white dark:bg-[var(--shell-surface)] rounded-lg shadow-xs p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full overflow-hidden bg-[var(--shell-accent-solid)] flex items-center justify-center text-white font-bold text-sm shrink-0">
                {data?.profile_status?.avatar ? (
                  <img
                    src={data.profile_status.avatar}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (data?.profile_status?.name ?? user?.name ?? "U").charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)] truncate leading-tight">
                  {data?.profile_status?.name ?? user?.name}
                </p>
                <p className="text-[11px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)] truncate leading-normal">
                  @{data?.profile_status?.username ?? user?.username ?? "creator"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 py-2 border-y border-[var(--shell-border)] dark:border-[var(--shell-border)] text-center">
              <div>
                <p className="text-[14px] font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)]">
                  {(data?.profile_status?.profile_views ?? 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">Views</p>
              </div>
              <div>
                <p className="text-[14px] font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)]">
                  {(data?.profile_status?.followers ?? 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">Followers</p>
              </div>
              <div>
                <p className="text-[14px] font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)]">
                  {data?.profile_status?.engagement_rate ?? "0%"}
                </p>
                <p className="text-[10px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">Engagement</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[var(--shell-muted)] dark:text-[var(--shell-muted)] font-medium">Weekly Growth Goal</span>
                <span className="font-bold text-[var(--shell-accent)] dark:text-[var(--shell-accent)]">
                  {data?.profile_status?.weekly_progress ?? 0}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--shell-hover)] dark:bg-[var(--shell-hover)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--shell-accent-solid)]"
                  style={{ width: `${data?.profile_status?.weekly_progress ?? 0}%` }}
                />
              </div>
            </div>

            <Link
              to="/app/settings/profile"
              className="block text-center text-xs font-semibold text-[var(--shell-accent)] dark:text-[var(--shell-accent)] hover:underline pt-1"
            >
              See public profile →
            </Link>
          </div>

          {/* 2. Professional Creator Tools */}
          <div className="bg-white dark:bg-[var(--shell-surface)] rounded-lg shadow-xs p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--shell-muted)] dark:text-[var(--shell-muted)] mb-2">
              Creator Tools
            </h3>

            <div className="space-y-1">
              {[
                { label: "Create post", url: "/app/feed", icon: Plus },
                { label: "Community hub", url: "/app/communities", icon: Users },
                { label: "Brand deals & pitches", url: "/app/brand-deals", icon: Handshake },
                { label: "Content calendar", url: "/app/marketing", icon: Calendar },
              ].map((tool) => (
                <Link
                  key={tool.label}
                  to={tool.url}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)] text-[13px] font-medium text-[var(--shell-text)] dark:text-[var(--shell-text)] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <tool.icon weight="fill" className="h-4 w-4 text-[var(--shell-accent)] dark:text-[var(--shell-accent)]" />
                    <span>{tool.label}</span>
                  </div>
                  <ArrowRight weight="bold" className="h-3 w-3 text-[var(--shell-muted)] dark:text-[var(--shell-muted)]" />
                </Link>
              ))}
            </div>
          </div>

          {/* 3. Planned Content Calendar Preview */}
          <div className="bg-white dark:bg-[var(--shell-surface)] rounded-lg shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
                Planned Content
              </h3>
              <Link
                to="/app/marketing"
                className="text-[11px] font-semibold text-[var(--shell-accent)] dark:text-[var(--shell-accent)] hover:underline"
              >
                Calendar
              </Link>
            </div>

            {(!data?.planned_content || data.planned_content.length === 0) ? (
              <div className="flex flex-col items-center justify-center text-center py-4 space-y-2">
                <Calendar weight="fill" className="h-6 w-6 text-[var(--shell-muted)] dark:text-[var(--shell-muted)] mx-auto opacity-40" />
                <p className="text-[11px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)] text-center mx-auto">
                  No upcoming posts scheduled
                </p>
                <Link to="/app/feed" className="inline-flex justify-center">
                  <button className="px-3 py-1 rounded-md bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] hover:bg-[var(--shell-hover)] text-xs font-semibold text-[var(--shell-text)] dark:text-[var(--shell-text)] transition-colors">
                    + Schedule post
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {data.planned_content.map((item) => {
                  const d = item.date ? new Date(item.date) : null;
                  const dayStr = d
                    ? d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })
                    : "Scheduled";
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--shell-subtle)] dark:bg-[#2F3031]"
                    >
                      <div className="px-2 py-1 rounded bg-[var(--shell-accent-solid)]/10 text-[var(--shell-accent)] font-bold text-[10px] shrink-0 text-center leading-tight">
                        {dayStr}
                      </div>
                      <p className="text-[12px] font-medium text-[var(--shell-text)] dark:text-[var(--shell-text)] truncate">
                        {item.title}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
export default AnalyticsPage;
