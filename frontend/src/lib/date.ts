import { formatDistanceToNow, format } from 'date-fns';

export function safeDate(val: string | number | Date | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function safeFormatDistanceToNow(
  val: string | number | Date | null | undefined,
  options?: Parameters<typeof formatDistanceToNow>[1],
  fallback = ''
): string {
  const d = safeDate(val);
  if (!d) return fallback;
  try {
    return formatDistanceToNow(d, options);
  } catch {
    return fallback;
  }
}

export function safeFormat(
  val: string | number | Date | null | undefined,
  formatStr: string,
  fallback = ''
): string {
  const d = safeDate(val);
  if (!d) return fallback;
  try {
    return format(d, formatStr);
  } catch {
    return fallback;
  }
}
