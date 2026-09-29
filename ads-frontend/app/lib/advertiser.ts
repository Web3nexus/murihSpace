/**
 * Resolve the real advertiser id stored during SSO login
 * (auth/sso.tsx). Callers must not hardcode an account id — every catalog,
 * product, campaign and audience call is scoped to the signed-in advertiser.
 */
export function getAdvertiserId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("advertiser_id") || "";
}