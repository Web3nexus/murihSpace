import { useState, useEffect, useCallback, useRef } from "react";
import {
  UserPlus,
  Users,
  Clock,
  Check,
  X,
  Search,
  Loader2,
  UserCheck,
  MessageSquare,
  UserX,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useConfirm } from "@/components/ui/DialogProvider";
import { cn } from "@/lib/utils";

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const inner = (data as { data?: unknown } | null)?.data;
  if (Array.isArray(inner)) return inner as T[];
  return [];
}

type TabKey = "friends" | "requests" | "sent";

interface FriendUser {
  id: number;
  name: string;
  username: string;
  avatar?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
}

interface FriendListItem {
  id: number;
  friend: FriendUser | null;
  mutual_friends: number;
  since: string;
}

interface FriendRequestItem {
  id: number;
  sender?: FriendUser | null;
  receiver?: FriendUser | null;
  mutual_friends: number;
  status: string;
  created_at: string;
}

function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const initial = name.charAt(0).toUpperCase();
  if (url) return <img src={url} alt={name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  return (
    <div
      className="rounded-full bg-gradient-to-br from-[#2164b6] to-[#1a6b9e] text-white font-bold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}

function FriendAvatar({ user, size = 48 }: { user?: FriendUser | null; size?: number }) {
  return <Avatar name={user?.name ?? "User"} url={user?.avatar_url ?? user?.avatar} size={size} />;
}

export default function FriendsPage() {
  const [tab, setTab] = useState<TabKey>("friends");
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fRes, rRes, sRes] = await Promise.all([
        apiClient.get("/friends"),
        apiClient.get("/friends/requests"),
        apiClient.get("/friends/requests/sent"),
      ]);
      setFriends(unwrapList<FriendListItem>(fRes.data?.data));
      setIncoming(unwrapList<FriendRequestItem>(rRes.data?.data));
      setOutgoing(unwrapList<FriendRequestItem>(sRes.data?.data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load friends.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchAll]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]); // eslint-disable-line react-hooks/set-state-in-effect
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/friends/search?q=${encodeURIComponent(q)}`);
        setSearchResults(unwrapList<FriendUser>(res.data?.data));
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchLoading(true);
    apiClient
      .get(`/friends/search?q=${encodeURIComponent(q)}`)
      .then((res) => setSearchResults(unwrapList<FriendUser>(res.data?.data)))
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  };

  const handleAddFriend = async (userId: number) => {
    setAddingId(userId);
    try {
      await apiClient.post("/friends/requests", { user_id: userId });
      setSearchResults((prev) => prev.filter((u) => u.id !== userId));
    } catch (e) {
      console.error("Failed to send friend request", e);
    } finally {
      setAddingId(null);
    }
  };

  const handleFriendAction = async (id: number, action: "accept" | "decline") => {
    setActionId(id);
    try {
      await apiClient.post(`/friends/requests/${id}/${action}`);
      setIncoming((prev) => prev.filter((r) => r.id !== id));
      if (action === "accept") fetchAll();
    } catch (e) {
      console.error(`Failed to ${action} friend request`, e);
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (id: number) => {
    setActionId(id);
    try {
      await apiClient.post(`/friends/requests/${id}/cancel`);
      setOutgoing((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error("Failed to cancel friend request", e);
    } finally {
      setActionId(null);
    }
  };

  const confirm = useConfirm();

  const handleUnfriend = async (userId: number) => {
    if (!await confirm({ title: "Remove Friend", message: "Remove this friend?", variant: "destructive" })) return;
    setActionId(userId);
    try {
      await apiClient.delete(`/friends/${userId}`);
      setFriends((prev) => prev.filter((f) => f.friend?.id !== userId));
    } catch (e) {
      console.error("Failed to remove friend", e);
    } finally {
      setActionId(null);
    }
  };

  const tabs: { key: TabKey; label: string; count: number; icon: typeof Users }[] = [
    { key: "friends", label: "Friends", count: friends.length, icon: Users },
    { key: "requests", label: "Requests", count: incoming.length, icon: UserPlus },
    { key: "sent", label: "Sent", count: outgoing.length, icon: Clock },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#2164b6] to-[#1a6b9e] flex items-center justify-center shadow-sm">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">Friends</h1>
            <p className="text-xs text-muted-foreground/70">Manage your friends and friend requests</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find friends by name or username..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-muted/60 border border-border/50 outline-none focus:ring-1 focus:ring-[#2164b6]/30 focus:border-[#2164b6]/30 placeholder:text-muted-foreground/40 transition-all"
          />
          {searchLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
          )}
        </form>
      </div>

      {/* Add friend results */}
      {searchQuery.trim() && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Search results
          </p>
          {searchLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" />
            </div>
          ) : searchResults.length === 0 ? (
            <p className="text-xs text-muted-foreground/70 py-3 text-center">
              No users found. Try a different name or username.
            </p>
          ) : (
            <div className="space-y-2">
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 p-2.5">
                  <FriendAvatar user={u} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{u.name}</p>
                    <p className="text-[11px] text-muted-foreground/70 truncate">@{u.username}</p>
                  </div>
                  <button
                    onClick={() => handleAddFriend(u.id)}
                    disabled={addingId === u.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2164b6] text-white text-[11px] font-bold hover:bg-[#1a5091] transition-all disabled:opacity-50"
                  >
                    {addingId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                    Add Friend
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-muted/40 p-1 border border-border/40">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex-1 justify-center",
              tab === t.key
                ? "bg-white dark:bg-[#102840] text-foreground shadow-sm border border-border/50"
                : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50",
            )}
          >
            <t.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t.label}</span>
            {t.count > 0 && (
              <span className="h-4 min-w-[18px] px-1 rounded-full bg-[#2164b6] text-white text-[9px] font-extrabold flex items-center justify-center">
                {t.count > 99 ? "99+" : t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-xs font-semibold text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" />
        </div>
      ) : tab === "friends" ? (
        friends.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No friends yet"
            description="Search for people by name or username above to start adding friends."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {friends.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3 hover:shadow-sm hover:border-[#2164b6]/20 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <FriendAvatar user={item.friend} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{item.friend?.name}</p>
                    <p className="text-xs text-muted-foreground/60 truncate">@{item.friend?.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                  <Users className="h-3 w-3" />
                  {item.mutual_friends > 0
                    ? `${item.mutual_friends} mutual friend${item.mutual_friends !== 1 ? "s" : ""}`
                    : "No mutual friends"}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href="/app/messages"
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] text-[11px] font-bold hover:bg-[#2164b6]/20 transition-colors"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Message
                  </a>
                  <button
                    onClick={() => item.friend && handleUnfriend(item.friend.id)}
                    disabled={actionId === item.friend?.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border/60 text-muted-foreground text-[11px] font-bold hover:bg-muted hover:text-destructive transition-all disabled:opacity-50"
                    title="Remove friend"
                  >
                    {actionId === item.friend?.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                    Unfriend
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === "requests" ? (
        incoming.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="No pending requests"
            description="When someone sends you a friend request, it will appear here."
          />
        ) : (
          <div className="space-y-2">
            {incoming.map((r) => (
              <div key={r.id} className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 hover:shadow-sm transition-all duration-200">
                <FriendAvatar user={r.sender} size={48} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{r.sender?.name}</p>
                  <p className="text-xs text-muted-foreground/60">@{r.sender?.username}</p>
                  {r.mutual_friends > 0 && (
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5 flex items-center gap-1">
                      <Users className="h-3 w-3" /> {r.mutual_friends} mutual friend{r.mutual_friends !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleFriendAction(r.id, "accept")}
                    disabled={actionId === r.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2164b6] text-white text-xs font-bold hover:bg-[#1a5091] transition-all shadow-xs disabled:opacity-50"
                  >
                    {actionId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Confirm
                  </button>
                  <button
                    onClick={() => handleFriendAction(r.id, "decline")}
                    disabled={actionId === r.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/60 text-muted-foreground text-xs font-bold hover:bg-muted hover:text-foreground transition-all disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : outgoing.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No sent requests"
          description="Friend requests you've sent will appear here."
        />
      ) : (
        <div className="space-y-2">
          {outgoing.map((r) => (
            <div key={r.id} className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 opacity-75">
              <FriendAvatar user={r.receiver} size={48} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{r.receiver?.name}</p>
                <p className="text-xs text-muted-foreground/60">@{r.receiver?.username}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 text-[11px] font-bold">
                  <Clock className="h-3.5 w-3.5" />
                  Pending
                </span>
                <button
                  onClick={() => handleCancel(r.id)}
                  disabled={actionId === r.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 text-muted-foreground text-[11px] font-bold hover:bg-muted hover:text-foreground transition-all disabled:opacity-50"
                >
                  {actionId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/60 bg-card p-12 text-center">
      <div className="rounded-2xl bg-[#2164b6]/10 p-4">
        <Icon className="h-8 w-8 text-[#2164b6] dark:text-[#7ab0ff]" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground/60 mt-1">{description}</p>
      </div>
    </div>
  );
}
