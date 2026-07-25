import React, { useState, useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, XCircle, ShieldCheck, FileText } from "lucide-react";

export function AdminKycPage() {
  const { pendingKycs, loading, fetchPendingKycs, approveKyc, rejectKyc } = useProfile();
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    fetchPendingKycs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (userId: number) => {
    setProcessingId(userId);
    await approveKyc(userId);
    setProcessingId(null);
  };

  const handleReject = async (userId: number) => {
    if (!rejectReason) return;
    setProcessingId(userId);
    await rejectKyc(userId, rejectReason);
    setRejectingId(null);
    setRejectReason("");
    setProcessingId(null);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">KYC Verification Queue</h2>
          <p className="text-sm text-muted-foreground">
            Review and approve identity verification requests for Creators and Vendors.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          <ShieldCheck className="h-4 w-4" /> {pendingKycs.length} Pending
        </span>
      </div>

      {pendingKycs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-3 opacity-80" />
          <h3 className="font-semibold text-foreground">No Pending Submissions</h3>
          <p className="text-xs mt-1">All creator and vendor verification requests have been processed.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="divide-y divide-border">
            {pendingKycs.map((user) => (
              <div key={user.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{user.name}</span>
                    <span className="text-xs text-muted-foreground">(@{user.username})</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {user.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <div className="flex items-center gap-1.5 text-xs text-foreground mt-2 bg-muted/50 px-2.5 py-1 rounded w-fit">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span className="font-mono">{user.kyc_document || "No document code attached"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {rejectingId === user.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Rejection reason..."
                        value={rejectReason}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRejectReason(e.target.value)}
                        className="h-8 text-xs w-48"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(user.id)}
                        disabled={processingId === user.id || !rejectReason}
                      >
                        Confirm Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setRejectingId(user.id)}
                        disabled={processingId === user.id}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleApprove(user.id)}
                        disabled={processingId === user.id}
                      >
                        {processingId === user.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Approve
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
