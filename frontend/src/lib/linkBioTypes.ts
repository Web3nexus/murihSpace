export interface LinkBioSocial {
  id: number;
  platform: string;
  url: string;
}

export interface LinkBioLinkItem {
  id: number;
  title: string;
  url: string;
  sort_order: number;
  click_count?: number;
  category?: string | null;
  badge?: string | null;
  price?: string | number | null;
  currency?: string | null;
  icon_3d?: string | null;
  icon_emoji?: string | null;
  unique_visitors?: number;
}

export interface LinkBioProductItem {
  id: number;
  title: string;
  description: string | null;
  price: string;
  currency: string;
  type: string;
  media_url: string | null;
  checkout_url: string | null;
}

export interface LinkBioPageData {
  username: string;
  profile_name: string;
  profile_bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bg: string;
  card_bg: string;
  text_color: string;
  accent: string;
  font: string;
  button_style: string;
  layout: string;
  template: string;
  background_type: string;
  background_value: string | null;
  links: LinkBioLinkItem[];
  social_links: LinkBioSocial[];
  products: LinkBioProductItem[];
}
