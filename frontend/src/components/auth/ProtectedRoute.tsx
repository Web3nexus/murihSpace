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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#38A8D8] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
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

  if (requiredRole === "member" && user?.role !== "member") {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
