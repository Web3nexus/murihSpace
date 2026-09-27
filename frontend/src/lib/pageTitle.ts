export const BRAND = "MurihSpace";
export const BRAND_SEPARATOR = "|";
export const HOME_PAGE_NAME = "";
export const HOME_TITLE = `${BRAND} ${BRAND_SEPARATOR} Connect Safely`;

const ADMIN_ROOT = "/app/securegate";

const ACRONYMS: Record<string, string> = {
  ai: "AI",
  api: "API",
  cms: "CMS",
  cpa: "CPA",
  gdpr: "GDPR",
  id: "ID",
  kyc: "KYC",
  p2p: "P2P",
  sms: "SMS",
  tos: "TOS",
  url: "URL",
};

const LOWERCASE_MIDS = new Set([
  "a", "an", "and", "at", "by", "for", "in", "my", "of", "on", "or", "the", "to", "with",
]);

export function humanizeSegment(segment: string): string {
  const words = segment
    .replace(/[-_+]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (ACRONYMS[lower]) return ACRONYMS[lower];
      if (index > 0 && index < words.length - 1 && LOWERCASE_MIDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function humanizePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map(humanizeSegment)
    .filter(Boolean)
    .join(" · ");
}

const EXACT_TITLES: Record<string, string> = {
  "/": HOME_PAGE_NAME,
  "/login": "Sign In",
  "/register": "Create Account",
  "/forgot-password": "Forgot Password",
  "/securegate": "SecureGate",
  "/securegate/login": "Admin Sign In",
  "/social/callback": "Signing In",
  "/privacy": "Privacy Policy",
  "/terms": "Terms of Service",
  "/gdpr": "GDPR",
  "/cookies": "Cookie Policy",
  "/help": "Help Center",
  "/friends": "Friends",
  "/community": "Community",
  "/courses": "Courses",
  "/marketing": "Marketing",
  "/brand-deals": "Brand Deals",
  "/live-events": "Live Events",
  "/my-events": "My Events",
  "/audio-rooms": "Audio Rooms",
  "/subscriptions": "Subscriptions",
  "/communities": "Communities",
  "/app": "Home",
  "/app/ai-assistant": "AI Assistant",
  "/app/ai-settings": "AI Settings",
  "/app/kyc": "KYC Verification",
  "/app/storefront": "Storefront",
  "/app/link-in-bio": "Link in Bio",
  "/app/link-in-bio/domain": "Custom Domain",
  "/app/messages/support": "Support",
  "/app/requests/friends": "Friend Requests",
  "/app/courses/my": "My Courses",
  "/app/courses/studio": "Course Studio",
  "/app/subscriptions/mine": "My Subscriptions",
  "/app/subscriptions/my-subscriptions": "My Subscriptions",
  "/app/wallet/purchase-library": "Purchase Library",
  "/app/store/physical": "Physical Products",
  "/app/store/physical-products": "Physical Products",
  "/app/communities/events": "Community Events",
  "/app/gifts/wallet": "Gift Wallet",
  [ADMIN_ROOT]: "Admin Dashboard",
};

const PARAM_TITLES: Array<[string, string]> = [
  ["/reset-password/:token", "Reset Password"],
  ["/store/:shortCode/p/:id", "Product"],
  ["/store/:shortCode", "Storefront"],
  ["/products/:id", "Product"],
  ["/p/:id", "Product"],
  ["/media-kit/:creatorId", "Media Kit"],
  ["/live/:trackingId", "Live"],
  ["/communities/:slug", "Community"],
  ["/c/:slug", "Community"],
  ["/u/:username", "Profile"],
  ["/@:username", "Profile"],
  ["/l/:username", "Link in Bio"],
  ["/bio/:username", "Link in Bio"],
  ["/:username", "Profile"],
  ["/app/events/:id", "Event"],
  ["/app/groups/:slug", "Group"],
  ["/app/communities/:slug", "Community"],
  ["/app/communities/:slug/feed", "Community Feed"],
  ["/app/meeting/:roomCode", "Meeting"],
  ["/app/meeting/booking/:bookingId", "Booking"],
];

const SPLAT_TITLES: Record<string, string> = {
  "/friends": "Friends",
  "/community": "Community",
  "/courses": "Courses",
  "/marketing": "Marketing",
  "/brand-deals": "Brand Deals",
  "/live-events": "Live Events",
  "/subscriptions": "Subscriptions",
};

const SECTIONS: string[] = [
  "/app/analytics",
  "/app/brand-deals",
  "/app/communities",
  "/app/friends",
  "/app/gifts",
  "/app/marketing",
  "/app/settings",
  "/app/store",
  "/app/subscriptions",
  "/app/wallet",
];

const OPAQUE_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isOpaque(segment: string): boolean {
  if (OPAQUE_SEGMENT.test(segment)) return true;
  if (segment.length > 32) return true;
  return !/[aeiouy]/i.test(segment) && /^[a-z0-9]+$/i.test(segment);
}

export function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split("?")[0].split("#")[0];
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery || "/";
}

function segments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function matchParamPattern(path: string): string | null {
  const pathSegments = segments(path);
  for (const [pattern, name] of PARAM_TITLES) {
    const patternSegments = segments(pattern);
    if (patternSegments.length !== pathSegments.length) continue;
    const matches = patternSegments.every(
      (segment, index) => segment.startsWith(":") || segment === pathSegments[index],
    );
    if (matches) return name;
  }
  return null;
}

function matchSplat(path: string): string | null {
  const pathSegments = segments(path);
  if (pathSegments.length !== 2) return null;
  const section = "/" + pathSegments[0];
  return Object.prototype.hasOwnProperty.call(SPLAT_TITLES, section)
    ? SPLAT_TITLES[section]
    : null;
}

function matchSection(path: string): string | null {
  const pathSegments = segments(path);
  if (pathSegments.length < 3) return null;
  for (const section of SECTIONS) {
    const sectionSegments = segments(section);
    if (sectionSegments.length >= pathSegments.length) continue;
    const isMatch = sectionSegments.every((segment, index) => segment === pathSegments[index]);
    if (isMatch) {
      const rest = pathSegments.slice(sectionSegments.length).join("/");
      return `${humanizeSegment(sectionSegments[sectionSegments.length - 1])} · ${humanizePath(rest)}`;
    }
  }
  return null;
}

export function resolvePageName(pathname: string): string {
  const path = normalizePathname(pathname);

  if (Object.prototype.hasOwnProperty.call(EXACT_TITLES, path)) return EXACT_TITLES[path];

  const paramMatch = matchParamPattern(path);
  if (paramMatch !== null) return paramMatch;

  const splatMatch = matchSplat(path);
  if (splatMatch !== null) return splatMatch;

  if (path === ADMIN_ROOT || path.startsWith(ADMIN_ROOT + "/")) {
    const rest = path.slice(ADMIN_ROOT.length);
    const name = humanizePath(rest);
    return name ? `Admin · ${name}` : "Admin Dashboard";
  }

  const sectionMatch = matchSection(path);
  if (sectionMatch !== null) return sectionMatch;

  const last = segments(path).pop();
  if (!last || isOpaque(last)) return "";
  return humanizeSegment(last);
}

export function composePageTitle(pageName: string): string {
  const trimmed = pageName.trim();
  if (!trimmed) return HOME_TITLE;
  if (trimmed.toLowerCase().includes(BRAND.toLowerCase())) return trimmed;
  return `${trimmed} ${BRAND_SEPARATOR} ${BRAND}`;
}

export function resolvePageTitle(pathname: string): string {
  return composePageTitle(resolvePageName(pathname));
}

// A page that renders SEOHead owns its own title for the duration of that
// route. The registry is keyed by pathname because the route-level sync runs in
// a parent effect, which React fires *after* the page's own effect.
let activeClaim: { pathname: string; title: string } | null = null;

export function claimPageTitle(pathname: string, title: string): void {
  activeClaim = { pathname, title };
  document.title = title;
}

export function releasePageTitle(pathname: string): void {
  if (activeClaim && activeClaim.pathname === pathname) activeClaim = null;
  if (typeof window !== "undefined" && window.location.pathname === pathname && !activeClaim) {
    document.title = resolvePageTitle(pathname);
  }
}

export function isPageTitleClaimed(pathname: string): boolean {
  return activeClaim?.pathname === pathname;
}

export function syncRouteTitle(pathname: string): void {
  if (isPageTitleClaimed(pathname)) return;
  document.title = resolvePageTitle(pathname);
}
