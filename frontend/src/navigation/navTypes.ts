export type UserRole = "member" | "creator" | "vendor" | "admin";

export type NavItem = {
  title: string;
  url: string;
  icon?: React.ReactNode;
  badge?: string | number;
  children?: NavItem[];
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
