import { Outlet, useLocation, Navigate } from "react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { useAuth } from "@/hooks/useAuth";

export function DashboardLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const isAdmin = user?.role === "admin";
  const isOnSecuregate = pathname.startsWith("/app/securegate");

  if (isAdmin && !isOnSecuregate) {
    return <Navigate to="/app/securegate" replace />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <ImpersonationBanner />
        <SiteHeader />
        <main
          id="main-content"
          className="flex flex-1 flex-col"
        >
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
