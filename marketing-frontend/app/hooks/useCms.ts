import { useEffect, useState } from "react";
import { fetchCmsSection, type CmsContentItem } from "../lib/cms";

interface UseCmsSectionResult {
  items: CmsContentItem[];
  loading: boolean;
}

/**
 * Load the published items for a CMS section once. Returns an empty array
 * while loading or when the CMS API is unreachable, so callers can render
 * their static defaults until live content arrives.
 */
export function useCmsSection(section: string): UseCmsSectionResult {
  const [items, setItems] = useState<CmsContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    fetchCmsSection(section).then((result) => {
      if (cancelled) return;
      setItems(result ?? []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [section]);

  return { items, loading };
}

/**
 * Pick the single content payload for a `single` section (e.g. homepage), or
 * null. Falls back to the default when no published content exists yet.
 */
export function useCmsSingle<T extends object>(
  section: string,
  fallback: T,
): { data: T; loading: boolean } {
  const { items, loading } = useCmsSection(section);

  if (items.length === 0) {
    return { data: fallback, loading };
  }

  return { data: (items[0]?.content ?? fallback) as T, loading };
}

/**
 * Pick the collection payloads for a `collection` section (e.g. features),
 * merging the per-item `content` with its `title`. Falls back to the default
 * array when no published content exists yet.
 */
export function useCmsCollection<T extends object>(
  section: string,
  fallback: T[],
): { data: T[]; loading: boolean } {
  const { items, loading } = useCmsSection(section);

  if (items.length === 0) {
    return { data: fallback, loading };
  }

  const merged = items
    .map((item) => ({ ...(item.content ?? {}), title: item.title }) as unknown as T)
    .filter((item) => item && typeof item === "object");

  return { data: merged.length > 0 ? merged : fallback, loading };
}
