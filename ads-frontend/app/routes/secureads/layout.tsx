import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger, Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset } from "../../components/ui/sidebar";
import { Link, Outlet } from "react-router";
import { ShieldAlert, Users, Image as ImageIcon } from "lucide-react";
import { readAdsToken, sendToStaffSignIn } from "../../lib/staff-session";

const navItems = [
  { title: "Verification Queue", url: "/secureads/advertisers/verification", icon: Users },
  { title: "Creative Moderation", url: "/secureads/moderation/creatives", icon: ImageIcon },
];

export default function SecureAdsLayout() {
  // The staff token lives in localStorage, which the server cannot read. The
  // admin shell therefore renders only once a token is present in the browser.
  // The ads API still enforces the staff ability on every admin call.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (readAdsToken()) {
      setReady(true);
    } else {
      sendToStaffSignIn();
    }
  }, []);

  if (!ready) return null;

  return (
    <SidebarProvider>
      <Sidebar className="border-r border-red-900/20 shadow-sm bg-slate-900 text-slate-100">
        <SidebarContent>
          <div className="p-6 flex items-center gap-2 text-red-500 font-bold tracking-widest uppercase">
            <ShieldAlert className="h-5 w-5" />
            Secure Ads
          </div>
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-slate-500">Admin Controls</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton render={<Link to={item.url} />} className="hover:bg-slate-800 text-slate-300">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
          <SidebarTrigger />
          <div className="flex-1">
            <h1 className="text-lg font-semibold tracking-tight text-red-600">Administration Portal</h1>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
