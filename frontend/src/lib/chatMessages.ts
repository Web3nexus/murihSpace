import type { ChatMessage } from '@/types/chat';

/**
 * Robustly extract a message array from a chat API payload, which may be:
 * - a raw array:                     [msg, ...]
 * - an API envelope wrapping array:  { data: [msg, ...] }
 * - an API envelope wrapping a Laravel paginator:
 *                                    { data: { current_page, data: [msg, ...], total, ... } }
 */
export function extractMessages(payload: unknown): ChatMessage[] {
  if (Array.isArray(payload)) {
    return payload as ChatMessage[];
  }
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const obj = payload as Record<string, unknown>;
  if ('data' in obj) {
    const inner = obj.data;
    if (Array.isArray(inner)) {
      return inner as ChatMessage[];
    }
    if (inner && typeof inner === 'object' && Array.isArray((inner as Record<string, unknown>).data)) {
      return (inner as Record<string, unknown>).data as ChatMessage[];
    }
  }
  return [];
}