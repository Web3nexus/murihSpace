export interface StorefrontLink {
  label: string;
  url: string;
}

export interface Storefront {
  id?: number;
  user_id?: number;
  is_published: boolean;
  display_name: string;
  tagline?: string;
  bio?: string;
  cover_url?: string;
  avatar_url?: string;
  short_code: string;
  links: StorefrontLink[];
  created_at?: string;
  updated_at?: string;
}

export interface PublicStorefront {
  id?: number;
  display_name: string;
  tagline?: string;
  bio?: string;
  cover_url?: string;
  avatar_url?: string;
  short_code: string;
  is_published?: boolean;
  is_preview?: boolean;
  is_owner?: boolean;
  links: StorefrontLink[];
  creator?: {
    id?: number;
    name?: string;
    username?: string;
    avatar?: string;
    avatar_url?: string;
    role?: string;
    is_verified?: boolean;
  };
  communities?: Array<{
    id: number;
    name: string;
    slug: string;
    description?: string;
    members_count?: number;
  }>;
  physical_products?: Array<{
    id: number;
    title: string;
    description?: string;
    sku?: string;
    price: number;
    currency: string;
    category?: string;
    images?: string[];
    stock_quantity: number;
  }>;
  digital_products?: Array<{
    id: number;
    title: string;
    description?: string;
    price: number;
    currency: string;
    category?: string;
    cover_url?: string;
  }>;
}
