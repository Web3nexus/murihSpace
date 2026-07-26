import { Outlet } from "react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";

export function DashboardLayout() {
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
