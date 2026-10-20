/**
 * Hidden staff sign-in path. The page is not linked from anywhere on the site,
 * is not listed in robots.txt and carries a noindex tag. The path is not a secret:
 * it ships in the client route table, so anyone who reads the bundle can find it.
 * Access control is the login itself (lockout, disabled accounts refused).
 *
 * Set STAFF_LOGIN_PATH at build time (routes are fixed when the app is built).
 * Use a random value per deployment, not the default below. Any value of 16 to
 * 128 characters from [A-Za-z0-9_-] is accepted. Leading and trailing slashes are ignored.
 */

// Random default, generated once. Not derived from any domain or name.
export const DEFAULT_STAFF_LOGIN_PATH = "c9359b966b1e96f2c13e03d489b80441";

const PATH_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export function resolveStaffLoginPath(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/^\/+|\/+$/g, "");
  const value = trimmed === "" ? DEFAULT_STAFF_LOGIN_PATH : trimmed;

  if (!PATH_PATTERN.test(value)) {
    throw new Error(
      "STAFF_LOGIN_PATH must be 16 to 128 characters using only letters, digits, '-' or '_'.",
    );
  }

  return value;
}
