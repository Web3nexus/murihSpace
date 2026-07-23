export type ConversationType = 'direct' | 'community' | 'saved';

export type MessageStatus = 'pending' | 'sent' | 'failed';

export interface ChatUser {
  id: number;
  name: string;
  username: string;
  avatar_url?: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  by_me: boolean;
  users?: number[];
}

export interface ChatMessage {
  id?: number;
  conversation_id: number;
  user_id: number;
  content: string;
  type: 'text' | 'image' | 'file' | 'voice';
  client_uuid?: string;
  status?: MessageStatus;
  reply_to_id?: number;
  attachment_url?: string;
  attachment_type?: 'image' | 'file' | 'voice';
  reactions?: MessageReaction[];
  reply_to?: {
    id: number;
    user_id: number;
    content: string;
    attachment_type?: string;
    user?: Pick<ChatUser, 'id' | 'name' | 'username'>;
  };
  created_at: string;
  updated_at?: string;
  user?: ChatUser;
}

export interface ConversationItem {
  id: number;
  type: ConversationType;
  title: string;
  community?: {
    id: number;
    name: string;
    slug: string;
    logo_url?: string;
  };
  other_user?: ChatUser;
  latest_message?: ChatMessage;
  unread_count: number;
  updated_at: string;
  is_muted?: boolean;
  is_archived?: boolean;
}
