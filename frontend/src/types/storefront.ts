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
  display_name: string;
  tagline?: string;
  bio?: string;
  cover_url?: string;
  avatar_url?: string;
  short_code: string;
  links: StorefrontLink[];
  creator?: {
    name?: string;
    username?: string;
  };
  communities?: Array<{
    id: number;
    name: string;
    slug: string;
    description?: string;
    members_count?: number;
  }>;
}
