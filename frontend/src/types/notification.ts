export type NotificationType =
  | 'new_post'
  | 'new_member'
  | 'new_reaction'
  | 'new_comment'
  | 'moderation_action'
  | 'join_request'
  | 'join_approved'
  | 'ticket_created'
  | 'ticket_reply'
  | 'ticket_status_changed'
  | 'ticket_info_requested'
  | 'ticket_resolved'
  | 'ticket_reopened';

export type NotificationChannel = 'in_app' | 'email' | 'push';

export interface AppNotification {
  id: string;
  type: string;
  notifiable_type: string;
  notifiable_id: number;
  data: {
    title?: string;
    message?: string;
    action_url?: string;
    type?: NotificationType;
    sender_name?: string;
    sender_avatar?: string;
  };
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationPreferencesMap = Record<NotificationType, Record<NotificationChannel, boolean>>;

export interface NotificationPreferencePayloadItem {
  type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}
