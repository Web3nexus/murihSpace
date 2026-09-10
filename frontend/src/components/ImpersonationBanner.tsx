import {
  SignOut as LogOut,
  ShieldWarning as ShieldWarning
} from "@phosphor-icons/react";
import { clearImpersonationToken, isImpersonating, getImpersonatedUser } from '@/lib/auth/token';

export function ImpersonationBanner() {
  const active = isImpersonating();
  const user = getImpersonatedUser();

  if (!active || !user) return null;

  const stopImpersonating = () => {
    clearImpersonationToken();
    window.location.assign('/app/securegate/users');
  };

  const handle = user.username ? `@${user.username}` : user.email ? `(${user.email})` : '';

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-amber-500/95 dark:bg-amber-600/95 backdrop-blur-md px-4 sm:px-6 py-2 text-xs font-semibold text-white border-b border-amber-600/30 shadow-md">
      <div className="flex items-center gap-2 max-w-full overflow-hidden">
        <ShieldWarning weight="fill" className="h-4 w-4 shrink-0 text-amber-100 animate-pulse" />
        <span className="truncate">
          Impersonating <strong className="underline decoration-white/40">{user.name}</strong> {handle && <span className="opacity-90">{handle}</span>} &mdash; <span className="uppercase font-black text-[10px] tracking-wider bg-white/20 px-1.5 py-0.5 rounded-sm">{user.role}</span>
        </span>
      </div>
      <button
        onClick={stopImpersonating}
        className="flex items-center gap-1.5 shrink-0 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer shadow-sm"
      >
        <LogOut weight="fill" className="h-3.5 w-3.5" /> Stop Impersonating
      </button>
    </div>
  );
}

