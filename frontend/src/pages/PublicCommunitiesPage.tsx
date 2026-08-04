import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { AnimatedPage } from "@/components/common/AnimatedPage";
import {
  Search,
  Users,
  Globe,
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

interface PublicCommunity {
  id: number;
  name: string;
  slug: string;
  description?: string;
  type: string;
  logo_url?: string;
  banner_url?: string;
  member_count: number;
  category?: string;
  creator?: { id: number; name: string; username: string; avatar?: string };
}

interface PaginatedResponse {
  data: PublicCommunity[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export function PublicCommunitiesPage() {
  const [communities, setCommunities] = useState<PublicCommunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{ lastPage: number; total: number } | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchCommunities = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`${API_BASE}/public/communities?${params}`, {
        headers: { Accept: "application/json" },
      });
      const json = await res.json();
      const paginatedData = json.data as PaginatedResponse;
      const items: PublicCommunity[] = paginatedData?.data ?? [];
      setCommunities(items);
      setMeta({ lastPage: paginatedData.last_page, total: paginatedData.total });
    } catch {
      setCommunities([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  const categoryColors: Record<string, string> = {
    tech: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    art: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    music: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    business: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    gaming: "bg-green-500/10 text-green-600 dark:text-green-400",
    fitness: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    education: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  };

  return (
    <AnimatedPage className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Public Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md px-6 py-4">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo_blue.png" alt="MurihSpace" className="h-8 w-auto object-contain dark:hidden" />
            <img src="/logo_white.png" alt="MurihSpace" className="h-8 w-auto object-contain hidden dark:block" />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="font-semibold">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#38A8D8] via-[#2e94c0] to-[#1a5091] px-6 py-16 text-white text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent)] pointer-events-none" />
        <div className="relative max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 bg-white/10 text-white/90 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Public Communities
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Discover Communities to Join
          </h1>
          <p className="text-sm md:text-base text-white/80 max-w-xl mx-auto leading-relaxed">
            Explore public spaces built by creators, experts, and enthusiasts across every topic.
          </p>
        </div>
      </section>

      {/* Search Bar */}
      <div className="bg-card border-b border-border px-6 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            id="community-search"
            type="text"
            placeholder="Search communities by name or description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 h-11 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#38A8D8]/40 transition-shadow"
          />
        </div>
      </div>

      {/* Community Grid */}
      <main className="flex-1 px-6 py-10">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" />
            </div>
          ) : communities.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[320px] px-6 text-center gap-4">
              <div className="p-4 rounded-full bg-muted">
                <Users className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">No communities found</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {searchQuery
                  ? `No public communities match "${searchQuery}". Try a different search term.`
                  : "No public communities are available yet. Check back soon!"}
              </p>
              {searchQuery && (
                <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <>
              {meta && (
                <p className="text-xs text-muted-foreground mb-6">
                  Showing <span className="font-semibold text-foreground">{communities.length}</span> of{" "}
                  <span className="font-semibold text-foreground">{meta.total}</span> public communities
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {communities.map((community) => (
                  <div
                    key={community.id}
                    className="group rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
                  >
                    {/* Banner */}
                    <div
                      className="h-24 w-full relative overflow-hidden"
                      style={
                        community.banner_url
                          ? { backgroundImage: `url(${community.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                          : { background: "linear-gradient(135deg, #38A8D8 0%, #7c3aed 100%)" }
                      }
                    >
                      <div className="absolute inset-0 bg-black/20" />
                      {community.logo_url && (
                        <div className="absolute -bottom-5 left-4">
                          <img
                            src={community.logo_url}
                            alt={community.name}
                            className="h-12 w-12 rounded-xl object-cover border-2 border-white shadow-md"
                          />
                        </div>
                      )}
                      {!community.logo_url && (
                        <div className="absolute -bottom-5 left-4 h-12 w-12 rounded-xl bg-white dark:bg-card border-2 border-white shadow-md flex items-center justify-center text-[#38A8D8] font-black text-xl">
                          {community.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4 pt-8">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-sm text-foreground group-hover:text-[#38A8D8] transition-colors line-clamp-1">
                          {community.name}
                        </h3>
                        {community.category && (
                          <span
                            className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              categoryColors[community.category?.toLowerCase()] ??
                              "bg-slate-100 dark:bg-muted text-muted-foreground"
                            }`}
                          >
                            {community.category}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                        {community.description ?? "A community on MurihSpace."}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Globe className="h-3.5 w-3.5 text-[#38A8D8]" />
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span className="font-semibold text-foreground">{community.member_count.toLocaleString()}</span> members
                          </span>
                        </div>
                        <Link to={`/login?redirect=/app/communities/${community.slug}`}>
                          <button className="px-3 py-1.5 rounded-lg bg-[#38A8D8] hover:bg-[#2e94c0] text-white text-[11px] font-bold transition-colors flex items-center gap-1">
                            Join <ArrowRight className="h-3 w-3" />
                          </button>
                        </Link>
                      </div>

                      {community.creator && (
                        <p className="text-[10px] text-muted-foreground mt-2 border-t border-border/50 pt-2">
                          by <span className="font-semibold text-foreground">@{community.creator.username}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {meta && meta.lastPage > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    Page {page} of {meta.lastPage}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= meta.lastPage}
                    onClick={() => setPage((p) => Math.min(meta.lastPage, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* CTA Footer Banner */}
      <section className="bg-gradient-to-r from-[#38A8D8] to-[#7c3aed] px-6 py-10 text-white text-center">
        <div className="max-w-xl mx-auto space-y-4">
          <h2 className="text-xl font-bold">Ready to start your own community?</h2>
          <p className="text-sm text-white/80">
            Create public or private spaces, grow your audience, and monetize your expertise.
          </p>
          <Link to="/register">
            <Button className="bg-white text-[#38A8D8] hover:bg-white/90 font-bold gap-2 mt-2">
              Create a Community <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span className="font-bold text-foreground">MurihSpace</span>
          <div className="flex items-center gap-6">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <Link to="/login" className="hover:text-foreground">Sign In</Link>
            <Link to="/register" className="hover:text-foreground font-semibold text-[#38A8D8]">Get Started</Link>
          </div>
        </div>
      </footer>
    </AnimatedPage>
  );
}

export default PublicCommunitiesPage;
