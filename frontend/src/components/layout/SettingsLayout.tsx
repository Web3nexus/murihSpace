import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router";
import {
  User,
  Wallet,
  Bookmark,
  Phone,
  Smartphone,
  Folder,
  Bell,
  Lock,
  SunMoon,
  Globe,
  Sparkles,
  Star,
  Store,
  HelpCircle,
  FileQuestion,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { apiClient } from "@/lib/api/client";

export function SettingsLayout() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [sessionCount, setSessionCount] = useState<number | null>(null);

  useEffect(() => {
    apiClient.get("/auth/sessions")
      .then((res) => {
        const body = (res.data as { data?: unknown } | undefined)?.data ?? res.data;
        if (Array.isArray(body)) setSessionCount(body.length);
      })
      .catch(() => {});
  }, []);

  const roleLabel =
    user?.role === "admin"
      ? "Platform Admin"
      : user?.role === "creator"
      ? "Verified Creator"
      : user?.role === "vendor"
      ? "Store Owner"
      : "Community Member";

  const roleBadgeColor =
    user?.role === "admin"
      ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30"
      : user?.role === "creator"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
      : user?.role === "vendor"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
      : "bg-secondary/15 text-secondary border-secondary/30";

  const themeLabel = theme === "system" ? "Auto" : theme.charAt(0).toUpperCase() + theme.slice(1);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          Settings & Account
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your identity, security, wallet, and platform preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Telegram iOS Inset Sidebar (4 Cols) ───────────────────── */}
        <aside className="lg:col-span-4 space-y-4">
          {/* Card 0: Profile Header Card */}
          <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-secondary to-primary text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : "US"}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-extrabold text-foreground truncate">
                {user?.name ?? "User"}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                @{user?.username ?? "username"}
              </p>
              <span
                className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleBadgeColor}`}
              >
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Group 1: Identity & Wallet */}
          <div className="rounded-3xl bg-card border border-border/80 shadow-xs overflow-hidden divide-y divide-border/40">
            <NavLink
              to="/app/settings"
              end
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-secondary/15 text-secondary"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-500 text-white shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <span>My Profile</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </NavLink>

            <NavLink
              to="/app/wallet"
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-secondary/15 text-secondary"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500 text-white shrink-0">
                  <Wallet className="h-4 w-4" />
                </div>
                <span>Wallet</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[9px] font-black uppercase tracking-wider shadow-xs">
                NEW
              </span>
            </NavLink>
          </div>

          {/* Group 2: Messages & Devices */}
          <div className="rounded-3xl bg-card border border-border/80 shadow-xs overflow-hidden divide-y divide-border/40">
            <NavLink
              to="/app/messages"
              className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-500 text-white shrink-0">
                  <Bookmark className="h-4 w-4" />
                </div>
                <span>Saved Messages</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </NavLink>

            <NavLink
              to="/app/events"
              className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0">
                  <Phone className="h-4 w-4" />
                </div>
                <span>Recent Calls</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </NavLink>

            <NavLink
              to="/app/settings/security"
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-secondary/15 text-secondary"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0">
                  <Smartphone className="h-4 w-4" />
                </div>
                <span>Devices</span>
              </div>
              {sessionCount !== null && (
                <span className="text-[11px] font-bold text-muted-foreground">{sessionCount} &gt;</span>
              )}
            </NavLink>

            <NavLink
              to="/app/community-chat"
              className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500 text-white shrink-0">
                  <Folder className="h-4 w-4" />
                </div>
                <span>Chat Folders</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </NavLink>
          </div>

          {/* Group 3: Preferences & Security */}
          <div className="rounded-3xl bg-card border border-border/80 shadow-xs overflow-hidden divide-y divide-border/40">
            <NavLink
              to="/app/settings/notifications"
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-secondary/15 text-secondary"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500 text-white shrink-0">
                  <Bell className="h-4 w-4" />
                </div>
                <span>Notifications and Sounds</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </NavLink>

            <NavLink
              to="/app/settings/privacy"
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-secondary/15 text-secondary"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-700 text-white shrink-0">
                  <Lock className="h-4 w-4" />
                </div>
                <span>Privacy and Security</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </NavLink>

            <NavLink
              to="/app/settings/preferences"
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-secondary/15 text-secondary"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-500 text-white shrink-0">
                  <SunMoon className="h-4 w-4" />
                </div>
                <span>Appearance</span>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">{themeLabel} &gt;</span>
            </NavLink>

            <NavLink
              to="/app/settings/language"
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-secondary/15 text-secondary"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-600 text-white shrink-0">
                  <Globe className="h-4 w-4" />
                </div>
                <span>Language</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </NavLink>
          </div>

          {/* Group 4: Extensions & Roles */}
          <div className="rounded-3xl bg-card border border-border/80 shadow-xs overflow-hidden divide-y divide-border/40">
            <NavLink
              to="/app/settings/upgrade"
              className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span>MurihSpace Premium</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </NavLink>

            <NavLink
              to="/app/gifts"
              className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0">
                  <Star className="h-4 w-4" />
                </div>
                <span>My Stars &amp; Gifts</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </NavLink>

            {user?.role === "vendor" && (
              <NavLink
                to="/app/store"
                className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-pink-500 text-white shrink-0">
                    <Store className="h-4 w-4" />
                  </div>
                  <span>MurihSpace Business</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </NavLink>
            )}
          </div>

          {/* Group 5: Help */}
          <div className="rounded-3xl bg-card border border-border/80 shadow-xs overflow-hidden divide-y divide-border/40">
            <NavLink
              to="/app/settings/help"
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-secondary/15 text-secondary"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-600 text-white shrink-0">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <span>Ask a Question</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </NavLink>

            <a
              href="/help"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-600 text-white shrink-0">
                  <FileQuestion className="h-4 w-4" />
                </div>
                <span>MurihSpace FAQ &amp; Guides</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </a>
          </div>
        </aside>

        {/* ── Right Content Panel (8 Cols) ───────────────────────────────── */}
        <main className="lg:col-span-8 p-6 rounded-3xl bg-card border border-border/80 shadow-xs min-h-[500px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
