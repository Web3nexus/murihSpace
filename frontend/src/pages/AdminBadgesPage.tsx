import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { ShieldDone as ShieldCheck, Star, N2User as Users, TickSquare as CheckCircle, Plus, Swap as ArrowClockwise, Edit as PencilSimple, AddUser as UserPlus, Search as MagnifyingGlass, CloseSquare as X } from "@/components/icons";
import { Medal, Trophy, Cube, Crown } from "@phosphor-icons/react";
import { apiClient } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";

interface BadgeCriteria {
  metric?: string;
  value?: number;
  rule?: string;
}

interface BadgeItem {
  id: number;
  slug: string;
  name: string;
  level_label?: string | null;
  description?: string | null;
  icon?: string | null;
  icon_3d?: string | null;
  color?: string | null;
  icon_gradient?: string | null;
  criteria?: BadgeCriteria | null;
  is_active: boolean;
  awarded_count: number;
  created_at?: string;
}

interface BadgeStats {
  total_badges: number;
  active_badges: number;
  total_awarded: number;
}

// Visual 3D Icon Renderer with multi-layer specular highlights and gradients
export function Badge3DRenderer({
  type = "3d-star",
  size = 56,
}: {
  type?: string | null;
  size?: number;
}) {
  const getGradientColors = (typeStr: string) => {
    switch (typeStr) {
      case "3d-cube":
        return { start: "#818cf8", mid: "#9333ea", end: "#4338ca", accent: "#c084fc" };
      case "3d-shield":
        return { start: "#34d399", mid: "#10b981", end: "#0f766e", accent: "#6ee7b7" };
      case "3d-trophy":
        return { start: "#60a5fa", mid: "#0284c7", end: "#1d4ed8", accent: "#93c5fd" };
      case "3d-gem":
        return { start: "#f472b6", mid: "#f43f5e", end: "#e11d48", accent: "#fda4af" };
      case "3d-award":
        return { start: "#fde047", mid: "#f59e0b", end: "#d97706", accent: "#fef08a" };
      case "3d-badge":
        return { start: "#a78bfa", mid: "#a21caf", end: "#7c3aed", accent: "#d8b4fe" };
      case "3d-star":
      default:
        return { start: "#fbbf24", mid: "#f97316", end: "#b45309", accent: "#fde68a" };
    }
  };

  const colors = getGradientColors(type || "3d-star");

  return (
    <div
      className="relative flex items-center justify-center shrink-0 group select-none"
      style={{ width: size, height: size }}
    >
      {/* Outer ambient glow */}
      <div
        className="absolute inset-0 rounded-2xl blur-md opacity-50 group-hover:opacity-80 transition-opacity"
        style={{ background: `radial-gradient(circle, ${colors.mid} 0%, transparent 70%)` }}
      />

      {/* Main 3D volumetric token */}
      <div
        className="relative w-full h-full rounded-2xl flex items-center justify-center shadow-lg transition-transform transform group-hover:scale-105 duration-200"
        style={{
          background: `linear-gradient(135deg, ${colors.start} 0%, ${colors.mid} 50%, ${colors.end} 100%)`,
          boxShadow: `0 8px 16px -4px ${colors.end}80, inset 0 2px 4px rgba(255, 255, 255, 0.6), inset 0 -4px 6px rgba(0, 0, 0, 0.35)`,
          border: "1px solid rgba(255, 255, 255, 0.3)",
        }}
      >
        {/* Top gloss reflection arc */}
        <div
          className="absolute top-1 left-2 right-2 h-1/3 rounded-t-xl opacity-60 pointer-events-none"
          style={{
            background: "linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 100%)",
          }}
        />

        {/* 3D Core Icon / Glyph */}
        <div className="relative z-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          {type === "3d-cube" && <Cube weight="fill" size={size * 0.52} />}
          {type === "3d-shield" && <ShieldCheck weight="fill" size={size * 0.52} />}
          {type === "3d-trophy" && <Trophy weight="fill" size={size * 0.52} />}
          {type === "3d-gem" && <Crown weight="fill" size={size * 0.52} />}
          {type === "3d-award" && <Medal weight="fill" size={size * 0.52} />}
          {type === "3d-badge" && <Medal weight="fill" size={size * 0.52} />}
          {(type === "3d-star" || !type) && <Star weight="fill" size={size * 0.52} />}
        </div>

        {/* Bottom specular edge highlight */}
        <div
          className="absolute bottom-1 left-3 right-3 h-[2px] rounded-full opacity-40 pointer-events-none"
          style={{ background: colors.accent }}
        />
      </div>
    </div>
  );
}

