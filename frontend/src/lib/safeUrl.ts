const ALLOWED_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/**
 * Returns `url` when it is safe to use as an `href`, otherwise `undefined`.
 *
 * Content-supplied links (post CTAs, link-in-bio buttons, attachments) can hold
 * `javascript:` or `data:` URLs, which run script when clicked. Relative paths
 * and schemeless values are left to the browser as they are.
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  // Browsers drop control characters (tabs, newlines) before parsing a URL, so
  // "java\tscript:" must be judged as "javascript:".
  const cleaned = Array.from(trimmed)
    .filter((ch) => ch.charCodeAt(0) > 0x1f && ch.charCodeAt(0) !== 0x7f)
    .join("");
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(cleaned);
  if (scheme && !ALLOWED_SCHEMES.has(scheme[1]!.toLowerCase())) return undefined;
  return trimmed;
}
