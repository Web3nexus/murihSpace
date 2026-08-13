export const HELP_API_BASE =
  (import.meta.env.VITE_HELP_API_URL ?? "http://127.0.0.1:8123/api/public/help").replace(/\/+$/, "");

export interface HelpCategory {
  id: string;
  slug: string;
  name: string;
  label: string;
  blurb: string;
  icon: string | null;
  article_count?: number;
  children: HelpCategory[];
}

export interface HelpArticleListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string | null;
  category_name: string | null;
  keywords: string[] | null;
  tags: string[] | null;
  featured: boolean;
  updated_at: string | null;
  published_at: string | null;
}

export interface HelpSection {
  heading: string;
  body: string;
}

export interface HelpArticle extends HelpArticleListItem {
  body: string;
  sections: HelpSection[];
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  related: HelpArticleListItem[];
}

export interface HelpSearchResult {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string | null;
  category_name: string | null;
  keywords: string[] | null;
  score?: number;
  updated_at: string | null;
}

export function apiUrl(path: string): string {
  return `${HELP_API_BASE}${path}`;
}

export class HelpApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "HelpApiError";
  }
}

async function helpFetch(path: string, init?: RequestInit) {
  const signal = init?.signal ?? AbortSignal.timeout(15000);
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    signal,
  });
  if (!res.ok) {
    throw new HelpApiError(`Help API ${res.status} for ${path}`, res.status);
  }
  return res;
}

export async function fetchHelp<T>(path: string, init?: RequestInit): Promise<T[]> {
  const res = await helpFetch(path, init);
  const json = await res.json();
  return json?.data ?? [];
}

export async function fetchHelpSingle<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await helpFetch(path, init);
  const json = await res.json();
  return json?.data as T;
}

export function getCategories(): Promise<HelpCategory[]> {
  return fetchHelp<HelpCategory>("/categories");
}

export function getArticles(params?: { category?: string; featured?: boolean }): Promise<HelpArticleListItem[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set("category", params.category);
  if (params?.featured) qs.set("featured", "1");
  const q = qs.toString();
  return fetchHelp<HelpArticleListItem>(`/articles${q ? `?${q}` : ""}`);
}

export function getArticle(slug: string): Promise<HelpArticle> {
  return fetchHelpSingle<HelpArticle>(`/articles/${encodeURIComponent(slug)}`);
}

export function searchHelp(query: string, limit = 8): Promise<HelpSearchResult[]> {
  const qs = new URLSearchParams({ q: query, limit: String(limit) });
  return fetchHelp<HelpSearchResult>(`/search?${qs.toString()}`);
}

export async function sendFeedback(slug: string, helpful: boolean, comment?: string): Promise<void> {
  await helpFetch(`/articles/${encodeURIComponent(slug)}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ helpful, comment: comment ?? null }),
  });
}

export interface HelpTicketContext {
  search_query?: string;
  attempted_article?: string;
  current_page?: string;
  user_id?: number;
  device?: string;
}

export interface CreateHelpTicketInput {
  subject: string;
  description: string;
  email: string;
  category_slug?: string;
  priority?: string;
  context?: HelpTicketContext;
}

export async function createHelpTicket(input: CreateHelpTicketInput): Promise<{ ticket_number: string }> {
  const res = await helpFetch("/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  return { ticket_number: json?.data?.ticket_number ?? "" };
}

/**
 * Best-effort device/app metadata captured from the browser so support can see
 * what platform the visitor was on. Never throws — all values degrade safely.
 */
export function deviceMetadata(): string {
  const parts: string[] = [];
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const scr = typeof screen !== "undefined" ? screen : undefined;

  if (nav?.platform) parts.push(nav.platform);
  if (scr?.width && scr?.height) parts.push(`${scr.width}×${scr.height}`);
  if (nav?.userAgent) {
    const ua = nav.userAgent;
    const match = ua.match(/\(([^)]+)\)/);
    if (match?.[1]) parts.push(match[1]);
  }
  if (nav?.language) parts.push(nav.language);

  return [...new Set(parts)].join(" / ");
}