export function AdminBadgesPage() {
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [stats, setStats] = useState<BadgeStats>({ total_badges: 0, active_badges: 0, total_awarded: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAwardOpen, setIsAwardOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<BadgeItem | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    slug: "",
    name: "",
    level_label: "",
    description: "",
    icon_3d: "3d-star",
    metric: "followers",
    metric_value: 10,
    rule: "",
    is_active: true,
  });

  const [awardUserId, setAwardUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchBadges = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filterActive !== "all") params.is_active = filterActive === "active" ? "1" : "0";

      const res = await apiClient.get("/securegate/badges", { params });
      if (res.data) {
        setBadges(res.data.data || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (err) {
      console.error("Failed to load badges:", err);
      toast.error("Failed to load activity badges.");
    } finally {
      setLoading(false);
    }
  }, [search, filterActive]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  const handleSeed = async () => {
    try {
      setSubmitting(true);
      const res = await apiClient.post("/securegate/badges/seed");
      toast.success(res.data?.message || "Successfully seeded 3D activity badges!");
      fetchBadges();
    } catch (err) {
      console.error(err);
      toast.error("Failed to seed badges.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (badge: BadgeItem) => {
    try {
      const nextActive = !badge.is_active;
      await apiClient.put(`/securegate/badges/${badge.id}`, {
        is_active: nextActive,
      });
      setBadges((prev) =>
        prev.map((b) => (b.id === badge.id ? { ...b, is_active: nextActive } : b))
      );
      toast.success(`Badge "${badge.name}" is now ${nextActive ? "Active" : "Disabled"}.`);
    } catch (err) {
      toast.error("Failed to update badge status.");
    }
  };

  const handleOpenEdit = (badge: BadgeItem) => {
    setSelectedBadge(badge);
    setFormData({
      slug: badge.slug,
      name: badge.name,
      level_label: badge.level_label || "",
      description: badge.description || "",
      icon_3d: badge.icon_3d || "3d-star",
      metric: badge.criteria?.metric || "followers",
      metric_value: badge.criteria?.value || 10,
      rule: badge.criteria?.rule || "",
      is_active: badge.is_active,
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBadge) return;
    try {
      setSubmitting(true);
      await apiClient.put(`/securegate/badges/${selectedBadge.id}`, {
        name: formData.name,
        level_label: formData.level_label,
        description: formData.description,
        icon_3d: formData.icon_3d,
        criteria: {
          metric: formData.metric,
          value: Number(formData.metric_value),
          rule: formData.rule,
        },
        is_active: formData.is_active,
      });
      toast.success("Badge updated successfully!");
      setIsEditOpen(false);
      fetchBadges();
    } catch (err) {
      toast.error("Failed to update badge.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiClient.post("/securegate/badges", {
        slug: formData.slug.toLowerCase().trim().replace(/\s+/g, "_"),
        name: formData.name,
        level_label: formData.level_label,
        description: formData.description,
        icon_3d: formData.icon_3d,
        criteria: {
          metric: formData.metric,
          value: Number(formData.metric_value),
          rule: formData.rule,
        },
        is_active: formData.is_active,
      });
      toast.success("New 3D Badge created successfully!");
      setIsCreateOpen(false);
      fetchBadges();
    } catch (err) {
      toast.error("Failed to create badge. Make sure slug is unique.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAwardUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBadge || !awardUserId) return;
    try {
      setSubmitting(true);
      const res = await apiClient.post(`/securegate/badges/${selectedBadge.id}/award`, {
        user_id: Number(awardUserId),
      });
      toast.success(res.data?.message || "Badge awarded to user successfully!");
      setIsAwardOpen(false);
      setAwardUserId("");
      fetchBadges();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to award badge to user.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-[#1A68D4]">
              <Medal weight="fill" size={20} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              3D Activity Badges Management
            </h1>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Configure automated unlock rules, award 3D achievements, and inspect creator engagement badges.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSeed}
            disabled={submitting}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50"
          >
            <ArrowClockwise className={submitting ? "animate-spin size-4" : "size-4 text-blue-600"} />
            <span>Reset / Seed Defaults</span>
          </button>

          <button
            onClick={() => {
              setFormData({
                slug: "",
                name: "",
                level_label: "",
                description: "",
                icon_3d: "3d-star",
                metric: "followers",
                metric_value: 10,
                rule: "",
                is_active: true,
              });
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-[#1A68D4] text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 active:scale-95"
          >
            <Plus weight="bold" size={16} />
            <span>New 3D Badge</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Star weight="fill" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {stats.total_badges}
            </div>
            <div className="text-xs font-medium text-neutral-500">Total System Badges</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle weight="fill" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {stats.active_badges}
            </div>
            <div className="text-xs font-medium text-neutral-500">Active Unlockable Badges</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-[#1A68D4] flex items-center justify-center shrink-0">
            <Users weight="fill" size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {stats.total_awarded}
            </div>
            <div className="text-xs font-medium text-neutral-500">Times Awarded to Users</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <div className="relative w-full sm:w-72">
          <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, slug or rule..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-neutral-50 dark:bg-neutral-800 border-none focus:ring-2 focus:ring-[#1A68D4] outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400">
            <button
              onClick={() => setFilterActive("all")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterActive === "all" ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm font-semibold" : ""
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterActive("active")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterActive === "active" ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm font-semibold" : ""
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterActive("inactive")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterActive === "inactive" ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm font-semibold" : ""
              }`}
            >
              Inactive
            </button>
          </div>
        </div>
      </div>

      {/* Badges Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <Skeleton className="h-14 w-14 rounded-2xl mb-4" />
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : badges.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <Medal className="size-12 mx-auto text-neutral-400 mb-3" />
          <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">No Badges Found</h3>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm mx-auto">
            Click "Reset / Seed Defaults" to generate the standard set of 3D profile badges or create a new one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`relative flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-neutral-900 border transition-all duration-200 hover:shadow-lg ${
                badge.is_active
                  ? "border-neutral-200/90 dark:border-neutral-800 hover:border-blue-500/50"
                  : "border-dashed border-neutral-300 dark:border-neutral-800 opacity-60"
              }`}
            >
              <div>
                {/* Top Row: 3D Icon & Status */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Badge3DRenderer type={badge.icon_3d} size={54} />
                    <div>
                      <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-base leading-snug">
                        {badge.name}
                      </h3>
                      {badge.level_label && (
                        <span className="inline-block mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#1A68D4] dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
                          {badge.level_label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Active Toggle Switch */}
                  <button
                    onClick={() => handleToggleActive(badge)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                      badge.is_active ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out mt-1 ml-1 ${
                        badge.is_active ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Description */}
                {badge.description && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
                    {badge.description}
                  </p>
                )}

                {/* Criteria Box */}
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 mb-4 text-xs space-y-1">
                  <div className="flex items-center justify-between text-neutral-500">
                    <span className="font-medium">Rule Logic:</span>
                    <span className="font-mono text-neutral-700 dark:text-neutral-300">
                      {badge.criteria?.metric || "manual"} {badge.criteria?.value ? `>= ${badge.criteria.value}` : ""}
                    </span>
                  </div>
                  {badge.criteria?.rule && (
                    <div className="text-neutral-700 dark:text-neutral-300 font-medium pt-1">
                      {badge.criteria.rule}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions & Award Counter */}
              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-neutral-500">
                  <Users size={14} />
                  <span>Awarded: <strong>{badge.awarded_count || 0}</strong></span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSelectedBadge(badge);
                      setAwardUserId("");
                      setIsAwardOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-[#1A68D4] hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                    title="Award to specific user"
                  >
                    <UserPlus size={16} weight="bold" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(badge)}
                    className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    title="Edit badge rules"
                  >
                    <PencilSimple size={16} weight="bold" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(isCreateOpen || isEditOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                {isEditOpen ? "Edit 3D Activity Badge" : "Create New 3D Badge"}
              </h2>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setIsEditOpen(false);
                }}
                className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={isEditOpen ? handleSaveEdit : handleCreate} className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                <Badge3DRenderer type={formData.icon_3d} size={56} />
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                    3D Icon Glyph & Volume Style
                  </label>
                  <select
                    value={formData.icon_3d}
                    onChange={(e) => setFormData({ ...formData, icon_3d: e.target.value })}
                    className="w-full text-xs font-medium p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
                  >
                    <option value="3d-star">3D Star (Amber / Orange Gold)</option>
                    <option value="3d-cube">3D Cube (Web3 / Purple Violet)</option>
                    <option value="3d-shield">3D Shield (Escrow / Emerald Green)</option>
                    <option value="3d-trophy">3D Trophy (Champion / Azure Blue)</option>
                    <option value="3d-gem">3D Crown / Gem (Genesis / Rose)</option>
                    <option value="3d-award">3D Medal (Merchant / Sunburst)</option>
                    <option value="3d-badge">3D Storyteller Badge (Purple)</option>
                  </select>
                </div>
              </div>

              {!isEditOpen && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                    Slug ID (Immutable)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="e.g. top_creator_2026"
                    className="w-full text-xs p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Badge Display Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Creator Economy Star"
                  className="w-full text-xs p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Level / Tier Subtitle
                </label>
                <input
                  type="text"
                  value={formData.level_label}
                  onChange={(e) => setFormData({ ...formData, level_label: e.target.value })}
                  placeholder="e.g. Master Creator · Level 2"
                  className="w-full text-xs p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Details of what this badge represents..."
                  className="w-full text-xs p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                    Auto-Award Metric
                  </label>
                  <select
                    value={formData.metric}
                    onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                  >
                    <option value="followers">Followers Count</option>
                    <option value="posts">Posts / Reels Count</option>
                    <option value="orders">Orders Placed</option>
                    <option value="sales">Storefront Sales</option>
                    <option value="kyc">KYC Verified (1 = Yes)</option>
                    <option value="creator">Creator/Vendor (1 = Yes)</option>
                    <option value="escrow">Escrow Transactions</option>
                    <option value="account_age_days">Account Age (Days)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                    Required Metric Value
                  </label>
                  <input
                    type="number"
                    value={formData.metric_value}
                    onChange={(e) => setFormData({ ...formData, metric_value: Number(e.target.value) })}
                    className="w-full text-xs p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Rule Explanation
                </label>
                <input
                  type="text"
                  value={formData.rule}
                  onChange={(e) => setFormData({ ...formData, rule: e.target.value })}
                  placeholder="e.g. Reached 20+ followers and community connections"
                  className="w-full text-xs p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="badge_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-[#1A68D4] focus:ring-[#1A68D4]"
                />
                <label htmlFor="badge_active" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Active (automatically awarded by system rule engine)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setIsEditOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-[#1A68D4] text-white hover:bg-blue-700 transition shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : isEditOpen ? "Update Badge" : "Create Badge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Award to User Modal */}
      {isAwardOpen && selectedBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                Award Badge to User
              </h2>
              <button
                onClick={() => setIsAwardOpen(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
              <Badge3DRenderer type={selectedBadge.icon_3d} size={48} />
              <div>
                <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
                  {selectedBadge.name}
                </h4>
                <p className="text-xs text-neutral-500">{selectedBadge.level_label || selectedBadge.slug}</p>
              </div>
            </div>

            <form onSubmit={handleAwardUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Target User ID
                </label>
                <input
                  type="number"
                  required
                  value={awardUserId}
                  onChange={(e) => setAwardUserId(e.target.value)}
                  placeholder="Enter User ID (e.g. 1)"
                  className="w-full text-xs p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              <p className="text-[11px] text-neutral-500">
                Awarding this badge manually grants it immediately to the specified user and increases the system awarded counter.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAwardOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-[#1A68D4] text-white hover:bg-blue-700 transition shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {submitting ? "Awarding..." : "Award Badge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminBadgesPage;
