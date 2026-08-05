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
  SidebarSeparator,
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
  Globe,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
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

function injectBadges(nav: NavGroup[], unreadCount: number, pendingReportsCount: number): NavGroup[] {
  if (!unreadCount && !pendingReportsCount) return nav;
  return nav.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.title === "MurihSpace Inbox" && unreadCount > 0) {
        return { ...item, badge: unreadCount };
      }
      if (item.title === "Posts & Reports" && pendingReportsCount > 0) {
        return { ...item, badge: pendingReportsCount };
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
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg group transition-all"
    >
      {collapsed ? (
        <img
          src={collapsedLogo.url}
          alt={collapsedLogo.alt}
          className="h-8 w-8 object-contain shrink-0 transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="flex flex-col gap-1">
          <img
            src={fullLogo.url}
            alt={fullLogo.alt}
            className="h-7 w-auto object-contain shrink-0 transition-transform group-hover:scale-105"
          />
          <span className="text-[9.5px] text-[#2164b6] dark:text-[#7ab0ff] font-bold uppercase tracking-widest pl-0.5">
            {roleLabel}
          </span>
        </div>
      )}
    </Link>
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
          className="relative group/item h-9 gap-3 rounded-lg px-3 text-[13.5px] font-medium
            text-[#65676B] transition-all duration-150
            hover:bg-[#F0F2F5] hover:text-[#1a2e3b]
            data-[active=true]:bg-[#2164b6]/10 data-[active=true]:text-[#2164b6] dark:text-[#7ab0ff] data-[active=true]:font-semibold"
        >
          <Link to={item.url}>
            <span className="shrink-0 opacity-60 group-hover/item:opacity-90 data-[active=true]:opacity-100 data-[active=true]:text-[#2164b6] dark:text-[#7ab0ff]">
              {item.icon}
            </span>
            <span className="flex-1 truncate">{item.title}</span>
            {item.badge != null && !collapsed && (
              <span className="ml-auto flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#2164b6] px-1.5 text-[10px] font-bold text-white shadow-xs">
                {item.badge}
              </span>
            )}
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-[#2164b6]" />
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
            className="relative group/item h-9 gap-3 rounded-lg px-3 text-[13.5px] font-medium
              text-[#65676B] transition-all duration-150
              hover:bg-[#F0F2F5] hover:text-[#1a2e3b]
              data-[active=true]:bg-[#2164b6]/10 data-[active=true]:text-[#2164b6] dark:text-[#7ab0ff] data-[active=true]:font-semibold"
          >
            <span className="shrink-0 opacity-60 group-hover/item:opacity-90">{item.icon}</span>
            <span className="flex-1 truncate">{item.title}</span>
            {item.badge != null && !collapsed && (
              <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#2164b6] px-1.5 text-[10px] font-bold text-white shadow-xs">
                {item.badge}
              </span>
            )}
            <ChevronRight className="size-3.5 shrink-0 opacity-40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-[#2164b6]" />
            )}
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="ml-7 mt-0.5 mb-1 border-l border-[#2164b6]/20 pl-3 space-y-0.5">
            {item.children!.map((child) => (
              <Link
                key={child.title}
                to={child.url}
                className={`flex items-center justify-between rounded-md py-1.5 px-2 text-[12.5px] transition-colors duration-100 ${
                  childActive(child)
                    ? "text-[#2164b6] dark:text-[#7ab0ff] font-semibold bg-[#2164b6]/08"
                    : "text-[#65676B] hover:text-[#1a2e3b] hover:bg-[#F0F2F5]"
                }`}
              >
                <span className="truncate">{child.title}</span>
                {child.badge && (
                  <span className="text-[9px] px-1 rounded bg-[#2164b6]/20 text-[#2164b6] dark:text-[#7ab0ff] font-bold uppercase">
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

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const roleSubtitle: Record<UserRole, string> = {
    member: "Member",
    creator: "Creator",
    vendor: "Vendor",
    admin: "Platform Administrator",
  };

  if (loading || !user) {
    return (
      <div className="space-y-2 px-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="h-auto gap-2.5 rounded-xl px-2 py-2">
              <div className="h-8 w-8 rounded-lg bg-[#2164b6]/10 animate-pulse" />
              <div className="grid flex-1 gap-1">
                <div className="h-3 w-24 rounded bg-[#2164b6]/10 animate-pulse" />
                <div className="h-2.5 w-16 rounded bg-[#2164b6]/10 animate-pulse" />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-1">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="h-auto gap-2.5 rounded-xl px-2 py-2 hover:bg-[#F0F2F5] data-[state=open]:bg-[#F0F2F5]"
              >
                <Avatar className="h-8 w-8 rounded-lg shrink-0">
                  <AvatarFallback className="rounded-lg bg-[#2164b6] text-white text-xs font-bold">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-[13px] font-semibold text-[#1a2e3b]">{user.name}</span>
                  <span className="truncate text-[11px] text-[#65676B]">
                    {roleSubtitle[role]}
                  </span>
                </div>
                <ChevronsUpDown className="size-3.5 shrink-0 text-[#65676B]" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-56 rounded-xl"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={6}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2.5 px-2 py-2">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid leading-tight">
                    <span className="text-[13px] font-semibold">{user.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {role !== "admin" && (
                <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                  <Link to="/app/link-in-bio"><Globe className="size-4" />My Link in Bio</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <Link to="/app/settings/profile"><UserCircle className="size-4" />Profile & Identity</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <Link to="/app/settings/kyc"><ShieldCheck className="size-4" />KYC Verification</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <Link to="/app/wallet"><Wallet className="size-4" />MurihPay Wallet</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <Link to="/app/settings/notifications"><Bell className="size-4" />Notifications</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
}

type SidebarProps = Omit<React.ComponentProps<typeof Sidebar>, "variant">;

export function AppSidebar({ ...props }: SidebarProps) {
  const { user } = useAuth();
  const role: UserRole = user?.role ?? "member";

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [pendingReportsCount, setPendingReportsCount] = useState<number>(0);

  useEffect(() => {
    apiClient
      .get("/conversations?unread_only=true")
      .then((res) => {
        const body = (res.data as { data?: unknown } | undefined)?.data ?? res.data;
        const list = Array.isArray(body) ? body : (body as { data?: unknown } | undefined)?.data;
        const total = (res.data as { total?: unknown } | undefined)?.total ?? (body as { total?: unknown } | undefined)?.total;
        setUnreadCount(Number(total) || (Array.isArray(list) ? list.length : 0));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    apiClient
      .get("/securegate/reports?status=pending")
      .then((res) => {
        const data = res.data;
        if (Array.isArray(data)) {
          setPendingReportsCount(data.length);
        } else if (data?.data && Array.isArray(data.data)) {
          setPendingReportsCount(data.data.length);
        } else if (typeof data?.count === "number") {
          setPendingReportsCount(data.count);
        }
      })
      .catch(() => {});
  }, [role]);

  const flags = useFeatureFlags();
  const nav = filterByFlags(injectBadges(getSidebarNav(role), unreadCount, pendingReportsCount), flags);

  // Blur the sidebar for creators/vendors who haven't finished the setup wizard
  const isSetupIncomplete =
    (role === "creator" || role === "vendor") &&
    user?.onboarding_completed === false;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border shadow-[2px_0_20px_rgba(16,40,64,0.06)]"
      {...props}
    >
      <SidebarHeader className="px-3 pt-3 pb-2">
        <BrandLogo role={role} />
      </SidebarHeader>

      <SidebarSeparator className="opacity-10 mx-3 bg-[#1a2e3b]" />

      <div className="relative flex flex-1 flex-col min-h-0">
        <SidebarContent
          {...(isSetupIncomplete ? { inert: true } : {})}
          className={`px-2 py-1.5 gap-0 transition-all duration-300 ${
            isSetupIncomplete ? "blur-sm pointer-events-none select-none" : ""
          }`}
        >
          {nav.map((group) => (
            <SidebarGroup key={group.title} className="p-0">
              <SidebarGroupLabel className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-widest text-[#65676B]/70">
                {group.title}
              </SidebarGroupLabel>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <NavRow key={item.title} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>

        {isSetupIncomplete && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-white/60 dark:bg-[#081826]/60 backdrop-blur-[2px] rounded-lg mx-1">
            <div className="text-center px-4">
              <div className="w-10 h-10 rounded-full bg-[#2164b6]/15 flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-[#2164b6] dark:text-[#7ab0ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-[11px] font-semibold text-[#1a2e3b] dark:text-white leading-tight mb-3">
                Complete your setup to unlock the dashboard
              </p>
              <Link
                to="/onboarding"
                className="inline-flex items-center gap-1.5 bg-[#2164b6] hover:bg-[#2a96c7] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
              >
                Start Setup Wizard
              </Link>
            </div>
          </div>
        )}
      </div>

      <SidebarSeparator className="opacity-10 mx-3 bg-[#1a2e3b]" />

      <SidebarFooter className="p-2 pb-3">
        <UserFooter role={role} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
