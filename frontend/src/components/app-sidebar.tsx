import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api/client";
import { getLogo } from "@/lib/logoConfig";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ChevronsUpDown,
  LogOut,
  UserCircle,
  Bell,
  Wallet,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getSidebarNav } from "@/navigation/getSidebarNav";
import { ROLE_LABELS } from "@/navigation/navTypes";
import type { NavItem, NavGroup, UserRole } from "@/navigation/navTypes";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

function isActiveRoute(item: NavItem, pathname: string, search: string): boolean {
  if (item.url.includes("?") ? pathname + search === item.url : pathname === item.url) return true;

  if (item.children) {
    if (item.children.some((child) => isActiveRoute(child, pathname, search))) return true;
    const basePath = item.url.split("?")[0];
    if (basePath !== "/app" && pathname.startsWith(basePath + "/")) return true;
  }

  return false;
}

function filterByFlags(nav: NavGroup[], flags: Record<string, boolean>): NavGroup[] {
  return nav
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => {
          if (item.featureFlag && !flags[item.featureFlag]) return null;
          if (item.children) {
            const kept = item.children.filter((c) => !c.featureFlag || flags[c.featureFlag]);
            if (kept.length === 0) return null;
            return { ...item, children: kept };
          }
          return item;
        })
        .filter(Boolean) as NavItem[],
    }))
    .filter((g) => g.items.length > 0);
}

interface AdminCounts {
  pending_kyc: number;
  pending_role_applications: number;
  pending_reports: number;
  open_tickets: number;
}

function injectBadges(nav: NavGroup[], unreadCount: number, adminCounts: AdminCounts): NavGroup[] {
  return nav.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.title === "MurihSpace Inbox" && unreadCount > 0) {
        return { ...item, badge: unreadCount };
      }
      if (item.title === "KYC Queue") {
        return { ...item, badge: adminCounts.pending_kyc };
      }
      if (item.title === "Role Applications") {
        return { ...item, badge: adminCounts.pending_role_applications };
      }
      if (item.title === "Posts & Reports") {
        return { ...item, badge: adminCounts.pending_reports };
      }
      return item;
    }),
  }));
}

function BrandLogo({ role }: { role: UserRole }) {
  const isAdmin = role === "admin";
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  
  const collapsedLogo = getLogo(role, "sidebar-collapsed", false);
  const fullLogo = getLogo(role, "sidebar-full", false);
  const roleLabel = ROLE_LABELS[role];

  return (
    <Link
      to={isAdmin ? "/app/securegate" : "/app"}
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl group transition-all"
    >
      {collapsed ? (
        <img
          src={collapsedLogo.url}
          alt={collapsedLogo.alt}
          className="h-8 w-8 object-contain shrink-0 transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="flex flex-col gap-0.5">
          <img
            src={fullLogo.url}
            alt={fullLogo.alt}
            className="h-7 w-auto object-contain shrink-0 transition-transform group-hover:scale-105"
          />
          <span className="text-[9px] text-[#1877f2] dark:text-[#4599ff] font-bold uppercase tracking-widest pl-0.5">
            {roleLabel}
          </span>
        </div>
      )}
    </Link>
  );
}

