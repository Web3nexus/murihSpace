import { useNavigate } from 'react-router';
import { LogOut, AlertTriangle } from 'lucide-react';

export function ImpersonationBanner() {
  const navigate = useNavigate();
  const isImpersonating = localStorage.getItem('is_impersonating') === 'true';
  const userData = localStorage.getItem('impersonated_user');
  const user = userData ? JSON.parse(userData) : null;

  if (!isImpersonating || !user) return null;

  const stopImpersonating = () => {
    const adminToken = localStorage.getItem('admin_token');
    if (adminToken) {
      localStorage.setItem('murihspace-token', adminToken);
    }
    localStorage.removeItem('admin_token');
    localStorage.removeItem('is_impersonating');
    localStorage.removeItem('impersonated_user');
    navigate('/app/securegate');
    window.location.reload();
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-lg">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        Impersonating <strong>{user.name}</strong> (@{user.username}) &mdash; {user.role}
      </span>
      <button
        onClick={stopImpersonating}
        className="ml-2 flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1 text-xs font-bold hover:bg-white/30 transition-colors"
      >
        <LogOut className="h-3.5 w-3.5" /> Stop Impersonating
      </button>
    </div>
  );
}
