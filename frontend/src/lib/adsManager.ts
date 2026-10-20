import { env } from "@/config/env";
import { safeHref } from "@/lib/safeUrl";

/**
 * Address of the Ads Manager web app, from VITE_ADS_MANAGER_URL.
 *
 * Returns undefined when the variable is blank or is not an absolute http(s)
 * URL that passes safeHref. Callers hide the entry point in that case rather
 * than link to an unknown target.
 */
export function getAdsManagerHref(raw: string = env.VITE_ADS_MANAGER_URL): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
  return safeHref(value);
}
