import { useEffect } from "react";
import { Navigate } from "react-router";
import { isProfileDomainHost, mainSiteUrl } from "@/lib/deepLinks";
import { BrandPreloader } from "@/components/common/BrandPreloader";

export const PageLoader = () => <BrandPreloader size="md" />;

/**
 * Sends the browser to another origin (React Router's <Navigate> only handles
 * in-app paths). Renders the brand loader while the browser navigates.
 */
export function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return <PageLoader />;
}

/**
 * Root route. On the vanity profile domain (e.g. `murih.me`, `s.murih.me`) a
 * bare hit with no handle has nothing to show, so we hand the visitor to the
 * main site — mirroring `wa.me` → `whatsapp.com`. Everywhere else, `/` keeps its
 * existing dashboard redirect.
 */
export function RootRedirect() {
  if (isProfileDomainHost()) {
    const currentHost = window.location.hostname.replace(/^www\./i, "").toLowerCase();
    let targetHost: string;
    const target = mainSiteUrl();
    try {
      targetHost = new URL(target).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      targetHost = "";
    }
    // Only bounce externally when we have a valid, different target — otherwise
    // we'd loop back to this same host or navigate to an unusable URL.
    if (targetHost && targetHost !== currentHost) {
      return <ExternalRedirect to={target} />;
    }
  }
  return <Navigate to="/app" replace />;
}
