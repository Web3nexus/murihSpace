/**
 * Lightweight multi-account registry for the web app.
 *
 * A small list of previously signed-in accounts (basic profile only) kept in
 * localStorage so the account menu can show who has used this browser.
 *
 * It holds no credentials. Web sessions live in the httpOnly cookie, so
 * switching to another account means signing in to it again.
 */

export interface SavedAccount {
  id: number;
  name: string;
  email: string;
  username?: string;
  role: string;
  avatar?: string;
}

const STORAGE_KEY = "murihspace-saved-accounts";
const MAX_ACCOUNTS = 5;

/** Strips any credential an older build stored alongside the profile fields. */
function toProfileOnly(entry: Record<string, unknown>): SavedAccount {
  const profile: Record<string, unknown> = { ...entry };
  delete profile.token;
  return profile as unknown as SavedAccount;
}

export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const accounts = parsed
      .filter((a): a is Record<string, unknown> => a !== null && typeof a === "object" && typeof a.id === "number")
      .map(toProfileOnly);
    // Rewrite the list once if it still carries stored tokens from an older build.
    if (parsed.some((a) => a && typeof a === "object" && "token" in a)) {
      writeSavedAccounts(accounts);
    }
    return accounts;
  } catch {
    return [];
  }
}

function writeSavedAccounts(accounts: SavedAccount[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts.slice(0, MAX_ACCOUNTS)));
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

/** Inserts (or refreshes) an account, most-recent first, capped at [MAX_ACCOUNTS]. */
export function saveSavedAccount(account: SavedAccount): SavedAccount[] {
  const accounts = getSavedAccounts().filter((a) => a.id !== account.id);
  accounts.unshift(toProfileOnly({ ...account }));
  const next = accounts.slice(0, MAX_ACCOUNTS);
  writeSavedAccounts(next);
  return next;
}

export function removeSavedAccount(id: number): SavedAccount[] {
  const next = getSavedAccounts().filter((a) => a.id !== id);
  writeSavedAccounts(next);
  return next;
}

export function clearSavedAccounts(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
