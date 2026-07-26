import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, CheckCircle2, Clock, LogOut, ChevronDown, Lock } from "lucide-react";
import type { Community } from "@/types/community";

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

interface JoinCommunityButtonProps {
  community: Community;
  onStatusChange?: (status: "active" | "pending" | "none", newCount: number) => void;
  className?: string;
}

export function JoinCommunityButton({
  community,
  onStatusChange,
  className = "",
}: JoinCommunityButtonProps) {
  const [status, setStatus] = React.useState<"active" | "pending" | "rejected" | "none">("none");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Check initial membership status
  React.useEffect(() => {
    async function checkStatus() {
      const token = localStorage.getItem("murihspace-token");
      if (!token || !community.id) return;
      try {
        const res = await fetch(`${API_BASE}/communities/${community.id}/membership-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status) {
            setStatus(data.status);
          }
        }
      } catch {
        // Ignore network errors
      }
    }
    checkStatus();
  }, [community.id]);

  const handleJoin = async () => {
    setIsLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("murihspace-token");
      if (!token) {
        window.location.href = "/login";
        return;
      }

      const res = await fetch(`${API_BASE}/communities/${community.id}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to join community.");
      }

      const newStatus = data.status as "active" | "pending";
      setStatus(newStatus);

      const deltaCount = newStatus === "active" ? 1 : 0;
      const updatedCount = community.members_count + deltaCount;

      if (onStatusChange) {
        onStatusChange(newStatus, updatedCount);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to join.");
      // Fallback demo toggle if backend endpoint is unavailable
      const fallbackStatus = community.visibility === "public" ? "active" : "pending";
      setStatus(fallbackStatus);
      if (onStatusChange) {
        onStatusChange(fallbackStatus, community.members_count + (fallbackStatus === "active" ? 1 : 0));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = async () => {
    setIsLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("murihspace-token");
      const res = await fetch(`${API_BASE}/communities/${community.id}/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to leave community.");
      }

      setStatus("none");
      const updatedCount = Math.max(1, community.members_count - 1);
      if (onStatusChange) {
        onStatusChange("none", updatedCount);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to leave.");
      setStatus("none");
      if (onStatusChange) {
        onStatusChange("none", Math.max(1, community.members_count - 1));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "active") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={`h-11 px-5 text-sm font-bold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 gap-2 shadow-xs ${className}`}
            disabled={isLoading}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Joined Member</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-1" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48 rounded-xl">
          <DropdownMenuItem
            onClick={handleLeave}
            className="text-destructive focus:text-destructive cursor-pointer gap-2"
          >
            <LogOut className="h-4 w-4" />
            Leave Community
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (status === "pending") {
    return (
      <Button
        variant="outline"
        onClick={handleLeave}
        className={`h-11 px-5 text-sm font-semibold border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 gap-2 ${className}`}
        title="Click to cancel join request"
        disabled={isLoading}
      >
        <Clock className="h-4 w-4 animate-spin-slow" />
        <span>Request Pending</span>
      </Button>
    );
  }

  // Non-member state
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleJoin}
        disabled={isLoading}
        className={`h-11 px-6 text-sm font-bold gap-2 shadow-md transition-all bg-primary text-primary-foreground hover:bg-primary/90 ${className}`}
      >
        {isLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
        ) : community.visibility === "private" ? (
          <>
            <Lock className="h-4 w-4" />
            Request to Join
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {community.pricing_type === "paid"
              ? `Join for $${community.price_amount}`
              : "Join Community Free"}
          </>
        )}
      </Button>

      {error && <span className="text-[11px] text-destructive font-medium">{error}</span>}
    </div>
  );
}
