/**
 * Canonical deep-link contract for MurihSpace.
 *
 * Every shareable entity has exactly one canonical path shape. These same
 * shapes are claimed by the mobile app on iOS and Android (Universal Links /
 * App Links), so a link opened with the app installed lands in-app, and opened
 * without it lands on the SPA page registered here.
 *
 *   content     canonical path   public?   web route
 *   ---------   ---------------   -------   -------------------------
 *   live        /live/{token}     yes       PublicLivePage
 *   meeting     /m/{code}         no        PublicMeetingPage
 *   event       /e/{id}           yes       PublicEventPage
 *   product     /p/{id}           yes       PublicProductPage
 *   chat        /chat/{id}        no        -> /app/messages
 *   profile     /u/{username}     yes       PublicProfilePage
 *   community   /c/{slug}         yes       CommunityPreviewPage
 *   link-in-bio /l/{username}     yes       PublicLinkInBioPage
 *
 * Keep in sync with `mobile/lib/config/deep_links.dart`.
 */

export type DeepLinkType =
  | "live"
  | "meeting"
  | "event"
  | "product"
  | "chat"
  | "profile"
  | "community"
  | "linkInBio"
  | "storefront"
  | "unknown";

export interface DeepLinkTarget {
  type: DeepLinkType;
  identifier: string;
  query: string;
  requiresAuth: boolean;
  /** Canonical in-app/web location for this target. */
  route: string;
}

/** Android package name and iOS bundle id. Must match the association files. */
export const APP_ID = "com.murihspace.mobile";

/** Custom scheme. Legacy only — never emit this when sharing. */
export const APP_SCHEME = "murihspace";

export const PATHS = {
  live: "/live",
  meeting: "/m",
  event: "/e",
  product: "/p",
  chat: "/chat",
  profile: "/u",
  community: "/c",
  linkInBio: "/l",
  storefront: "/store",
} as const;

/** Every first path segment the mobile app claims. Mirrors AndroidManifest. */
export const APP_CLAIMED_PREFIXES = Object.values(PATHS);

/**
 * Resolves the SPA origin that shared links must point at.
 *
 * Staging builds share staging links and production builds share production
 * links, so a link pasted from a staging device never leaks into production
 * chat. `VITE_APP_URL` wins when set, which is how each deployed build is
 * pinned; otherwise the current hostname decides.
 */
export function siteUrl(): string {
  const configured = import.meta.env.VITE_APP_URL;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    const { origin, hostname } = window.location;
    // localhost must never be shared — fall back to the hosted origin.
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "https://web.murihspace.com";
    }
    if (hostname.includes("staging")) return origin;
    return "https://web.murihspace.com";
  }
  return "https://web.murihspace.com";
}

/** Strips a leading `@` from a handle and trims surrounding whitespace. */
export function normaliseHandle(username: string): string {
  return username.trim().replace(/^@/, "");
}

// ── Builders ──────────────────────────────────────────────────────

export function liveUrl(token: string, query?: Record<string, string | undefined>): string {
  return withQuery(`${PATHS.live}/${encodeURIComponent(token)}`, query);
}

export function meetingUrl(code: string): string {
  return `${PATHS.meeting}/${encodeURIComponent(code.trim().toLowerCase())}`;
}

export function eventUrl(id: string | number): string {
  return `${PATHS.event}/${encodeURIComponent(String(id))}`;
}

export function productUrl(id: string | number, kind: "digital" | "physical"): string {
  // Physical and digital products live in separate tables, so they can share a
  // numeric id. An unprefixed `/p/5` resolves physical-first and would send the
  // recipient to a different product than the one that was shared.
  const prefix = kind === "digital" ? "d_" : "p_";
  return `${PATHS.product}/${prefix}${encodeURIComponent(String(id))}`;
}

export function chatUrl(conversationId: string | number): string {
  return `${PATHS.chat}/${encodeURIComponent(String(conversationId))}`;
}

