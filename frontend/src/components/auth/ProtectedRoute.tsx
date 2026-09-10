import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/navigation/navTypes";

import { BrandPreloader } from "@/components/common/BrandPreloader";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole | UserRole[];
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, requiredRole, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return <BrandPreloader fullScreen message="Loading MurihSpace…" />;
  }

  if (!isAuthenticated) {
    // If an unauthenticated guest opened a community URL (/app/communities/:slug), redirect to public /c/:slug preview
    const commMatch = location.pathname.match(/^\/app\/communities\/([^/]+)$/);
    if (commMatch) {
      return <Navigate to={`/c/${commMatch[1]}`} replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role === "admin") {
    return <>{children}</>;
  }

  const roles: UserRole[] = allowedRoles
    ? allowedRoles
    : Array.isArray(requiredRole)
    ? requiredRole
    : requiredRole
    ? [requiredRole]
    : [];

  if (roles.length > 0 && user && !roles.includes(user.role as UserRole)) {
    return <Navigate to="/app" replace />;
  }

  // All authenticated user roles (member, creator, vendor, admin) have access to base member routes
  return <>{children}</>;
}
