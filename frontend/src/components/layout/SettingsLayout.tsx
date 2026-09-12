import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router";
import {
  User as User,
  Wallet as Wallet,
  DeviceMobile as Smartphone,
  Folder as Folder,
  Bell as Bell,
  Lock as Lock,
  Sun as Sun,
  Globe as Globe,
  Sparkle as Sparkle,
  Star as Star,
  Storefront,
  Question as HelpCircle,
  CaretRight as ChevronRight,
  ShieldCheck as ShieldCheck,
  SealCheck as BadgeCheck,
  CurrencyDollar as DollarSign,
  Waveform as Activity,
  Link as Link,
  Package as Package,
  Truck as Truck,
  ArrowCounterClockwise as RotateCcw
} from "@phosphor-icons/react";
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

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-4 lg:p-5 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black tracking-tight text-foreground">
          Settings & Account
        </h1>
        <p className="text-xs font-medium text-muted-foreground mt-0.5">
          Manage your role preferences, security, wallet, and account settings.
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
              <div className="rounded-3xl bg-card border border-purple-500/30  overflow-hidden divide-y divide-border/40">
                <NavLink
                  to="/app/admin/users"
                  className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-600 text-white shrink-0">
                      <ShieldCheck weight="fill" className="h-4 w-4" />
                    </div>
                    <span>User Management</span>
                  </div>
                  <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
                </NavLink>

                <NavLink
                  to="/app/admin/kyc"
                  className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-600 text-white shrink-0">
                      <BadgeCheck weight="fill" className="h-4 w-4" />
                    </div>
                    <span>KYC &amp; Identity Verification</span>
                  </div>
                  <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
                </NavLink>

                <NavLink
                  to="/app/admin/fees"
                  className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0">
                      <DollarSign weight="fill" className="h-4 w-4" />
                    </div>
                    <span>Platform Fee Management</span>
                  </div>
                  <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
                </NavLink>

                <NavLink
                  to="/app/admin/system-health"
                  className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-rose-600 text-white shrink-0">
                      <Activity weight="fill" className="h-4 w-4" />
                    </div>
                    <span>System Health &amp; Logs</span>
                  </div>
                  <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
                </NavLink>
              </div>
            </div>
          )}

          {user?.role === "creator" && (
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500 px-3 py-1">
                Creator Management
              </p>
              <div className="rounded-3xl bg-card border border-amber-500/30  overflow-hidden divide-y divide-border/40">
                <NavLink
                  to="/app/store"
                  className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500 text-white shrink-0">
                      <Storefront weight="fill" className="h-4 w-4" />
                    </div>
                    <span>Storefront &amp; Handle</span>
                  </div>
                  <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
                </NavLink>

                <NavLink
                  to="/app/link-in-bio"
                  className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500 text-white shrink-0">
                      <Link weight="fill" className="h-4 w-4" />
                    </div>
                    <span>Link in Bio &amp; Theme</span>
                  </div>
                  <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
                </NavLink>

                <NavLink
                  to="/app/kyc"
                  className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0">
                      <BadgeCheck weight="fill" className="h-4 w-4" />
                    </div>
                    <span>KYC &amp; Verification Badge</span>
                  </div>
                  <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
                </NavLink>
              </div>
            </div>
          )}

          {user?.role === "vendor" && (
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 px-3 py-1">
                Vendor Storefront Management
              </p>
              <div className="rounded-3xl bg-card border border-emerald-500/30  overflow-hidden divide-y divide-border/40">
                <NavLink
                  to="/app/store/physical"
                  className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0">
                      <Package weight="fill" className="h-4 w-4" />
                    </div>
                    <span>Physical Merchandise</span>
                  </div>
                  <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
                </NavLink>

                <NavLink
                  to="/app/store/fulfilment"
                  className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0">
                      <Truck weight="fill" className="h-4 w-4" />
                    </div>
                    <span>Order Fulfilment</span>
                  </div>
                  <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
                </NavLink>

                <NavLink
                  to="/app/store/returns"
                  className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#2164b6] text-white shrink-0">
                      <RotateCcw weight="fill" className="h-4 w-4" />
                    </div>
                    <span>Returns &amp; Refund Policy</span>
                  </div>
                  <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
                </NavLink>
              </div>
            </div>
          )}

          {/* Group 1: Identity & Wallet */}
          <div className="rounded-3xl bg-card border-none/80  overflow-hidden divide-y divide-border/40">
            <NavLink
              to="/app/settings"
              end
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-[#2164b6]/15 text-[#2164b6] dark:text-[#7ab0ff]"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500 text-white shrink-0">
                  <User weight="fill" className="h-4 w-4" />
                </div>
                <span>My Profile</span>
              </div>
              <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
            </NavLink>

            <NavLink
              to="/app/wallet"
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-[#2164b6]/15 text-[#2164b6] dark:text-[#7ab0ff]"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500 text-white shrink-0">
                  <Wallet weight="fill" className="h-4 w-4" />
                </div>
                <span>Wallet &amp; Balance</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#2164b6] text-white text-[9px] font-black uppercase tracking-wider ">
                ACTIVE
              </span>
            </NavLink>
          </div>

          {/* Group 2: Messages & Security */}
          <div className="rounded-3xl bg-card border-none/80  overflow-hidden divide-y divide-border/40">
            <NavLink
              to="/app/settings/security"
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-[#2164b6]/15 text-[#2164b6] dark:text-[#7ab0ff]"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500 text-white shrink-0">
                  <Smartphone weight="fill" className="h-4 w-4" />
                </div>
                <span>Active Sessions &amp; Devices</span>
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
                <div className="p-2 rounded-lg bg-indigo-500 text-white shrink-0">
                  <Folder weight="fill" className="h-4 w-4" />
                </div>
                <span>Community Chat Channels</span>
              </div>
              <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
            </NavLink>
          </div>

          {/* Group 3: Preferences & Security */}
          <div className="rounded-3xl bg-card border-none/80  overflow-hidden divide-y divide-border/40">
            <NavLink
              to="/app/settings/notifications"
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-[#2164b6]/15 text-[#2164b6] dark:text-[#7ab0ff]"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500 text-white shrink-0">
                  <Bell weight="fill" className="h-4 w-4" />
                </div>
                <span>Notifications &amp; Sounds</span>
              </div>
              <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
            </NavLink>

            <NavLink
              to="/app/settings/privacy"
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-[#2164b6]/15 text-[#2164b6] dark:text-[#7ab0ff]"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-700 text-white shrink-0">
                  <Lock weight="fill" className="h-4 w-4" />
                </div>
                <span>Privacy &amp; Security</span>
              </div>
              <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
            </NavLink>

            <NavLink
              to="/app/settings/preferences"
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-[#2164b6]/15 text-[#2164b6] dark:text-[#7ab0ff]"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-500 text-white shrink-0">
                  <Sun weight="fill" className="h-4 w-4" />
                </div>
                <span>Appearance &amp; Theme</span>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">{themeLabel} &gt;</span>
            </NavLink>

            <NavLink
              to="/app/settings/language"
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-[#2164b6]/15 text-[#2164b6] dark:text-[#7ab0ff]"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-600 text-white shrink-0">
                  <Globe weight="fill" className="h-4 w-4" />
                </div>
                <span>Language &amp; Region</span>
              </div>
              <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
            </NavLink>
          </div>

          {/* Group 4: Account Tier & Help */}
          <div className="rounded-3xl bg-card border-none/80  overflow-hidden divide-y divide-border/40">
            {user?.role === "member" && (
              <NavLink
                to="/app/settings/upgrade"
                className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#2164b6] text-white shrink-0">
                    <Sparkle weight="fill" className="h-4 w-4" />
                  </div>
                  <span>Become a Creator or Vendor</span>
                </div>
                <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
              </NavLink>
            )}

            <NavLink
              to="/app/gifts"
              className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-xs font-bold text-foreground"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500 text-white shrink-0">
                  <Star weight="fill" className="h-4 w-4" />
                </div>
                <span>My Stars &amp; Gifts</span>
              </div>
              <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
            </NavLink>

            <NavLink
              to="/app/settings/help"
              className={({ isActive }) =>
                `w-full flex items-center justify-between p-3.5 transition-colors text-xs font-bold ${
                  isActive
                    ? "bg-[#2164b6]/15 text-[#2164b6] dark:text-[#7ab0ff]"
                    : "text-foreground hover:bg-muted/50"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-600 text-white shrink-0">
                  <HelpCircle weight="fill" className="h-4 w-4" />
                </div>
                <span>Support &amp; Help Desk</span>
              </div>
              <ChevronRight weight="fill" className="h-4 w-4 text-muted-foreground" />
            </NavLink>
          </div>
        </aside>

        {/* ── Right Sub-view Content Area (8 Cols) ────────────────── */}
        <main className="lg:col-span-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
