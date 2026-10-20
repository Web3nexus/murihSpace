import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api/client";
import {
  getUnreadCount,
  subscribeUnreadCount,
} from "@/lib/chatUnread";
import { getSidebarNav, resolveExternalItems } from "@/navigation/getSidebarNav";
import { ROLE_LABELS } from "@/navigation/navTypes";
import type { NavItem, NavGroup, UserRole } from "@/navigation/navTypes";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { Logout as SignOut, Profile as UserCircle, Profile as User, ShieldDone as ShieldCheck, Wallet, Notification as Bell, ArrowDown as CaretDown } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const RELATED_SECTION_PATHS: Record<string, string[]> = {
  "/app/events": ["/app/events", "/app/my-events", "/app/audio-rooms", "/app/communities/events"],
  "/app/communities": ["/app/communities", "/app/feed"],
  "/app/courses": ["/app/courses", "/app/store/courses"],
  "/app/marketing": [
    "/app/marketing",
    "/app/marketing/broadcasts",
    "/app/marketing/sequences",
    "/app/marketing/ads",
    "/app/ads",
  ],
  "/app/brand-deals": [
    "/app/brand-deals",
    "/app/brand-deals/proposals",
    "/app/brand-deals/media-kit",
    "/app/brand-deals/invoicing",
    "/app/brand-deals/invoices",
  ],
  "/app/store": [
    "/app/store",
    "/app/store/digital",
    "/app/store/physical",
    "/app/store/physical-products",
    "/app/store/products",
    "/app/store/inventory",
    "/app/store/categories",
    "/app/store/returns",
    "/app/store/cart",
    "/app/store/addresses",
    "/app/store/orders",
  ],
  "/app/subscriptions": [
    "/app/subscriptions",
    "/app/subscriptions/my-subscriptions",
    "/app/subscriptions/discover",
  ],
  "/app/wallet": ["/app/wallet", "/app/wallet/purchase-library"],
  "/app/friends": ["/app/friends", "/app/requests/friends"],
  "/app/link-in-bio": [
    "/app/link-in-bio",
    "/app/link-in-bio/domain",
    "/app/link-in-bio/theme",
    "/app/link-in-bio/analytics",
  ],
  "/app/settings": ["/app/settings", "/app/settings/profile", "/app/settings/upgrade"],
};

function isActiveRoute(item: NavItem, pathname: string, search: string): boolean {
  if (item.url.includes("?") ? pathname + search === item.url : pathname === item.url) return true;

  const basePath = item.url.split("?")[0];

  // Specific exceptions to prevent false positive matching on sibling paths
  if (basePath === "/app/communities" && pathname.startsWith("/app/communities/events")) {
    return false;
  }

  // Check mapped related paths
  const related = RELATED_SECTION_PATHS[basePath];
  if (related && related.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return true;
  }

  if (basePath !== "/app" && pathname.startsWith(basePath + "/")) return true;

  if (item.children) {
    if (item.children.some((child) => isActiveRoute(child, pathname, search))) return true;
  }

  return false;
}

function filterByFlags(nav: NavGroup[], flags: Record<string, boolean>): NavGroup[] {
  return nav
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => {
          if (item.featureFlag && flags[item.featureFlag] === false) return null;
          if (item.children) {
            const kept = item.children.filter((c) => !c.featureFlag || flags[c.featureFlag] !== false);
            if (kept.length === 0) return null;
            return { ...item, children: kept };
          }
          return item;
        })
        .filter(Boolean) as NavItem[],
    }))
    .filter((g) => g.items.length > 0);
}

interface AdminCounts {
  pending_kyc: number;
  pending_role_applications: number;
  pending_reports: number;
  open_tickets: number;
}

function injectBadges(nav: NavGroup[], unreadCount: number, adminCounts: AdminCounts): NavGroup[] {
  return nav.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.title === "MurihChat" && unreadCount > 0) {
        return { ...item, badge: unreadCount };
      }
      if (item.title === "KYC Queue") {
        return { ...item, badge: adminCounts.pending_kyc };
      }
      if (item.title === "Role Applications") {
        return { ...item, badge: adminCounts.pending_role_applications };
      }
      if (item.title === "Posts & Reports") {
        return { ...item, badge: adminCounts.pending_reports };
      }
      return item;
    }),
  }));
}

