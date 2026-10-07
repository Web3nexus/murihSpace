import { describe, expect, it } from "vitest";
import { routes } from "@/app/router/routes";
import { PATHS } from "@/lib/deepLinks";

/** Flattens the route tree into every path pattern it registers. */
function patterns(route: (typeof routes)[number], base = ""): string[] {
  const full = route.path
    ? route.path.startsWith("/")
      ? route.path
      : `${base}/${route.path}`.replace(/\/+/g, "/")
    : base;
  return [full, ...(route.children ?? []).flatMap((child) => patterns(child, full))];
}

const registered = routes.flatMap((route) => patterns(route));

function hasRoute(path: string): boolean {
  return registered.includes(path);
}

function hasRouteUnder(prefix: string): boolean {
  return registered.some((p) => p === prefix || p.startsWith(`${prefix}/`));
}

describe("route table", () => {
  it("registers every canonical deep link prefix", () => {
    for (const prefix of Object.values(PATHS)) {
      expect(hasRouteUnder(prefix), `${prefix} has no route`).toBe(true);
    }
  });

  it("registers every destination the apps link to from copy", () => {
    // Kept in sync with the literal paths passed to Env.absolute() in the
    // Flutter app and absolute() here. A route that disappears leaves a
    // shared link that lands on the SPA fallback instead of the page.
    const destinations = [
      "/app",
      "/app/kyc",
      "/app/groups/:slug",
      "/app/wallet/escrow",
      "/app/brand-deals",
      "/app/referrals",
      "/privacy",
      "/terms",
      "/securegate/login",
      "/u/:username",
      "/@:username",
      "/l/:username",
      "/c/:slug",
      "/e/:id",
      "/p/:id",
      "/m/:code",
      "/live/:trackingId",
      "/chat/:id",
      "/store/:shortCode",
    ];
    for (const path of destinations) {
      expect(hasRoute(path), `${path} has no route`).toBe(true);
    }
  });

  it("keeps the legacy aliases the mobile app claims", () => {
    for (const path of ["/meeting/:code", "/meetings/:code", "/products/:id"]) {
      expect(hasRoute(path), `${path} has no route`).toBe(true);
    }
  });
});
