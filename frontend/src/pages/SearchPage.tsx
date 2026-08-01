import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router";
import { Search, Loader2, Users, MessageSquare, FileText, Package, User } from "lucide-react";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

const TABS = [
  { key: "all", label: "All" },
  { key: "users", label: "Users" },
  { key: "communities", label: "Communities" },
  { key: "posts", label: "Posts" },
  { key: "messages", label: "Messages" },
  { key: "products", label: "Products" },
] as const;

type TabType = (typeof TABS)[number]["key"];

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface SearchResults {
  users?: { id: number; name: string; username: string; avatar?: string; bio?: string }[];
  communities?: { id: number; name: string; slug: string; description?: string; logo_url?: string; member_count?: number }[];
  posts?: { id: number; content: string; author?: { id: number; name: string; username: string; avatar?: string }; community?: { id: number; name: string; slug: string }; created_at: string }[];
  messages?: { id: number; content: string; sender?: { id: number; name: string; username: string; avatar?: string }; conversation_id: number; created_at: string }[];
  products?: { id: number; title: string; description?: string; price: number; currency: string; type: string }[];
}

type ResultItem = { _type: string; _subtype?: string } & Record<string, unknown>;

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const tab = (searchParams.get("type") as TabType) ?? "all";

  const [results, setResults] = useState<SearchResults>({});
  const [loading, setLoading] = useState(false);
  const [localQuery, setLocalQuery] = useState(query);

  useEffect(() => {
    if (!query.trim()) return;
    setLoading(true);
    const typeParam = tab === "all" ? "" : `&type=${tab}`;
    fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}${typeParam}&per_page=20`, {
      headers: getAuthHeaders(),
    })
      .then((r) => r.json())
      .then((json) => setResults(json.results ?? {}))
      .catch(() => setResults({}))
      .finally(() => setLoading(false));
  }, [query, tab]);

  function switchTab(t: TabType) {
    setSearchParams({ q: query, ...(t !== "all" ? { type: t } : {}) });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (localQuery.trim()) setSearchParams({ q: localQuery.trim() });
  }

  const resultsArray: ResultItem[] = [
    ...(results.users?.map((r) => ({ ...r, _type: "user" })) ?? []),
    ...(results.communities?.map((r) => ({ ...r, _type: "community" })) ?? []),
    ...(results.posts?.map((r) => ({ ...r, _type: "post" })) ?? []),
    ...(results.messages?.map((r) => ({ ...r, _type: "message" })) ?? []),
    ...(results.products?.map((r) => ({ ...r, _type: "product", _subtype: r.type })) ?? []),
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Search className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Search</h1>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="Search users, communities, posts, products..."
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </form>

      {/* Tabs */}
      {query && (
        <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-border pb-px">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
                tab === t.key ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.key === "users" && <Users className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />}
              {t.key === "messages" && <MessageSquare className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />}
              {t.key === "posts" && <FileText className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />}
              {t.key === "products" && <Package className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />}
              {t.key === "communities" && <Users className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />}
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : query && resultsArray.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No results for &ldquo;{query}&rdquo;</p>
          <p className="text-sm mt-1">Try a different search term.</p>
        </div>
      ) : !query ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Search across the platform</p>
          <p className="text-sm mt-1">Find users, communities, posts, messages, and products.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Users */}
          {tab === "all" && results.users && results.users.length > 0 && (
            <Section title="Users" icon={<Users className="h-4 w-4" />}>
              {results.users.map((user) => (
                <Link key={user.id} to={`/app/profile/${user.id}`} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground overflow-hidden flex-shrink-0">
                    {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {/* Communities */}
          {tab === "all" && results.communities && results.communities.length > 0 && (
            <Section title="Communities" icon={<Users className="h-4 w-4" />}>
              {results.communities.map((c) => (
                <Link key={c.id} to={`/app/communities/${c.slug}`} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground overflow-hidden flex-shrink-0">
                    {c.logo_url ? <img src={c.logo_url} alt="" className="w-full h-full object-cover" /> : c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.member_count ?? 0} members</p>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {/* Posts */}
          {tab === "all" && results.posts && results.posts.length > 0 && (
            <Section title="Posts" icon={<FileText className="h-4 w-4" />}>
              {results.posts.map((post) => (
                <Link key={post.id} to={`/app/communities/${post.community?.slug}`} className="block px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <p className="text-sm leading-relaxed line-clamp-2">{post.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {post.author?.name} &middot; {new Date(post.created_at).toLocaleDateString()}
                    {post.community && <span> &middot; in {post.community.name}</span>}
                  </p>
                </Link>
              ))}
            </Section>
          )}

          {/* Messages */}
          {tab === "all" && results.messages && results.messages.length > 0 && (
            <Section title="Messages" icon={<MessageSquare className="h-4 w-4" />}>
              {results.messages.map((msg) => (
                <Link key={msg.id} to={`/app/chat`} className="block px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <p className="text-sm leading-relaxed line-clamp-2">{msg.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {msg.sender?.name} &middot; {new Date(msg.created_at).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </Section>
          )}

          {/* Products */}
          {tab === "all" && results.products && results.products.length > 0 && (
            <Section title="Products" icon={<Package className="h-4 w-4" />}>
              {results.products.map((p, idx) => (
                <Link key={`${p.type}-${p.id}-${idx}`} to={`/app/store`} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.currency} {p.price}</p>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {/* Tab-specific views */}
          {tab !== "all" && resultsArray.length > 0 && (
            <div className="space-y-1">
              {resultsArray.map((item, idx) => (
                <ResultRow key={`${item._type}-${item.id}-${idx}`} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-1 py-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ResultRow({ item }: { item: ResultItem }) {
  if (item._type === "user") {
    const u = item as unknown as { id: number; name: string; username: string; avatar?: string; bio?: string; _type: string };
    return (
      <Link to={`/app/profile/${u.id}`} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0">
          {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : <User className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{u.name}</p>
          <p className="text-xs text-muted-foreground">@{u.username}{u.bio ? ` · ${u.bio}` : ""}</p>
        </div>
      </Link>
    );
  }

  if (item._type === "community") {
    const c = item as unknown as { id: number; name: string; slug: string; description?: string; logo_url?: string; member_count?: number; _type: string };
    return (
      <Link to={`/app/communities/${c.slug}`} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0">
          {c.logo_url ? <img src={c.logo_url} alt="" className="w-full h-full object-cover" /> : <Users className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{c.name}</p>
          <p className="text-xs text-muted-foreground">{c.member_count ?? 0} members{c.description ? ` · ${c.description}` : ""}</p>
        </div>
      </Link>
    );
  }

  if (item._type === "post") {
    const p = item as unknown as { id: number; content: string; author?: { name: string }; community?: { name: string; slug: string }; created_at: string; _type: string };
    return (
      <Link to={p.community ? `/app/communities/${p.community.slug}` : "#"} className="block px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors">
        <p className="text-sm leading-relaxed line-clamp-2">{p.content}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {p.author?.name} &middot; {new Date(p.created_at).toLocaleDateString()}
          {p.community && <span> &middot; in {p.community.name}</span>}
        </p>
      </Link>
    );
  }

  if (item._type === "message") {
    const m = item as unknown as { id: number; content: string; sender?: { name: string }; created_at: string; _type: string };
    return (
      <Link to="/app/chat" className="block px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors">
        <p className="text-sm leading-relaxed line-clamp-2">{m.content}</p>
        <p className="text-xs text-muted-foreground mt-1">{m.sender?.name} &middot; {new Date(m.created_at).toLocaleDateString()}</p>
      </Link>
    );
  }

  if (item._type === "product") {
    const p = item as unknown as { id: number; title: string; price: number; currency: string; _type: string; _subtype?: string };
    return (
      <Link to="/app/store" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{p.title}</p>
          <p className="text-xs text-muted-foreground">{p.currency} {p.price}{p._subtype ? ` · ${p._subtype.replace("_", " ")}` : ""}</p>
        </div>
      </Link>
    );
  }

  return null;
}
