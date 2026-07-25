export interface SubscriptionPlan {
  id: number;
  creator_id: number;
  community_id: number | null;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_cycle: 'monthly' | 'yearly';
  features: string[] | null;
  is_active: boolean;
  sort_order: number;
  active_subscribers?: number;
  creator?: {
    id: number;
    name: string;
    username: string;
    avatar_url?: string;
  };
  community?: {
    id: number;
    name: string;
    slug: string;
  };
  created_at: string;
}

export interface Subscription {
  id: number;
  plan_id: number;
  subscriber_id: number;
  creator_id: number;
  status: 'active' | 'canceled' | 'expired' | 'past_due';
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  trial_ends_at: string | null;
  payment_method: string;
  is_active: boolean;
  days_remaining: number;
  plan?: Pick<SubscriptionPlan, 'id' | 'name' | 'description' | 'price' | 'currency' | 'billing_cycle' | 'features'>;
  creator?: {
    id: number;
    name: string;
    username: string;
    avatar_url?: string;
  };
  subscriber?: {
    id: number;
    name: string;
    username: string;
    avatar_url?: string;
  };
  created_at: string;
}

export interface SubscriptionStats {
  active_subscribers: number;
  total_monthly_revenue: number;
  recent_subscriptions: Array<{
    id: number;
    subscriber: { id: number; name: string; username: string; avatar_url?: string };
    plan: { id: number; name: string };
    created_at: string;
  }>;
}

export interface CreatePlanPayload {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  billing_cycle?: 'monthly' | 'yearly';
  features?: string[];
  is_active?: boolean;
  sort_order?: number;
  community_id?: number | null;
}
