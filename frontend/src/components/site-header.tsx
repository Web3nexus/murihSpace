import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  MagnifyingGlass as Search,
  House as Home,
  Users,
  FileText,
  ShoppingBag,
  Plus,
  Bell,
  ChatTeardropText as MessageSquare,
  X,
  Package,
  ShoppingCart,
  Wallet,
  List,
  UserCircle,
  Gear,
  ShieldCheck,
  SignOut,
  VideoCamera,
  ChartBar,
  Megaphone,
  Handshake,
  Calendar,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api/client";
import { getLogo } from "@/lib/logoConfig";
import type { UserRole } from "@/navigation/navTypes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SiteHeaderProps {
  onOpenMobileSidebar?: () => void;
}

export function SiteHeader({ onOpenMobileSidebar }: SiteHeaderProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { id: number; name: string; username?: string; type: string; avatar?: string; slug?: string; communitySlug?: string }[]
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Real notification + message counts
  const [notifCount, setNotifCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);

  useEffect(() => {
    const countTotal = (res: { data?: unknown }): number => {
      const body = (res.data as Record<string, unknown> | undefined)?.data ?? res.data;
      const list = Array.isArray(body) ? body : (body as Record<string, unknown> | undefined)?.data;
      const total = (body as Record<string, unknown> | undefined)?.total;
      return Number(total) || (Array.isArray(list) ? list.length : 0);
    };

    apiClient
      .get("/notifications?unread_only=true&per_page=1")
      .then((res) => {
        setNotifCount(countTotal(res));
      })
      .catch(() => {});

    apiClient
      .get("/conversations?unread_only=true&per_page=1")
      .then((res) => {
        setMsgCount(countTotal(res));
      })
      .catch(() => {});
  }, []);

  // Debounced search suggestions
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      return;
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
    <header className="sticky top-0 z-40 h-14 w-full shrink-0 flex items-center justify-between border-b border-[#DADDE1] dark:border-[#3E4042] bg-white dark:bg-[#242526] px-3 sm:px-4 select-none">
      {/* ── LEFT: Logo + Mobile Hamburger + Search ── */}
      <div className="flex items-center gap-2.5 shrink-0 min-w-0">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden h-9 w-9 rounded-full bg-[#F0F2F5] dark:bg-[#3A3B3C] text-[#050505] dark:text-[#E4E6EB] hover:bg-[#E4E6EB] flex items-center justify-center transition-colors"
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
        <div className="relative w-[180px] sm:w-[220px] lg:w-[260px]">
          <Search
            weight="bold"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#65676B] dark:text-[#B0B3B8]"
          />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search MurihSpace"
            className="w-full h-10 pl-9 pr-8 text-[14px] rounded-full border-none bg-[#F0F2F5] dark:bg-[#3A3B3C] placeholder:text-[#65676B] dark:placeholder:text-[#B0B3B8] text-[#050505] dark:text-[#E4E6EB] focus:outline-none focus:ring-2 focus:ring-[#2164b6]/40 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSuggestions([]);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#65676B] hover:text-[#050505] dark:hover:text-white"
            >
              <X weight="bold" className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Search Dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 rounded-lg border border-[#DADDE1] dark:border-[#3E4042] bg-white dark:bg-[#242526] shadow-xl overflow-hidden z-50">
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
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground overflow-hidden shrink-0">
                    {s.avatar ? (
                      <img src={s.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      s.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#050505] dark:text-[#E4E6EB] truncate">{s.name}</p>
                    <p className="text-[10px] text-[#65676B] dark:text-[#B0B3B8] capitalize">{s.type}</p>
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
                    ? "text-[#2164b6] dark:text-[#7ab0ff]"
                    : "text-[#65676B] dark:text-[#B0B3B8]"
                }`}
              >
                <div
                  className={`flex flex-col items-center justify-center gap-0.5 w-full h-[46px] rounded-lg transition-colors ${
                    isActive
                      ? ""
                      : "hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] text-[#65676B] hover:text-[#050505] dark:hover:text-[#E4E6EB]"
                  }`}
                >
                  <span className={`transition-colors ${isActive ? "text-[#2164b6] dark:text-[#7ab0ff]" : ""}`}>
                    {tab.icon}
                  </span>
                  <span className="text-[11px] font-medium leading-none">{tab.label}</span>
                </div>
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-[3px] bg-[#2164b6] dark:bg-[#7ab0ff] rounded-t-full" />
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
              className="h-10 w-10 rounded-full bg-[#E4E6EB] hover:bg-[#D8DADF] dark:bg-[#3A3B3C] dark:hover:bg-[#4E4F50] flex items-center justify-center text-[#050505] dark:text-[#E4E6EB] transition-colors"
              title="Create"
            >
              <Plus weight="bold" className="h-5 w-5" />
            </button>

            {showQuickMenu && (
              <div className="absolute right-0 top-12 w-56 bg-white dark:bg-[#242526] border border-[#DADDE1] dark:border-[#3E4042] rounded-lg shadow-xl z-50 p-1.5 space-y-1 text-xs">
                <div className="px-3 py-1.5 font-bold text-[11px] text-[#65676B] dark:text-[#B0B3B8] uppercase tracking-wider border-b border-[#DADDE1] dark:border-[#3E4042] mb-1">
                  Create
                </div>
                <Link
                  to="/app/feed"
                  onClick={() => setShowQuickMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] transition-colors font-medium text-[#050505] dark:text-[#E4E6EB]"
                >
                  <FileText weight="fill" className="h-4 w-4 text-[#2164b6]" />
                  <span>Create Post</span>
                </Link>
                <Link
                  to="/app/communities"
                  onClick={() => setShowQuickMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] transition-colors font-medium text-[#050505] dark:text-[#E4E6EB]"
                >
                  <Users weight="fill" className="h-4 w-4 text-emerald-500" />
                  <span>Create Community</span>
                </Link>
                <Link
                  to="/app/audio-rooms"
                  onClick={() => setShowQuickMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] transition-colors font-medium text-[#050505] dark:text-[#E4E6EB]"
                >
                  <VideoCamera weight="fill" className="h-4 w-4 text-red-500" />
                  <span>Live Studio</span>
                </Link>
                <Link
                  to="/app/meetings"
                  onClick={() => setShowQuickMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] transition-colors font-medium text-[#050505] dark:text-[#E4E6EB]"
                >
                  <VideoCamera weight="fill" className="h-4 w-4 text-indigo-500" />
                  <span>Meeting &amp; Conference</span>
                </Link>
                <Link
                  to="/app/store"
                  onClick={() => setShowQuickMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] transition-colors font-medium text-[#050505] dark:text-[#E4E6EB]"
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
              className="relative h-10 w-10 rounded-full bg-[#E4E6EB] hover:bg-[#D8DADF] dark:bg-[#3A3B3C] dark:hover:bg-[#4E4F50] flex items-center justify-center text-[#050505] dark:text-[#E4E6EB] transition-colors"
              title="Messages"
            >
              <MessageSquare weight="fill" className="h-5 w-5" />
              {msgCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {msgCount > 9 ? "9+" : msgCount}
                </span>
              )}
            </button>
          </Link>
        )}

        {/* Notifications */}
        <Link to="/app/settings/notifications">
          <button
            className="relative h-10 w-10 rounded-full bg-[#E4E6EB] hover:bg-[#D8DADF] dark:bg-[#3A3B3C] dark:hover:bg-[#4E4F50] flex items-center justify-center text-[#050505] dark:text-[#E4E6EB] transition-colors"
            title="Notifications"
          >
            <Bell weight="fill" className="h-5 w-5" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
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
              className="h-10 w-10 rounded-full overflow-hidden bg-[#2164b6] flex items-center justify-center text-white font-bold text-xs cursor-pointer hover:ring-2 hover:ring-[#2164b6]/50 transition-all ml-0.5"
              title="Account"
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0)?.toUpperCase() ?? "U"
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-60 rounded-lg bg-white dark:bg-[#242526] border border-[#DADDE1] dark:border-[#3E4042] shadow-xl p-1 text-xs z-50"
            align="end"
            sideOffset={6}
          >
            <DropdownMenuLabel className="px-3 py-2">
              <p className="font-bold text-[#050505] dark:text-[#E4E6EB] text-sm truncate">{user?.name}</p>
              <p className="text-[11px] text-[#65676B] dark:text-[#B0B3B8] font-normal truncate">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#DADDE1] dark:bg-[#3E4042]" />
            <DropdownMenuItem
              onClick={() => navigate("/app/settings/profile")}
              className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C]"
            >
              <UserCircle weight="fill" className="h-4 w-4 text-[#65676B] dark:text-[#B0B3B8]" />
              <span>Profile Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/app/settings")}
              className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C]"
            >
              <Gear weight="fill" className="h-4 w-4 text-[#65676B] dark:text-[#B0B3B8]" />
              <span>Settings &amp; Privacy</span>
            </DropdownMenuItem>
            {!isAdmin && (
              <>
                <DropdownMenuItem
                  onClick={() => navigate("/app/wallet")}
                  className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C]"
                >
                  <Wallet weight="fill" className="h-4 w-4 text-[#65676B] dark:text-[#B0B3B8]" />
                  <span>MurihPay Wallet</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/app/kyc")}
                  className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C]"
                >
                  <ShieldCheck weight="fill" className="h-4 w-4 text-[#65676B] dark:text-[#B0B3B8]" />
                  <span>KYC Verification</span>
                </DropdownMenuItem>
                {role === "creator" && (
                  <>
                    <DropdownMenuSeparator className="bg-[#DADDE1] dark:bg-[#3E4042]" />
                    <div className="px-3 py-1 text-[10px] font-bold text-[#65676B] dark:text-[#B0B3B8] uppercase tracking-wider">
                      Creator Tools
                    </div>
                    <DropdownMenuItem
                      onClick={() => navigate("/app/insights")}
                      className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C]"
                    >
                      <ChartBar weight="fill" className="h-4 w-4 text-[#2164b6] dark:text-[#7ab0ff]" />
                      <span>Performance Insights</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate("/app/events")}
                      className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C]"
                    >
                      <Calendar weight="fill" className="h-4 w-4 text-rose-500" />
                      <span>Events &amp; Live Studio</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate("/app/marketing")}
                      className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C]"
                    >
                      <Megaphone weight="fill" className="h-4 w-4 text-purple-500" />
                      <span>Marketing Hub</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate("/app/brand-deals")}
                      className="cursor-pointer text-xs flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C]"
                    >
                      <Handshake weight="fill" className="h-4 w-4 text-emerald-500" />
                      <span>Brand Deals</span>
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
            <DropdownMenuSeparator className="bg-[#DADDE1] dark:bg-[#3E4042]" />
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
    </header>
  );
}
