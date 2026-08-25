import { useNavigate } from 'react-router';
import { LogOut, ShieldAlert } from 'lucide-react';
import { clearImpersonationToken } from '@/lib/auth/token';

export function ImpersonationBanner() {
  const navigate = useNavigate();
  const isImpersonating = sessionStorage.getItem('is_impersonating') === 'true';
  const userData = sessionStorage.getItem('impersonated_user');
  const user = userData ? JSON.parse(userData) : null;

  if (!isImpersonating || !user) return null;

  const stopImpersonating = () => {
    clearImpersonationToken();
    sessionStorage.removeItem('is_impersonating');
    sessionStorage.removeItem('impersonated_user');
    navigate('/app/securegate');
    window.location.reload();
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-amber-500/95 dark:bg-amber-600/95 backdrop-blur-md px-6 py-2 text-xs font-semibold text-white shadow-md border-b border-amber-600/30">
      <div className="flex items-center gap-2 max-w-full overflow-hidden">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-100" />
        <span className="truncate">
          Impersonating <strong className="underline decoration-white/40">{user.name}</strong> (@{user.username}) &mdash; <span className="uppercase font-black text-[10px] tracking-wider bg-white/20 px-1.5 py-0.5 rounded-sm">{user.role}</span>
        </span>
      </div>
      <button
        onClick={stopImpersonating}
        className="flex items-center gap-1.5 shrink-0 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-bold text-white transition-all shadow-xs active:scale-95"
      >
        <LogOut className="h-3.5 w-3.5" /> Stop Impersonating
      </button>
    </div>
  );
}
