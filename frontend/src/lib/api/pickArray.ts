/**
 * Read a list out of an API response whose envelope varies:
 * the array itself, `data`, `data.data`, or one of the named `keys` at either level.
 */
export function pickArray<T>(val: T[], keys?: readonly string[]): T[];
export function pickArray<T = unknown>(val: unknown, keys?: readonly string[]): T[];
export function pickArray(val: unknown, keys: readonly string[] = []): unknown[] {
  if (Array.isArray(val)) return val;
  const top = asRecord(val);
  if (Array.isArray(top.data)) return top.data;
  const inner = asRecord(top.data);
  if (Array.isArray(inner.data)) return inner.data;
  for (const k of keys) {
    if (Array.isArray(top[k])) return top[k] as unknown[];
  }
  for (const k of keys) {
    if (Array.isArray(inner[k])) return inner[k] as unknown[];
  }
  return [];
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
