import type { ChatMessage } from '@/types/chat';

/** Minimal shape needed to build a human-readable message preview. */
export interface PreviewableMessage {
  content?: string | null;
  type?: string | null;
  attachment_type?: string | null;
  deleted?: boolean;
}

const BRACKET_PREVIEWS: Array<[RegExp, string]> = [
  [/^\[LOCATION\]/, '📍 Location'],
  [/^\[COMMUNITY\]/, '👥 Community'],
  [/^\[POLL\]/, '📊 Poll'],
  [/^\[GIFT\]/, '🎁 Gift'],
];

/**
 * Turn a raw message (or a `reply_to` payload) into human-readable text.
 *
 * Rich message types store machine payloads in `content` (call messages are
 * JSON, polls/gifts/locations are bracket-tagged). Rendering `content` verbatim
 * leaks JSON into reply quotes, so every preview surface must run through this.
 */
export function messagePreview(msg: PreviewableMessage | null | undefined, max = 120): string {
  if (!msg) return '';

  const content = (msg.content ?? '').trim();
  const type = (msg.type ?? '').toLowerCase();
  const attachment = (msg.attachment_type ?? '').toLowerCase();

  if (msg.deleted && !content) return 'This message was deleted';

  const isCall =
    type === 'call' ||
    content.startsWith('{"call_id"') ||
    (content.startsWith('{') && content.includes('"call_id"'));
  if (isCall) {
    try {
      const data = JSON.parse(content) as {
        call_type?: string;
        status?: string;
        duration?: number;
      };
      const isVideo = data.call_type === 'video';
      const missed = data.status === 'missed' || data.status === 'declined';
      if (missed) return isVideo ? '📹 Missed video call' : '📞 Missed call';
      const dur = Number(data.duration) || 0;
      if (dur > 0) {
        const m = Math.floor(dur / 60);
        const s = dur % 60;
        const ds = m > 0 ? `${m}m ${s}s` : `${s}s`;
        return isVideo ? `📹 Video call · ${ds}` : `📞 Voice call · ${ds}`;
      }
      return isVideo ? '📹 Video call' : '📞 Voice call';
    } catch {
      return '📞 Call';
    }
  }

  for (const [pattern, label] of BRACKET_PREVIEWS) {
    if (pattern.test(content)) return label;
  }

  if (type === 'live_stream' || attachment === 'live_stream' || content.startsWith('🔴 Watch ')) {
    return '🔴 Live stream';
  }

  if (attachment === 'image' || type === 'image') return '📷 Photo';
  if (attachment === 'voice' || type === 'voice') return '🎤 Voice message';
  if (attachment === 'file' || type === 'file') return '📎 File';
  if (attachment === 'video' || type === 'video') return '🎬 Video';
  if (attachment === 'gift' || type === 'gift') return '🎁 Gift';
  if (attachment === 'poll') return '📊 Poll';

  const single = content.replace(/\s+/g, ' ').trim();
  return single.length > max ? `${single.slice(0, max)}…` : single;
}

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
/**
 * The date a business chat's delete-for-everyone window opens, or null when it is open now.
 * The messages response carries it under data.delete_for_everyone_unlocks_at.
 */
export function extractDeleteLock(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const inner = (payload as Record<string, unknown>).data;
  if (!inner || typeof inner !== 'object') return null;
  const value = (inner as Record<string, unknown>).delete_for_everyone_unlocks_at;
  if (typeof value !== 'string') return null;
  return new Date(value).getTime() > Date.now() ? value : null;
}
