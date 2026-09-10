export type GroupPrivacy = 'public' | 'private' | 'invite_only';
export type GroupDiscoverability = 'discoverable' | 'hidden';
export type GroupMemberRole = 'owner' | 'admin' | 'moderator' | 'member';
export type GroupMemberStatus = 'active' | 'pending' | 'invited' | 'banned';

export interface GroupCreator {
  id: number;
  name: string;
  username: string;
  avatar?: string;
}

export interface GroupSettings {
  id?: number;
  group_id?: number;
  post_approval: boolean;
  who_can_post: 'all_members' | 'admins_only';
  who_can_chat: 'all_members' | 'admins_only';
  who_can_invite: 'all_members' | 'admins_only';
  slow_mode_seconds: number;
  blocked_keywords?: string[];
}

export interface Group {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  category: string;
  privacy: GroupPrivacy;
  discoverability: GroupDiscoverability;
  rules?: string | null;
  tags?: string[] | null;
  website?: string | null;
  location?: string | null;
  creator_id: number;
  creator?: GroupCreator;
  members_count: number;
  posts_count: number;
  created_at: string;
  updated_at?: string;

  // Computed / User Context
  is_member?: boolean;
  user_role?: GroupMemberRole | null;
  is_admin_or_owner?: boolean;
  has_pending_request?: boolean;
  can_post?: boolean;
  can_chat?: boolean;
  conversation_id?: number;
  settings?: GroupSettings;
}

export interface GroupMember {
  id: number;
  group_id: number;
  user_id: number;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  muted_until?: string | null;
  joined_at?: string | null;
  user: GroupCreator;
}

export interface GroupJoinRequest {
  id: number;
  group_id: number;
  user_id: number;
  status: 'pending' | 'approved' | 'rejected';
  note?: string | null;
  created_at: string;
  user: GroupCreator;
}

export interface GroupInvitation {
  id: number;
  group_id: number;
  inviter_id: number;
  invitee_id?: number | null;
  code: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at?: string | null;
  created_at: string;
  group?: Group;
  inviter?: GroupCreator;
}

export interface GroupPostReaction {
  reaction_type: string;
  user_id: number;
}

export interface GroupPost {
  id: number;
  group_id: number;
  user_id: number;
  type: 'post' | 'poll' | 'announcement' | 'media';
  content: string;
  media_urls?: string[] | null;
  link_url?: string | null;
  poll_question?: string | null;
  poll_options?: string[] | { text: string; votes?: number }[] | null;
  poll_results?: Record<string, any> | null;
  poll_ends_at?: string | null;
  is_pinned?: boolean;
  pinned_at?: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author: GroupCreator;
  user_reaction?: string | null;
  user_poll_vote?: number | null;
}
