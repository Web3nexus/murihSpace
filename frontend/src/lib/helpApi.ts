import { articleBodyText } from "@/data/helpCenter";
import type { HelpArticle, HelpCategory } from "@/data/helpCenter";

export const HELP_API_URL: string | undefined = String(
  import.meta.env.VITE_HELP_API_URL ?? ""
).trim() || undefined;

interface ApiCategory {
  id?: string;
  slug?: string;
  name?: string;
  label?: string;
  blurb?: string | null;
}

interface ApiArticleListItem {
  id?: string;
  slug?: string;
  title?: string;
  excerpt?: string | null;
  category?: string | null;
  keywords?: string[];
}

interface ApiArticleDetail extends ApiArticleListItem {
  sections?: { heading?: string; body?: string }[];
  related?: { id?: string; slug?: string }[];
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Help API responded with HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

/**
 * Load the full help center catalog from the public help API.
 *
 * The article list endpoint omits body/sections/related, so each article's
 * detail is fetched as well. Throws on any failure — callers decide how to
 * fall back (e.g. to the static snapshot bundled with the app).
 */
export async function loadHelpContent(timeoutMs = 15000): Promise<{
  categories: HelpCategory[];
  articles: HelpArticle[];
}> {
  if (!HELP_API_URL) {
    throw new Error("VITE_HELP_API_URL is not configured");
  }

  const base = HELP_API_URL.replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const [categoriesRaw, articlesRaw] = (await Promise.all([
      fetchJson(`${base}/categories`, controller.signal),
      fetchJson(`${base}/articles`, controller.signal),
    ])) as [ApiCategory[], ApiArticleListItem[]];

    const categories: HelpCategory[] = (categoriesRaw ?? [])
      .map((c) => ({
        id: (c.id ?? c.slug ?? "").trim(),
        label: (c.name ?? c.label ?? c.id ?? "").trim(),
        blurb: (c.blurb ?? "").trim(),
      }))
      .filter((c) => c.id.length > 0);

    const details = await Promise.all(
      (articlesRaw ?? []).map((a) =>
        fetchJson(
          `${base}/articles/${encodeURIComponent(a.id ?? a.slug ?? "")}`,
          controller.signal
        ).catch(() => null)
      )
    );

    const articles: HelpArticle[] = (articlesRaw ?? [])
      .map((a, i) => {
        const d = details[i] as ApiArticleDetail | null;
        return {
          id: (a.id ?? a.slug ?? "").trim(),
          categoryId: ((d?.category ?? a.category) ?? "").trim(),
          title: (d?.title ?? a.title ?? "").trim(),
          excerpt: (d?.excerpt ?? a.excerpt ?? "").trim(),
          keywords: (d?.keywords ?? a.keywords ?? []).map((k) => String(k).trim()),
          sections: (d?.sections ?? []).map((s) => ({
            heading: (s.heading ?? "").trim(),
            body: (s.body ?? "").trim(),
          })),
          related: (d?.related ?? [])
            .map((r) => (r.id ?? r.slug ?? "").trim())
            .filter((slug) => slug.length > 0),
        };
      })
      .filter((a) => a.id.length > 0);

    return { categories, articles };
  } finally {
    clearTimeout(timer);
  }
}

const STOPWORDS = new Set([
  "the", "and", "for", "how", "do", "i", "a", "an", "to", "my", "can", "me",
  "on", "in", "with", "what", "is", "are", "of", "it", "this", "that",
]);

/**
 * Keyword-scored search over an explicit article list, mirroring the static
 * `searchHelp` helper so search behaves identically in API mode.
 */
export function searchArticles(
  articles: HelpArticle[],
  query: string,
  limit = 4
): HelpArticle[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

  if (tokens.length === 0) return [];

  const scored = articles
    .map((article) => {
      const haystack = articleBodyText(article).toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (haystack.includes(t)) score += 1;
      }
      return { article, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);

  return scored.slice(0, limit).map((x) => x.article);
}
