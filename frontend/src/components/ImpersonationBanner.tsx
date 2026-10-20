import { useState } from "react";
import { Logout as LogOut, ShieldFail as ShieldWarning } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";

/**
 * Shown on every page while an administrator is viewing the app as another
 * account. The flag comes from the server (`impersonating` on /user), so the
 * banner cannot be dismissed and stays until impersonation ends.
 */
export function ImpersonationBanner() {
  const { user, stopImpersonation } = useAuth();
  const [stopping, setStopping] = useState(false);

  if (!user?.impersonating) return null;

  const handleStop = async () => {
    setStopping(true);
    let stopped: boolean;
    try {
      stopped = await stopImpersonation();
    } catch {
      stopped = false;
    }
    if (!stopped) {
      // Still impersonating: stay on this page and let the administrator try again.
      setStopping(false);
      return;
    }
    // A full load returns the administrator to the user list with no cached data from the other account.
    window.location.assign("/app/securegate/users");
  };

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-amber-500/95 dark:bg-amber-600/95 backdrop-blur-md px-4 sm:px-6 py-2 text-xs font-semibold text-white border-b border-amber-600/30 shadow-md"
    >
      <div className="flex items-center gap-2 min-w-0">
        <ShieldWarning weight="fill" className="h-4 w-4 shrink-0 text-amber-100 animate-pulse" aria-hidden="true" />
        <span className="truncate">
          You are viewing as <strong className="underline decoration-white/40">{user.name}</strong>
        </span>
      </div>
      <button
        type="button"
        onClick={handleStop}
        disabled={stopping}
        className="flex items-center gap-1.5 shrink-0 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer shadow-sm disabled:opacity-60"
      >
        <LogOut weight="fill" className="h-3.5 w-3.5" aria-hidden="true" /> Stop impersonating
      </button>
    </div>
  );
}
