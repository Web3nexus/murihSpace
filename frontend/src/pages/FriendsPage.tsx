import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  UserPlus,
  Users,
  Clock,
  Check,
  X,
  MagnifyingGlass,
  Spinner,
  UserCheck,
  ChatTeardropText,
  UserMinus,
  UsersThree,
  Prohibit,
  DotsThree,
  DotsThreeVertical,
  Cake,
  Gift,
  Star,
  Briefcase,
  Palette,
  Eye,
  SlidersHorizontal,
  SquaresFour,
  ListDashes,
  Plus,
  Trash,
  SealCheck,
  Heart,
  User,
} from "@phosphor-icons/react";
import { apiClient } from "@/lib/api/client";
import { useConfirm } from "@/components/ui/DialogProvider";
import { Link, useSearchParams } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const inner = (data as { data?: unknown } | null)?.data;
  if (Array.isArray(inner)) return inner as T[];
  return [];
}

export type TabKey = "all" | "requests" | "suggestions" | "birthdays" | "lists";

export interface FriendUser {
  id: number;
  name: string;
  username: string;
  avatar?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  birthday?: string | null;
  role?: string;
  has_active_verification_badge?: boolean;
  mutual_friends?: number;
  status?: "none" | "pending_sent" | "pending_received" | "accepted";
  request_id?: number;
  days_remaining?: number;
  formatted_date?: string;
  is_online?: boolean;
}

export interface FriendListItem {
  id: number;
  friend: FriendUser | null;
  mutual_friends: number;
  since: string;
}

export interface FriendRequestItem {
  id: number;
  sender?: FriendUser | null;
  receiver?: FriendUser | null;
  mutual_friends: number;
  status: string;
  created_at: string;
}

export interface BirthdayResponse {
  today: FriendUser[];
  upcoming: FriendUser[];
  total_with_birthdays: number;
}

export interface CustomList {
  id: string;
  name: string;
  description: string;
  icon: "star" | "users" | "palette" | "briefcase" | "heart";
  color: string;
  memberIds: number[];
}

const DEFAULT_CUSTOM_LISTS: CustomList[] = [
  {
    id: "close_friends",
    name: "Close Friends",
    description: "Your closest friends and inner circle",
    icon: "star",
    color: "#F59E0B",
    memberIds: [],
  },
  {
    id: "acquaintances",
    name: "Acquaintances",
    description: "People you have met or casually know",
    icon: "users",
    color: "#3B82F6",
    memberIds: [],
  },
  {
    id: "creators",
    name: "Creators & Artists",
    description: "Fellow creators, collaborators and artists",
    icon: "palette",
    color: "#8B5CF6",
    memberIds: [],
  },
  {
    id: "collaborators",
    name: "Work & Collaborators",
    description: "Professional network and project peers",
    icon: "briefcase",
    color: "#10B981",
    memberIds: [],
  },
];

