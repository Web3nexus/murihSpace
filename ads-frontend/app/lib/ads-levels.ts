import type { AdsLevel } from "./ads-format";

export type ColumnKey = "budget" | "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "conversions";

export const METRIC_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "budget", label: "Budget" },
  { key: "spend", label: "Spend" },
  { key: "impressions", label: "Impressions" },
  { key: "clicks", label: "Clicks" },
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "CPC" },
  { key: "conversions", label: "Conversions" },
];

export interface LevelConfig {
  level: AdsLevel;
  title: string;
  singular: string;
  nameHeader: string;
  endpoint: string;
  createTo?: string;
  emptyTitle: string;
  emptyCopy: string;
  /** Metric and budget columns this level shows, in display order. */
  columns: ColumnKey[];
}

export const LEVELS: Record<AdsLevel, LevelConfig> = {
  campaigns: {
    level: "campaigns",
    title: "Campaigns",
    singular: "campaign",
    nameHeader: "Campaign",
    endpoint: "/campaigns",
    createTo: "/campaigns/create/objective",
    emptyTitle: "No data yet",
    emptyCopy: "No campaigns yet. Create a campaign to start seeing delivery here.",
    columns: ["budget", "spend", "impressions", "clicks", "ctr", "cpc", "conversions"],
  },
  "ad-groups": {
    level: "ad-groups",
    title: "Ad groups",
    singular: "ad group",
    nameHeader: "Ad group",
    endpoint: "/ad-groups",
    createTo: "/campaigns/create/objective",
    emptyTitle: "No data yet",
    emptyCopy: "No ad groups yet. Ad groups are created inside a campaign.",
    columns: ["budget", "spend", "impressions", "clicks", "ctr", "cpc", "conversions"],
  },
  ads: {
    level: "ads",
    title: "Ads",
    singular: "ad",
    nameHeader: "Ad",
    endpoint: "/ads",
    createTo: "/campaigns/create/objective",
    emptyTitle: "No data yet",
    emptyCopy: "No ads yet. Ads are added to an ad group when you create a campaign.",
    columns: ["spend", "impressions", "clicks", "ctr", "cpc", "conversions"],
  },
};
