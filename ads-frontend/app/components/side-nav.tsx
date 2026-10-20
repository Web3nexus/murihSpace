import { Link, useLocation } from "react-router";
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Images,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  Settings,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  match?: "exact" | "prefix";
}

export const PRIMARY_NAV: NavItem[] = [
  { title: "Campaigns", url: "/campaigns", icon: Megaphone },
  { title: "Ad groups", url: "/ad-groups", icon: Layers },
  { title: "Ads", url: "/ads", icon: LayoutGrid },
  { title: "Reports", url: "/analytics", icon: BarChart3 },
  { title: "Billing", url: "/billing", icon: CreditCard },
  { title: "Settings", url: "/business", icon: Settings },
];

// Existing tools kept reachable below the six main sections.
export const TOOLS_NAV: NavItem[] = [
  { title: "Overview", url: "/", icon: LayoutDashboard, match: "exact" },
  { title: "Assets", url: "/creative", icon: Images },
  { title: "Audiences", url: "/audiences", icon: Users },
  { title: "Events manager", url: "/events-manager", icon: CalendarDays },
  { title: "Catalogs", url: "/catalogs", icon: ShoppingBag },
];

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = item.match === "exact" ? pathname === item.url : pathname.startsWith(item.url);
  const Icon = item.icon;
  return (
    <Link
      to={item.url}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-primary/10 text-ads-accent-text"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {item.title}
    </Link>
  );
}

/** Left navigation. Used as a fixed column on large screens and inside a sheet on smaller ones. */
export function SideNavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Ads Manager sections" className="flex flex-col gap-6 p-3">
      <div className="flex flex-col gap-1">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.title} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tools</p>
        {TOOLS_NAV.map((item) => (
          <NavLink key={item.title} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}

export function SideNav() {
  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 self-start overflow-y-auto border-r border-border bg-background lg:block">
      <SideNavContent />
    </aside>
  );
}
