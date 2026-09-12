import { useState, useEffect } from "react";
import { Outlet, useLocation, Navigate, Link } from "react-router";
import {
  Sparkle,
  X,
  House as Home,
  Users,
  ShoppingBag,
  ChatTeardropText as MessageSquare,
  ChartBar,
  Package,
  ShoppingCart,
  Wallet,
  FileText,
} from "@phosphor-icons/react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { WebLockedPage } from "@/components/WebLockedPage";
import { getAuthToken } from "@/lib/auth/token";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PopChatWidget } from "@/components/chat/PopChatWidget";
import { RealtimeNotificationsHost } from "@/hooks/useGlobalRealtimeNotifications";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function OnboardingBanner() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [status, setStatus] = useState<"loading" | "show" | "hide">("loading");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || user.role === "admin") return;
    const token = getAuthToken();
    if (!token) return;
    let cancelled = false;
    fetch(`${API_BASE}/onboarding`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((j) => {
        if (cancelled) return;
        const d = j?.success ? j?.data : j;
        const unwrapped = d?.data ?? d;
        setStatus(unwrapped?.onboarding_completed ? "hide" : "show");
      })
      .catch(() => setStatus("hide"));
    return () => { cancelled = true; };
  }, [user]);

  if (status !== "show" || dismissed || pathname.startsWith("/app/onboarding")) return null;

  return (
    <div className="mx-auto max-w-5xl my-2 px-4 w-full">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[#2164b6]/30 bg-[#2164b6]/10 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Sparkle weight="fill" className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff] shrink-0" />
          <p className="text-xs font-medium text-foreground truncate">
            Your space isn't set up yet — take the 5-minute <span className="font-bold text-[#2164b6] dark:text-[#7ab0ff]">AI onboarding</span> and Mera will build your profile.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link to="/app/onboarding" className="text-xs font-bold bg-[#2164b6] hover:bg-[#1a5091] text-white px-3 py-1.5 rounded-lg transition-colors">
            Set up now
          </Link>
          <button onClick={() => setDismissed(true)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X weight="bold" className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

function MobileBottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const role = user?.role ?? "member";

  const isTabActive = (tabTo: string) => {
    if (tabTo === "/app") return pathname === "/app" || pathname === "/app/";
    return pathname.startsWith(tabTo);
  };

  const navItems =
    role === "vendor"
      ? [
          { id: "home", label: "Home", icon: Home, to: "/app" },
          { id: "products", label: "Products", icon: Package, to: "/app/store/physical-products" },
          { id: "orders", label: "Orders", icon: ShoppingCart, to: "/app/store/orders" },
          { id: "messages", label: "Messages", icon: MessageSquare, to: "/app/messages" },
          { id: "wallet", label: "Wallet", icon: Wallet, to: "/app/wallet" },
        ]
      : role === "creator"
      ? [
          { id: "home", label: "Home", icon: Home, to: "/app" },
          { id: "friends", label: "Friends", icon: Users, to: "/app/friends" },
          { id: "community", label: "Community", icon: Users, to: "/app/communities" },
          { id: "store", label: "Store", icon: ShoppingBag, to: "/app/store" },
          { id: "insights", label: "Insights", icon: ChartBar, to: "/app/insights" },
        ]
      : [
          { id: "home", label: "Home", icon: Home, to: "/app" },
          { id: "friends", label: "Friends", icon: Users, to: "/app/friends" },
          { id: "community", label: "Community", icon: Users, to: "/app/communities" },
          { id: "feed", label: "Feed", icon: FileText, to: "/app/feed" },
          { id: "shop", label: "Shop", icon: ShoppingBag, to: "/app/store" },
        ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden h-14 bg-white dark:bg-[#242526] border-t border-[#DADDE1] dark:border-[#3E4042] flex items-center justify-around px-2 select-none shadow-sm">
      {navItems.map((item) => {
        const active = isTabActive(item.to);
        const IconComp = item.icon;
        return (
          <Link
            key={item.id}
            to={item.to}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
              active
                ? "text-[#2164b6] dark:text-[#7ab0ff]"
                : "text-[#65676B] dark:text-[#B0B3B8] hover:text-[#050505] dark:hover:text-[#E4E6EB]"
            }`}
          >
            <IconComp weight={active ? "fill" : "regular"} className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-tight mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const cfg = usePlatformConfig();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const isAppHome = pathname === "/app" || pathname === "/app/";

  if (isAdmin && isAppHome) {
    return <Navigate to="/app/securegate" replace />;
  }

  if (
    !isAdmin &&
    user &&
    !cfg.loading &&
    (cfg.web_disabled_roles as string[]).includes(user.role)
  ) {
    return <WebLockedPage role={user.role} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F0F2F5] dark:bg-[#18191A] text-[#050505] dark:text-[#E4E6EB]">
      {/* 100vw Impersonation banner at the very top */}
      <ImpersonationBanner />

      {/* Global live notification + badge listeners */}
      <RealtimeNotificationsHost />

      {/* 100vw Edge-to-edge Global Social Header */}
      <SiteHeader onOpenMobileSidebar={() => setMobileMenuOpen(true)} />

      {/* Onboarding Banner if applicable */}
      <OnboardingBanner />

      {/* Social Shell below header: Sidebar + Feed / Page Outlet */}
      <div className="flex-1 flex w-full max-w-[1920px] mx-auto min-h-0">
        {/* Left Desktop Sidebar: visible on desktop for all users */}
        <aside className="w-[240px] xl:w-[260px] shrink-0 hidden md:block sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto no-scrollbar py-3 px-2">
          <AppSidebar />
        </aside>

        {/* Main Content Area */}
        <main
          id="main-content"
          className="flex-1 min-w-0 h-[calc(100dvh-3.5rem)] flex flex-col pb-16 md:pb-0"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-3 w-[280px] bg-white dark:bg-[#242526] border-r border-[#DADDE1] dark:border-[#3E4042]">
          <div className="h-full pt-4">
            <AppSidebar onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Floating Pop Chat widget (docked bottom-right Facebook Messenger style) */}
      <PopChatWidget />

      {!isAdmin && <MobileBottomNav />}
    </div>
  );
}
