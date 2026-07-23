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
import { Clock, ShieldCheck, Check, X } from "lucide-react";
import type { JoinRequest } from "@/types/community";

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
  const [processingId, setProcessingId] = React.useState<number | null>(null);

  // Fetch pending join requests
  React.useEffect(() => {
    if (!open || !communityId) return;

    async function fetchRequests() {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("murihspace-token");
        const res = await fetch(`/api/v1/communities/${communityId}/requests`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.requests) {
            setRequests(data.requests);
          }
        }
      } catch {
        // Mock fallback if offline
        setRequests([
          {
            id: 201,
            community_id: communityId,
            user_id: 10,
            role: "member",
            status: "pending",
            created_at: "2026-07-21",
            user: {
              id: 10,
              name: "David Kim",
              username: "davidkim",
              bio: "Product designer and digital creator interested in web3 & UI design systems.",
              avatar: "",
            },
          },
          {
            id: 202,
            community_id: communityId,
            user_id: 11,
            role: "member",
            status: "pending",
            created_at: "2026-07-21",
            user: {
              id: 11,
              name: "Amara Nwosu",
              username: "amara_n",
              bio: "Full-stack developer building creator tools and community platforms.",
              avatar: "",
            },
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRequests();
  }, [open, communityId]);

  const handleAction = async (requestId: number, action: "approve" | "reject") => {
    setProcessingId(requestId);
    try {
      const token = localStorage.getItem("murihspace-token");
      await fetch(`/api/v1/memberships/${requestId}/${action}`, {
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
      <DialogContent className="max-w-md rounded-2xl p-6">
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
          {isLoading ? (
            <div className="space-y-3 p-4">
              <div className="h-14 rounded-xl bg-muted animate-pulse" />
              <div className="h-14 rounded-xl bg-muted animate-pulse" />
            </div>
          ) : requests.length === 0 ? (
            <div className="py-8 text-center space-y-2 border border-dashed border-border rounded-xl">
              <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-xs font-semibold text-foreground">No pending join requests</p>
              <p className="text-[11px] text-muted-foreground">
                All membership applications for this community have been reviewed.
              </p>
            </div>
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