function getIconBadgeColor(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("dashboard") || t.includes("securegate")) return "bg-gradient-to-tr from-[#1877f2] to-[#0d5cb6] text-white shadow-xs";
  if (t.includes("request") || t.includes("friend") || t.includes("user")) return "bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-xs";
  if (t.includes("link") || t.includes("bio") || t.includes("content")) return "bg-gradient-to-tr from-pink-500 to-rose-600 text-white shadow-xs";
  if (t.includes("community") || t.includes("feed") || t.includes("group")) return "bg-gradient-to-tr from-teal-400 to-emerald-600 text-white shadow-xs";
  if (t.includes("event") || t.includes("audio") || t.includes("room")) return "bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-xs";
  if (t.includes("course") || t.includes("learn") || t.includes("package")) return "bg-gradient-to-tr from-emerald-500 to-green-600 text-white shadow-xs";
  if (t.includes("coach") || t.includes("brand") || t.includes("proposal")) return "bg-gradient-to-tr from-indigo-500 to-violet-600 text-white shadow-xs";
  if (t.includes("market") || t.includes("broadcast") || t.includes("sequence")) return "bg-gradient-to-tr from-rose-500 to-red-600 text-white shadow-xs";
  if (t.includes("inbox") || t.includes("message") || t.includes("chat")) return "bg-gradient-to-tr from-sky-400 to-blue-600 text-white shadow-xs";
  if (t.includes("ai assistant") || t.includes("mera")) return "bg-gradient-to-tr from-[#1877f2] to-indigo-600 text-white shadow-xs";
  if (t.includes("wallet") || t.includes("payout") || t.includes("earning")) return "bg-gradient-to-tr from-emerald-400 to-teal-600 text-white shadow-xs";
  if (t.includes("escrow") || t.includes("kyc") || t.includes("security")) return "bg-gradient-to-tr from-amber-400 to-yellow-600 text-white shadow-xs";
  if (t.includes("gift")) return "bg-gradient-to-tr from-pink-400 to-rose-500 text-white shadow-xs";
  if (t.includes("badge") || t.includes("verifi")) return "bg-gradient-to-tr from-[#1877f2] to-cyan-500 text-white shadow-xs";
  return "bg-gradient-to-tr from-slate-600 to-slate-800 text-white shadow-xs";
}

