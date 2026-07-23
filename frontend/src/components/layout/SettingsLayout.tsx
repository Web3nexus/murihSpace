import { NavLink, Outlet } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  BellIcon,
  PaintbrushIcon,
  GlobeIcon,
  KeyboardIcon,
  LockIcon,
  UserIcon,
  ShieldIcon,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Profile",       href: "/app/settings",               icon: UserIcon,       end: true },
  { name: "Security",      href: "/app/settings/security",      icon: ShieldIcon,     end: false },
  { name: "Notifications", href: "/app/settings/notifications", icon: BellIcon,       end: false },
  { name: "Appearance",    href: "/app/settings/preferences",   icon: PaintbrushIcon, end: false },
  { name: "Privacy",       href: "/app/settings/privacy",       icon: LockIcon,       end: false },
  { name: "Language",      href: "/app/settings/language",      icon: GlobeIcon,      end: false },
  { name: "Accessibility", href: "/app/settings/accessibility", icon: KeyboardIcon,   end: false },
];

export function SettingsLayout() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your account, preferences, and privacy.
        </p>
      </div>

      {/* sidebar-13 pattern: SidebarProvider wrapping settings nav + content */}
      <SidebarProvider className="items-start min-h-0 rounded-xl border border-border overflow-hidden bg-card">
        <Sidebar collapsible="none" className="w-48 shrink-0 border-r">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <NavLink
                        to={item.href}
                        end={item.end}
                        id={`settings-nav-${item.name.toLowerCase()}`}
                      >
                        {({ isActive }) => (
                          <SidebarMenuButton isActive={isActive} asChild>
                            <span className="flex items-center gap-2 cursor-pointer">
                              <item.icon className="h-4 w-4" />
                              {item.name}
                            </span>
                          </SidebarMenuButton>
                        )}
                      </NavLink>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Settings Content */}
        <main className="flex flex-1 flex-col min-h-[400px] overflow-y-auto p-6">
          <Outlet />
        </main>
      </SidebarProvider>
    </div>
  );
}
