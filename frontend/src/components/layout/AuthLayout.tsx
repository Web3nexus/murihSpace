import React from "react";
import { Link, Outlet } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuthLayoutProps {
  backHref?: string;
  backLabel?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  backHref = "/",
  backLabel = "Back to home",
}) => {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background">
      {/* Background gradient decoration */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
      >
        <div className="absolute left-1/4 top-1/4 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[32rem] w-[32rem] translate-x-1/2 translate-y-1/2 rounded-full bg-secondary/10 blur-[120px]" />
      </div>

      {/* Back link */}
      <div className="absolute left-6 top-6">
        <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
          <Link to={backHref} id="auth-back-link">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
      </div>

      {/* Brand logo */}
      <div className="absolute right-6 top-6 flex items-center gap-2">
        <img src="/logo_blue.png" alt="MurihSpace" className="h-7 w-auto object-contain dark:hidden" />
        <img src="/logo_white.png" alt="MurihSpace" className="h-7 w-auto object-contain hidden dark:block" />
      </div>

      {/* Auth Card */}
      <div className="relative w-full max-w-md px-4">
        <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-xl backdrop-blur-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
