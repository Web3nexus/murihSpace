export type CommunityCategory =
  | "Technology"
  | "Art & Design"
  | "Business"
  | "Gaming"
  | "Education"
  | "Lifestyle"
  | "Fitness"
  | "General";

export interface CommunityCreator {
  id: number;
  name: string;
  username: string;
  avatar?: string;
  bio?: string;
  role?: string;
}

export interface Community {
  id: number;
  user_id: number;
  name: string;
  slug: string;
  description?: string;
  category: CommunityCategory | string;
  visibility: "public" | "private";
  privacy?: "public" | "private";
  pricing_type: "free" | "paid";
  price_amount?: number;
  logo_url?: string;
  cover_url?: string;
  rules?: string[];
  members_count: number;
  creator?: CommunityCreator;
  last_active_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCommunityInput {
  name: string;
  description?: string;
  category: string;
  visibility: "public" | "private";
  pricing_type: "free" | "paid";
  price_amount?: number;
  logo_url?: string;
  cover_url?: string;
  rules?: string[];
}

export interface CommunityMembership {
  id: number;
  community_id: number;
  user_id: number;
  role: "member" | "moderator" | "admin" | string;
  role_id?: number;
  status: "active" | "pending" | "rejected";
  created_at?: string;
  updated_at?: string;
  user?: CommunityCreator;
}

export interface JoinRequest {
  id: number;
  community_id: number;
  user_id: number;
  role: string;
  status: "pending";
  created_at: string;
  user: CommunityCreator;
}

export interface CommunityRole {
  id: number;
  community_id: number;
  name: string;
  slug: string;
  permissions: string[];
  is_system: boolean;
  color: string;
}

export interface PermissionDefinition {
  key: string;
  name: string;
  description: string;
  category: string;
  default_for: string[];
}
