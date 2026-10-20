/**
 * Central client logger.
 *
 * Development: writes to the browser console, as the direct console calls did before.
 * Production: writes nothing to the console. An entry is only passed to `send` (when one is
 * configured) after it has been redacted and bounded. No backend endpoint for client logs
 * exists yet, so the default production logger has no transport and sends nothing.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: unknown;
  time: string;
}

export interface LoggerOptions {
  /** Whether to write to the console. Defaults to the Vite dev flag. */
  dev: boolean;
  /** Console-like sink. Defaults to the global console. */
  sink?: Pick<Console, "debug" | "info" | "warn" | "error">;
  /** Receives redacted, bounded entries in production. Not set by default. */
  send?: (entry: LogEntry) => void;
}

export interface Logger {
  debug(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
}

const REDACTED = "[REDACTED]";
const MAX_STRING = 500;
const MAX_MESSAGE = 300;
const MAX_DEPTH = 4;
const MAX_KEYS = 30;
const MAX_ITEMS = 20;

// Compared after lowercasing and stripping non-alphanumerics, so "mobile_number" and "mobileNumber" match.
const SENSITIVE_KEYS = new Set([
  "token",
  "authorization",
  "password",
  "pin",
  "otp",
  "secret",
  "card",
  "cardnumber",
  "cvv",
  "phone",
  "phonenumber",
  "mobilenumber",
  "email",
  "emailaddress",
]);

// Keys ending in these words are also masked, e.g. access_token, refreshToken, client_secret.
const SENSITIVE_SUFFIXES = ["token", "secret", "password", "authorization", "cvv", "otp"];

const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const QUERY_SECRET_PATTERN = /\b(token|access_token|password|secret|otp|authorization|cvv)=[^&\s]+/gi;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return SENSITIVE_KEYS.has(normalized) || SENSITIVE_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}...[truncated]` : value;
}

/** Masks bearer tokens, secret query parameters and email addresses in free text, then bounds its length. */
export function redactString(value: string, max = MAX_STRING): string {
  const masked = value
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(QUERY_SECRET_PATTERN, (_match, name: string) => `${name}=${REDACTED}`)
    .replace(EMAIL_PATTERN, REDACTED);
  return truncate(masked, max);
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function describeError(error: Error): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: error.name,
    message: redactString(error.message ?? ""),
  };
  // Axios errors carry the request config (including the Authorization header) and the full
  // response body. Keep only the method, the path without its query string, and the status.
  const withHttp = error as Error & {
    code?: unknown;
    response?: { status?: unknown };
    config?: { method?: unknown; url?: unknown };
  };
  if (typeof withHttp.code === "string") out.code = withHttp.code;
  if (typeof withHttp.response?.status === "number") out.status = withHttp.response.status;
  if (typeof withHttp.config?.method === "string") out.method = withHttp.config.method.toUpperCase();
  if (typeof withHttp.config?.url === "string") out.url = redactString(withHttp.config.url.split("?")[0] ?? "", 200);
  return out;
}

/**
 * Returns a copy of `value` that is safe to store or send: sensitive keys are masked, strings
 * are scrubbed and bounded, and depth, key count and array length are capped.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint" || typeof value === "symbol") return String(value);
  if (typeof value === "function") return "[Function]";
  if (typeof value !== "object") return String(value);
  if (depth >= MAX_DEPTH) return "[Truncated]";
  if (value instanceof Error) return describeError(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((item) => redact(item, depth + 1));
    if (value.length > MAX_ITEMS) items.push(`[+${value.length - MAX_ITEMS} more]`);
    return items;
  }
  if (!isPlainObject(value)) {
    return `[${value.constructor?.name ?? "Object"}]`;
  }

  const out: Record<string, unknown> = {};
  const entries = Object.entries(value);
  for (const [key, item] of entries.slice(0, MAX_KEYS)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redact(item, depth + 1);
  }
  if (entries.length > MAX_KEYS) out["[more]"] = `${entries.length - MAX_KEYS} keys omitted`;
  return out;
}

export function createLogger(options: LoggerOptions): Logger {
  const write = (level: LogLevel, message: string, context?: unknown) => {
    if (options.dev) {
      const sink = options.sink ?? console;
      const args = context === undefined ? [message] : [message, context];
      sink[level](...args);
      return;
    }

    if (!options.send) return;
    try {
      const entry: LogEntry = {
        level,
        message: redactString(message, MAX_MESSAGE),
        time: new Date().toISOString(),
      };
      if (context !== undefined) entry.context = redact(context);
      options.send(entry);
    } catch {
      // Logging must never throw into application code.
    }
  };

  return {
    debug: (message, context) => write("debug", message, context),
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
  };
}

export const logger = createLogger({ dev: import.meta.env.DEV });
