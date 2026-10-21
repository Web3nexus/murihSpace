import { authFetch } from "@/lib/api/authFetch";
import { useState, useEffect } from "react";
import { Outlet, useLocation, Navigate, Link } from "react-router";
import { CloseSquare as X, Home, Discovery as Compass, Plus, Profile as User, Message as MessageSquare } from "@/components/icons";
import { Lightning } from "@/components/icons/rounded";;
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { WebLockedPage } from "@/components/WebLockedPage";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PopChatWidget } from "@/components/chat/PopChatWidget";
import { SessionDock } from "@/components/session/SessionDock";
import { RealtimeNotificationsHost } from "@/hooks/useGlobalRealtimeNotifications";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function OnboardingBanner() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [status, setStatus] = useState<"loading" | "show" | "hide">("loading");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || user.role === "admin") return;
    let cancelled = false;
    authFetch(`${API_BASE}/onboarding`, {
      headers: { Accept: "application/json" },
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
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--shell-accent)]/30 bg-[var(--shell-accent)]/10 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Lightning weight="fill" className="h-4 w-4 text-[var(--shell-accent)] dark:text-[var(--shell-accent)] shrink-0" />
          <p className="text-xs font-medium text-foreground truncate">
            Your space isn't set up yet — take the 5-minute <span className="font-bold text-[var(--shell-accent)] dark:text-[var(--shell-accent)]">AI onboarding</span> and Mera will build your profile.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link to="/app/onboarding" className="text-xs font-bold bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white px-3 py-1.5 rounded-lg transition-colors">
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

  const isTabActive = (tabTo: string) => {
    if (tabTo === "/app") return pathname === "/app" || pathname === "/app/";
    return pathname.startsWith(tabTo);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden h-16 bg-white dark:bg-[var(--shell-surface)] border-t border-[var(--shell-border)] dark:border-[var(--shell-border)] flex items-center justify-around px-3 select-none shadow-sm">
      {/* 1. Home */}
      <Link
        to="/app"
        className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
          isTabActive("/app")
            ? "text-[var(--shell-accent)] dark:text-[var(--shell-accent)]"
            : "text-[var(--shell-muted)] dark:text-[var(--shell-muted)] hover:text-[var(--shell-text)] dark:hover:text-white"
        }`}
      >
        <Home weight={isTabActive("/app") ? "fill" : "regular"} className="h-5 w-5" />
        <span className="text-[10px] font-semibold leading-tight mt-1">Home</span>
      </Link>

      {/* 2. Discover */}
      <Link
        to="/app/communities"
        className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
          isTabActive("/app/communities") || isTabActive("/app/discover")
            ? "text-[var(--shell-accent)] dark:text-[var(--shell-accent)]"
            : "text-[var(--shell-muted)] dark:text-[var(--shell-muted)] hover:text-[var(--shell-text)] dark:hover:text-white"
        }`}
      >
        <Compass weight={isTabActive("/app/communities") || isTabActive("/app/discover") ? "fill" : "regular"} className="h-5 w-5" />
        <span className="text-[10px] font-semibold leading-tight mt-1">Discover</span>
      </Link>

      {/* 3. Create (Elevated Button) */}
      <Link
        to="/app/feed"
        className="flex flex-col items-center justify-center flex-1 h-full py-1"
      >
        <div className="w-10 h-10 rounded-xl bg-[var(--shell-accent-solid)] text-white flex items-center justify-center shadow-md shadow-[var(--shell-accent)]/30 hover:bg-[var(--shell-accent-hover)] transition-transform active:scale-95">
          <Plus weight="bold" className="h-5 w-5" />
        </div>
      </Link>

      {/* 4. Messages (Preserved Chat Icon) */}
      <Link
        to="/app/messages"
        className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
          isTabActive("/app/messages")
            ? "text-[var(--shell-accent)] dark:text-[var(--shell-accent)]"
            : "text-[var(--shell-muted)] dark:text-[var(--shell-muted)] hover:text-[var(--shell-text)] dark:hover:text-white"
        }`}
      >
        <MessageSquare weight={isTabActive("/app/messages") ? "fill" : "regular"} className="h-5 w-5" />
        <span className="text-[10px] font-semibold leading-tight mt-1">Messages</span>
      </Link>

      {/* 5. Profile */}
      <Link
        to="/app/profile"
        className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
          isTabActive("/app/profile")
            ? "text-[var(--shell-accent)] dark:text-[var(--shell-accent)]"
            : "text-[var(--shell-muted)] dark:text-[var(--shell-muted)] hover:text-[var(--shell-text)] dark:hover:text-white"
        }`}
      >
        <User weight={isTabActive("/app/profile") ? "fill" : "regular"} className="h-5 w-5" />
        <span className="text-[10px] font-semibold leading-tight mt-1">Profile</span>
      </Link>
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
  const hideSidebar = pathname === "/app/profile" || pathname.startsWith("/app/profile/");

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
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-[var(--shell-canvas)] dark:bg-[var(--shell-canvas)] text-[var(--shell-text)] dark:text-[var(--shell-text)]">
      {/* Global live notification + badge listeners */}
      <RealtimeNotificationsHost />

      {/* 100vw Edge-to-edge Global Social Header */}
      <SiteHeader onOpenMobileSidebar={() => setMobileMenuOpen(true)} />

      {/* Onboarding Banner if applicable */}
      <OnboardingBanner />

      {/* Social Shell below header: Sidebar + Feed / Page Outlet */}
      <div className={`flex-1 flex w-full mx-auto min-h-0 ${hideSidebar ? "" : "max-w-[1920px]"}`}>
        {/* Left Desktop Sidebar: visible on desktop for all users (hidden on full-width profile) */}
        {!hideSidebar && (
          <aside className="w-[240px] xl:w-[260px] shrink-0 hidden md:block h-full overflow-y-auto no-scrollbar py-3 px-2">
            <AppSidebar />
          </aside>
        )}

        {/* Main Content Area — the single scrolling surface of the shell, so
            the header and sidebar stay pinned while only this area moves. */}
        <main
          id="main-content"
          className="flex-1 min-w-0 min-h-0 overflow-y-auto flex flex-col bg-[var(--shell-canvas)] dark:bg-[var(--shell-canvas)] pb-16 md:pb-0"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-3 w-[280px] bg-white dark:bg-[var(--shell-surface)] border-r border-[var(--shell-border)] dark:border-[var(--shell-border)]">
          <div className="h-full pt-4">
            <AppSidebar onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Floating Pop Chat widget — user-side only, docked bottom-right, only shows when a chat is open */}
      {!isAdmin && <PopChatWidget />}

      {/* Keeps an active call / meeting / live broadcast alive while browsing.
          Without this, navigating away used to disconnect the LiveKit room and
          empty the participant roster for everyone still in the session. */}
      <SessionDock />

      {!isAdmin && <MobileBottomNav />}
    </div>
  );
}
