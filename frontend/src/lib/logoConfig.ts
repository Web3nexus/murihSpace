/**
 * Logo Configuration System
 * Provides role-based and context-aware logo assets
 */

export type UserRole = "member" | "creator" | "vendor" | "admin";
export type LogoContext = "sidebar-collapsed" | "sidebar-full" | "header" | "splash" | "app-icon";

interface LogoAsset {
  url: string;
  alt: string;
  width?: string;
  height?: string;
  className?: string;
}

interface LogoSet {
  light: LogoAsset;
  dark: LogoAsset;
}

/**
 * Logo assets by role and context
 * URLs should point to public/ folder assets
 */
export const LOGO_CONFIG: Record<UserRole, Record<LogoContext, LogoSet>> = {
  member: {
    "sidebar-collapsed": {
      light: { url: "/logos/member-icon-light.png", alt: "MurihSpace" },
      dark: { url: "/logos/member-icon-dark.png", alt: "MurihSpace" },
    },
    "sidebar-full": {
      light: { url: "/logos/member-logo-light.png", alt: "MurihSpace" },
      dark: { url: "/logos/member-logo-dark.png", alt: "MurihSpace" },
    },
    header: {
      light: { url: "/logos/member-logo-light.png", alt: "MurihSpace" },
      dark: { url: "/logos/member-logo-dark.png", alt: "MurihSpace" },
    },
    splash: {
      light: { url: "/logos/member-icon-light.png", alt: "MurihSpace" },
      dark: { url: "/logos/member-icon-dark.png", alt: "MurihSpace" },
    },
    "app-icon": {
      light: { url: "/logos/member-icon-light.png", alt: "MurihSpace" },
      dark: { url: "/logos/member-icon-dark.png", alt: "MurihSpace" },
    },
  },
  creator: {
    "sidebar-collapsed": {
      light: { url: "/logos/creator-icon-light.png", alt: "MurihSpace Creator" },
      dark: { url: "/logos/creator-icon-dark.png", alt: "MurihSpace Creator" },
    },
    "sidebar-full": {
      light: { url: "/logos/creator-logo-light.png", alt: "MurihSpace Creator" },
      dark: { url: "/logos/creator-logo-dark.png", alt: "MurihSpace Creator" },
    },
    header: {
      light: { url: "/logos/creator-logo-light.png", alt: "MurihSpace Creator" },
      dark: { url: "/logos/creator-logo-dark.png", alt: "MurihSpace Creator" },
    },
    splash: {
      light: { url: "/logos/creator-icon-light.png", alt: "MurihSpace Creator" },
      dark: { url: "/logos/creator-icon-dark.png", alt: "MurihSpace Creator" },
    },
    "app-icon": {
      light: { url: "/logos/creator-icon-light.png", alt: "MurihSpace Creator" },
      dark: { url: "/logos/creator-icon-dark.png", alt: "MurihSpace Creator" },
    },
  },
  vendor: {
    "sidebar-collapsed": {
      light: { url: "/logos/vendor-icon-light.png", alt: "MurihSpace Business" },
      dark: { url: "/logos/vendor-icon-dark.png", alt: "MurihSpace Business" },
    },
    "sidebar-full": {
      light: { url: "/logos/vendor-logo-light.png", alt: "MurihSpace Business" },
      dark: { url: "/logos/vendor-logo-dark.png", alt: "MurihSpace Business" },
    },
    header: {
      light: { url: "/logos/vendor-logo-light.png", alt: "MurihSpace Business" },
      dark: { url: "/logos/vendor-logo-dark.png", alt: "MurihSpace Business" },
    },
    splash: {
      light: { url: "/logos/vendor-icon-light.png", alt: "MurihSpace Business" },
      dark: { url: "/logos/vendor-icon-dark.png", alt: "MurihSpace Business" },
    },
    "app-icon": {
      light: { url: "/logos/vendor-icon-light.png", alt: "MurihSpace Business" },
      dark: { url: "/logos/vendor-icon-dark.png", alt: "MurihSpace Business" },
    },
  },
  admin: {
    "sidebar-collapsed": {
      light: { url: "/logos/admin-icon-light.png", alt: "SecureGate" },
      dark: { url: "/logos/admin-icon-dark.png", alt: "SecureGate" },
    },
    "sidebar-full": {
      light: { url: "/logos/admin-logo-light.png", alt: "SecureGate Admin" },
      dark: { url: "/logos/admin-logo-dark.png", alt: "SecureGate Admin" },
    },
    header: {
      light: { url: "/logos/admin-logo-light.png", alt: "SecureGate Admin" },
      dark: { url: "/logos/admin-logo-dark.png", alt: "SecureGate Admin" },
    },
    splash: {
      light: { url: "/logos/admin-icon-light.png", alt: "SecureGate" },
      dark: { url: "/logos/admin-icon-dark.png", alt: "SecureGate" },
    },
    "app-icon": {
      light: { url: "/logos/admin-icon-light.png", alt: "SecureGate" },
      dark: { url: "/logos/admin-icon-dark.png", alt: "SecureGate" },
    },
  },
};

/**
 * Get logo asset for a role and context
 * @param role User role
 * @param context Where the logo will be used
 * @param isDark Whether to use dark mode version
 * @returns Logo asset configuration
 */
export function getLogo(
  role: UserRole,
  context: LogoContext = "header",
  isDark: boolean = false
): LogoAsset {
  const roleLogos = LOGO_CONFIG[role] || LOGO_CONFIG.member;
  const contextLogos = roleLogos[context] || roleLogos.header;
  return isDark ? contextLogos.dark : contextLogos.light;
}
