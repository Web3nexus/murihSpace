import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  ShoppingBag,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  ArrowUpRight,
  Users,
  Video,
  Radio,
  Store,
  Package,
  Boxes,
  Layers,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient, type ApiError } from "@/lib/api/client";
import { useAuth } from "@/hooks/useAuth";

interface ApplicationRecord {
  id: number;
  previous_role: string;
  requested_role: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requested_at: string;
  approved_at?: string | null;
  rejection_reason?: string | null;
}

export function UpgradeAccountPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [history, setHistory] = useState<ApplicationRecord[]>([]);

  const fetchApplicationState = useCallback(async () => {
    setLoading(true);
    try {
      const [appRes, historyRes] = await Promise.all([
        apiClient.get("/role/application"),
        apiClient.get("/role/history"),
      ]);

      if (appRes.data?.application) {
        setApplication(appRes.data.application);
      } else {
        setApplication(null);
      }

      if (historyRes.data?.history) {
        setHistory(historyRes.data.history);
      }
    } catch (err) {
      console.error("Failed to load role application data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplicationState();
  }, [fetchApplicationState]);

  const handleApply = async (requestedRole: "creator" | "vendor") => {
    setSubmitting(requestedRole);
    try {
      const res = await apiClient.post("/role/apply", {
        requested_role: requestedRole,
      });

      if (res.data?.success) {
        toast.success(res.data.message || "Role application submitted successfully!");
        await fetchApplicationState();
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Failed to submit role application.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleCancel = async () => {
    setSubmitting("cancel");
    try {
      const res = await apiClient.delete("/role/apply");
      if (res.data?.success) {
        toast.info("Application cancelled.");
        setApplication(null);
        await fetchApplicationState();
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Failed to cancel application.");
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentRole = user?.role ?? "member";

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header Banner */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-accent/20 to-background p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-2">
              Current Account Role: <span className="capitalize font-bold">{currentRole}</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Upgrade Your MurihSpace Experience
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              MurihSpace is free for all users. Upgrade to unlock powerful monetization, store frontends, and creator tools.
            </p>
          </div>
        </div>
      </div>

      {/* Pending Application Alert */}
      {application && application.status === "pending" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-4">
            <Clock className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold text-base text-foreground">
                  Role Application Pending Review
                </h3>
                <span className="text-xs text-muted-foreground">
                  Submitted {new Date(application.requested_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                You have requested an upgrade to <strong className="capitalize text-foreground">{application.requested_role}</strong>.
                Our team is reviewing your application and verifying your identity.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={submitting === "cancel"}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {submitting === "cancel" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Cancel Application
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Alert */}
      {application && application.status === "rejected" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-destructive dark:text-red-200">
          <div className="flex items-start gap-4">
            <XCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-base">Application Not Approved</h3>
              <p className="mt-1 text-sm opacity-90">
                Reason: {application.rejection_reason || "Requirements were not met."}
              </p>
              <p className="mt-2 text-xs opacity-75">
                You may submit a new application below once you have updated your profile details.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Role Upgrade Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Creator Card */}
        <div
          className={`relative rounded-xl border p-6 flex flex-col justify-between transition-all ${
            currentRole === "creator"
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-card hover:border-primary/50 hover:shadow-md"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">Creator Role</h3>
                  <p className="text-xs text-muted-foreground">For Content Creators & Solopreneurs</p>
                </div>
              </div>
              {currentRole === "creator" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active Role
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Full suite of creator tools: Link-in-bio, digital products, courses, coaching, memberships, video conferencing, live sessions, and vendor capabilities.
            </p>

            <ul className="space-y-2 text-xs text-muted-foreground mb-6">
              <li className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Link-in-bio website & theme builder</span>
              </li>
              <li className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Digital products, courses & 1:1 coaching</span>
              </li>
              <li className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Communities & Video Conferences</span>
              </li>
              <li className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Live sessions, tips & conference gifts</span>
              </li>
              <li className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Creator payouts & media kit tools</span>
              </li>
              <li className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Physical storefront & vendor capabilities included</span>
              </li>
            </ul>
          </div>

          <div>
            {currentRole === "creator" ? (
              <div className="w-full rounded-lg bg-accent py-2.5 text-center text-xs font-medium text-muted-foreground">
                You already hold Creator permissions
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleApply("creator")}
                disabled={submitting !== null || (application?.status === "pending")}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting === "creator" && <Loader2 className="h-4 w-4 animate-spin" />}
                Apply as Creator
              </button>
            )}
          </div>
        </div>

        {/* Vendor Card */}
        <div
          className={`relative rounded-xl border p-6 flex flex-col justify-between transition-all ${
            currentRole === "vendor"
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-card hover:border-primary/50 hover:shadow-md"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">Vendor Role</h3>
                  <p className="text-xs text-muted-foreground">For Physical Product Sellers & Merchants</p>
                </div>
              </div>
              {currentRole === "vendor" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active Role
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Tailored storefront tools for physical products, inventory tracking, fulfilment, shipping profiles, disputes, and business wallet payouts.
            </p>

            <ul className="space-y-2 text-xs text-muted-foreground mb-6">
              <li className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Physical product storefront & catalogue</span>
              </li>
              <li className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Inventory management & stock alerts</span>
              </li>
              <li className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Orders, shipping profiles & fulfilment</span>
              </li>
              <li className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Reviews & dispute management</span>
              </li>
              <li className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Business wallet & payout settlement</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground/60">
                <XCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <span className="line-through">No community or conference hosting</span>
              </li>
            </ul>
          </div>

          <div>
            {currentRole === "vendor" ? (
              <div className="w-full rounded-lg bg-accent py-2.5 text-center text-xs font-medium text-muted-foreground">
                You already hold Vendor permissions
              </div>
            ) : currentRole === "creator" ? (
              <div className="w-full rounded-lg bg-accent py-2.5 text-center text-xs font-medium text-muted-foreground">
                Creator role includes all Vendor capabilities
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleApply("vendor")}
                disabled={submitting !== null || (application?.status === "pending")}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
              >
                {submitting === "vendor" && <Loader2 className="h-4 w-4 animate-spin" />}
                Apply as Vendor
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Role Upgrade Process Steps */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-primary" />
          Role Upgrade Workflow
        </h3>

        <div className="grid gap-4 sm:grid-cols-3 text-sm">
          <div className="rounded-lg border border-border/50 bg-background/50 p-4">
            <div className="flex items-center gap-2 text-primary font-semibold mb-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs">1</span>
              Submit Application
            </div>
            <p className="text-xs text-muted-foreground">
              Select your desired role above to create your role transition application.
            </p>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/50 p-4">
            <div className="flex items-center gap-2 text-primary font-semibold mb-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs">2</span>
              Complete KYC Verification
            </div>
            <p className="text-xs text-muted-foreground">
              KYC verification is triggered when applying for creator or vendor trusted workflows.
            </p>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/50 p-4">
            <div className="flex items-center gap-2 text-primary font-semibold mb-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs">3</span>
              Role Activation
            </div>
            <p className="text-xs text-muted-foreground">
              Once verified and approved by admin, your role and menu features are activated instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Role History */}
      {history.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-semibold text-base text-foreground">Application History</h3>
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {history.map((record) => (
              <div key={record.id} className="flex items-center justify-between p-4 text-sm bg-background/30">
                <div>
                  <div className="font-medium capitalize text-foreground">
                    {record.previous_role} → {record.requested_role}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Requested on {new Date(record.requested_at).toLocaleDateString()}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                    record.status === "approved"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : record.status === "pending"
                      ? "bg-amber-500/10 text-amber-500"
                      : record.status === "rejected"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {record.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export default UpgradeAccountPage;
