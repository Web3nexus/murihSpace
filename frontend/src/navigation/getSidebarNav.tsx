import type { UserRole, NavGroup, NavItem } from "./navTypes";
import { getAdsManagerHref } from "@/lib/adsManager";
import { memberNav } from "./memberNav";
import { creatorNav } from "./creatorNav";
import { vendorNav } from "./vendorNav";
import { adminNav } from "./adminNav";

const navMap: Record<UserRole, NavGroup[]> = {
  member: memberNav,
  creator: creatorNav,
  vendor: vendorNav,
  admin: adminNav,
};

export function getSidebarNav(role: UserRole): NavGroup[] {
  return navMap[role] ?? memberNav;
}

const EXTERNAL_TARGETS: Record<NonNullable<NavItem["external"]>, () => string | undefined> = {
  "ads-manager": () => getAdsManagerHref(),
};

/**
 * Resolves items that open an external app. Each one takes its address from the
 * environment at runtime. An item whose address is missing or unsafe is removed,
 * and a group left empty by that is removed too.
 */
export function resolveExternalItems(nav: NavGroup[]): NavGroup[] {
  return nav
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => {
          if (!item.external) return item;
          const href = EXTERNAL_TARGETS[item.external]();
          return href ? { ...item, url: href } : null;
        })
        .filter((item): item is NavItem => item !== null),
    }))
    .filter((group) => group.items.length > 0);
}
