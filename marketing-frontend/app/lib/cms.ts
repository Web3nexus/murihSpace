export const CMS_API_BASE = (
  import.meta.env.VITE_CMS_API_URL ?? "http://127.0.0.1:8123/api/public/cms"
).replace(/\/+$/, "");

export const ANNOUNCEMENTS_API_BASE = (
  import.meta.env.VITE_ANNOUNCEMENTS_API_URL ?? "http://127.0.0.1:8123/api/public/announcements"
).replace(/\/+$/, "");

export interface CmsContentItem {
  id: string;
  slug: string;
  section: string;
  title: string | null;
  excerpt: string | null;
  body: string | null;
  content: Record<string, unknown> | null;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string | null;
  published_at: string | null;
}

export interface CmsSectionResponse {
  data: CmsContentItem[];
}

export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  featured: boolean;
  published_at: string | null;
}

/**
 * Fetch the published items for a CMS section. Returns null when the API is
 * unreachable so callers can fall back to static defaults.
 */
export async function fetchCmsSection(section: string): Promise<CmsContentItem[] | null> {
  try {
    const res = await fetch(`${CMS_API_BASE}/${encodeURIComponent(section)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as CmsSectionResponse;
    return json?.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchAnnouncements(): Promise<Announcement[] | null> {
  try {
    const res = await fetch(`${ANNOUNCEMENTS_API_BASE}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: Announcement[] };
    return json?.data ?? null;
  } catch {
    return null;
  }
}
