import { getAuthToken } from "@/lib/auth/token";
import { useState, useEffect, useCallback } from "react";
import {
  UserPlus as UserPlus,
  Users as Users,
  Clock as Clock,
  Check as Check,
  X as X,
  MagnifyingGlass as Search,
  Spinner as Loader2,
  UserCheck as UserCheck,
  Prohibit as Prohibit,
  SignIn as SignIn,
  User as UserIcon
} from "@phosphor-icons/react";
import { authFetch } from "@/lib/api/authFetch";



function authHeaders() {
  const t = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

type RequestTab = "friends" | "communities" | "sent";

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const inner = (value as { data?: unknown }).data;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

interface FriendRequest {
  id: number;
  sender: { id: number; name: string; username: string; avatar_url?: string };
  receiver?: { id: number; name: string; username: string; avatar_url?: string };
  status: "pending" | "accepted" | "declined";
  created_at: string;
  mutual_friends?: number;
}

interface CommunityRequest {
  id: number;
  community: { id: number; name: string; slug: string; logo_url?: string; members_count: number; visibility?: string };
  status: "pending" | "active" | "rejected";
  role: string;
  created_at: string;
}

function Avatar({ name, url, size = 40 }: { name: string; url?: string; size?: number }) {
  if (url) return <img src={url} alt={name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  return (
    <div
      className="rounded-full bg-gradient-to-br from-[#2164b6] to-[#1a6b9e] text-white flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <UserIcon weight="fill" className="text-white/90" style={{ width: size * 0.55, height: size * 0.55 }} />
    </div>
  );
}

export default function RequestsPage() {
  const [tab, setTab] = useState<RequestTab>("friends");
  const [friendReqs, setFriendReqs] = useState<FriendRequest[]>([]);
  const [communityReqs, setCommunityReqs] = useState<CommunityRequest[]>([]);
  const [sentReqs, setSentReqs] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fRes, cRes, sRes] = await Promise.all([
        authFetch(`/friends/requests`, { headers: authHeaders() }),
        authFetch(`/community-requests`, { headers: authHeaders() }),
        authFetch(`/friends/requests/sent`, { headers: authHeaders() }),
      ]);
      if (fRes.ok) { const j = await fRes.json(); setFriendReqs(asList(j?.data) as FriendRequest[]); }
      if (cRes.ok) { const j = await cRes.json(); setCommunityReqs(asList(j?.data) as CommunityRequest[]); }
      if (sRes.ok) { const j = await sRes.json(); setSentReqs(asList(j?.data) as FriendRequest[]); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleFriendAction = async (id: number, action: "accept" | "decline") => {
    setActionLoading(id);
    try {
      const res = await authFetch(`/friends/requests/${id}/${action}`, {
        method: "POST", headers: authHeaders(),
      });
      if (res.ok) setFriendReqs((prev) => prev.filter((r) => r.id !== id));
    } catch { /* ignore */ }
    finally { setActionLoading(null); }
  };

  const handleCancelRequest = async (id: number) => {
    setActionLoading(id);
    try {
      const res = await authFetch(`/community-requests/${id}/cancel`, {
        method: "POST", headers: authHeaders(),
      });
      if (res.ok) setCommunityReqs((prev) => prev.filter((r) => r.id !== id));
    } catch { /* ignore */ }
    finally { setActionLoading(null); }
  };

  const filteredFriend = friendReqs.filter((r) =>
    r.sender.name.toLowerCase().includes(search.toLowerCase()) ||
    r.sender.username.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredCommunity = communityReqs.filter((r) =>
    r.community.name.toLowerCase().includes(search.toLowerCase()) ||
    r.status.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredSent = sentReqs.filter((r) =>
    (r.receiver?.name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const pendingCount = communityReqs.filter((r) => r.status === "pending").length;
  const tabs: { key: RequestTab; label: string; count: number; icon: React.ElementType }[] = [
    { key: "friends", label: "Friend Requests", count: friendReqs.length, icon: UserPlus },
    { key: "communities", label: "Community Requests", count: pendingCount, icon: Users },
    { key: "sent", label: "Sent Requests", count: sentReqs.length, icon: Clock },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-4 lg:p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#2164b6] to-[#1a6b9e] flex items-center justify-center ">
            <UserPlus weight="fill" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">Requests</h1>
            <p className="text-xs text-muted-foreground/70">Manage friend requests and community join requests</p>
          </div>
        </div>
        <div className="relative w-48">
          <Search weight="fill" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requests..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-muted/60 border-none/50 outline-none focus:ring-1 focus:ring-[#2164b6]/30 focus:border-[#2164b6]/30 placeholder:text-muted-foreground/40 transition-all"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/40 p-1 border-none/40">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex-1 justify-center ${
              tab === t.key
                ? "bg-white dark:bg-[#102840] text-foreground  border-none/50"
                : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
            }`}
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
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 weight="fill" className="h-7 w-7 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" />
        </div>
      ) : tab === "friends" ? (
        filteredFriend.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border/60 bg-card p-12 text-center">
            <div className="rounded-lg bg-[#2164b6]/10 p-4">
              <UserCheck weight="fill" className="h-8 w-8 text-[#2164b6] dark:text-[#7ab0ff]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">No pending requests</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">All caught up! New friend requests will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFriend.map((r) => (
              <div key={r.id} className="flex items-center gap-4 rounded-lg border-none/60 bg-card p-4 hover: hover:border-[#2164b6]/20 transition-all duration-200">
                <Avatar name={r.sender.name} url={r.sender.avatar_url} size={48} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{r.sender.name}</p>
                  <p className="text-xs text-muted-foreground/60">@{r.sender.username}</p>
                  {r.mutual_friends && r.mutual_friends > 0 && (
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5 flex items-center gap-1">
                      <Users weight="fill" className="h-3 w-3" /> {r.mutual_friends} mutual friend{r.mutual_friends !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleFriendAction(r.id, "accept")}
                    disabled={actionLoading === r.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2164b6] text-white text-xs font-bold hover:bg-[#1a5091] transition-all  hover: hover:shadow-[#2164b6]/20 disabled:opacity-50"
                  >
                    {actionLoading === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check weight="fill" className="h-3.5 w-3.5" />}
                    Confirm
                  </button>
                  <button
                    onClick={() => handleFriendAction(r.id, "decline")}
                    disabled={actionLoading === r.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-none/60 text-muted-foreground text-xs font-bold hover:bg-muted hover:text-foreground transition-all disabled:opacity-50"
                  >
                    <X weight="fill" className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === "communities" ? (
        filteredCommunity.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border/60 bg-card p-12 text-center">
            <div className="rounded-lg bg-emerald-500/10 p-4">
              <Users weight="fill" className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">No community requests</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">When you request to join a private community, it will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCommunity.map((r) => (
              <div key={r.id} className="flex items-center gap-4 rounded-lg border-none/60 bg-card p-4 transition-all duration-200">
                <Avatar name={r.community.name} url={r.community.logo_url} size={48} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{r.community.name}</p>
                  <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
                    <Users weight="fill" className="h-3 w-3" /> {r.community.members_count} members &middot; {r.community.visibility ?? "private"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === "pending" && (
                    <>
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 text-[11px] font-bold">
                        <Clock weight="fill" className="h-3.5 w-3.5" />
                        Pending
                      </span>
                      <button
                        onClick={() => handleCancelRequest(r.id)}
                        disabled={actionLoading === r.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none/60 text-muted-foreground text-[11px] font-bold hover:bg-muted hover:text-foreground transition-all disabled:opacity-50"
                      >
                        {actionLoading === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X weight="fill" className="h-3.5 w-3.5" />}
                        Cancel
                      </button>
                    </>
                  )}
                  {r.status === "active" && (
                    <>
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-[11px] font-bold">
                        <Check weight="fill" className="h-3.5 w-3.5" />
                        Approved
                      </span>
                      <a
                        href={`/community/${r.community.slug}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[11px] font-bold hover:bg-emerald-600 transition-all"
                      >
                        <SignIn weight="fill" className="h-3.5 w-3.5" />
                        Visit
                      </a>
                    </>
                  )}
                  {r.status === "rejected" && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-[11px] font-bold">
                      <Prohibit weight="fill" className="h-3.5 w-3.5" />
                      Declined
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        filteredSent.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border/60 bg-card p-12 text-center">
            <div className="rounded-lg bg-amber-500/10 p-4">
              <Clock weight="fill" className="h-8 w-8 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">No sent requests</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">Friend requests you've sent will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSent.map((r) => (
              <div key={r.id} className="flex items-center gap-4 rounded-lg border-none/60 bg-card p-4 opacity-70">
                <Avatar name={r.receiver?.name ?? "User"} url={r.receiver?.avatar_url} size={48} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{r.receiver?.name ?? "User"}</p>
                  <p className="text-xs text-muted-foreground/60">@{r.receiver?.username}</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 text-[11px] font-bold">
                  <Clock weight="fill" className="h-3.5 w-3.5" />
                  Pending
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
