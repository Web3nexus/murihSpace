import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/navigation/navTypes";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2164b6] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // If an unauthenticated guest opened a community URL (/app/communities/:slug), redirect to public /c/:slug preview
    const commMatch = location.pathname.match(/^\/app\/communities\/([^/]+)$/);
    if (commMatch) {
      return <Navigate to={`/c/${commMatch[1]}`} replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole === "admin" && user?.role !== "admin") {
    return <Navigate to="/app" replace />;
  }

  if (requiredRole === "creator" && user?.role !== "creator" && user?.role !== "admin") {
    return <Navigate to="/app" replace />;
  }

  if (requiredRole === "vendor" && user?.role !== "vendor" && user?.role !== "admin") {
    return <Navigate to="/app" replace />;
  }

  // All authenticated user roles (member, creator, vendor, admin) have access to base member routes

  return <>{children}</>;
}
