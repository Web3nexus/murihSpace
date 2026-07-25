export interface AdminStats {
  users: { total: number; active: number; suspended: number; pending_kyc: number };
  store: { total_products: number; published_products: number };
  commerce: { total_orders: number; completed_orders: number; revenue: number };
  operations: { pending_withdrawals: number; pending_reports: number };
  wallet: { platform_balance: number; user_balances: number };
  recent_activity: { id: number; action: string; user_name: string; created_at: string }[];
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  username: string;
  role: string;
  status: string;
  kyc_status: string;
  kyc_rejection_reason?: string;
  country?: string;
  mobile_number?: string;
  created_at: string;
  suspended_at?: string;
  suspension_reason?: string;
  email_verified_at?: string;
}

export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
  user?: { id: number; name: string };
}

export interface PageSection {
  id: number;
  page: string;
  key: string;
  type: string;
  label: string;
  content: Record<string, unknown>;
  meta?: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlag {
  id: number;
  key: string;
  label: string;
  description?: string;
  enabled: boolean;
  is_scheduled: boolean;
  scheduled_at?: string;
  created_at: string;
}
