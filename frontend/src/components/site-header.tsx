import { Link, useLocation, useNavigate } from "react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Search,
  Home,
  Users,
  FileText,
  ShoppingBag,
  Plus,
  Bell,
  MessageSquare,
  X,
  Package,
  ShoppingCart,
  Wallet,
  UserPlus,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api/client";

export function SiteHeader() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
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

  const isAdmin = user?.role === "admin";
  const userRole = user?.role ?? "member";

  const getNavTabs = () => {
    if (userRole === "vendor") {
      return [
        { id: "home", label: "Home", icon: <Home className="h-[18px] w-[18px]" />, to: "/app" },
        { id: "products", label: "Products", icon: <Package className="h-[18px] w-[18px]" />, to: "/app/store/physical-products" },
        { id: "orders", label: "Orders", icon: <ShoppingCart className="h-[18px] w-[18px]" />, to: "/app/store/orders" },
        { id: "wallet", label: "Wallet", icon: <Wallet className="h-[18px] w-[18px]" />, to: "/app/wallet" },
      ];
    }
    if (userRole === "creator") {
      return [
        { id: "home", label: "Home", icon: <Home className="h-[18px] w-[18px]" />, to: "/app" },
        { id: "requests", label: "Requests", icon: <UserPlus className="h-[18px] w-[18px]" />, to: "/app/requests" },
        { id: "friends", label: "Friends", icon: <Users className="h-[18px] w-[18px]" />, to: "/app/friends" },
        { id: "community", label: "Community", icon: <Users className="h-[18px] w-[18px]" />, to: "/app/communities" },
        { id: "store", label: "Store", icon: <ShoppingBag className="h-[18px] w-[18px]" />, to: "/app/store/products" },
      ];
    }
    return [
      { id: "home", label: "Home", icon: <Home className="h-[18px] w-[18px]" />, to: "/app" },
      { id: "feed", label: "Feed", icon: <FileText className="h-[18px] w-[18px]" />, to: "/app/feed" },
      { id: "community", label: "Community", icon: <Users className="h-[18px] w-[18px]" />, to: "/app/communities" },
      { id: "shop", label: "Shop", icon: <ShoppingBag className="h-[18px] w-[18px]" />, to: "/app/store" },
    ];
  };

  const navTabs = getNavTabs();

  const isTabActive = (tabTo: string) => {
    if (tabTo === "/app") return location.pathname === "/app";
    return location.pathname.startsWith(tabTo);
  };

  return (
    <header className="sticky top-0 z-40 h-14 shrink-0 flex items-center justify-between border-b border-border bg-[#F8F7F4] dark:bg-background/95 backdrop-blur-md px-4">

      {/* ── LEFT: Sidebar trigger + Search ── */}
      <div className="flex items-center gap-2 w-[240px] shrink-0">
        <SidebarTrigger className="-ml-1 text-[#65676B] hover:text-[#1a2e3b] hover:bg-[#F0F2F5] rounded-lg h-8 w-8" />

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#65676B]" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search MurihSpace"
            className="w-full h-9 pl-9 pr-8 text-[13px] rounded-full border border-border bg-[#F0F2F5] dark:bg-muted/40 placeholder:text-[#65676B] text-[#1a2e3b] focus:outline-none focus:ring-2 focus:ring-[#38A8D8]/30 focus:border-[#38A8D8] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setSuggestions([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#65676B] hover:text-[#1a2e3b]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-border bg-popover shadow-xl overflow-hidden z-50">
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
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-xs hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground overflow-hidden shrink-0">
                    {s.avatar ? (
                      <img src={s.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      s.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{s.type}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Nav Tabs — centered in flex space (hidden for admin) ── */}
      {!isAdmin && (
        <nav className="hidden md:flex items-center justify-center flex-1 h-14 px-2">
          {navTabs.map((tab) => {
            const isActive = isTabActive(tab.to);
            return (
              <Link
                key={tab.id}
                to={tab.to}
                className={`relative flex flex-col items-center justify-center gap-0.5 px-4 sm:px-5 h-14 min-w-[68px] text-[12px] font-semibold transition-colors group ${
                  isActive
                    ? "text-[#38A8D8]"
                    : "text-[#65676B] hover:text-[#1a2e3b]"
                }`}
              >
                <span className={`transition-colors ${isActive ? "text-[#38A8D8]" : "text-[#65676B] group-hover:text-[#1a2e3b]"}`}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-[3px] bg-[#38A8D8] rounded-t-full" />
                )}
              </Link>
            );
          })}
        </nav>
      )}

      {/* ── RIGHT: Action Icons + Profile ── */}
      <div className="flex items-center gap-1.5 w-[240px] justify-end shrink-0 ml-auto">

        {!isAdmin && (
          <>
            {/* Plus / Create */}
            <Link to="/app/communities">
              <button className="h-9 w-9 rounded-full bg-[#F0F2F5] hover:bg-[#E4E6EB] flex items-center justify-center text-[#1a2e3b] transition-colors" title="Create">
                <Plus className="h-4 w-4" />
              </button>
            </Link>
          </>
        )}

        {/* Notifications */}
        <Link to="/app/settings/notifications">
          <button className="relative h-9 w-9 rounded-full bg-[#F0F2F5] hover:bg-[#E4E6EB] flex items-center justify-center text-[#1a2e3b] transition-colors" title="Notifications">
            <Bell className="h-[18px] w-[18px]" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </button>
        </Link>

        {!isAdmin && (
          <>
            {/* Messages */}
            <Link to="/app/messages">
              <button className="relative h-9 w-9 rounded-full bg-[#F0F2F5] hover:bg-[#E4E6EB] flex items-center justify-center text-[#1a2e3b] transition-colors" title="Messages">
                <MessageSquare className="h-[18px] w-[18px]" />
                {msgCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                    {msgCount > 9 ? "9+" : msgCount}
                  </span>
                )}
              </button>
            </Link>
          </>
        )}

        {/* User Avatar */}
        <Link to="/app/settings" className="ml-0.5 shrink-0">
          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#38A8D8] to-purple-600 p-[2px] cursor-pointer hover:scale-105 transition-transform shadow-sm">
            <div className="w-full h-full rounded-full bg-[#F8F7F4] dark:bg-card overflow-hidden flex items-center justify-center text-[13px] font-black text-[#1a2e3b]">
              {(user as { avatar_url?: string; avatar?: string })?.avatar_url || (user as { avatar_url?: string; avatar?: string })?.avatar ? (
                <img src={(user as { avatar_url?: string; avatar?: string })?.avatar_url || (user as { avatar_url?: string; avatar?: string })?.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0)?.toUpperCase() ?? "U"
              )}
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
