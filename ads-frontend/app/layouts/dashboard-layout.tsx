import { useEffect } from "react";
import { Outlet } from "react-router";
import { TopBar } from "../components/top-bar";
import { SideNav } from "../components/side-nav";

/**
 * API calls authenticate with the bearer token stored at sign-in. Without it
 * there is nothing to show, so send the user to sign in.
 */
function useRequireSignIn() {
  useEffect(() => {
    let token = "";
    try {
      token = window.localStorage.getItem("ads_token") || "";
    } catch {
      token = "";
    }
    if (!token) window.location.assign("/login");
  }, []);
}

export default function DashboardLayout() {
  useRequireSignIn();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex min-w-0 flex-1">
        <SideNav />
        <main id="main" className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
