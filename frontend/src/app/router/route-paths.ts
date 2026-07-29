export const RoutePaths = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  SECUREGATE_LOGIN: "/securegate/login",
  APP: "/app",
  APP_DISCOVER: "/app/discover",
  APP_COMMUNITIES: "/app/communities",
  APP_STORE: "/app/store",
  APP_MESSAGES: "/app/messages",
  APP_SETTINGS: "/app/settings",
  APP_SETTINGS_SECURITY: "/app/settings/security",
  APP_SETTINGS_NOTIFICATIONS: "/app/settings/notifications",
  APP_SETTINGS_PREFERENCES: "/app/settings/preferences",
  APP_ADMIN: "/app/securegate",
} as const;

export type RoutePathValues = typeof RoutePaths[keyof typeof RoutePaths];
