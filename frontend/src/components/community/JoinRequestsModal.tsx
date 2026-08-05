import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ErrorState, EmptyState } from "@/components/common/UIStateComponents";
import { Clock, ShieldCheck, Check, X } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';
import type { JoinRequest } from "@/types/community";
import { getAuthToken } from "@/lib/auth/token";

interface JoinRequestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: number;
  communityName: string;
}

export function JoinRequestsModal({
  open,
  onOpenChange,
  communityId,
  communityName,
}: JoinRequestsModalProps) {
  const [requests, setRequests] = React.useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [processingId, setProcessingId] = React.useState<number | null>(null);

  // Fetch pending join requests
  const fetchRequests = React.useCallback(async () => {
    if (!open || !communityId) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/communities/${communityId}/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      } else {
        setError("Failed to load join requests. Please try again.");
      }
    } catch {
      setError("Unable to connect to the server. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [open, communityId]);

  React.useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (requestId: number, action: "approve" | "reject") => {
    setProcessingId(requestId);
    try {
      const token = getAuthToken();
      await fetch(`${API_BASE}/memberships/${requestId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      // Remove approved/rejected request from state list
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      // Remove from UI state on fallback
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl rounded-2xl p-6 sm:p-8">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Join Requests Queue</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Review pending membership applications for <span className="font-semibold text-foreground">{communityName}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2 max-h-[60vh] overflow-y-auto pr-1">
          {error ? (
            <ErrorState
              title="Failed to load requests"
              description={error}
              onRetry={fetchRequests}
            />
          ) : isLoading ? (
            <div className="space-y-3 p-4">
              <div className="h-14 rounded-xl bg-muted animate-pulse" />
              <div className="h-14 rounded-xl bg-muted animate-pulse" />
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No pending join requests"
              description="All membership applications for this community have been reviewed."
            />
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card shadow-2xs hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0 rounded-lg">
                    <AvatarImage src={req.user.avatar} alt={req.user.name} />
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                      {req.user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{req.user.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">@{req.user.username}</p>
                    {req.user.bio && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{req.user.bio}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(req.id, "reject")}
                    disabled={processingId === req.id}
                    className="h-8 w-8 p-0 text-destructive border-destructive/30 hover:bg-destructive/10"
                    title="Reject applicant"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAction(req.id, "approve")}
                    disabled={processingId === req.id}
                    className="h-8 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
