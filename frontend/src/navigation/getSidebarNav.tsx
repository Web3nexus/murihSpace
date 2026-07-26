import type { UserRole, NavGroup } from "./navTypes";
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
