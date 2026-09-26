import type { ChatMessage } from '@/types/chat';

/**
 * Robustly extract a message array from a chat API payload, which may be:
 * - a raw array:                     [msg, ...]
 * - an API envelope wrapping array:  { data: [msg, ...] }
 * - an API envelope wrapping a Laravel paginator:
 *                                    { data: { current_page, data: [msg, ...], total, ... } }
 */
export function extractMessages(payload: unknown): ChatMessage[] {
  let list: ChatMessage[] = [];
  if (Array.isArray(payload)) {
    list = payload as ChatMessage[];
  } else if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if ('data' in obj) {
      const inner = obj.data;
      if (Array.isArray(inner)) {
        list = inner as ChatMessage[];
      } else if (inner && typeof inner === 'object' && Array.isArray((inner as Record<string, unknown>).data)) {
        list = (inner as Record<string, unknown>).data as ChatMessage[];
      }
    }
  }

  // The backend paginates with orderBy('created_at', 'desc'), meaning index 0 is newest.
  // Reverse to chronological order (oldest first, newest at the bottom) for standard chat stream.
  if (list.length > 1) {
    const firstTime = new Date(list[0].created_at || 0).getTime();
    const lastTime = new Date(list[list.length - 1].created_at || 0).getTime();
    if (firstTime > lastTime) {
      return [...list].reverse();
    }
  }

  return list;
}