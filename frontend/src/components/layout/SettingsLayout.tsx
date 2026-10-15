import { useEffect, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { Suspense } from "react";
import { Outlet, useLocation } from "react-router";
import { Profile as User, Folder, Notification as Bell, Lock, Discovery as Globe, ArrowRight as ChevronRight, ShieldDone as ShieldCheck, ShieldDone as BadgeCheck, Activity, Swap as RotateCcw, Chat as ChatCircleDots } from "@/components/icons";
import { DeviceMobile as Smartphone, Sun, Sparkle, Question as HelpCircle, CurrencyDollar as DollarSign, Package, Truck } from "@/components/icons/rounded";
import { BrandPreloader } from "@/components/common/BrandPreloader";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { apiClient } from "@/lib/api/client";

/**
 * Every settings rail entry maps to the page it used to link to. Instead of
 * routing away, the page is lazily loaded and rendered inline in the right-hand
 * content panel while the rail stays put.
 */
const INLINE_PANEL_COMPONENTS: Record<string, LazyExoticComponent<ComponentType>> = {
  "/app/settings": lazyWithRetry(() => import("@/pages/ProfilePage"), "ProfilePage"),
  "/app/settings/profile": lazyWithRetry(() => import("@/pages/ProfilePage"), "ProfilePage"),
  "/app/settings/upgrade": lazyWithRetry(() => import("@/pages/UpgradeAccountPage"), "UpgradeAccountPage"),
  "/app/settings/security": lazyWithRetry(() => import("@/pages/SecurityPage"), "SecurityPage"),
  "/app/settings/notifications": lazyWithRetry(() => import("@/pages/NotificationsPage"), "NotificationsPage"),
  "/app/settings/privacy": lazyWithRetry(() => import("@/pages/PrivacyPage"), "PrivacyPage"),
  "/app/settings/preferences": lazyWithRetry(() => import("@/pages/AppearancePage"), "AppearancePage"),
  "/app/settings/language": lazyWithRetry(() => import("@/pages/LanguagePage"), "LanguagePage"),
  "/app/settings/automated-replies": lazyWithRetry(() => import("@/pages/AutomatedRepliesPage"), "AutomatedRepliesPage"),
  "/app/settings/help": lazyWithRetry(() => import("@/pages/SupportThreadsPage"), "SupportThreadsPage"),
  "/app/kyc": lazyWithRetry(() => import("@/pages/KycSettingsPage"), "KycSettingsPage"),
  "/app/store/physical": lazyWithRetry(() => import("@/pages/PhysicalProductsPage"), "PhysicalProductsPage"),
  "/app/store/fulfilment": lazyWithRetry(() => import("@/pages/FulfilmentPage"), "FulfilmentPage"),
  "/app/store/returns": lazyWithRetry(() => import("@/pages/ReturnsPage"), "ReturnsPage"),
  "/app/community-chat": lazyWithRetry(() => import("@/pages/ChatPage"), "ChatPage"),
  "/app/securegate/notifications": lazyWithRetry(() => import("@/pages/AdminNotificationsPage"), "AdminNotificationsPage"),
  "/app/securegate/users": lazyWithRetry(() => import("@/pages/AdminUsersPage"), "AdminUsersPage"),
  "/app/securegate/kyc": lazyWithRetry(() => import("@/pages/AdminKycPage"), "AdminKycPage"),
  "/app/securegate/fees": lazyWithRetry(() => import("@/pages/AdminFeeManagementPage"), "AdminFeeManagementPage"),
  "/app/securegate/system-health": lazyWithRetry(() => import("@/pages/AdminSystemHealthPage"), "AdminSystemHealthPage"),
};

/** Resolve a router pathname to a rail key, tolerating a trailing slash. */
function resolvePanelKey(pathname: string): string | null {
  if (INLINE_PANEL_COMPONENTS[pathname]) return pathname;
  const trimmed = pathname.replace(/\/+$/, "");
  return INLINE_PANEL_COMPONENTS[trimmed] ? trimmed : null;
}

interface RailEntry {
  to: string;
  label: string;
  icon: ReactNode;
  iconBg: string;
  trailing?: ReactNode;
}

function RailCard({
  entries,
  activePanel,
  onSelect,
  className = "",
}: {
  entries: RailEntry[];
  activePanel: string | null;
  onSelect: (to: string) => void;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl bg-card overflow-hidden divide-y divide-border/40 ${className}`}>
      {entries.map((entry) => {
        const active = activePanel === entry.to;
        return (
          <button
            key={entry.label}
            type="button"
            onClick={() => onSelect(entry.to)}
            aria-current={active ? "true" : undefined}
            className={`w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold text-left ${
              active
                ? "bg-[#2164b6]/15 text-[#2164b6] dark:text-[#7ab0ff]"
                : "text-foreground hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg text-white shrink-0 ${entry.iconBg}`}>{entry.icon}</div>
              <span>{entry.label}</span>
            </div>
            {entry.trailing ?? <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsLayout() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  // Inline panel selection: `override` only applies while the URL still matches
  // the path it was set on, so navigating (deep links / in-page links / back)
  // transparently falls back to the routed <Outlet /> content.
  const [panelOverride, setPanelOverride] = useState<{ path: string; key: string } | null>(null);

  useEffect(() => {
    apiClient.get("/auth/sessions")
      .then((res) => {
        const body = (res.data as { data?: unknown } | undefined)?.data ?? res.data;
        if (Array.isArray(body)) setSessionCount(body.length);
      })
      .catch(() => {});
  }, []);

  const routePanelKey = resolvePanelKey(location.pathname);
  const activePanel =
    panelOverride && panelOverride.path === location.pathname ? panelOverride.key : routePanelKey;
  const setActivePanel = (to: string) => setPanelOverride({ path: location.pathname, key: to });


  const isKycVerified = user?.kyc_status === "verified";
  const isKycPending = user?.kyc_status === "pending" || user?.kyc_status === "in_review";

  const roleLabel =
    user?.role === "admin"
      ? "Platform Admin"
      : user?.role === "creator"
      ? (isKycVerified ? "Verified Creator" : isKycPending ? "Creator (KYC Pending)" : "Creator")
      : user?.role === "vendor"
      ? (isKycVerified ? "Verified Storefront Owner" : isKycPending ? "Storefront Owner (KYC Pending)" : "Storefront Owner")
      : "Community Member";

  const roleBadgeColor =
    user?.role === "admin"
      ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30"
      : user?.role === "creator"
      ? (isKycVerified
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
          : isKycPending
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
          : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30")
      : user?.role === "vendor"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
      : "bg-secondary/15 text-secondary border-secondary/30";

  const themeLabel = theme === "system" ? "Auto" : theme.charAt(0).toUpperCase() + theme.slice(1);

  const sessionTrailing =
    sessionCount !== null ? (
      <span className="text-[11px] font-bold text-muted-foreground">{sessionCount} &gt;</span>
    ) : (
      <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
    );

  const themeTrailing = (
    <span className="text-[11px] font-medium text-muted-foreground">{themeLabel} &gt;</span>
  );

  const ActivePanel = activePanel ? INLINE_PANEL_COMPONENTS[activePanel] : null;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-4 lg:p-5 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black tracking-tight text-foreground">
          Settings & Account
        </h1>
        <p className="text-xs font-medium text-muted-foreground mt-0.5">
          Manage your role preferences, security, and account settings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ── Left Sidebar (4 Cols) ───────────────────── */}
        <aside className="lg:col-span-4 space-y-4">
          {/* Card 0: Profile Header Card */}
          <div className="p-4 rounded-3xl bg-card border-none/80  flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-[#2164b6] text-white flex items-center justify-center shrink-0 overflow-hidden">
              {user?.avatar_url || user?.avatar ? (
                <img src={user.avatar_url || user.avatar || ''} alt="" className="w-full h-full object-cover" />
              ) : (
                <User weight="fill" className="text-white/90" style={{ width: 28, height: 28 }} />
              )}
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

          {/* ── ROLE-SPECIFIC CONTROL SECTION ──────────────────────── */}
          {user?.role === "admin" && (
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-500 px-3 py-1">
                Admin Control Panel
              </p>
              <RailCard
                entries={[
                  { to: "/app/securegate/notifications", label: "Admin Notification Center", icon: <Bell weight="fill" className="h-4 w-4" />, iconBg: "bg-blue-600" },
                  { to: "/app/securegate/users", label: "User Management", icon: <ShieldCheck weight="fill" className="h-4 w-4" />, iconBg: "bg-purple-600" },
                  { to: "/app/securegate/kyc", label: "KYC & Identity Verification", icon: <BadgeCheck weight="fill" className="h-4 w-4" />, iconBg: "bg-indigo-600" },
                  { to: "/app/securegate/fees", label: "Platform Fee Management", icon: <DollarSign weight="fill" className="h-4 w-4" />, iconBg: "bg-emerald-600" },
                  { to: "/app/securegate/system-health", label: "System Health & Logs", icon: <Activity weight="fill" className="h-4 w-4" />, iconBg: "bg-rose-600" },
                ]}
                activePanel={activePanel}
                onSelect={setActivePanel}
              />
            </div>
          )}

          {user?.role === "creator" && (
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500 px-3 py-1">
                Creator Management
              </p>
              <RailCard
                className="border border-amber-500/30"
                activePanel={activePanel}
                onSelect={setActivePanel}
                entries={[
                  { to: "/app/kyc", label: "KYC & Verification Badge", icon: <BadgeCheck weight="fill" className="h-4 w-4" />, iconBg: "bg-emerald-600" },
                ]}
              />
            </div>
          )}

          {user?.role === "vendor" && (
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 px-3 py-1">
                Vendor Storefront Management
              </p>
              <RailCard
                className="border border-emerald-500/30"
                entries={[
                  { to: "/app/store/physical", label: "Physical Merchandise", icon: <Package weight="fill" className="h-4 w-4" />, iconBg: "bg-emerald-600" },
                  { to: "/app/store/fulfilment", label: "Order Fulfilment", icon: <Truck weight="fill" className="h-4 w-4" />, iconBg: "bg-blue-600" },
                  { to: "/app/store/returns", label: "Returns & Refund Policy", icon: <RotateCcw weight="fill" className="h-4 w-4" />, iconBg: "bg-[#2164b6]" },
                ]}
                activePanel={activePanel}
                onSelect={setActivePanel}
              />
            </div>
          )}

          {user?.role === "admin" ? (
            <RailCard
              entries={[
                { to: "/app/settings", label: "My Profile", icon: <User weight="fill" className="h-4 w-4" />, iconBg: "bg-red-500" },
                { to: "/app/settings/security", label: "Active Sessions & Devices", icon: <Smartphone weight="fill" className="h-4 w-4" />, iconBg: "bg-amber-500", trailing: sessionTrailing },
                { to: "/app/settings/privacy", label: "Privacy & Password", icon: <Lock weight="fill" className="h-4 w-4" />, iconBg: "bg-slate-700" },
                { to: "/app/settings/preferences", label: "Appearance & Theme", icon: <Sun weight="fill" className="h-4 w-4" />, iconBg: "bg-teal-500", trailing: themeTrailing },
              ]}
              activePanel={activePanel}
              onSelect={setActivePanel}
            />
          ) : (
            <>
              {/* Group 1: Identity */}
              <RailCard
                entries={[
                  { to: "/app/settings", label: "My Profile", icon: <User weight="fill" className="h-4 w-4" />, iconBg: "bg-red-500" },
                ]}
                activePanel={activePanel}
                onSelect={setActivePanel}
              />

              {/* Group 2: Messages & Security */}
              <RailCard
                entries={[
                  { to: "/app/settings/security", label: "Active Sessions & Devices", icon: <Smartphone weight="fill" className="h-4 w-4" />, iconBg: "bg-amber-500", trailing: sessionTrailing },
                  { to: "/app/community-chat", label: "Community Chat Channels", icon: <Folder weight="fill" className="h-4 w-4" />, iconBg: "bg-indigo-500" },
                  { to: "/app/settings/automated-replies", label: "Automated Greeting & Replies", icon: <ChatCircleDots weight="fill" className="h-4 w-4" />, iconBg: "bg-emerald-600" },
                ]}
                activePanel={activePanel}
                onSelect={setActivePanel}
              />

              {/* Group 3: Preferences & Security */}
              <RailCard
                entries={[
                  { to: "/app/settings/notifications", label: "Notifications & Sounds", icon: <Bell weight="fill" className="h-4 w-4" />, iconBg: "bg-rose-500" },
                  { to: "/app/settings/privacy", label: "Privacy & Security", icon: <Lock weight="fill" className="h-4 w-4" />, iconBg: "bg-slate-700" },
                  { to: "/app/settings/preferences", label: "Appearance & Theme", icon: <Sun weight="fill" className="h-4 w-4" />, iconBg: "bg-teal-500", trailing: themeTrailing },
                  { to: "/app/settings/language", label: "Language & Region", icon: <Globe weight="fill" className="h-4 w-4" />, iconBg: "bg-violet-600" },
                ]}
                activePanel={activePanel}
                onSelect={setActivePanel}
              />

              {/* Group 4: Account Tier & Help */}
              <RailCard
                entries={[
                  ...(user?.role === "member"
                    ? [{ to: "/app/settings/upgrade", label: "Become a Creator or Vendor", icon: <Sparkle weight="fill" className="h-4 w-4" />, iconBg: "bg-[#2164b6]" }]
                    : []),
                  { to: "/app/settings/help", label: "Support & Help Desk", icon: <HelpCircle weight="fill" className="h-4 w-4" />, iconBg: "bg-amber-600" },
                ]}
                activePanel={activePanel}
                onSelect={setActivePanel}
              />
            </>
          )}
        </aside>

        {/* ── Right Sub-view Content Area (8 Cols) ────────────────── */}
        <main className="lg:col-span-8">
          {ActivePanel ? (
            <Suspense fallback={<BrandPreloader size="md" />}>
              <ActivePanel />
            </Suspense>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
