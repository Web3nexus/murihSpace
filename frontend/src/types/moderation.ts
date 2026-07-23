export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'misinformation' | 'other';

export type ReportedType = 'post' | 'user' | 'comment';

export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'actioned';

export interface Report {
  id: number;
  reporter_id: number;
  reported_type: ReportedType;
  reported_id: number;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  reviewed_by?: number;
  review_note?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  reporter?: {
    id: number;
    name: string;
    username: string;
  };
}

export interface CreateReportPayload {
  reported_type: ReportedType;
  reported_id: number;
  reason: ReportReason;
  details?: string;
}

export interface UserBlock {
  id: number;
  name: string;
  username: string;
  avatar_url?: string;
}

export interface UserMute {
  id: number;
  name: string;
  username: string;
  avatar_url?: string;
}
