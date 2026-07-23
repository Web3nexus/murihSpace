import { Link } from "react-router";
import { useLocation } from "react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";

function usePageTitle() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

export function SiteHeader() {
  const segments = usePageTitle();

  return (
    <header className="sticky top-0 z-50 flex h-[68px] shrink-0 items-center gap-3 border-b border-border bg-background/90 backdrop-blur-md px-4">
      {/* Sidebar Toggle */}
      <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="h-5" />

      {/* Breadcrumb Navigation */}
      <Breadcrumb className="flex-1">
        <BreadcrumbList>
          <BreadcrumbItem>
            <Link to="/app" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              MurihSpace
            </Link>
          </BreadcrumbItem>
          {segments.slice(1).map((seg, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {idx === segments.length - 2 ? (
                  <BreadcrumbPage className="text-xs font-semibold text-foreground capitalize">
                    {seg}
                  </BreadcrumbPage>
                ) : (
                  <span className="text-xs text-muted-foreground capitalize">{seg}</span>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Right-side Header Actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>

        {/* Notification Dropdown */}
        <NotificationDropdown />

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Avatar / Profile access */}
        <Link
          to="/app/settings"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
          aria-label="Your profile settings"
        >
          VP
        </Link>
      </div>
    </header>
  );
}