function Avatar({
  name,
  url,
  size = 48,
  className = "",
}: {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`rounded-full object-cover shrink-0 select-none ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-full bg-gradient-to-br from-[#2164b6] to-[#1a6b9e] text-white flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <User weight="fill" className="text-white/90" style={{ width: size * 0.55, height: size * 0.55 }} />
    </div>
  );
}

interface FriendsPageProps {
  initialTab?: TabKey;
}

export default function FriendsPage({ initialTab }: FriendsPageProps) {
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State: route prop > query param > fallback "all"
  const urlTab = searchParams.get("tab") as TabKey | null;
  const currentTab: TabKey = initialTab || urlTab || "all";

  const setTab = (newTab: TabKey) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", newTab);
      return next;
    }, { replace: true });
  };

  // Friends & Requests data
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestItem[]>([]);
  const [suggestions, setSuggestions] = useState<FriendUser[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayResponse>({ today: [], upcoming: [], total_with_birthdays: 0 });
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Global search & filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<FriendUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // View state in All Friends
  const [friendFilter, setFriendFilter] = useState("");
  const [friendSort, setFriendSort] = useState<"recent" | "az" | "active">("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showSentRequests, setShowSentRequests] = useState(false);

  // Optimistic tracking of request state for suggestions/search
  const [localStatus, setLocalStatus] = useState<Record<number, FriendUser["status"]>>({});
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Record<number, boolean>>({});

  // Custom Lists state (persisted in localStorage)
  const [customLists, setCustomLists] = useState<CustomList[]>(() => {
    try {
      const saved = localStorage.getItem("murihspace_custom_friend_lists");
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return DEFAULT_CUSTOM_LISTS;
  });

  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [newListIcon, setNewListIcon] = useState<CustomList["icon"]>("star");
  const [newListColor, setNewListColor] = useState("#2164b6");

  // Save custom lists
  useEffect(() => {
    try {
      localStorage.setItem("murihspace_custom_friend_lists", JSON.stringify(customLists));
    } catch {
      /* ignore */
    }
  }, [customLists]);

  // Fetch all friend data
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fRes, rRes, sRes, sugRes, bRes] = await Promise.all([
        apiClient.get("/friends").catch(() => ({ data: { data: [] } })),
        apiClient.get("/friends/requests").catch(() => ({ data: { data: [] } })),
        apiClient.get("/friends/requests/sent").catch(() => ({ data: { data: [] } })),
        apiClient.get("/friends/suggestions").catch(() => ({ data: { data: [] } })),
        apiClient.get("/friends/birthdays").catch(() => ({ data: { data: { today: [], upcoming: [], total_with_birthdays: 0 } } })),
      ]);

      setFriends(unwrapList<FriendListItem>(fRes.data?.data ?? fRes.data));
      setIncoming(unwrapList<FriendRequestItem>(rRes.data?.data ?? rRes.data));
      setOutgoing(unwrapList<FriendRequestItem>(sRes.data?.data ?? sRes.data));
      setSuggestions(unwrapList<FriendUser>(sugRes.data?.data ?? sugRes.data));

      const bdayData = bRes.data?.data ?? bRes.data;
      if (bdayData && typeof bdayData === "object") {
        setBirthdays({
          today: Array.isArray(bdayData.today) ? bdayData.today : [],
          upcoming: Array.isArray(bdayData.upcoming) ? bdayData.upcoming : [],
          total_with_birthdays: Number(bdayData.total_with_birthdays ?? 0),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load friends.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Live search debouncing
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setGlobalSearchResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await apiClient.get("/friends/search?q=" + encodeURIComponent(q));
        setGlobalSearchResults(unwrapList<FriendUser>(res.data?.data ?? res.data));
      } catch {
        setGlobalSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  const getStatus = (user: FriendUser): FriendUser["status"] => {
    return localStatus[user.id] ?? user.status ?? "none";
  };

  // Add friend
  const handleAdd = async (userId: number) => {
    setActionId(userId);
    try {
      await apiClient.post("/friends/requests", { user_id: userId });
      setLocalStatus((prev) => ({ ...prev, [userId]: "pending_sent" }));
    } catch {
      /* ignore */
    } finally {
      setActionId(null);
    }
  };

  // Accept / decline incoming
  const handleFriendAction = async (id: number, action: "accept" | "decline") => {
    setActionId(id);
    try {
      await apiClient.post(`/friends/requests/${id}/${action}`);
      if (action === "accept") {
        fetchAll();
      } else {
        setIncoming((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {
      /* ignore */
    } finally {
      setActionId(null);
    }
  };

  // Cancel outgoing
  const handleCancel = async (id: number, targetUserId?: number) => {
    setActionId(id);
    try {
      await apiClient.post(`/friends/requests/${id}/cancel`);
      setOutgoing((prev) => prev.filter((r) => r.id !== id));
      if (targetUserId) {
        setLocalStatus((prev) => ({ ...prev, [targetUserId]: "none" }));
      }
    } catch {
      /* ignore */
    } finally {
      setActionId(null);
    }
  };

  // Unfriend
  const handleUnfriend = async (userId: number, userName: string) => {
    const ok = await confirm({
      title: `Unfriend ${userName}?`,
      message: `Are you sure you want to remove ${userName} from your friends? They won't be notified, but they won't see your private friend posts.`,
      confirmText: "Unfriend",
      variant: "destructive",
    });
    if (!ok) return;

    setActionId(userId);
    try {
      await apiClient.delete(`/friends/${userId}`);
      setFriends((prev) => prev.filter((f) => f.friend?.id !== userId));
      // Also remove from any custom lists
      setCustomLists((lists) =>
        lists.map((l) => ({
          ...l,
          memberIds: l.memberIds.filter((id) => id !== userId),
        }))
      );
    } catch {
      /* ignore */
    } finally {
      setActionId(null);
    }
  };

  // Custom List member toggle
  const toggleFriendInList = (listId: string, userId: number) => {
    setCustomLists((prev) =>
      prev.map((l) => {
        if (l.id !== listId) return l;
        const exists = l.memberIds.includes(userId);
        return {
          ...l,
          memberIds: exists ? l.memberIds.filter((id) => id !== userId) : [...l.memberIds, userId],
        };
      })
    );
  };

  const handleCreateList = () => {
    const name = newListName.trim();
    if (!name) return;
    const newList: CustomList = {
      id: "custom_" + Date.now(),
      name,
      description: newListDesc.trim(),
      icon: newListIcon,
      color: newListColor,
      memberIds: [],
    };
    setCustomLists((prev) => [...prev, newList]);
    setNewListName("");
    setNewListDesc("");
    setCreateListOpen(false);
  };

  const handleDeleteList = (listId: string) => {
    setCustomLists((prev) => prev.filter((l) => l.id !== listId));
    if (activeListId === listId) setActiveListId(null);
  };

  // Filtered & Sorted Friends List
  const filteredFriends = useMemo(() => {
    let result = [...friends];

    // Filter by active custom list if selected
    if (activeListId) {
      const activeList = customLists.find((l) => l.id === activeListId);
      if (activeList) {
        result = result.filter((item) => item.friend && activeList.memberIds.includes(item.friend.id));
      }
    }

    // Filter by text
    const q = friendFilter.trim().toLowerCase();
    if (q) {
      result = result.filter((item) => {
        const f = item.friend;
        if (!f) return false;
        return (
          f.name?.toLowerCase().includes(q) ||
          f.username?.toLowerCase().includes(q) ||
          f.bio?.toLowerCase().includes(q)
        );
      });
    }

    // Sort
    if (friendSort === "az") {
      result.sort((a, b) => (a.friend?.name || "").localeCompare(b.friend?.name || ""));
    } else if (friendSort === "active") {
      result.sort((a, b) => ((b.friend?.is_online ? 1 : 0) - (a.friend?.is_online ? 1 : 0)));
    } else {
      result.sort((a, b) => new Date(b.since).getTime() - new Date(a.since).getTime());
    }

    return result;
  }, [friends, friendFilter, friendSort, activeListId, customLists]);

  const tabs: { key: TabKey; label: string; count?: number; hasBadge?: boolean }[] = [
    { key: "all", label: "All Friends", count: friends.length },
    { key: "requests", label: "Friend Requests", count: incoming.length, hasBadge: incoming.length > 0 },
    { key: "suggestions", label: "Suggestions" },
    { key: "birthdays", label: "Birthdays", count: birthdays.today.length, hasBadge: birthdays.today.length > 0 },
    { key: "lists", label: "Custom Lists", count: customLists.length },
  ];

  const isGlobalSearching = searchQuery.trim().length > 0;

  return (
    <div className="w-full min-h-screen bg-[#F0F2F5] dark:bg-[#18191A] text-foreground pb-20">
      {/* ────────────────── TOP PAGE HEADER ────────────────── */}
      <header className="w-full bg-white dark:bg-[#242526] border-b border-[#DADDE1] dark:border-[#3E4042] sticky top-14 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Title & Subtitle */}
            <div>
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#2164b6]/10 dark:bg-[#2164b6]/20 flex items-center justify-center text-[#2164b6] dark:text-[#7ab0ff]">
                  <Users weight="fill" className="h-5 w-5" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#050505] dark:text-[#E4E6EB]">
                  Friends
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Connect with people, discover new connections and manage your network.
              </p>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              {/* Global Search Bar */}
              <div className="relative flex-1 md:w-72 lg:w-80">
                <MagnifyingGlass
                  weight="bold"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search people on MurihSpace…"
                  className="w-full pl-9 pr-9 py-2 text-sm rounded-lg bg-[#F0F2F5] dark:bg-[#3A3B3C] border-none text-[#050505] dark:text-[#E4E6EB] placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-[#2164b6]/50 transition-all"
                />
                {searchLoading && (
                  <Spinner
                    weight="bold"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin"
                  />
                )}
                {searchQuery && !searchLoading && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                    title="Clear search"
                  >
                    <X weight="bold" className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Action Button: Custom Lists / Quick Create */}
              <button
                onClick={() => setCreateListOpen(true)}
                className="h-9 px-3 rounded-lg border border-[#DADDE1] dark:border-[#3E4042] bg-white dark:bg-[#242526] hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] text-sm font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer"
                title="Create Custom List"
              >
                <Plus weight="bold" className="h-4 w-4 text-[#2164b6]" />
                <span className="hidden sm:inline">New List</span>
              </button>
            </div>
          </div>

          {/* ────────────────── HORIZONTAL NAVIGATION TABS ────────────────── */}
          <nav className="flex items-center gap-1 sm:gap-2 mt-4 pt-1 overflow-x-auto no-scrollbar border-t border-[#DADDE1]/60 dark:border-[#3E4042]/60">
            {tabs.map((t) => {
              const isActive = currentTab === t.key && !isGlobalSearching;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setSearchQuery("");
                    setTab(t.key);
                  }}
                  className={`relative flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "text-[#2164b6] dark:text-[#7ab0ff] bg-[#2164b6]/10 dark:bg-[#2164b6]/20 font-bold"
                      : "text-muted-foreground hover:text-[#050505] dark:hover:text-[#E4E6EB] hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <span>{t.label}</span>
                  {t.count != null && t.count > 0 && (
                    <span
                      className={`h-5 min-w-[20px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center leading-none ${
                        t.hasBadge
                          ? "bg-rose-500 text-white"
                          : isActive
                          ? "bg-[#2164b6] text-white"
                          : "bg-[#DADDE1] dark:bg-[#3E4042] text-foreground"
                      }`}
                    >
                      {t.count > 99 ? "99+" : t.count}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2.5px] bg-[#2164b6] dark:bg-[#7ab0ff] rounded-t-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive flex items-center gap-3">
            <Prohibit weight="fill" className="h-5 w-5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={fetchAll} className="underline text-xs font-bold hover:text-destructive cursor-pointer">
              Retry
            </button>
          </div>
        )}

        {/* ────────────────── GLOBAL SEARCH RESULTS OVERLAY ────────────────── */}
        {isGlobalSearching ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <MagnifyingGlass weight="bold" className="h-4 w-4 text-[#2164b6]" />
                Search results for &ldquo;{searchQuery}&rdquo;
              </h2>
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs font-semibold text-[#2164b6] hover:underline cursor-pointer"
              >
                Clear Search
              </button>
            </div>

            {searchLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Spinner weight="bold" className="h-7 w-7 animate-spin text-[#2164b6]" />
              </div>
            ) : globalSearchResults.length === 0 ? (
              <EmptySocialState
                icon={UsersThree}
                title="No people found"
                description={`No user accounts match "${searchQuery}". Try searching with a different name or @username.`}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {globalSearchResults.map((user) => (
                  <SuggestionCard
                    key={user.id}
                    user={user}
                    status={getStatus(user)}
                    isBusy={actionId === user.id}
                    onAdd={() => handleAdd(user.id)}
                    onCancel={() => {
                      const req = outgoing.find((r) => r.receiver?.id === user.id);
                      if (req) handleCancel(req.id, user.id);
                      else setLocalStatus((prev) => ({ ...prev, [user.id]: "none" }));
                    }}
                    onDismiss={() => setDismissedSuggestions((prev) => ({ ...prev, [user.id]: true }))}
                  />
                ))}
              </div>
            )}
          </section>
        ) : loading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner weight="bold" className="h-8 w-8 animate-spin text-[#2164b6]" />
          </div>
        ) : (
          <>
            {/* ────────────────── TAB 1: ALL FRIENDS ────────────────── */}
            {currentTab === "all" && (
              <section className="space-y-5">
                {/* Control bar */}
                <div className="bg-white dark:bg-[#242526] border border-[#DADDE1] dark:border-[#3E4042] rounded-xl p-3 sm:p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-base sm:text-lg font-bold text-[#050505] dark:text-[#E4E6EB]">
                      {activeListId ? (
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground font-normal">List:</span>
                          <span className="text-[#2164b6]">
                            {customLists.find((l) => l.id === activeListId)?.name}
                          </span>
                          <button
                            onClick={() => setActiveListId(null)}
                            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Clear list filter"
                          >
                            <X weight="bold" className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ) : (
                        `${friends.length} ${friends.length === 1 ? "Friend" : "Friends"}`
                      )}
                    </span>
                    {activeListId && (
                      <span className="text-xs text-muted-foreground">
                        ({filteredFriends.length} in this list)
                      </span>
                    )}
                  </div>

                  {/* Filter / Sort / Toggle Controls */}
                  <div className="flex items-center flex-wrap gap-2.5">
                    {/* In-list filter */}
                    <div className="relative w-full sm:w-48 lg:w-56">
                      <MagnifyingGlass
                        weight="bold"
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                      />
                      <input
                        type="text"
                        value={friendFilter}
                        onChange={(e) => setFriendFilter(e.target.value)}
                        placeholder="Filter friends…"
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#F0F2F5] dark:bg-[#3A3B3C] border-none text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-[#2164b6]/50"
                      />
                    </div>

                    {/* Sort Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 px-3 rounded-lg border border-[#DADDE1] dark:border-[#3E4042] bg-white dark:bg-[#242526] hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer">
                        <SlidersHorizontal weight="bold" className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>
                          {friendSort === "recent"
                            ? "Recently Added"
                            : friendSort === "az"
                            ? "Name (A-Z)"
                            : "Recently Active"}
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel className="text-xs font-bold text-muted-foreground">
                          Sort By
                        </DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setFriendSort("recent")} className="cursor-pointer">
                          Recently Added
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFriendSort("az")} className="cursor-pointer">
                          Name (A-Z)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFriendSort("active")} className="cursor-pointer">
                          Recently Active
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Grid / List View Toggle */}
                    <div className="flex items-center bg-[#F0F2F5] dark:bg-[#3A3B3C] p-0.5 rounded-lg border border-[#DADDE1]/50 dark:border-[#3E4042]/50">
                      <button
                        onClick={() => setViewMode("grid")}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                          viewMode === "grid"
                            ? "bg-white dark:bg-[#242526] text-[#2164b6] shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Grid View"
                      >
                        <SquaresFour weight="fill" className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setViewMode("list")}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                          viewMode === "list"
                            ? "bg-white dark:bg-[#242526] text-[#2164b6] shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="List View"
                      >
                        <ListDashes weight="bold" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Friends Grid or List */}
                {filteredFriends.length === 0 ? (
                  friends.length === 0 ? (
                    <EmptySocialState
                      icon={Users}
                      title="No friends yet"
                      description="Search for people or explore recommendations to start building your social network on MurihSpace."
                      primaryAction={{
                        label: "Find People",
                        onClick: () => setTab("suggestions"),
                      }}
                      secondaryAction={{
                        label: "Explore Communities",
                        href: "/app/communities",
                      }}
                    />
                  ) : (
                    <EmptySocialState
                      icon={MagnifyingGlass}
                      title="No matches found"
                      description={`No friends matched "${friendFilter}". Try clearing the filter.`}
                      primaryAction={{
                        label: "Clear Filter",
                        onClick: () => setFriendFilter(""),
                      }}
                    />
                  )
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredFriends.map((item) => {
                      if (!item.friend) return null;
                      return (
                        <FriendCardGrid
                          key={item.id}
                          friend={item.friend}
                          mutualCount={item.mutual_friends}
                          since={item.since}
                          isBusy={actionId === item.friend.id}
                          customLists={customLists}
                          onToggleList={(listId) => item.friend && toggleFriendInList(listId, item.friend.id)}
                          onUnfriend={() =>
                            item.friend && handleUnfriend(item.friend.id, item.friend.name)
                          }
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[#242526] border border-[#DADDE1] dark:border-[#3E4042] rounded-xl divide-y divide-[#DADDE1]/60 dark:divide-[#3E4042]/60 overflow-hidden shadow-2xs">
                    {filteredFriends.map((item) => {
                      if (!item.friend) return null;
                      return (
                        <FriendCardListRow
                          key={item.id}
                          friend={item.friend}
                          mutualCount={item.mutual_friends}
                          isBusy={actionId === item.friend.id}
                          customLists={customLists}
                          onToggleList={(listId) => item.friend && toggleFriendInList(listId, item.friend.id)}
                          onUnfriend={() =>
                            item.friend && handleUnfriend(item.friend.id, item.friend.name)
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ────────────────── TAB 2: FRIEND REQUESTS ────────────────── */}
            {currentTab === "requests" && (
              <section className="space-y-6">
                {/* Incoming Requests */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-[#050505] dark:text-[#E4E6EB] flex items-center gap-2">
                      <UserCheck weight="fill" className="h-5 w-5 text-[#2164b6]" />
                      Friend Requests
                      <span className="text-sm font-semibold text-muted-foreground">
                        ({incoming.length})
                      </span>
                    </h2>
                  </div>

                  {incoming.length === 0 ? (
                    <EmptySocialState
                      icon={UserCheck}
                      title="No new friend requests"
                      description="Check out People You May Know to grow your network and meet creators on MurihSpace."
                      primaryAction={{
                        label: "Explore Suggestions",
                        onClick: () => setTab("suggestions"),
                      }}
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {incoming.map((r) => {
                        if (!r.sender) return null;
                        return (
                          <IncomingRequestCard
                            key={r.id}
                            request={r}
                            isBusy={actionId === r.id}
                            onAccept={() => handleFriendAction(r.id, "accept")}
                            onDecline={() => handleFriendAction(r.id, "decline")}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sent Requests Collapsible */}
                {outgoing.length > 0 && (
                  <div className="pt-4 border-t border-[#DADDE1] dark:border-[#3E4042]">
                    <button
                      onClick={() => setShowSentRequests((prev) => !prev)}
                      className="flex items-center justify-between w-full py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Clock weight="fill" className="h-4 w-4" />
                        Sent Requests ({outgoing.length})
                      </span>
                      <span className="text-xs text-[#2164b6]">
                        {showSentRequests ? "Hide" : "Show Sent Requests"}
                      </span>
                    </button>

                    {showSentRequests && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-3">
                        {outgoing.map((r) => {
                          if (!r.receiver) return null;
                          return (
                            <SentRequestCard
                              key={r.id}
                              request={r}
                              isBusy={actionId === r.id}
                              onCancel={() => handleCancel(r.id, r.receiver?.id)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ────────────────── TAB 3: SUGGESTIONS ────────────────── */}
            {currentTab === "suggestions" && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#050505] dark:text-[#E4E6EB] flex items-center gap-2">
                      <UsersThree weight="fill" className="h-5 w-5 text-[#2164b6]" />
                      People You May Know
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Recommended based on mutual friends, communities and interests.
                    </p>
                  </div>
                </div>

                {suggestions.filter((u) => !dismissedSuggestions[u.id]).length === 0 ? (
                  <EmptySocialState
                    icon={UsersThree}
                    title="No suggestions right now"
                    description="You've reviewed all current recommendations. Check back later or use search above to find people."
                    primaryAction={{
                      label: "Explore Communities",
                      href: "/app/communities",
                    }}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {suggestions
                      .filter((u) => !dismissedSuggestions[u.id])
                      .map((user) => (
                        <SuggestionCard
                          key={user.id}
                          user={user}
                          status={getStatus(user)}
                          isBusy={actionId === user.id}
                          onAdd={() => handleAdd(user.id)}
                          onCancel={() => {
                            const req = outgoing.find((r) => r.receiver?.id === user.id);
                            if (req) handleCancel(req.id, user.id);
                            else setLocalStatus((prev) => ({ ...prev, [user.id]: "none" }));
                          }}
                          onDismiss={() =>
                            setDismissedSuggestions((prev) => ({ ...prev, [user.id]: true }))
                          }
                        />
                      ))}
                  </div>
                )}
              </section>
            )}

            {/* ────────────────── TAB 4: BIRTHDAYS ────────────────── */}
            {currentTab === "birthdays" && (
              <section className="space-y-6">
                {/* Today's Birthdays */}
                {birthdays.today.length > 0 && (
                  <div className="bg-gradient-to-r from-[#2164b6]/10 via-[#2164b6]/5 to-transparent border border-[#2164b6]/30 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="h-9 w-9 rounded-xl bg-[#2164b6] text-white flex items-center justify-center shadow-xs">
                        <Cake weight="fill" className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-[#050505] dark:text-[#E4E6EB]">
                          Today&apos;s Birthdays 🎂
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          Wish your friends a wonderful birthday on MurihSpace!
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {birthdays.today.map((user) => (
                        <div
                          key={user.id}
                          className="bg-white dark:bg-[#242526] border border-[#2164b6]/40 rounded-xl p-4 flex items-center gap-3 shadow-xs"
                        >
                          <Avatar
                            name={user.name}
                            url={user.avatar_url ?? user.avatar}
                            size={52}
                            className="ring-2 ring-[#2164b6]/40"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
                              {user.has_active_verification_badge && (
                                <SealCheck weight="fill" className="h-4 w-4 text-[#2164b6] shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                            <span className="inline-block mt-1 text-[11px] font-bold text-[#2164b6] bg-[#2164b6]/10 px-2 py-0.5 rounded-full">
                              Celebrating Today 🎉
                            </span>
                          </div>
                          <Link
                            to={`/app/messages?user=${user.id}`}
                            className="px-3 py-2 rounded-lg bg-[#2164b6] text-white text-xs font-bold hover:bg-[#1a5091] transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs"
                          >
                            <Gift weight="fill" className="h-4 w-4" />
                            <span>Wish</span>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upcoming Birthdays */}
                <div>
                  <h3 className="text-base font-bold text-[#050505] dark:text-[#E4E6EB] mb-3 flex items-center gap-2">
                    <Cake weight="fill" className="h-4 w-4 text-[#2164b6]" />
                    Upcoming Birthdays
                  </h3>

                  {birthdays.upcoming.length === 0 && birthdays.today.length === 0 ? (
                    <EmptySocialState
                      icon={Cake}
                      title="No upcoming birthdays"
                      description="None of your friends have a birthday coming up in the next 60 days. You'll see celebration alerts here when someone's birthday approaches!"
                      primaryAction={{
                        label: "View All Friends",
                        onClick: () => setTab("all"),
                      }}
                    />
                  ) : birthdays.upcoming.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No other birthdays in the next 60 days.
                    </p>
                  ) : (
                    <div className="bg-white dark:bg-[#242526] border border-[#DADDE1] dark:border-[#3E4042] rounded-xl divide-y divide-[#DADDE1]/60 dark:divide-[#3E4042]/60 overflow-hidden shadow-2xs">
                      {birthdays.upcoming.map((user) => (
                        <div
                          key={user.id}
                          className="px-4 py-3 flex items-center gap-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                        >
                          <Avatar name={user.name} url={user.avatar_url ?? user.avatar} size={44} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
                              {user.has_active_verification_badge && (
                                <SealCheck weight="fill" className="h-3.5 w-3.5 text-[#2164b6] shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              @{user.username}
                              {user.formatted_date && ` · ${user.formatted_date}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-semibold text-muted-foreground">
                              {user.days_remaining === 1
                                ? "Tomorrow"
                                : user.days_remaining != null
                                ? `in ${user.days_remaining} days`
                                : "Soon"}
                            </span>
                            <Link
                              to={`/app/messages?user=${user.id}`}
                              className="px-3 py-1.5 rounded-lg border border-[#DADDE1] dark:border-[#3E4042] hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] text-xs font-bold text-foreground transition-colors flex items-center gap-1.5"
                            >
                              <ChatTeardropText weight="fill" className="h-3.5 w-3.5 text-[#2164b6]" />
                              <span>Message</span>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ────────────────── TAB 5: CUSTOM LISTS ────────────────── */}
            {currentTab === "lists" && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#050505] dark:text-[#E4E6EB] flex items-center gap-2">
                      <Star weight="fill" className="h-5 w-5 text-[#2164b6]" />
                      Custom Friend Lists
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Organize your friends into distinct circles to manage sharing and discover updates.
                    </p>
                  </div>
                  <button
                    onClick={() => setCreateListOpen(true)}
                    className="px-3.5 py-2 rounded-lg bg-[#2164b6] text-white text-xs font-bold hover:bg-[#1a5091] flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Plus weight="bold" className="h-4 w-4" />
                    <span>Create List</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {customLists.map((list) => {
                    const listFriends = friends.filter(
                      (f) => f.friend && list.memberIds.includes(f.friend.id)
                    );
                    const isSelected = activeListId === list.id;

                    return (
                      <div
                        key={list.id}
                        className={`bg-white dark:bg-[#242526] border rounded-xl p-4.5 flex flex-col justify-between transition-all shadow-2xs hover:shadow-md ${
                          isSelected
                            ? "border-[#2164b6] ring-2 ring-[#2164b6]/20"
                            : "border-[#DADDE1] dark:border-[#3E4042]"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div
                              className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-2xs"
                              style={{ backgroundColor: list.color }}
                            >
                              {list.icon === "star" && <Star weight="fill" className="h-5 w-5" />}
                              {list.icon === "users" && <Users weight="fill" className="h-5 w-5" />}
                              {list.icon === "palette" && <Palette weight="fill" className="h-5 w-5" />}
                              {list.icon === "briefcase" && (
                                <Briefcase weight="fill" className="h-5 w-5" />
                              )}
                              {list.icon === "heart" && <Heart weight="fill" className="h-5 w-5" />}
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
                                <DotsThree weight="bold" className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setActiveListId(list.id);
                                    setTab("all");
                                  }}
                                  className="cursor-pointer"
                                >
                                  View Members
                                </DropdownMenuItem>
                                {list.id.startsWith("custom_") && (
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteList(list.id)}
                                    className="text-destructive focus:text-destructive cursor-pointer"
                                  >
                                    <Trash weight="bold" className="h-3.5 w-3.5 mr-1.5" />
                                    Delete List
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <h3 className="text-base font-bold text-foreground">{list.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {list.description || "Organized circle of friends."}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-[#DADDE1]/60 dark:border-[#3E4042]/60">
                          {/* Member avatars preview */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center -space-x-2">
                              {listFriends.slice(0, 4).map((f) => (
                                <Avatar
                                  key={f.id}
                                  name={f.friend?.name || "Friend"}
                                  url={f.friend?.avatar_url ?? f.friend?.avatar}
                                  size={26}
                                  className="ring-2 ring-white dark:ring-[#242526]"
                                />
                              ))}
                              {listFriends.length === 0 && (
                                <span className="text-[11px] text-muted-foreground italic">
                                  No members yet
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-bold text-[#2164b6]">
                              {list.memberIds.length} {list.memberIds.length === 1 ? "friend" : "friends"}
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              setActiveListId(list.id);
                              setTab("all");
                            }}
                            className="mt-3 w-full py-1.5 text-xs font-bold rounded-lg border border-[#DADDE1] dark:border-[#3E4042] hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] text-foreground transition-colors cursor-pointer"
                          >
                            Filter Friends
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* ────────────────── CREATE CUSTOM LIST MODAL ────────────────── */}
      <Dialog open={createListOpen} onOpenChange={setCreateListOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#242526] border border-[#DADDE1] dark:border-[#3E4042]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Create New Friend List
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Group friends into custom circles for quick filtering and focused interactions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                List Name
              </label>
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g. Designers, University Friends, Gym Buddies…"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#F0F2F5] dark:bg-[#3A3B3C] border border-[#DADDE1] dark:border-[#3E4042] text-foreground focus:outline-hidden focus:ring-2 focus:ring-[#2164b6]/50"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Description (Optional)
              </label>
              <input
                type="text"
                value={newListDesc}
                onChange={(e) => setNewListDesc(e.target.value)}
                placeholder="Brief note about this list…"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#F0F2F5] dark:bg-[#3A3B3C] border border-[#DADDE1] dark:border-[#3E4042] text-foreground focus:outline-hidden focus:ring-2 focus:ring-[#2164b6]/50"
              />
            </div>

            {/* Icon Picker */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Icon
              </label>
              <div className="flex items-center gap-2">
                {[
                  { id: "star", icon: Star, label: "Star" },
                  { id: "users", icon: Users, label: "Users" },
                  { id: "palette", icon: Palette, label: "Palette" },
                  { id: "briefcase", icon: Briefcase, label: "Briefcase" },
                  { id: "heart", icon: Heart, label: "Heart" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setNewListIcon(item.id as CustomList["icon"])}
                      className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                        newListIcon === item.id
                          ? "bg-[#2164b6] text-white shadow-xs scale-105"
                          : "bg-[#F0F2F5] dark:bg-[#3A3B3C] text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon weight="fill" className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Color Tag
              </label>
              <div className="flex items-center gap-2">
                {[
                  "#2164b6",
                  "#F59E0B",
                  "#10B981",
                  "#8B5CF6",
                  "#EC4899",
                  "#EF4444",
                  "#06B6D4",
                ].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewListColor(color)}
                    className={`h-7 w-7 rounded-full transition-transform cursor-pointer ${
                      newListColor === color ? "scale-125 ring-2 ring-offset-2 ring-[#2164b6]" : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setCreateListOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#DADDE1] dark:border-[#3E4042] text-xs font-bold hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateList}
              disabled={!newListName.trim()}
              className="px-4 py-2 rounded-lg bg-[#2164b6] text-white text-xs font-bold hover:bg-[#1a5091] disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
            >
              Create List
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ────────────────── SUBCOMPONENTS ────────────────── */

/**
 * Responsive Friend Card (Grid View in All Friends)
 */
function FriendCardGrid({
  friend,
  mutualCount,
  isBusy,
  customLists,
  onToggleList,
  onUnfriend,
}: {
  friend: FriendUser;
  mutualCount: number;
  since?: string;
  isBusy: boolean;
  customLists: CustomList[];
  onToggleList: (listId: string) => void;
  onUnfriend: () => void;
}) {
  return (
    <div className="group bg-white dark:bg-[#242526] border border-[#DADDE1] dark:border-[#3E4042] rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all duration-200">
      <div>
        <div className="flex items-start justify-between gap-2">
          {/* Avatar with status indicator */}
          <div className="relative">
            <Avatar
              name={friend.name}
              url={friend.avatar_url ?? friend.avatar}
              size={56}
              className="ring-2 ring-white dark:ring-[#242526]"
            />
            {friend.is_online && (
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#242526]" />
            )}
          </div>

          {/* More actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
              <DotsThreeVertical weight="bold" className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link to={`/u/${friend.username}`} className="flex items-center gap-2 cursor-pointer">
                  <Eye weight="fill" className="h-4 w-4 text-muted-foreground" />
                  <span>View Profile</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground">
                Add to Custom List
              </DropdownMenuLabel>
              {customLists.map((l) => {
                const inList = l.memberIds.includes(friend.id);
                return (
                  <DropdownMenuItem
                    key={l.id}
                    onClick={() => onToggleList(l.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-xs truncate">{l.name}</span>
                    {inList && <Check weight="bold" className="h-3.5 w-3.5 text-[#2164b6]" />}
                  </DropdownMenuItem>
                );
              })}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onUnfriend}
                disabled={isBusy}
                className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer"
              >
                {isBusy ? (
                  <Spinner weight="bold" className="h-4 w-4 animate-spin" />
                ) : (
                  <UserMinus weight="fill" className="h-4 w-4" />
                )}
                <span>Unfriend</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Friend Name & Username */}
        <div className="mt-3">
          <Link
            to={`/u/${friend.username}`}
            className="text-base font-bold text-[#050505] dark:text-[#E4E6EB] hover:underline flex items-center gap-1.5 line-clamp-1"
          >
            <span>{friend.name}</span>
            {friend.has_active_verification_badge && (
              <SealCheck weight="fill" className="h-4 w-4 text-[#2164b6] shrink-0" />
            )}
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5">@{friend.username}</p>
        </div>

        {/* Mutual friends count */}
        {mutualCount > 0 ? (
          <p className="text-[11px] text-muted-foreground/80 mt-1.5 flex items-center gap-1">
            <Users weight="fill" className="h-3.5 w-3.5 text-[#2164b6]" />
            <span>{mutualCount} mutual connections</span>
          </p>
        ) : friend.bio ? (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{friend.bio}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground/60 mt-1.5">Connected on MurihSpace</p>
        )}
      </div>

      {/* Card Action Button */}
      <div className="mt-4 pt-3 border-t border-[#DADDE1]/60 dark:border-[#3E4042]/60 flex items-center gap-2">
        <Link
          to={`/app/messages?user=${friend.id}`}
          className="flex-1 py-1.5 rounded-lg bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] hover:bg-[#2164b6]/20 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
        >
          <ChatTeardropText weight="fill" className="h-4 w-4" />
          <span>Message</span>
        </Link>
      </div>
    </div>
  );
}

/**
 * List Row for All Friends
 */
function FriendCardListRow({
  friend,
  mutualCount,
  isBusy,
  customLists,
  onToggleList,
  onUnfriend,
}: {
  friend: FriendUser;
  mutualCount: number;
  isBusy: boolean;
  customLists: CustomList[];
  onToggleList: (listId: string) => void;
  onUnfriend: () => void;
}) {
  return (
    <div className="px-4 py-3 flex items-center gap-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
      <div className="relative">
        <Avatar name={friend.name} url={friend.avatar_url ?? friend.avatar} size={48} />
        {friend.is_online && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#242526]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Link
            to={`/u/${friend.username}`}
            className="text-sm font-bold text-foreground hover:underline truncate"
          >
            {friend.name}
          </Link>
          {friend.has_active_verification_badge && (
            <SealCheck weight="fill" className="h-3.5 w-3.5 text-[#2164b6] shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          @{friend.username}
          {mutualCount > 0 && ` · ${mutualCount} mutual`}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          to={`/app/messages?user=${friend.id}`}
          className="px-3 py-1.5 rounded-lg bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] hover:bg-[#2164b6]/20 text-xs font-bold transition-colors flex items-center gap-1.5"
        >
          <ChatTeardropText weight="fill" className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Message</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
            <DotsThreeVertical weight="bold" className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link to={`/u/${friend.username}`} className="flex items-center gap-2 cursor-pointer">
                <Eye weight="fill" className="h-4 w-4 text-muted-foreground" />
                <span>View Profile</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground">
              Add to Custom List
            </DropdownMenuLabel>
            {customLists.map((l) => {
              const inList = l.memberIds.includes(friend.id);
              return (
                <DropdownMenuItem
                  key={l.id}
                  onClick={() => onToggleList(l.id)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="text-xs truncate">{l.name}</span>
                  {inList && <Check weight="bold" className="h-3.5 w-3.5 text-[#2164b6]" />}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onUnfriend}
              disabled={isBusy}
              className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer"
            >
              <UserMinus weight="fill" className="h-4 w-4" />
              <span>Unfriend</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/**
 * High-Priority Incoming Request Card
 */
function IncomingRequestCard({
  request,
  isBusy,
  onAccept,
  onDecline,
}: {
  request: FriendRequestItem;
  isBusy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const sender = request.sender;
  if (!sender) return null;

  return (
    <div className="bg-white dark:bg-[#242526] border border-[#DADDE1] dark:border-[#3E4042] rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      {/* Card Header & Avatar */}
      <div>
        <div className="h-14 bg-gradient-to-r from-[#2164b6]/20 via-[#2164b6]/10 to-transparent relative">
          <div className="absolute top-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="p-1 rounded-full bg-white/70 dark:bg-black/50 hover:bg-white text-muted-foreground hover:text-foreground shadow-2xs cursor-pointer">
                <DotsThree weight="bold" className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/u/${sender.username}`} className="cursor-pointer">View Profile</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="px-4 -mt-7">
          <Avatar
            name={sender.name}
            url={sender.avatar_url ?? sender.avatar}
            size={58}
            className="ring-3 ring-white dark:ring-[#242526] shadow-xs"
          />
        </div>

        <div className="p-4 pt-2">
          <Link
            to={`/u/${sender.username}`}
            className="text-base font-bold text-[#050505] dark:text-[#E4E6EB] hover:underline flex items-center gap-1.5 line-clamp-1"
          >
            <span>{sender.name}</span>
            {sender.has_active_verification_badge && (
              <SealCheck weight="fill" className="h-4 w-4 text-[#2164b6] shrink-0" />
            )}
          </Link>
          <p className="text-xs text-muted-foreground">@{sender.username}</p>

          {request.mutual_friends > 0 ? (
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
              <Users weight="fill" className="h-3.5 w-3.5 text-[#2164b6]" />
              <span>{request.mutual_friends} mutual friends</span>
            </p>
          ) : sender.bio ? (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{sender.bio}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground/60 mt-2">Wants to connect with you</p>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="p-4 pt-0 space-y-2">
        <button
          onClick={onAccept}
          disabled={isBusy}
          className="w-full py-2 rounded-lg bg-[#2164b6] hover:bg-[#1a5091] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
        >
          {isBusy ? (
            <Spinner weight="bold" className="h-4 w-4 animate-spin" />
          ) : (
            <Check weight="bold" className="h-4 w-4" />
          )}
          <span>Confirm</span>
        </button>
        <button
          onClick={onDecline}
          disabled={isBusy}
          className="w-full py-2 rounded-lg bg-[#E4E6EB] hover:bg-[#D8DADF] dark:bg-[#3A3B3C] dark:hover:bg-[#4E4F50] text-[#050505] dark:text-[#E4E6EB] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <X weight="bold" className="h-3.5 w-3.5" />
          <span>Delete Request</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Outgoing Sent Request Card
 */
function SentRequestCard({
  request,
  isBusy,
  onCancel,
}: {
  request: FriendRequestItem;
  isBusy: boolean;
  onCancel: () => void;
}) {
  const receiver = request.receiver;
  if (!receiver) return null;

  return (
    <div className="bg-white dark:bg-[#242526] border border-[#DADDE1] dark:border-[#3E4042] rounded-xl p-4 flex items-center gap-3 shadow-2xs opacity-90">
      <Avatar name={receiver.name} url={receiver.avatar_url ?? receiver.avatar} size={48} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">{receiver.name}</p>
        <p className="text-xs text-muted-foreground truncate">@{receiver.username}</p>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1">
          <Clock weight="fill" className="h-3 w-3" />
          Pending
        </span>
      </div>
      <button
        onClick={onCancel}
        disabled={isBusy}
        className="px-3 py-1.5 rounded-lg border border-[#DADDE1] dark:border-[#3E4042] text-xs font-semibold hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
      >
        {isBusy ? <Spinner weight="bold" className="h-3.5 w-3.5 animate-spin" /> : "Cancel"}
      </button>
    </div>
  );
}

/**
 * Suggestions (People You May Know) Discovery Card
 */
function SuggestionCard({
  user,
  status,
  isBusy,
  onAdd,
  onCancel,
  onDismiss,
}: {
  user: FriendUser;
  status: FriendUser["status"];
  isBusy: boolean;
  onAdd: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const hasCover = Boolean(user.banner_url);

  return (
    <div className="group bg-white dark:bg-[#242526] border border-[#DADDE1] dark:border-[#3E4042] rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      <div>
        {/* Cover / Banner area */}
        <div
          className="h-16 relative bg-gradient-to-r from-[#2164b6]/20 via-[#1a6b9e]/20 to-indigo-500/20 bg-cover bg-center"
          style={hasCover ? { backgroundImage: `url(${user.banner_url})` } : {}}
        >
          <button
            onClick={onDismiss}
            className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Remove suggestion"
          >
            <X weight="bold" className="h-3 w-3" />
          </button>
        </div>

        {/* Overlapping Avatar */}
        <div className="px-4 -mt-8 flex items-end justify-between">
          <Avatar
            name={user.name}
            url={user.avatar_url ?? user.avatar}
            size={58}
            className="ring-3 ring-white dark:ring-[#242526] shadow-xs"
          />
        </div>

        {/* User Info */}
        <div className="p-4 pt-2">
          <Link
            to={`/u/${user.username}`}
            className="text-base font-bold text-[#050505] dark:text-[#E4E6EB] hover:underline flex items-center gap-1.5 line-clamp-1"
          >
            <span>{user.name}</span>
            {user.has_active_verification_badge && (
              <SealCheck weight="fill" className="h-4 w-4 text-[#2164b6] shrink-0" />
            )}
          </Link>
          <p className="text-xs text-muted-foreground">@{user.username}</p>

          {(user.mutual_friends ?? 0) > 0 ? (
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
              <Users weight="fill" className="h-3.5 w-3.5 text-[#2164b6]" />
              <span>{user.mutual_friends} mutual connections</span>
            </p>
          ) : user.bio ? (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{user.bio}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground/60 mt-2">Suggested for you</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 pt-0 space-y-2">
        {status === "accepted" ? (
          <div className="w-full py-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5">
            <Check weight="bold" className="h-4 w-4" />
            <span>Friends</span>
          </div>
        ) : status === "pending_sent" ? (
          <button
            onClick={onCancel}
            disabled={isBusy}
            className="w-full py-2 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-500/25 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isBusy ? (
              <Spinner weight="bold" className="h-4 w-4 animate-spin" />
            ) : (
              <Clock weight="fill" className="h-4 w-4" />
            )}
            <span>Request Sent (Cancel)</span>
          </button>
        ) : (
          <>
            <button
              onClick={onAdd}
              disabled={isBusy}
              className="w-full py-2 rounded-lg bg-[#2164b6] hover:bg-[#1a5091] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {isBusy ? (
                <Spinner weight="bold" className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus weight="fill" className="h-4 w-4" />
              )}
              <span>Add Friend</span>
            </button>
            <button
              onClick={onDismiss}
              className="w-full py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Social Empty State
 */
function EmptySocialState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  icon: typeof Users;
  title: string;
  description: string;
  primaryAction?: { label: string; onClick?: () => void; href?: string };
  secondaryAction?: { label: string; onClick?: () => void; href?: string };
}) {
  return (
    <div className="bg-white dark:bg-[#242526] border border-[#DADDE1] dark:border-[#3E4042] rounded-2xl p-10 sm:p-14 text-center max-w-xl mx-auto shadow-2xs my-4">
      <div className="h-16 w-16 rounded-2xl bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] flex items-center justify-center mx-auto mb-4">
        <Icon weight="fill" className="h-8 w-8" />
      </div>
      <h3 className="text-lg sm:text-xl font-bold text-[#050505] dark:text-[#E4E6EB]">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
        {description}
      </p>

      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          {primaryAction &&
            (primaryAction.href ? (
              <Link
                to={primaryAction.href}
                className="px-5 py-2.5 rounded-lg bg-[#2164b6] hover:bg-[#1a5091] text-white text-xs sm:text-sm font-bold transition-colors shadow-2xs"
              >
                {primaryAction.label}
              </Link>
            ) : (
              <button
                onClick={primaryAction.onClick}
                className="px-5 py-2.5 rounded-lg bg-[#2164b6] hover:bg-[#1a5091] text-white text-xs sm:text-sm font-bold transition-colors shadow-2xs cursor-pointer"
              >
                {primaryAction.label}
              </button>
            ))}

          {secondaryAction &&
            (secondaryAction.href ? (
              <Link
                to={secondaryAction.href}
                className="px-4 py-2.5 rounded-lg border border-[#DADDE1] dark:border-[#3E4042] hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] text-xs sm:text-sm font-bold text-foreground transition-colors"
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                onClick={secondaryAction.onClick}
                className="px-4 py-2.5 rounded-lg border border-[#DADDE1] dark:border-[#3E4042] hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] text-xs sm:text-sm font-bold text-foreground transition-colors cursor-pointer"
              >
                {secondaryAction.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