interface NavRowProps {
  item: NavItem;
  onNavigate?: () => void;
}

function NavRow({ item, onNavigate }: NavRowProps) {
  const { pathname, search } = useLocation();
  const active = isActiveRoute(item, pathname, search);

  const className = `flex items-center gap-3 px-3 h-11 rounded-lg text-[14px] font-medium transition-all select-none ${
    active
      ? "bg-[var(--shell-hover)] dark:bg-[var(--shell-hover-strong)] text-[var(--shell-accent)] dark:text-[var(--shell-accent)] font-semibold shadow-2xs"
      : "text-[var(--shell-text)] dark:text-[var(--shell-text)] hover:bg-[var(--shell-hover)]/60 dark:hover:bg-[var(--shell-hover)]"
  }`;

  const content = (
    <>
        {item.icon && (
          <span
            className={`shrink-0 text-[20px] transition-colors ${
              active
                ? "text-[var(--shell-accent)] dark:text-[var(--shell-accent)]"
                : "text-[var(--shell-muted)] dark:text-[var(--shell-muted)]"
            }`}
          >
            {item.icon}
          </span>
        )}
        <span className="truncate flex-1 leading-none">{item.title}</span>
        {item.badge != null && (
          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary px-1.5 text-[11px] font-bold text-white leading-none">
            {item.badge}
          </span>
        )}
    </>
  );

  return (
    <div className="flex flex-col">
      {item.external ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          title={item.description}
          onClick={onNavigate}
          className={className}
        >
          {content}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : (
        <Link to={item.url} onClick={onNavigate} title={item.description} className={className}>
          {content}
        </Link>
      )}
    </div>
  );
}

interface AppSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function AppSidebar({ className = "", onNavigate }: AppSidebarProps) {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const role: UserRole = (user?.role as UserRole) ?? "member";
  const flags = useFeatureFlags();

  // Live unread total — same authoritative store as the site header & chat
  // layout, so badge stays correct after reading/opening a conversation.
  const [unreadCount, setUnreadCount] = useState(getUnreadCount());
  useEffect(() => subscribeUnreadCount(() => setUnreadCount(getUnreadCount())), []);
  const [adminCounts, setAdminCounts] = useState<AdminCounts>({
    pending_kyc: 0,
    pending_role_applications: 0,
    pending_reports: 0,
    open_tickets: 0,
  });

  useEffect(() => {
    let unmounted = false;

    async function fetchCounts() {
      try {
        const res = await apiClient.get("/messages/unread-count");
        if (!unmounted && res.data?.success) {
          setUnreadCount(res.data.data?.unread_count ?? 0);
        }
      } catch {
        /* ignore */
      }

      if (role === "admin") {
        try {
          const res = await apiClient.get("/securegate/pending-counts");
          if (!unmounted && res.data?.success) {
            setAdminCounts(res.data.data);
          }
        } catch {
          /* ignore */
        }
      }
    }

    fetchCounts();
    return () => {
      unmounted = true;
    };
  }, [role]);

  const rawNav = getSidebarNav(role);
  const filtered = filterByFlags(resolveExternalItems(rawNav), flags);
  const navGroups = injectBadges(filtered, unreadCount, adminCounts);

  const roleLabel = ROLE_LABELS[role] ?? "";

