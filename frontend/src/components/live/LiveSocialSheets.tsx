import { useEffect, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { CloseSquare as X } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import type { GuestProfileTarget } from "./LiveGuestGrid";
import { DismissOnEscape } from "@/components/ui/DismissOnEscape";

// Bottom sheet. Clicks and Escape on the backdrop close it; the panel itself
// has no handlers, so taps inside it never reach the backdrop.
function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  const closeOnBackdrop = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
  // Escape is handled here while focus is inside the sheet. stopPropagation keeps
  // DismissOnEscape from firing a second close for the same key press.
  const closeOnEscape = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      role="presentation"
      onClick={closeOnBackdrop}
      onKeyDown={closeOnEscape}
      className="absolute inset-0 z-40 flex items-end justify-center bg-black/50"
    >
      <DismissOnEscape onDismiss={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="max-h-[85%] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#16181f] p-5 pb-6 text-white shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}

export function LiveFollowButton({ userId, className = "" }: { userId: number; className?: string }) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient
      .get(`/users/${userId}/follow-status`)
      .then((res) => {
        if (!active) return;
        const payload = res.data?.data ?? res.data;
        setFollowing(Boolean(payload?.is_following));
      })
      .catch(() => {
        // Status unavailable: show an enabled "Follow"; the toggle reports its own errors.
        if (active) setFollowing(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await apiClient.post(`/users/${userId}/follow`);
      const payload = res.data?.data ?? res.data;
      setFollowing(Boolean(payload?.is_following));
    } catch {
      toast.error("Could not update follow. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy || following === null}
      className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
        following ? "border border-white/25 bg-white/10 text-white" : "bg-[#fe2c55] text-white hover:bg-[#e6264c]"
      } ${className}`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}

export function LiveJoinGuestSheet({
  open,
  onClose,
  hostName,
  requestSent,
  sending,
  onJoin,
}: {
  open: boolean;
  onClose: () => void;
  hostName: string;
  requestSent: boolean;
  sending: boolean;
  onJoin: () => void;
}) {
  if (!open) return null;

  return (
    <Sheet onClose={onClose} label="Join as a guest">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Join as a guest</h2>
          <p className="mt-1 text-sm text-white/70">
            {requestSent
              ? `Your request was sent. ${hostName} will review it.`
              : `Ask ${hostName} to let you on camera. The host reviews each request.`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X weight="bold" className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-5 space-y-2">
        <Button
          type="button"
          onClick={onJoin}
          disabled={requestSent || sending}
          className="h-11 w-full rounded-full bg-[#fe2c55] text-sm font-bold text-white hover:bg-[#e6264c] disabled:opacity-60"
        >
          {requestSent ? "Request sent" : sending ? "Sending…" : "Request to join"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-11 w-full rounded-full border-white/15 bg-white/5 text-sm font-semibold text-white hover:bg-white/10"
        >
          Keep watching
        </Button>
      </div>
    </Sheet>
  );
}

interface PublicProfile {
  name?: string;
  username?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  followers_count?: number;
  following_count?: number;
}

function ProfileBody({ target, onClose }: { target: GuestProfileTarget; onClose: () => void }) {
  const [loaded, setLoaded] = useState<{ id: number; profile: PublicProfile } | null>(null);
  const profile = loaded?.id === target.id ? loaded.profile : null;

  useEffect(() => {
    let active = true;
    apiClient
      .get(`/users/${target.id}`)
      .then((res) => {
        if (!active) return;
        const payload = res.data?.data ?? res.data;
        setLoaded({ id: target.id, profile: payload ?? {} });
      })
      .catch(() => {
        // The sheet falls back to what the stage already knows about this user.
      });
    return () => {
      active = false;
    };
  }, [target.id]);

  const name = profile?.name ?? target.name;
  const avatar = profile?.avatar_url ?? target.avatar_url ?? undefined;

  return (
    <Sheet onClose={onClose} label={`${name} profile`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarImage src={avatar} alt={name} />
            <AvatarFallback className="bg-primary/25 font-bold text-white">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold">{name}</h2>
            {profile?.username && <p className="truncate text-sm text-white/60">@{profile.username}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X weight="bold" className="h-5 w-5" />
        </button>
      </div>

      {profile?.bio && <p className="mt-3 text-sm text-white/80">{profile.bio}</p>}

      {profile && (
        <p className="mt-3 text-sm text-white/70">
          <span className="font-bold text-white">{profile.followers_count ?? 0}</span> followers ·{" "}
          <span className="font-bold text-white">{profile.following_count ?? 0}</span> following
        </p>
      )}

      <div className="mt-5">
        <LiveFollowButton userId={target.id} className="h-11 w-full text-sm" />
      </div>
    </Sheet>
  );
}

export function LiveViewerProfileSheet({
  target,
  onClose,
}: {
  target: GuestProfileTarget | null;
  onClose: () => void;
}) {
  if (!target) return null;
  return <ProfileBody key={target.id} target={target} onClose={onClose} />;
}
