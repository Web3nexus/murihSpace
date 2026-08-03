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
  const [users, setUsers] = useState<BadgeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchBadges = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page };
      if (currentStatus !== "all") {
        params.status = currentStatus;
      }

      const res = await apiClient.get("/securegate/verification-badges", { params });

      const data = res.data;
      if (data?.data) {
        setUsers(data.data);
        setLastPage(data.last_page || 1);
        setTotal(data.total || 0);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error("Failed to load verification badges:", err);
      toast.error("Failed to load verification badges.");
    } finally {
      setLoading(false);
    }
  }, [currentStatus, page]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  const handleUpdateStatus = async (user: BadgeUser, newStatus: string) => {
    setProcessingId(user.id);
    try {
      const res = await apiClient.patch(`/securegate/verification-badges/${user.id}/status`, {
        status: newStatus,
      });

      if (res.data?.success) {
        toast.success(res.data.message || `Badge status updated to ${newStatus}.`);
        await fetchBadges();
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Failed to update badge status.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BadgeCheck className="h-6 w-6 text-primary" />
          Verification Badge Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review, approve, suspend, or revoke paid verification badges (blue checkmarks).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-border pb-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentStatus === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setSearchParams({ status: tab.key });
                setPage(1);
              }}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-primary text-primary-foreground shadow"
                  : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground border border-border"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <BadgeCheck className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold text-lg text-foreground">No verification badges found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              There are no accounts matching the selected badge filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
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
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            {u.name}
                            {(u.verification_badge_status === "active" || u.verification_badge_status === "verified") && (
                              <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          u.kyc_status === "verified"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : u.kyc_status === "pending" || u.kyc_status === "in_review"
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-muted text-muted-foreground"
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
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          u.verification_badge_status === "active" || u.verification_badge_status === "verified"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : u.verification_badge_status === "under_review" || u.verification_badge_status === "kyc_pending"
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {u.verification_badge_status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs text-muted-foreground">
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
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                            >
                              Approve Badge
                            </button>
                          )}
                          {(u.verification_badge_status === "active" || u.verification_badge_status === "verified") && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(u, "suspended")}
                              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-500/20"
                            >
                              Suspend
                            </button>
                          )}
                          {u.verification_badge_status !== "revoked" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(u, "revoked")}
                              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
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
            <span className="text-xs text-muted-foreground">
              Total {total} accounts — Page {page} of {lastPage}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= lastPage}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default AdminVerificationBadgesPage;
