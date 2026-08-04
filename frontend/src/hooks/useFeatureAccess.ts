import { useCallback } from "react";
import { useAuth } from "./useAuth";
import { hasFeatureAccess, getAccessibleFeatures } from "@/lib/roleFeatures";
import type { RoleFeatures } from "@/lib/roleFeatures";

/**
 * Hook for checking feature access based on user role
 */
export function useFeatureAccess() {
  const { user } = useAuth();
  const role = user?.role ?? "member";

  const canAccess = useCallback(
    (feature: keyof RoleFeatures): boolean => {
      return hasFeatureAccess(role, feature);
    },
    [role]
  );

  const accessibleFeatures = useCallback((): string[] => {
    return getAccessibleFeatures(role);
  }, [role]);

  return {
    canAccess,
    accessibleFeatures,
    role,
  };
}