  return (
    <nav aria-label="Social Navigation" className={`flex flex-col h-full ${className}`}>
      {/* Top: User Identity Row */}
      {!loading && user && (
        <div className="mb-2 shrink-0">
          <Link
            to="/app/profile"
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--shell-hover)]/60 dark:hover:bg-[var(--shell-hover)] transition-colors"
          >
            <div className="h-9 w-9 rounded-full overflow-hidden bg-[var(--shell-accent-solid)] flex items-center justify-center text-white shrink-0">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User weight="fill" className="text-white/90" style={{ width: 18, height: 18 }} />
              )}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[14px] font-semibold text-[var(--shell-text)] dark:text-[var(--shell-text)] truncate leading-tight">
                {user.name}
              </p>
              <p className="text-[12px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)] truncate leading-normal">
                {user.username ? `@${user.username}` : roleLabel}
              </p>
            </div>
          </Link>
        </div>
      )}

      {/* Continuous Social Navigation List */}
      <div className="flex-1 min-h-0 space-y-0.5 overflow-y-auto no-scrollbar pr-0.5">
        {navGroups.map((group, groupIdx) => {
          const isShortcutGroup = group.title.toLowerCase().includes("shortcut");
          const isNamedGroup = group.title && !isShortcutGroup && role === "admin";

          return (
            <React.Fragment key={group.title || groupIdx}>
              {groupIdx > 0 && (
                <div className="my-2 border-t border-[var(--shell-border)] dark:border-[var(--shell-border)] mx-2" />
              )}

              {isNamedGroup && (
                <div className="px-3 pt-2 pb-1 text-[11px] font-bold text-[var(--shell-muted)] dark:text-[var(--shell-muted)] uppercase tracking-wider">
                  {group.title}
                </div>
              )}

              {isShortcutGroup && (
                <div className="px-3 pt-1 pb-1 text-[12px] font-semibold text-[var(--shell-muted)] dark:text-[var(--shell-muted)]">
                  Shortcuts
                </div>
              )}

              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavRow key={item.title} item={item} onNavigate={onNavigate} />
                ))}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Subtle Bottom User Dropdown */}
      {!loading && user && (
        <div className="shrink-0 pt-2 mt-auto border-t border-[var(--shell-border)] dark:border-[var(--shell-border)]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center gap-3 px-3 h-11 rounded-lg text-left hover:bg-[var(--shell-hover)]/60 dark:hover:bg-[var(--shell-hover)] transition-colors"
              >
                <div className="h-8 w-8 rounded-full overflow-hidden bg-[var(--shell-accent-solid)] flex items-center justify-center text-white shrink-0">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User weight="fill" className="text-white/90" style={{ width: 16, height: 16 }} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--shell-text)] dark:text-[var(--shell-text)] truncate">
                    {user.name}
                  </p>
                  <p className="text-[11px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)] truncate">
                    {user.email}
                  </p>
                </div>
                <CaretDown weight="bold" className="h-3.5 w-3.5 text-[var(--shell-muted)] dark:text-[var(--shell-muted)] shrink-0" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-56 rounded-lg bg-card border border-border shadow-lg p-1 text-xs"
              align="start"
              side="top"
              sideOffset={6}
            >
              <DropdownMenuLabel className="px-3 py-2">
                <p className="font-bold text-foreground text-xs">{user.name}</p>
                <p className="text-[11px] text-muted-foreground font-normal">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={() => {
                  navigate("/app/profile");
                  onNavigate?.();
                }}
                className="cursor-pointer text-xs"
              >
                <User weight="fill" className="mr-2 h-4 w-4 text-muted-foreground" />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  navigate("/app/settings");
                  onNavigate?.();
                }}
                className="cursor-pointer text-xs"
              >
                <UserCircle weight="fill" className="mr-2 h-4 w-4 text-muted-foreground" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  navigate("/app/settings/notifications");
                  onNavigate?.();
                }}
                className="cursor-pointer text-xs"
              >
                <Bell weight="fill" className="mr-2 h-4 w-4 text-muted-foreground" />
                Notifications
              </DropdownMenuItem>

              {role !== "admin" && (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      navigate("/app/wallet");
                      onNavigate?.();
                    }}
                    className="cursor-pointer text-xs"
                  >
                    <Wallet weight="fill" className="mr-2 h-4 w-4 text-muted-foreground" />
                    MurihPay Wallet
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      navigate("/app/kyc");
                      onNavigate?.();
                    }}
                    className="cursor-pointer text-xs"
                  >
                    <ShieldCheck weight="fill" className="mr-2 h-4 w-4 text-muted-foreground" />
                    KYC Verification
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={() => logout()}
                className="cursor-pointer text-xs text-destructive focus:text-destructive"
              >
                <SignOut weight="fill" className="mr-2 h-4 w-4 text-destructive" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </nav>
  );
}
