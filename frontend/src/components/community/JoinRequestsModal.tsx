import { authFetch } from "@/lib/api/authFetch";
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
import { TimeCircle as Clock, ShieldDone as ShieldCheck, TickSquare as Check, CloseSquare as X } from "@/components/icons";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';
import type { JoinRequest } from "@/types/community";

interface JoinRequestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: number;
  communityName: string;
}

function JoinRequestsBody({ communityId }: { communityId: number }) {
  const [requests, setRequests] = React.useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [processingId, setProcessingId] = React.useState<number | null>(null);
  const [attempt, setAttempt] = React.useState(0);

  // Mounted when the dialog opens, so loading starts true. Results are only
  // written after the request settles.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE}/communities/${communityId}/requests`, {
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setRequests(data.requests || []);
        } else {
          setError("Failed to load join requests. Please try again.");
        }
      } catch {
        if (!cancelled) setError("Unable to connect to the server. Please check your connection and try again.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [communityId, attempt]);

  const retry = () => {
    setError(null);
    setIsLoading(true);
    setAttempt((n) => n + 1);
  };

  const handleAction = async (requestId: number, action: "approve" | "reject") => {
    setProcessingId(requestId);
    try {
      await authFetch(`${API_BASE}/memberships/${requestId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
    <>
        <div className="space-y-4 my-2 max-h-[60vh] overflow-y-auto pr-1">
          {error ? (
            <ErrorState
              title="Failed to load requests"
              description={error}
              onRetry={retry}
            />
          ) : isLoading ? (
            <div className="space-y-3 p-4">
              <div className="h-14 rounded-lg bg-muted animate-pulse" />
              <div className="h-14 rounded-lg bg-muted animate-pulse" />
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
                className="flex items-center justify-between gap-3 p-3.5 rounded-lg border-none bg-card shadow-2xs hover:border-primary/30 transition-all"
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
                    <X weight="fill" className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAction(req.id, "approve")}
                    disabled={processingId === req.id}
                    className="h-8 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                  >
                    <Check weight="fill" className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
    </>
  );
}

export function JoinRequestsModal({
  open,
  onOpenChange,
  communityId,
  communityName,
}: JoinRequestsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl rounded-lg p-4 sm:p-5">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock weight="fill" className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Join Requests Queue</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Review pending membership applications for <span className="font-semibold text-foreground">{communityName}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <JoinRequestsBody key={communityId} communityId={communityId} />
      </DialogContent>
    </Dialog>
  );
}
