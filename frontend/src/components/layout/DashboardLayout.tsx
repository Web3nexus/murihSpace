import { Outlet, useLocation } from "react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

/** Any route that starts with /app/admin gets the admin sidebar */
function useLayoutVariant(): "user" | "admin" {
  const { pathname } = useLocation();
  return pathname.startsWith("/app/admin") ? "admin" : "user";
}

export function DashboardLayout() {
  const variant = useLayoutVariant();

  return (
    <SidebarProvider>
      <AppSidebar variant={variant} />
      <SidebarInset>
        <SiteHeader />
        <main
          id="main-content"
          className="flex flex-1 flex-col gap-4 p-6"
        >
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