export function profileUrl(username: string): string {
  return `${PATHS.profile}/${encodeURIComponent(normaliseHandle(username))}`;
}

export function communityUrl(slug: string): string {
  return `${PATHS.community}/${encodeURIComponent(slug.trim())}`;
}

export function linkInBioUrl(username: string): string {
  return `${PATHS.linkInBio}/${encodeURIComponent(normaliseHandle(username))}`;
}

export function storefrontUrl(shortCode: string): string {
  return `${PATHS.storefront}/${encodeURIComponent(shortCode.trim())}`;
}

/** Absolute, shareable form of any canonical path. */
export function absolute(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = siteUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function withQuery(path: string, query?: Record<string, string | undefined>): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

// ── Parser ────────────────────────────────────────────────────────

/**
 * Normalises an inbound link to its path + query.
 *
 * Accepts every shape a chat message or the OS can hand us:
 *   `https://web.murihspace.com/live/abc?x=1`
 *   `murihspace://live/abc`, `murihspace:///live/abc`
 *   `/live/abc`
 *   `web.murihspace.com/live/abc`
 */
export function normaliseLink(raw: string): { path: string; query: string } {
  let input = (raw ?? "").trim();
  if (!input) return { path: "/", query: "" };

  const lower = input.toLowerCase();
  if (lower.startsWith(`${APP_SCHEME}://`)) {
    input = input.slice(APP_SCHEME.length + 3);
  } else if (lower.startsWith(`${APP_SCHEME}:`)) {
    input = input.slice(APP_SCHEME.length + 1);
  }

  if (input.startsWith("/")) return splitPath(input);

  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(input);
  if (schemeMatch && !/^https?$/i.test(schemeMatch[1])) {
    return { path: "/", query: "" };
  }

  if (!/^https?:\/\//i.test(input)) {
    if (!input.includes(".")) return splitPath(`/${input}`);
    input = `https://${input}`;
  }

  try {
    const url = new URL(input);
    return { path: url.pathname, query: url.search.replace(/^\?/, "") };
  } catch {
    return { path: "/", query: "" };
  }
}

function splitPath(input: string): { path: string; query: string } {
  const [path, ...rest] = input.split("?");
  return { path: path || "/", query: rest.join("?") };
}

/**
 * Resolves any inbound link into a canonical target.
 *
 * Recognises canonical shapes first, then legacy aliases, so links already
 * shared in the wild keep resolving. Returns `unknown` rather than throwing.
 */
export function resolveDeepLink(raw: string): DeepLinkTarget {
  const { path, query } = normaliseLink(raw);
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return unknown();

  const first = segments[0]!;
  const second = segments[1] ?? "";
  const id = (index = 1) => segments[index];

  const make = (
    type: DeepLinkType,
    identifier: string,
    route: string,
    requiresAuth = false,
  ): DeepLinkTarget => ({
    type,
    identifier,
    query,
    requiresAuth,
    // Chat's route already carries `?conversation=`, so appending the inbound
    // query with a second `?` would drop everything after it.
    route: query ? `${route}${route.includes("?") ? "&" : "?"}${query}` : route,
  });

  // Canonical short forms.
  if (first === "m" || first === "meeting") {
    const code = id();
    if (code && code !== "instant") {
      return make("meeting", code.toLowerCase(), `${PATHS.meeting}/${code.toLowerCase()}`, true);
    }
  } else if (first === "e" && id()) {
    return make("event", id()!, `${PATHS.event}/${id()}`);
  } else if (first === "p" && id()) {
    return make("product", id()!, `${PATHS.product}/${id()}`);
  } else if (first === "chat" && id()) {
    return make("chat", id()!, `/app/messages?conversation=${id()}`, true);
  } else if ((first === "l" || first === "bio") && id()) {
    const username = normaliseHandle(id()!);
    return make("linkInBio", username, `${PATHS.linkInBio}/${username}`);
  } else if ((first === "c" || first === "communities") && id()) {
    return make("community", id()!, `${PATHS.community}/${id()}`);
  } else if (first === "u" && id()) {
    const username = normaliseHandle(id()!);
    return make("profile", username, `${PATHS.profile}/${username}`);
  } else if (first === "live") {
    const token = second === "resolve" ? id(2) : id();
    if (token) return make("live", token, `${PATHS.live}/${token}`);
  } else if (first === "store") {
    const shortCode = id();
    if (shortCode) {
      // `/store/{code}/p/{id}` — the id sits in segments[3]; `second` is the
      // short code, so testing it for "p" silently resolved every one of these
      // links as a storefront and disagreed with the backend resolver.
      if (segments[2] === "p" && segments[3]) {
        return make("product", segments[3], `${PATHS.product}/${segments[3]}`);
      }
      return make("storefront", shortCode, `${PATHS.storefront}/${shortCode}`);
    }
  }

  // Legacy /app-prefixed aliases.
  if (first === "app" && segments.length > 2) {
    const section = segments[1]!;
    const value = segments[2]!;
    if (section === "live") {
      const tracking = new URLSearchParams(query).get("trackingId");
      if (tracking) return make("live", tracking, `${PATHS.live}/${tracking}`);
    } else if (
      (section === "meeting" || section === "meetings") &&
      value !== "instant"
    ) {
      // `instant` is the reserved "start now" route, not a room — excluding it
      // for both spellings keeps a shared `/app/meeting/instant` from being
      // read as an invite. The route is the canonical `/m/:code`, mirroring
      // `appRoute` on mobile.
      return make("meeting", value.toLowerCase(), `${PATHS.meeting}/${value.toLowerCase()}`, true);
    } else if (section === "events") {
      return make("event", value, `${PATHS.event}/${value}`);
    } else if (section === "conversation") {
      return make("chat", value, `/app/messages?conversation=${value}`, true);
    } else if (section === "community") {
      return make("community", value, `${PATHS.community}/${value}`);
    }
  }

  // Top-level legacy aliases.
  if (first === "events" && id() && id() !== "my") {
    return make("event", id()!, `${PATHS.event}/${id()}`);
  } else if (first === "products" && id()) {
    return make("product", id()!, `${PATHS.product}/${id()}`);
  } else if (first === "community" && id()) {
    return make("community", id()!, `${PATHS.community}/${id()}`);
  } else if (first === "meetings" && id() && id() !== "instant") {
    return make("meeting", id()!.toLowerCase(), `${PATHS.meeting}/${id()!.toLowerCase()}`, true);
  }

  return unknown();
}

function unknown(): DeepLinkTarget {
  return { type: "unknown", identifier: "", query: "", requiresAuth: false, route: "/" };
}

// ── Post-auth return ──────────────────────────────────────────────

/**
 * Whether `path` is a location the app may navigate back to after login.
 *
 * Mirrors `DeepLinks.isReturnableRoute` on mobile. Guards against
 * open-redirect abuse: only canonical in-app routes are honoured, never
 * absolute URLs, protocol-relative paths, or backslash tricks.
 */
export function isReturnableRoute(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
  if (path.length > 2048) return false;

  const lower = path.toLowerCase();
  const prefixes = [
    ...APP_CLAIMED_PREFIXES,
    "/app/",
    "/profile/",
    "/conversation/",
    "/community/",
    "/communities/",
    "/events/",
    "/products/",
    "/meeting",
    "/meetings/",
  ];
  // Match on a path-segment boundary. A bare `startsWith("/m")` would accept
  // `/marketplace` as a safe login destination, so each prefix is trimmed to
  // its segment and only an exact hit or a `/child` of it qualifies.
  return prefixes.some((prefix) => {
    const segment = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    return lower === segment || lower.startsWith(`${segment}/`);
  });
}

/** Sanitises a `returnTo` value, returning null when it is not safe. */
export function sanitiseReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  const candidate = value.trim();
  if (!isReturnableRoute(candidate)) return null;
  return candidate.replace(/\\/g, "/");
}