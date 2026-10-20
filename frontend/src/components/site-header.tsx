import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Search, Home, N2User as Users, Document as FileText, Bag as ShoppingBag, Plus, Notification as Bell, Message as MessageSquare, CloseSquare as X, Bag as ShoppingCart, Wallet, Profile as UserCircle, Profile as User, ShieldDone as ShieldCheck, Logout as SignOut, Video as VideoCamera, Chart as ChartBar, Calendar, AddUser as UserPlus } from "@/components/icons";
import { Package, List, Megaphone, Handshake } from "@/components/icons/rounded";;
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api/client";
import { getLogo } from "@/lib/logoConfig";
import { getAdsManagerHref } from "@/lib/adsManager";
import { subscribeUnreadCount, getUnreadCount } from "@/lib/chatUnread";
import type { UserRole } from "@/navigation/navTypes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileMenuDrawer } from "@/components/account/ProfileMenuDrawer";
import { AddAccountDialog } from "@/components/account/AddAccountDialog";

interface SiteHeaderProps {
  onOpenMobileSidebar?: () => void;
}

export function SiteHeader({ onOpenMobileSidebar }: SiteHeaderProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const adsManagerHref = getAdsManagerHref();

  const [searchQuery, setSearchQuery] = useState("");
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { id: number; name: string; username?: string; type: string; avatar?: string; slug?: string; communitySlug?: string }[]
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Real notification + message counts
  const [notifCount, setNotifCount] = useState(0);
  const [msgCount, setMsgCount] = useState(() => getUnreadCount());

  // Live, authoritative unread total — same store as the sidebar & chat layout
  useEffect(() => {
    return subscribeUnreadCount(() => setMsgCount(getUnreadCount()));
  }, []);

  // Live-update notification badges as realtime notifications arrive
  useEffect(() => {
    const bumpNotifs = () => setNotifCount((c) => c + 1);
    window.addEventListener("murih:notification", bumpNotifs);
    return () => {
      window.removeEventListener("murih:notification", bumpNotifs);
    };
  }, []);

  // Debounced search suggestions
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      // Deferred so the reset is not set synchronously inside the effect body
      const clearTimer = setTimeout(() => setSuggestions([]), 0);
      return () => clearTimeout(clearTimer);
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.get(
          `/search?q=${encodeURIComponent(searchQuery)}&type=all&per_page=5`
        );
        const results = res.data?.results ?? {};
        const items = [
          ...(results.users ?? []),
          ...(results.communities ?? []),
          ...(results.posts ?? []),
        ];
        setSuggestions(
          items
            .map((r: Record<string, unknown>) => ({
              id: r.id as number,
              name: (r.name ?? r.content ?? "Untitled") as string,
              username: r.username as string | undefined,
              type: r.type as string,
              avatar: r.avatar as string | undefined,
              slug: (r.slug ?? (r.community as Record<string, unknown> | undefined)?.slug) as string | undefined,
              communitySlug: (r.community as Record<string, unknown> | undefined)?.slug as string | undefined,
            }))
            .slice(0, 5)
        );
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/app/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setSuggestions([]);
    }
  }

  const role: UserRole = (user?.role as UserRole) ?? "member";
  const isAdmin = role === "admin";
  const logoAsset = getLogo(role, "header", false);

  const getNavTabs = () => {
    if (role === "vendor") {
      return [
        { id: "home", label: "Home", icon: <Home weight="fill" className="h-5 w-5" />, to: "/app" },
        { id: "products", label: "Products", icon: <Package weight="fill" className="h-5 w-5" />, to: "/app/store/physical-products" },
        { id: "orders", label: "Orders", icon: <ShoppingCart weight="fill" className="h-5 w-5" />, to: "/app/store/orders" },
        { id: "wallet", label: "Wallet", icon: <Wallet weight="fill" className="h-5 w-5" />, to: "/app/wallet" },
      ];
    }
    if (role === "creator") {
      return [
        { id: "home", label: "Home", icon: <Home weight="fill" className="h-5 w-5" />, to: "/app" },
        { id: "friends", label: "Friends", icon: <Users weight="fill" className="h-5 w-5" />, to: "/app/friends" },
        { id: "community", label: "Community", icon: <Users weight="fill" className="h-5 w-5" />, to: "/app/communities" },
        { id: "store", label: "Store", icon: <ShoppingBag weight="fill" className="h-5 w-5" />, to: "/app/store" },
        { id: "insights", label: "Insights", icon: <ChartBar weight="fill" className="h-5 w-5" />, to: "/app/insights" },
      ];
    }
    return [
      { id: "home", label: "Home", icon: <Home weight="fill" className="h-5 w-5" />, to: "/app" },
      { id: "friends", label: "Friends", icon: <Users weight="fill" className="h-5 w-5" />, to: "/app/friends" },
      { id: "community", label: "Community", icon: <Users weight="fill" className="h-5 w-5" />, to: "/app/communities" },
      { id: "feed", label: "Feed", icon: <FileText weight="fill" className="h-5 w-5" />, to: "/app/feed" },
      { id: "shop", label: "Shop", icon: <ShoppingBag weight="fill" className="h-5 w-5" />, to: "/app/store" },
    ];
  };

  const navTabs = getNavTabs();

  const isTabActive = (tabTo: string) => {
    if (tabTo === "/app") return location.pathname === "/app" || location.pathname === "/app/";
    return location.pathname.startsWith(tabTo);
  };

  return (
    <header className="sticky top-0 z-40 h-14 w-full shrink-0 flex items-center justify-between border-b border-[var(--shell-border)] dark:border-[var(--shell-border)] bg-white dark:bg-[var(--shell-surface)] px-3 sm:px-4 select-none">
      {/* ── LEFT: Logo + Mobile Hamburger + Search ── */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 md:flex-none">
        {/* Profile menu trigger — desktop */}
        <button
          type="button"
          onClick={() => setProfileMenuOpen(true)}
          className="hidden md:flex h-9 w-9 rounded-full bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] text-[var(--shell-text)] dark:text-[var(--shell-text)] hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover-strong)] items-center justify-center transition-colors"
          title="Profile menu"
        >
          <List weight="bold" className="h-5 w-5" />
        </button>

        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden h-9 w-9 rounded-full bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] text-[var(--shell-text)] dark:text-[var(--shell-text)] hover:bg-[var(--shell-hover)] flex items-center justify-center transition-colors"
          title="Open Menu"
        >
          <List weight="bold" className="h-5 w-5" />
        </button>

        {/* Logo */}
        <Link
          to={isAdmin ? "/app/securegate" : "/app"}
          className="flex items-center gap-2 shrink-0 group transition-transform active:scale-95"
        >
          <img
            src={logoAsset.url}
            alt={logoAsset.alt}
            className="h-8 w-auto object-contain shrink-0"
          />
        </Link>

        {/* Global Search Bar */}
        <div className="relative min-w-0 flex-1 max-w-[200px] sm:max-w-none sm:w-[220px] lg:w-[260px]">
          <Search
            weight="bold"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--shell-muted)] dark:text-[var(--shell-muted)]"
          />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search MurihSpace"
            className="w-full h-10 pl-9 pr-8 text-[14px] rounded-full border-none bg-[var(--shell-canvas)] dark:bg-[var(--shell-hover)] placeholder:text-[var(--shell-muted)] dark:placeholder:text-[var(--shell-muted)] text-[var(--shell-text)] dark:text-[var(--shell-text)] focus:outline-none focus:ring-2 focus:ring-[var(--shell-accent)]/40 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSuggestions([]);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--shell-muted)] hover:text-[var(--shell-text)] dark:hover:text-white"
            >
              <X weight="bold" className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Search Dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 rounded-lg border border-[var(--shell-border)] dark:border-[var(--shell-border)] bg-white dark:bg-[var(--shell-surface)] shadow-xl overflow-hidden z-50">
              {suggestions.map((s, idx) => (
                <button
                  key={`${s.type}-${s.id}-${idx}`}
                  onClick={() => {
                    const target =
                      s.type === "community" && s.slug
                        ? `/app/communities/${s.slug}`
                        : s.type === "post" && s.communitySlug
                          ? `/app/communities/${s.communitySlug}`
                          : s.type === "user" && s.username
                            ? `/app/search?q=${encodeURIComponent(s.username)}`
                            : `/app/search?q=${encodeURIComponent(searchQuery)}`;
                    navigate(target);
                    setSearchQuery("");
                    setSuggestions([]);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)] transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground overflow-hidden shrink-0">
                    {s.avatar ? (
                      <img src={s.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      s.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--shell-text)] dark:text-[var(--shell-text)] truncate">{s.name}</p>
                    <p className="text-[10px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)] capitalize">{s.type}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Social Navigation Destinations ── */}
      {!isAdmin && (
        <nav className="hidden md:flex items-center justify-center flex-1 max-w-[620px] h-14 mx-auto px-2">
          {navTabs.map((tab) => {
            const isActive = isTabActive(tab.to);
            return (
              <Link
                key={tab.id}
                to={tab.to}
                className={`relative flex items-center justify-center flex-1 h-full px-2 text-[13px] font-medium transition-colors group ${
                  isActive
                    ? "text-[var(--shell-accent)] dark:text-[var(--shell-accent)]"
                    : "text-[var(--shell-muted)] dark:text-[var(--shell-muted)]"
                }`}
              >
                <div
                  className={`flex flex-col items-center justify-center gap-0.5 w-full h-[46px] rounded-lg transition-colors ${
                    isActive
                      ? ""
                      : "hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)] text-[var(--shell-muted)] hover:text-[var(--shell-text)] dark:hover:text-[var(--shell-text)]"
                  }`}
                >
                  <span className={`transition-colors ${isActive ? "text-[var(--shell-accent)] dark:text-[var(--shell-accent)]" : ""}`}>
                    {tab.icon}
                  </span>
                  <span className="text-[11px] font-medium leading-none">{tab.label}</span>
                </div>
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-[3px] bg-[var(--shell-accent-solid)] dark:bg-[var(--shell-accent)] rounded-t-full" />
                )}
              </Link>
            );
          })}
        </nav>
      )}

      {/* ── RIGHT: Quick Create + Messages + Notifications + Profile ── */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {/* Quick Create + */}
        {!isAdmin && (
          <div className="relative">
            <button
              onClick={() => setShowQuickMenu((prev) => !prev)}
              className="h-10 w-10 rounded-full bg-[var(--shell-hover)] hover:bg-[var(--shell-hover-strong)] dark:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover-strong)] flex items-center justify-center text-[var(--shell-text)] dark:text-[var(--shell-text)] transition-colors"
              title="Create"
            >
              <Plus weight="bold" className="h-5 w-5" />
            </button>

            {showQuickMenu && (
              <div className="absolute right-0 top-12 w-56 bg-white dark:bg-[var(--shell-surface)] border border-[var(--shell-border)] dark:border-[var(--shell-border)] rounded-lg shadow-xl z-50 p-1.5 space-y-1 text-xs">
                <div className="px-3 py-1.5 font-bold text-[11px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)] uppercase tracking-wider border-b border-[var(--shell-border)] dark:border-[var(--shell-border)] mb-1">
                  Create
                </div>
                <Link
                  to="/app/feed"
                  onClick={() => setShowQuickMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)] transition-colors font-medium text-[var(--shell-text)] dark:text-[var(--shell-text)]"
                >
                  <FileText weight="fill" className="h-4 w-4 text-[var(--shell-accent)]" />
                  <span>Create Post</span>
                </Link>
                <Link
                  to="/app/communities"
                  onClick={() => setShowQuickMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)] transition-colors font-medium text-[var(--shell-text)] dark:text-[var(--shell-text)]"
                >
                  <Users weight="fill" className="h-4 w-4 text-emerald-500" />
                  <span>Create Community</span>
                </Link>
                <Link
                  to="/app/audio-rooms"
                  onClick={() => setShowQuickMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)] transition-colors font-medium text-[var(--shell-text)] dark:text-[var(--shell-text)]"
                >
                  <VideoCamera weight="fill" className="h-4 w-4 text-red-500" />
                  <span>Live Studio</span>
                </Link>
                <Link
                  to="/app/meetings"
                  onClick={() => setShowQuickMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)] transition-colors font-medium text-[var(--shell-text)] dark:text-[var(--shell-text)]"
                >
                  <VideoCamera weight="fill" className="h-4 w-4 text-indigo-500" />
                  <span>Meeting &amp; Conference</span>
                </Link>
                <Link
                  to="/app/store"
                  onClick={() => setShowQuickMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)] transition-colors font-medium text-[var(--shell-text)] dark:text-[var(--shell-text)]"
                >
                  <ShoppingBag weight="fill" className="h-4 w-4 text-amber-500" />
                  <span>Add Product</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {!isAdmin && (
          <Link to="/app/messages">
            <button
              className="relative h-10 w-10 rounded-full bg-[var(--shell-hover)] hover:bg-[var(--shell-hover-strong)] dark:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover-strong)] flex items-center justify-center text-[var(--shell-text)] dark:text-[var(--shell-text)] transition-colors"
              title="Messages"
            >
              <MessageSquare weight="fill" className="h-5 w-5" />
              {msgCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-secondary text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {msgCount > 9 ? "9+" : msgCount}
                </span>
              )}
            </button>
          </Link>
        )}

        {/* Notifications */}
        <Link to="/app/settings/notifications">
          <button
            className="relative h-10 w-10 rounded-full bg-[var(--shell-hover)] hover:bg-[var(--shell-hover-strong)] dark:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover-strong)] flex items-center justify-center text-[var(--shell-text)] dark:text-[var(--shell-text)] transition-colors"
            title="Notifications"
          >
            <Bell weight="fill" className="h-5 w-5" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-secondary text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </button>
        </Link>

        {/* User Profile Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-10 w-10 rounded-full overflow-hidden bg-[var(--shell-accent-solid)] flex items-center justify-center text-white font-bold text-xs cursor-pointer hover:ring-2 hover:ring-[var(--shell-accent)]/50 transition-all ml-0.5"
              title="Account"
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User weight="fill" className="text-white/90" style={{ width: 18, height: 18 }} />
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-60 rounded-lg bg-white dark:bg-[var(--shell-surface)] border border-[var(--shell-border)] dark:border-[var(--shell-border)] shadow-xl p-1 text-xs z-50"
            align="end"
            sideOffset={6}
          >
            <DropdownMenuLabel className="px-3 py-2">
              <p className="font-bold text-[var(--shell-text)] dark:text-[var(--shell-text)] text-sm truncate">{user?.name}</p>
              <p className="text-[11px] text-[var(--shell-muted)] dark:text-[var(--shell-muted)] font-normal truncate">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[var(--shell-border)] dark:bg-[var(--shell-border)]" />
            <DropdownMenuItem
              onClick={() => navigate("/app/profile")}
              className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)]"
            >
              <User weight="fill" className="h-4 w-4 text-[var(--shell-muted)] dark:text-[var(--shell-muted)]" />
              <span>View Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/app/settings/profile")}
              className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)]"
            >
              <UserCircle weight="fill" className="h-4 w-4 text-[var(--shell-muted)] dark:text-[var(--shell-muted)]" />
              <span>Profile Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setProfileMenuOpen(true)}
              className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)]"
            >
              <List weight="bold" className="h-4 w-4 text-[var(--shell-muted)] dark:text-[var(--shell-muted)]" />
              <span>Profile menu</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setAddAccountOpen(true)}
              className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)]"
            >
              <UserPlus weight="fill" className="h-4 w-4 text-[var(--shell-muted)] dark:text-[var(--shell-muted)]" />
              <span>Add account</span>
            </DropdownMenuItem>
            {!isAdmin && (
              <>
                <DropdownMenuItem
                  onClick={() => navigate("/app/wallet")}
                  className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)]"
                >
                  <Wallet weight="fill" className="h-4 w-4 text-[var(--shell-muted)] dark:text-[var(--shell-muted)]" />
                  <span>MurihPay Wallet</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/app/kyc")}
                  className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)]"
                >
                  <ShieldCheck weight="fill" className="h-4 w-4 text-[var(--shell-muted)] dark:text-[var(--shell-muted)]" />
                  <span>KYC Verification</span>
                </DropdownMenuItem>
                {role === "creator" && (
                  <>
                    <DropdownMenuSeparator className="bg-[var(--shell-border)] dark:bg-[var(--shell-border)]" />
                    <div className="px-3 py-1 text-[10px] font-bold text-[var(--shell-muted)] dark:text-[var(--shell-muted)] uppercase tracking-wider">
                      Creator Tools
                    </div>
                    <DropdownMenuItem
                      onClick={() => navigate("/app/insights")}
                      className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)]"
                    >
                      <ChartBar weight="fill" className="h-4 w-4 text-[var(--shell-accent)] dark:text-[var(--shell-accent)]" />
                      <span>Performance Insights</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate("/app/events")}
                      className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)]"
                    >
                      <Calendar weight="fill" className="h-4 w-4 text-rose-500" />
                      <span>Events &amp; Live Studio</span>
                    </DropdownMenuItem>
                    {adsManagerHref && (
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)]"
                      >
                        <a href={adsManagerHref} target="_blank" rel="noopener noreferrer">
                          <Megaphone weight="fill" className="h-4 w-4 text-purple-500" />
                          <span>Ads Manager</span>
                        </a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => navigate("/app/brand-deals")}
                      className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--shell-hover)] dark:hover:bg-[var(--shell-hover)]"
                    >
                      <Handshake weight="fill" className="h-4 w-4 text-emerald-500" />
                      <span>Brand Deals</span>
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
            <DropdownMenuSeparator className="bg-[var(--shell-border)] dark:bg-[var(--shell-border)]" />
            <DropdownMenuItem
              onClick={() => logout()}
              className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md text-destructive focus:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <SignOut weight="fill" className="h-4 w-4 text-destructive" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ProfileMenuDrawer open={profileMenuOpen} onOpenChange={setProfileMenuOpen} />
      <AddAccountDialog open={addAccountOpen} onOpenChange={setAddAccountOpen} />
    </header>
  );
}
