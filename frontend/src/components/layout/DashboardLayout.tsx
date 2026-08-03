import { useState, useEffect } from "react";
import { Outlet, useLocation, Navigate, Link } from "react-router";
import { Sparkles, X } from "lucide-react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { WebLockedPage } from "@/components/WebLockedPage";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

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
    <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#38A8D8]/30 bg-[#38A8D8]/10 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Sparkles className="h-4 w-4 text-[#38A8D8] shrink-0" />
        <p className="text-xs font-medium text-foreground truncate">
          Your space isn't set up yet — take the 5-minute <span className="font-bold text-[#38A8D8]">AI onboarding</span> and Mera will build your profile.
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Link to="/app/onboarding" className="text-xs font-bold bg-[#38A8D8] hover:bg-[#2e94c0] text-white px-3 py-1.5 rounded-lg transition-colors">
          Set up now
        </Link>
        <button onClick={() => setDismissed(true)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

export function DashboardLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const cfg = usePlatformConfig();

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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <ImpersonationBanner />
        <SiteHeader />
        <OnboardingBanner />
        <main
          id="main-content"
          className="flex flex-1 flex-col min-h-0 overflow-y-auto"
        >
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
