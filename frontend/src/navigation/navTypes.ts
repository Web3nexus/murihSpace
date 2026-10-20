export type UserRole = "member" | "creator" | "vendor" | "admin";

export type NavItem = {
  title: string;
  url: string;
  icon?: React.ReactNode;
  badge?: string | number;
  children?: NavItem[];
  featureFlag?: string;
  /** Short tooltip text shown on hover. */
  description?: string;
  /**
   * An item that opens an external app in a new tab. Its url is resolved from
   * an environment variable at runtime, and the item is hidden when that value
   * is missing or unsafe.
   */
  external?: "ads-manager";
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const ROLE_LABELS: Record<UserRole, string> = {
  member: "MEMBER SPACE",
  creator: "CREATOR ECOSYSTEM",
  vendor: "VENDOR CENTER",
  admin: "SECUREGATE ADMIN",
};
