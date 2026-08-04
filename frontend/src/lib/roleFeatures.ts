/**
 * Role-Based Feature Access Control
 * Defines which features are available for each user role
 */

export type UserRole = "member" | "creator" | "vendor" | "admin";

interface RoleFeatures {
  // Community & Social Features
  community: boolean;
  events: boolean;
  audio_rooms: boolean;
  stories: boolean;
  feed: boolean;
  
  // Creator Features
  content_studio: boolean;
  link_in_bio: boolean;
  courses: boolean;
  coaching: boolean;
  media_kit: boolean;
  brand_deals: boolean;
  
  // E-Commerce Features (VENDOR ONLY)
  physical_products: boolean;
  digital_products: boolean;
  inventory: boolean;
  storefront: boolean;
  orders: boolean;
  shipping: boolean;
  subscriptions: boolean;
  memberships: boolean;
  
  // Marketing & Growth
  email_broadcasts: boolean;
  email_sequences: boolean;
  analytics: boolean;
  
  // Communication
  inbox: boolean;
  messages: boolean;
  community_chat: boolean;
  
  // Wallet & Money
  wallet: boolean;
  payouts: boolean;
  escrow: boolean;
  gifts: boolean;
  
  // Account
  kyc: boolean;
  profile: boolean;
  security: boolean;
  settings: boolean;
}

/**
 * Feature availability by role
 */
export const ROLE_FEATURES: Record<UserRole, RoleFeatures> = {
  member: {
    // Community & Social
    community: true,
    events: true,
    audio_rooms: true,
    stories: true,
    feed: true,
    
    // Creator
    content_studio: false,
    link_in_bio: false,
    courses: false,
    coaching: false,
    media_kit: false,
    brand_deals: false,
    
    // E-Commerce
    physical_products: false,
    digital_products: false,
    inventory: false,
    storefront: false,
    orders: false,
    shipping: false,
    subscriptions: false,
    memberships: false,
    
    // Marketing
    email_broadcasts: false,
    email_sequences: false,
    analytics: false,
    
    // Communication
    inbox: true,
    messages: true,
    community_chat: true,
    
    // Wallet
    wallet: true,
    payouts: false,
    escrow: false,
    gifts: true,
    
    // Account
    kyc: false,
    profile: true,
    security: true,
    settings: true,
  },
  
  creator: {
    // Community & Social
    community: true,
    events: true,
    audio_rooms: true,
    stories: true,
    feed: true,
    
    // Creator
    content_studio: true,
    link_in_bio: true,
    courses: true,
    coaching: true,
    media_kit: true,
    brand_deals: true,
    
    // E-Commerce (DISABLED FOR CREATORS - except memberships)
    physical_products: false,
    digital_products: false,
    inventory: false,
    storefront: false,
    orders: false,
    shipping: false,
    subscriptions: false,
    memberships: true, // Creators can sell community memberships
    
    // Marketing
    email_broadcasts: true,
    email_sequences: true,
    analytics: true,
    
    // Communication
    inbox: true,
    messages: true,
    community_chat: true,
    
    // Wallet
    wallet: true,
    payouts: true,
    escrow: true,
    gifts: true,
    
    // Account
    kyc: true,
    profile: true,
    security: true,
    settings: true,
  },
  
  vendor: {
    // Community & Social
    community: true,
    events: false,
    audio_rooms: false,
    stories: false,
    feed: false,
    
    // Creator
    content_studio: false,
    link_in_bio: false,
    courses: true,  // Can sell courses
    coaching: false,
    media_kit: false,
    brand_deals: false,
    
    // E-Commerce (ALL ENABLED FOR VENDORS)
    physical_products: true,
    digital_products: true,
    inventory: true,
    storefront: true,
    orders: true,
    shipping: true,
    subscriptions: false,
    memberships: false,
    
    // Marketing
    email_broadcasts: true,
    email_sequences: true,
    analytics: true,
    
    // Communication
    inbox: true,
    messages: true,
    community_chat: true,
    
    // Wallet
    wallet: true,
    payouts: true,
    escrow: true,
    gifts: false,
    
    // Account
    kyc: true,
    profile: true,
    security: true,
    settings: true,
  },
  
  admin: {
    // Community & Social
    community: false,
    events: false,
    audio_rooms: false,
    stories: false,
    feed: false,
    
    // Creator
    content_studio: false,
    link_in_bio: false,
    courses: false,
    coaching: false,
    media_kit: false,
    brand_deals: false,
    
    // E-Commerce
    physical_products: false,
    digital_products: false,
    inventory: false,
    storefront: false,
    orders: false,
    shipping: false,
    subscriptions: false,
    memberships: false,
    
    // Marketing
    email_broadcasts: false,
    email_sequences: false,
    analytics: false,
    
    // Communication
    inbox: false,
    messages: false,
    community_chat: false,
    
    // Wallet
    wallet: false,
    payouts: false,
    escrow: false,
    gifts: false,
    
    // Account
    kyc: false,
    profile: true,
    security: true,
    settings: true,
  },
};

/**
 * Check if a role has access to a feature
 */
export function hasFeatureAccess(role: UserRole, feature: keyof RoleFeatures): boolean {
  return ROLE_FEATURES[role]?.[feature] ?? false;
}

/**
 * Get all accessible features for a role
 */
export function getAccessibleFeatures(role: UserRole): string[] {
  const features = ROLE_FEATURES[role];
  if (!features) return [];
  return Object.entries(features)
    .filter(([, enabled]) => enabled)
    .map(([feature]) => feature);
}