function NavIconBadge({ title, icon }: { title: string; icon: React.ReactNode }) {
  const badgeStyle = getIconBadgeColor(title);
  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-xl p-1.5 transition-transform group-hover/item:scale-105 shrink-0 ${badgeStyle}`}>
      {icon}
    </span>
  );
}

function NavRow({ item }: { item: NavItem }) {
  const { pathname, search } = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const active = isActiveRoute(item, pathname, search);
  const hasChildren = !!item.children?.length;

  const childActive = (child: NavItem) => isActiveRoute(child, pathname, search);

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={item.title}
          className="relative group/item h-10 gap-3 rounded-xl px-2.5 text-[13px] font-medium
            text-muted-foreground transition-all duration-150
            hover:bg-muted/70 hover:text-foreground
            data-[active=true]:bg-[#1877f2]/10 data-[active=true]:text-[#1877f2] dark:data-[active=true]:text-[#4599ff] data-[active=true]:font-bold"
        >
          <Link to={item.url}>
            <NavIconBadge title={item.title} icon={item.icon} />
            <span className="flex-1 truncate">{item.title}</span>
            {item.badge != null && !collapsed && (
              <span className="ml-auto flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-xs">
                {item.badge}
              </span>
            )}
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-[#1877f2]" />
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild defaultOpen={active} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={active}
            tooltip={item.title}
            className="relative group/item h-10 gap-3 rounded-xl px-2.5 text-[13px] font-medium
              text-muted-foreground transition-all duration-150
              hover:bg-muted/70 hover:text-foreground
              data-[active=true]:bg-[#1877f2]/10 data-[active=true]:text-[#1877f2] dark:data-[active=true]:text-[#4599ff] data-[active=true]:font-bold"
          >
            <NavIconBadge title={item.title} icon={item.icon} />
            <span className="flex-1 truncate">{item.title}</span>
            {item.badge != null && !collapsed && (
              <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-xs">
                {item.badge}
              </span>
            )}
            <ChevronRight className="size-3.5 shrink-0 opacity-50 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-[#1877f2]" />
            )}
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="ml-8 mt-1 mb-1 border-l border-border/80 pl-3 space-y-1">
            {item.children!.map((child) => (
              <Link
                key={child.title}
                to={child.url}
                className={`flex items-center justify-between rounded-lg py-1.5 px-2.5 text-[12px] transition-colors duration-100 ${
                  childActive(child)
                    ? "text-[#1877f2] dark:text-[#4599ff] font-bold bg-[#1877f2]/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <span className="truncate">{child.title}</span>
                {child.badge && (
                  <span className="text-[9px] px-1.5 rounded bg-[#1877f2]/15 text-[#1877f2] dark:text-[#4599ff] font-bold uppercase">
                    {child.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function UserFooter({ role }: { role: UserRole }) {
  const navigate = useNavigate();
  const { isMobile } = useSidebar();
  const { user, logout, loading } = useAuth();

  if (loading || !user) {
    return (
      <div className="flex items-center gap-3 p-2 text-xs text-muted-foreground">
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 space-y-1">
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          <div className="h-2 w-12 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[role];
  const userInitials = user.name ? initials(user.name) : "U";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-muted data-[state=open]:text-foreground rounded-xl"
            >
              <Avatar className="h-8 w-8 rounded-full bg-[#1877f2] text-white">
                <AvatarFallback className="text-xs font-bold bg-[#1877f2] text-white">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-xs leading-tight">
                <span className="truncate font-bold text-foreground">{user.name}</span>
                <span className="truncate text-[10px] text-muted-foreground capitalize">{roleLabel}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-xl border border-border bg-card shadow-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-3 py-2 text-left text-xs">
                <Avatar className="h-8 w-8 rounded-full bg-[#1877f2] text-white">
                  <AvatarFallback className="text-xs font-bold bg-[#1877f2] text-white">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-xs leading-tight">
                  <span className="truncate font-bold text-foreground">{user.name}</span>
                  <span className="truncate text-[10px] text-muted-foreground">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={() => navigate("/app/settings/profile")}
              className="cursor-pointer text-xs"
            >
              <UserCircle className="mr-2 h-4 w-4 text-muted-foreground" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/app/settings/notifications")}
              className="cursor-pointer text-xs"
            >
              <Bell className="mr-2 h-4 w-4 text-muted-foreground" />
              Notifications
            </DropdownMenuItem>

            {role !== "admin" && (
              <>
                <DropdownMenuItem
                  onClick={() => navigate("/app/wallet")}
                  className="cursor-pointer text-xs"
                >
                  <Wallet className="mr-2 h-4 w-4 text-muted-foreground" />
                  MurihPay Wallet
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/app/kyc")}
                  className="cursor-pointer text-xs"
                >
                  <ShieldCheck className="mr-2 h-4 w-4 text-muted-foreground" />
                  KYC Verification
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={() => logout()}
              className="cursor-pointer text-xs text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4 text-destructive" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const role: UserRole = (user?.role as UserRole) ?? "member";
  const flags = useFeatureFlags();

  const [unreadCount, setUnreadCount] = useState(0);
  const [adminCounts, setAdminCounts] = useState<AdminCounts>({
    pending_kyc: 0,
    pending_role_applications: 0,
    pending_reports: 0,
    open_tickets: 0,
  });

  useEffect(() => {
    let unmounted = false;

    async function fetchCounts() {
      try {
        const res = await apiClient.get("/messages/unread-count");
        if (!unmounted && res.data?.success) {
          setUnreadCount(res.data.data?.unread_count ?? 0);
        }
      } catch { /* ignore */ }

      if (role === "admin") {
        try {
          const res = await apiClient.get("/securegate/pending-counts");
          if (!unmounted && res.data?.success) {
            setAdminCounts(res.data.data);
          }
        } catch { /* ignore */ }
      }
    }

    fetchCounts();
    return () => { unmounted = true; };
  }, [role]);

  const rawNav = getSidebarNav(role);
  const filtered = filterByFlags(rawNav, flags);
  const navGroups = injectBadges(filtered, unreadCount, adminCounts);

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card" {...props}>
      <SidebarHeader className="h-14 flex items-center justify-center border-b border-border/80 px-4">
        <BrandLogo role={role} />
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 space-y-4">
        {navGroups.map((group, idx) => (
          <SidebarGroup key={group.title ?? idx} className="py-0">
            {group.title && (
              <SidebarGroupLabel className="text-[10px] font-bold tracking-widest text-muted-foreground/80 uppercase px-2.5 mb-1">
                {group.title}
              </SidebarGroupLabel>
            )}
            <SidebarMenu className="space-y-0.5">
              {group.items.map((item) => (
                <NavRow key={item.title} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/80 p-2">
        <UserFooter role={role} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
