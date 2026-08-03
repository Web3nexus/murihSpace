import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  UserCheck,
  Clock,
  XSquare,
  CheckCircle2,
  XCircle,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User,
  FileText,
  AlertCircle,
  Filter,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { apiClient, type ApiError } from "@/lib/api/client";

interface RoleApplication {
  id: number;
  user_id: number;
  previous_role: string;
  requested_role: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requested_at: string;
  approved_at?: string | null;
  rejection_reason?: string | null;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
    avatar_url?: string;
  };
  approvedBy?: {
    id: number;
    name: string;
  };
}

const TABS = [
  { key: "pending", label: "Pending Applications", icon: Clock },
  { key: "approved", label: "Approved History", icon: CheckCircle2 },
  { key: "rejected", label: "Rejected History", icon: XCircle },
  { key: "all", label: "All Records", icon: Filter },
];

export function AdminRoleApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStatus = searchParams.get("status") || "pending";
  const [applications, setApplications] = useState<RoleApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RoleApplication | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedApp, setSelectedApp] = useState<RoleApplication | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page };
      if (currentStatus !== "all") {
        params.status = currentStatus;
      }
      if (roleFilter !== "all") {
        params.role = roleFilter;
      }

      const res = await apiClient.get("/securegate/role-applications", { params });

      const data = res.data;
      if (data?.data) {
        setApplications(data.data);
        setLastPage(data.last_page || 1);
        setTotal(data.total || 0);
      } else {
        setApplications([]);
      }
    } catch (err) {
      console.error("Failed to load role applications:", err);
      toast.error("Failed to load role applications.");
    } finally {
      setLoading(false);
    }
  }, [currentStatus, roleFilter, page]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleApprove = async (app: RoleApplication) => {
    setProcessingId(app.id);
    try {
      const res = await apiClient.patch(`/securegate/role-applications/${app.id}/approve`);
      if (res.data?.success) {
        toast.success(res.data.message || `Application approved. User is now a ${app.requested_role}.`);
        if (selectedApp?.id === app.id) setSelectedApp(null);
        await fetchApplications();
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Failed to approve application.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim() || rejectReason.trim().length < 10) {
      toast.error("Please provide a rejection reason of at least 10 characters.");
      return;
    }

    setProcessingId(rejectTarget.id);
    try {
      const res = await apiClient.patch(`/securegate/role-applications/${rejectTarget.id}/reject`, {
        reason: rejectReason,
      });

      if (res.data?.success) {
        toast.info("Application rejected.");
        setRejectTarget(null);
        setRejectReason("");
        if (selectedApp?.id === rejectTarget.id) setSelectedApp(null);
        await fetchApplications();
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Failed to reject application.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <UserCheck className="h-6 w-6 text-primary" />
          Account Role Applications
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve user requests to upgrade to Creator or Vendor roles.
        </p>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-2 overflow-x-auto">
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

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Requested Roles</option>
            <option value="creator">Creator Applications</option>
            <option value="vendor">Vendor Applications</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <UserCheck className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold text-lg text-foreground">No applications found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              There are no role transition requests matching the selected filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-6 py-3.5">Transition Path</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Requested Date</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {app.user?.name ? app.user.name.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{app.user?.name || "Unknown User"}</div>
                          <div className="text-xs text-muted-foreground">{app.user?.email || `ID: ${app.user_id}`}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-accent px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                          {app.previous_role}
                        </span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold capitalize text-primary">
                          {app.requested_role === "creator" ? (
                            <Sparkles className="h-3 w-3" />
                          ) : (
                            <ShoppingBag className="h-3 w-3" />
                          )}
                          {app.requested_role}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          app.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : app.status === "pending"
                            ? "bg-amber-500/10 text-amber-500"
                            : app.status === "rejected"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {app.status === "pending" && <Clock className="h-3.5 w-3.5" />}
                        {app.status === "approved" && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {app.status === "rejected" && <XCircle className="h-3.5 w-3.5" />}
                        {app.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {new Date(app.requested_at).toLocaleString()}
                    </td>

                    <td className="px-6 py-4 text-right space-x-2">
                      {app.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(app)}
                            disabled={processingId === app.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                          >
                            {processingId === app.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectTarget(app)}
                            disabled={processingId === app.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedApp(app)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          Details
                        </button>
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
              Total {total} records — Page {page} of {lastPage}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= lastPage}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Reject Role Application</h3>
            <p className="text-xs text-muted-foreground">
              Provide a clear reason for rejecting <strong className="text-foreground">{rejectTarget.user?.name}</strong>'s request to become a <span className="capitalize">{rejectTarget.requested_role}</span>.
            </p>

            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain what requirements were missing..."
              className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={processingId === rejectTarget.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground shadow hover:bg-destructive/90 disabled:opacity-50"
              >
                {processingId === rejectTarget.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground">Application Record #{selectedApp.id}</h3>
              <button
                onClick={() => setSelectedApp(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">User Name</span>
                <span className="font-semibold text-foreground">{selectedApp.user?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">User Email</span>
                <span className="font-mono text-foreground">{selectedApp.user?.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Transition</span>
                <span className="font-semibold capitalize text-foreground">{selectedApp.previous_role} → {selectedApp.requested_role}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Status</span>
                <span className="capitalize font-semibold text-foreground">{selectedApp.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Requested At</span>
                <span className="text-xs text-muted-foreground">{new Date(selectedApp.requested_at).toLocaleString()}</span>
              </div>

              {selectedApp.approved_at && (
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Resolved At</span>
                  <span className="text-xs text-muted-foreground">{new Date(selectedApp.approved_at).toLocaleString()}</span>
                </div>
              )}

              {selectedApp.rejection_reason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 mt-3">
                  <div className="text-xs font-semibold text-destructive">Rejection Reason</div>
                  <p className="text-xs text-destructive/90 mt-1">{selectedApp.rejection_reason}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default AdminRoleApplicationsPage;
