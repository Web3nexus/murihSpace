import { EMOJI_MANIFEST, EMOJI_KEYS } from "@/lib/emoji-manifest";

// Compile the 631 emoji keys into a single regex with a capture group, so
// `text.split(EMOJI_REGEX)` yields alternating [text, emoji, text, ...].
// Keys are sorted longest-first so multi-codepoint sequences (ZWJ family
// emoji, VS16 selectors) match before their shorter prefixes.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const EMOJI_REGEX = new RegExp(
  `(${EMOJI_KEYS.map(escapeRegExp).join("|")})`,
  "g"
);

/** Strips `/api/v1`/`/api` to get the API origin that also serves `/emoji/`. */
export function apiOrigin(): string {
  const base =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    (import.meta.env.VITE_API_URL as string | undefined) ||
    "http://localhost:8000/api/v1";
  return base
    .replace(/\/api\/v1\/?$/, "")
    .replace(/\/api\/?$/, "")
    .replace(/\/+$/, "");
}

/** Full URL for an emoji's animated webp, or null when the pack has no asset. */
export function emojiAssetUrl(emoji: string): string | null {
  const rel = EMOJI_MANIFEST[emoji];
  if (!rel) return null;
  const encoded = rel
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `${apiOrigin()}/emoji/${encoded}`;
}

/**
 * Returns the emojis when [text] contains *only* emoji (plus whitespace) and no
 * more than [max] of them — the Telegram "jumbo" case drawn large instead of at
 * text size. Returns null otherwise.
 */
export function emojiOnlySequence(text: string, max = 3): string[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const matches = trimmed.match(EMOJI_REGEX);
  if (!matches || matches.length === 0 || matches.length > max) return null;
  if (trimmed.replace(EMOJI_REGEX, "").trim() !== "") return null;
  return matches;
}

/** True when [text] is made up exclusively of emoji (and whitespace), with no
 *  limit on how many — used to render such messages without the chat bubble. */
export function isEmojiOnlyMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const matches = trimmed.match(EMOJI_REGEX);
  if (!matches || matches.length === 0) return false;
  return trimmed.replace(EMOJI_REGEX, "").trim() === "";
}