import { useEffect } from "react";
import { useLocation } from "react-router";
import { syncRouteTitle } from "@/lib/pageTitle";

export function RouteTitleSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    syncRouteTitle(pathname);
  }, [pathname]);

  return null;
}
