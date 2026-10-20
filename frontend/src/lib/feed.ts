import { formatDistanceToNow } from "date-fns";

export interface FeedComment {
  id: number;
  user_name: string;
  avatar_url?: string;
  content: string;
  time: string;
  verified?: boolean;
}

export interface FeedPost {
  id: number;
  author: string;
  authorVerified?: boolean;
  avatar: string;
  badge: string;
  time: string;
  content: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  embedType: "video" | "product" | "media" | null;
  embedTitle?: string;
  embedSub?: string;
  embedBg?: string;
  price?: string;
  mediaUrl?: string;
  commentList: FeedComment[];
}

export function timeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "recently";
  }
}

/** Post as returned by the API feed endpoints (only the fields the mapper reads). */
export interface ApiPost {
  id: number;
  content?: string | null;
  created_at?: string | null;
  likes_count?: number | null;
  comments_count?: number | null;
  shares_count?: number | null;
  media_urls?: string[] | null;
  link_url?: string | null;
  link_title?: string | null;
  link_description?: string | null;
  link_image?: string | null;
  reactions?: { user_id?: number; reaction_type?: string }[] | null;
  author?: { name?: string; avatar?: string | null; avatar_url?: string | null; has_active_verification_badge?: boolean } | null;
  community?: { name?: string; logo_url?: string | null } | null;
}

export function mapApiPost(p: ApiPost, currentUserId?: number): FeedPost {
  const isLiked = Array.isArray(p.reactions)
    ? p.reactions.some(
        (r) => r.user_id === currentUserId && r.reaction_type === "like"
      )
    : false;

  let embedType: FeedPost["embedType"] = null;
  let embedTitle: string | undefined;
  let embedSub: string | undefined;
  let embedBg: string | undefined;

  if (p.link_url) {
    embedType = "product";
    embedTitle = p.link_title ?? "External Link";
    embedSub = p.link_description ?? p.link_url;
    embedBg = p.link_image ?? undefined;
  } else if (p.media_urls && p.media_urls.length > 0) {
    embedType = "media";
    embedBg = p.media_urls[0];
  }

  return {
    id: p.id,
    author: p.author?.name ?? p.community?.name ?? "User",
    authorVerified: p.author?.has_active_verification_badge ?? false,
    avatar: p.author?.avatar_url ?? p.author?.avatar ?? p.community?.logo_url ?? "",
    badge: p.community?.name ?? "Global",
    time: timeAgo(p.created_at ?? ""),
    content: p.content ?? "",
    likes: p.likes_count ?? 0,
    comments: p.comments_count ?? 0,
    shares: p.shares_count ?? 0,
    isLiked,
    embedType,
    embedTitle,
    embedSub,
    embedBg,
    price: undefined,
    mediaUrl: p.media_urls?.[0],
    commentList: [],
  };
}

export function mapApiComments(raw: unknown): FeedComment[] {
  const list = Array.isArray(raw) ? raw : (raw as { data?: unknown })?.data ?? [];
  return (Array.isArray(list) ? list : [])
    .filter((c) => c)
    .map((c) => ({
      id: c.id,
      user_name: c.author?.name ?? c.user?.name ?? "User",
      avatar_url: c.author?.avatar_url ?? c.user?.avatar_url,
      content: c.content,
      time: timeAgo(c.created_at),
      verified: c.author?.has_active_verification_badge ?? c.user?.has_active_verification_badge ?? false,
    }));
}
