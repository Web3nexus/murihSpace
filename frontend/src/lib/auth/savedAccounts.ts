/**
 * Lightweight multi-account registry for the web app.
 *
 * Mirrors the mobile client's saved-accounts store: a small list of
 * previously authenticated accounts (token + basic profile) kept in
 * localStorage so the user can switch profiles without a full re-login.
 */

export interface SavedAccount {
  id: number;
  name: string;
  email: string;
  username?: string;
  role: string;
  avatar?: string;
  token: string;
}

const STORAGE_KEY = "murihspace-saved-accounts";
const MAX_ACCOUNTS = 5;

export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is SavedAccount =>
        a && typeof a === "object" && typeof a.token === "string" && typeof a.id === "number"
    );
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
  const accounts = getSavedAccounts().filter(
    (a) => a.id !== account.id && a.token !== account.token
  );
  accounts.unshift(account);
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
