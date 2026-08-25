import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  BadgeCheck,
  AlertTriangle,
  Clock,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { apiClient, type ApiError } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { getCachedData, setCachedData } from "@/lib/api/cacheStore";

interface BadgeUser {
  id: number;
  name: string;
  email: string;
  username: string;
  role: string;
  kyc_status: string;
  verification_badge_status: string;
  verification_badge_expires_at?: string | null;
  verification_badge_purchased_at?: string | null;
  verification_badge_auto_renew: boolean;
}

const TABS = [
  { key: "under_review", label: "Under Review", icon: Clock },
  { key: "active", label: "Active & Verified Badges", icon: BadgeCheck },
  { key: "kyc_pending", label: "KYC Pending", icon: AlertTriangle },
  { key: "all", label: "All Badge Accounts", icon: Filter },
];

export function AdminVerificationBadgesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStatus = searchParams.get("status") || "under_review";
  const [page, setPage] = useState(1);

  const cacheKey = `vbadges_${currentStatus}_p${page}`;

  const [users, setUsers] = useState<BadgeUser[]>(() => {
    const cached = getCachedData<{ items: BadgeUser[]; lastPage: number; total: number }>(cacheKey);
    return cached?.items ?? [];
  });
  const [lastPage, setLastPage] = useState<number>(() => {
    const cached = getCachedData<{ items: BadgeUser[]; lastPage: number; total: number }>(cacheKey);
    return cached?.lastPage ?? 1;
  });
  const [total, setTotal] = useState<number>(() => {
    const cached = getCachedData<{ items: BadgeUser[]; lastPage: number; total: number }>(cacheKey);
    return cached?.total ?? 0;
  });
  const [loading, setLoading] = useState<boolean>(!getCachedData(cacheKey));
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchBadges = useCallback(async (isSilent = false) => {
    if (!isSilent && !getCachedData(cacheKey)) {
      setLoading(true);
    }
    try {
      const params: Record<string, string | number> = { page };
      if (currentStatus !== "all") {
        params.status = currentStatus;
      }

      const res = await apiClient.get("/securegate/verification-badges", { params });
      const envelope = res.data;
      const paginator = envelope?.success ? envelope.data : envelope;
      const items = Array.isArray(paginator?.data) ? paginator.data : [];
      const lp = paginator?.last_page || 1;
      const tot = paginator?.total || 0;

      setUsers(items);
      setLastPage(lp);
      setTotal(tot);

      setCachedData(cacheKey, { items, lastPage: lp, total: tot });
    } catch (err) {
      console.error("Failed to load verification badges:", err);
      toast.error("Failed to load verification badges.");
    } finally {
      setLoading(false);
    }
  }, [cacheKey, currentStatus, page]);

  useEffect(() => {
    fetchBadges(Boolean(getCachedData(cacheKey)));
  }, [cacheKey, fetchBadges]);

  // Optimistic Status Update
  const handleUpdateStatus = async (user: BadgeUser, newStatus: string) => {
    const prevStatus = user.verification_badge_status;
    setProcessingId(user.id);

    // Optimistically update local list state
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, verification_badge_status: newStatus } : u))
    );

    try {
      const res = await apiClient.patch(`/securegate/verification-badges/${user.id}/status`, {
        status: newStatus,
      });

      if (res.data?.success) {
        toast.success(res.data.message || `Badge status updated to ${newStatus}.`);
        fetchBadges(true);
      } else {
        // Rollback on non-success
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, verification_badge_status: prevStatus } : u))
        );
      }
    } catch (err: unknown) {
      // Rollback on error
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, verification_badge_status: prevStatus } : u))
      );
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Failed to update badge status.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BadgeCheck className="h-6 w-6 text-[#1877f2]" />
          Verification Badge Management
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Review, approve, suspend, or revoke paid verification badges (blue checkmarks).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-border pb-4 scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentStatus === tab.key;
          return (
            <ActionTooltip key={tab.key} content={`Filter by ${tab.label}`}>
              <button
                onClick={() => {
                  setSearchParams({ status: tab.key });
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-[#1877f2] text-white shadow-xs"
                    : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            </ActionTooltip>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <BadgeCheck className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="font-bold text-base text-foreground">No verification badges found</h3>
            <p className="text-xs text-muted-foreground mt-1">
              There are no accounts matching the selected badge filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/30 font-bold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-6 py-3.5">KYC Status</th>
                  <th className="px-6 py-3.5">Badge Status</th>
                  <th className="px-6 py-3.5">Expiration</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1877f2]/10 text-[#1877f2] font-bold text-xs">
                          {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div>
                          <div className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                            {u.name}
                            {(u.verification_badge_status === "active" || u.verification_badge_status === "verified") && (
                              <BadgeCheck className="h-4 w-4 text-[#1877f2] shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${
                          u.kyc_status === "verified"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : u.kyc_status === "pending" || u.kyc_status === "in_review"
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        {u.kyc_status === "verified" ? (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        ) : (
                          <Shield className="h-3.5 w-3.5" />
                        )}
                        {u.kyc_status}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${
                          u.verification_badge_status === "active" || u.verification_badge_status === "verified"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : u.verification_badge_status === "under_review" || u.verification_badge_status === "kyc_pending"
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            : "bg-destructive/10 text-destructive border border-destructive/20"
                        }`}
                      >
                        {u.verification_badge_status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs text-muted-foreground font-medium">
                      {u.verification_badge_expires_at
                        ? new Date(u.verification_badge_expires_at).toLocaleDateString()
                        : "N/A"}
                    </td>

                    <td className="px-6 py-4 text-right space-x-2">
                      {processingId === u.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary inline-block" />
                      ) : (
                        <>
                          {u.verification_badge_status !== "verified" && u.verification_badge_status !== "active" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(u, "verified")}
                              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                            >
                              Approve Badge
                            </button>
                          )}
                          {(u.verification_badge_status === "active" || u.verification_badge_status === "verified") && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(u, "suspended")}
                              className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-500 hover:bg-amber-500/20 transition-colors"
                            >
                              Suspend
                            </button>
                          )}
                          {u.verification_badge_status !== "revoked" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(u, "revoked")}
                              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 transition-colors"
                            >
                              Revoke
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3 bg-muted/10">
            <span className="text-xs text-muted-foreground font-medium">
              Total {total} accounts &middot; Page {page} of {lastPage}
            </span>
            <div className="flex items-center gap-2">
              <ActionTooltip content="Previous page">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </ActionTooltip>
              <ActionTooltip content="Next page">
                <button
                  disabled={page >= lastPage}
                  onClick={() => setPage(page + 1)}
                  className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </ActionTooltip>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminVerificationBadgesPage;
