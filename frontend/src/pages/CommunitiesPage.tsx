import * as React from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorState, EmptyState } from "@/components/common/UIStateComponents";
import { CreateCommunityModal } from "@/components/community/CreateCommunityModal";
import {
  Users,
  Plus,
  Search,
  Globe,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import type { Community } from "@/types/community";

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

const CATEGORIES = [
  "All",
  "Technology",
  "Art & Design",
  "Business",
  "Gaming",
  "Education",
  "Lifestyle",
  "Fitness",
  "General",
];

export function CommunitiesPage() {
  const [tab, setTab] = React.useState<"discover" | "my">("discover");
  const [selectedCategory, setSelectedCategory] = React.useState("All");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const [communities, setCommunities] = React.useState<Community[]>([]);
  const [myCommunities, setMyCommunities] = React.useState<Community[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch communities from API backend
  const fetchCommunities = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "All") params.set("category", selectedCategory);
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`${API_BASE}/communities?${params.toString()}`);
      if (res.ok) {
        const j = await res.json();
        const list = j?.success ? j?.data : j;
        setCommunities(list?.data ?? []);
      } else {
        setError("Failed to load communities. Please try again.");
      }
    } catch (e) {
      console.error('Failed to fetch communities', e);
      setError("Unable to connect to the server. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  const fetchMyCommunities = React.useCallback(async () => {
    const token = localStorage.getItem("murihspace-token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/my-communities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const j = await res.json();
        const list = j?.success ? j?.data : j;
        if (list?.communities) {
          setMyCommunities(list.communities);
        }
      }
    } catch (e) { console.error('Failed to fetch my communities', e); }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCommunities();
    fetchMyCommunities();
  }, [fetchCommunities, fetchMyCommunities]);

  const handleCreated = (newCommunity: Community) => {
    setCommunities((prev) => [newCommunity, ...prev]);
    setMyCommunities((prev) => [newCommunity, ...prev]);
    setTab("my");
  };

  const displayedCommunities = tab === "my" ? myCommunities : communities;

  const filteredCommunities = displayedCommunities.filter((c) => {
    const matchesCategory =
      selectedCategory === "All" ||
      c.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      {/* ── Page Header Banner ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#38A8D8]/20 text-[#38A8D8] text-xs font-semibold uppercase tracking-wider border border-[#38A8D8]/30">
              Phase 2 — Community Foundation
            </span>
            <span className="text-xs text-white/50">Sprint 5</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Communities & Hubs
          </h1>
          <p className="text-sm text-white/70 max-w-xl">
            Discover vibrant creator spaces, join exclusive discussions, or publish your own community space.
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#38A8D8] text-white hover:bg-[#2E96C5] font-semibold h-11 px-5 rounded-xl shadow-md gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-5 w-5" />
          Create Community
        </Button>
      </div>

      {/* ── Tabs & Search Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex p-1 bg-muted rounded-xl gap-1 shrink-0 w-fit">
          <button
            onClick={() => setTab("discover")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === "discover"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="h-4 w-4 text-secondary" />
            Discover Communities
          </button>
          <button
            onClick={() => setTab("my")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === "my"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4 text-secondary" />
            My Communities ({myCommunities.length})
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search communities by name or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-card border-border text-sm"
          />
        </div>
      </div>

      {/* ── Category Filter Pills ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-card border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Community Grid ── */}
      {error ? (
        <ErrorState
          title="Failed to load communities"
          description={error}
          onRetry={fetchCommunities}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-72 rounded-2xl bg-muted animate-pulse border border-border" />
          ))}
        </div>
      ) : filteredCommunities.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No communities found"
          description={
            tab === "my"
              ? "You haven't created any communities yet. Click 'Create Community' to publish your first space!"
              : "Try adjusting your search query or selected category to find communities."
          }
          action={
            tab === "my"
              ? { label: "Create Community", onClick: () => setIsModalOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCommunities.map((c) => (
            <div
              key={c.id || c.slug}
              className="group relative flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:shadow-md hover:border-primary/30 transition-all duration-200"
            >
              {/* Cover Image Banner */}
              <div className="h-28 w-full bg-gradient-to-r from-primary to-[#173852] relative overflow-hidden">
                {c.cover_url ? (
                  <img
                    src={c.cover_url}
                    alt={c.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-r from-[#102840] via-[#173852] to-[#38A8D8]/40" />
                )}
                {/* Pricing / Visibility badges */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className="bg-background/90 text-foreground backdrop-blur-xs text-[11px] font-bold px-2 py-0.5 rounded-md"
                  >
                    {c.pricing_type === "paid" ? `$${c.price_amount}` : "FREE"}
                  </Badge>
                </div>
              </div>

              {/* Card Body */}
              <div className="flex-1 p-5 pt-0 space-y-3 relative flex flex-col justify-between">
                <div>
                  {/* Floating Logo Avatar */}
                  <div className="-mt-8 mb-3 flex items-end justify-between">
                    <div className="h-14 w-14 rounded-xl border-2 border-card bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center shadow-md overflow-hidden shrink-0">
                      {c.logo_url ? (
                        <img src={c.logo_url} alt={c.name} className="h-full w-full object-cover" />
                      ) : (
                        c.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10.5px] font-medium border-border">
                      {c.category}
                    </Badge>
                  </div>

                  {/* Title & Creator */}
                  <h2 className="font-bold text-base text-foreground group-hover:text-secondary transition-colors line-clamp-1">
                    {c.name}
                  </h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span>by {c.creator?.name || "Community Host"}</span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-secondary fill-secondary/20" />
                  </p>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-2 leading-relaxed">
                    {c.description || "Welcome to this creator community on MurihSpace."}
                  </p>
                </div>

                {/* Card Footer Info & Link */}
                <div className="pt-3 border-t border-border flex items-center justify-between mt-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Users className="h-3.5 w-3.5 text-secondary" />
                    <span>{c.members_count || 1} members</span>
                  </div>

                  <Link
                    to={`/app/communities/${c.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-secondary hover:text-secondary/80 transition-colors"
                  >
                    <span>Preview Space</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Community Dialog Modal ── */}
      <CreateCommunityModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
