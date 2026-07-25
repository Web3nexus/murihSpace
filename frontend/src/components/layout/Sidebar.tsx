import React from "react";
import { Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Users,
  Store,
  MessageSquare,
  Settings,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Compass,
  Wallet,
  Heart,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type UserRole = "member" | "creator" | "vendor" | "admin";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/app",
    icon: LayoutDashboard,
    roles: ["member", "creator", "vendor", "admin"],
  },
  {
    title: "Discover",
    href: "/app/discover",
    icon: Compass,
    roles: ["member", "creator", "vendor", "admin"],
  },
  {
    title: "Communities",
    href: "/app/communities",
    icon: Users,
    roles: ["member", "creator", "vendor", "admin"],
  },
  {
    title: "Storefront & Items",
    href: "/app/store",
    icon: Store,
    roles: ["creator", "vendor", "admin"],
  },
  {
    title: "Wallet",
    href: "/app/wallet",
    icon: Wallet,
    roles: ["member", "creator", "vendor", "admin"],
  },
  {
    title: "Purchase Library",
    href: "/app/wallet/purchases",
    icon: Package,
    roles: ["member", "creator", "vendor", "admin"],
  },
  {
    title: "Tips & Donations",
    href: "/app/wallet/donations",
    icon: Heart,
    roles: ["member", "creator", "vendor", "admin"],
  },
  {
    title: "Messages",
    href: "/app/messages",
    icon: MessageSquare,
    roles: ["member", "creator", "vendor", "admin"],
  },
  {
    title: "Settings",
    href: "/app/settings",
    icon: Settings,
    roles: ["member", "creator", "vendor", "admin"],
  },
  {
    title: "Platform Admin",
    href: "/app/securegate",
    icon: ShieldAlert,
    roles: ["admin"],
  },
];

interface SidebarProps {
  currentRole: UserRole;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  collapsed,
  onToggleCollapse,
}) => {
  const location = useLocation();

  const filteredNav = navItems.filter((item) => item.roles.includes(currentRole));

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-border bg-card transition-all duration-300 select-none",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            M
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg tracking-tight whitespace-nowrap">
              MurihSpace
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Role Badge Indicator */}
      {!collapsed && (
        <div className="px-4 py-2 border-b border-border bg-muted/40">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Active Role</span>
            <span className="capitalize font-semibold text-primary px-2 py-0.5 rounded bg-primary/10">
              {currentRole}
            </span>
          </div>
        </div>
      )}

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.title : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer info */}
      {!collapsed && (
        <div className="p-4 border-t border-border text-xs text-muted-foreground">
          MurihSpace v0.1.0 • Sprint 2 Shell
        </div>
      )}
    </aside>
  );
};
