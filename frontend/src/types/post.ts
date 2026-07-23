export type PostType = 'status' | 'announcement' | 'media';

export type ReactionType = 'like' | 'fire' | 'clap' | 'heart';

export interface PostReaction {
  id: number;
  user_id: number;
  type: ReactionType;
  user?: {
    id: number;
    name: string;
    username: string;
    avatar_url?: string;
  };
}

export interface PostComment {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    name: string;
    username: string;
    avatar_url?: string;
  };
}

export interface Post {
  id: number;
  community_id: number;
  user_id: number;
  type: PostType;
  content: string;
  link_url?: string;
  link_title?: string;
  link_description?: string;
  link_image?: string;
  media_urls?: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;

  // Relations
  author?: {
    id: number;
    name: string;
    username: string;
    avatar_url?: string;
  };
  community?: {
    id: number;
    name: string;
    slug: string;
    logo_url?: string;
  };
  comments?: PostComment[];
  reactions?: PostReaction[];
  comments_count?: number;
  reactions_count?: number;
  reaction_counts?: Record<ReactionType, number>;
  user_reaction?: ReactionType | null;
}

export interface CreatePostPayload {
  community_id: number;
  type: PostType;
  content: string;
  link_url?: string;
  media_urls?: string[];
}
