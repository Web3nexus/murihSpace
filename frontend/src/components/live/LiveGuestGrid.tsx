/* eslint-disable jsx-a11y/media-has-caption -- every video here is a live camera feed, which has no caption track */
import { useEffect, useReducer, useRef, type RefObject } from "react";
import { RemoteParticipant, Room, RoomEvent, Track } from "livekit-client";
import { Plus } from "@/components/icons";
import { MicrophoneSlash } from "@/components/icons/rounded";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Co-hosts that can be on screen at once, including the host's own tile.
export const MAX_GUESTS = 8;

export interface GuestProfileTarget {
  id: number;
  name: string;
  username?: string | null;
  avatar_url?: string | null;
}

// Re-renders when participants or their tracks change. Listeners only bump a
// counter, so no state is written from inside an effect.
function useRemoteParticipants(room: Room | null): RemoteParticipant[] {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!room) return;
    const events = [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
    ] as const;
    events.forEach((event) => room.on(event, bump));
    return () => {
      events.forEach((event) => room.off(event, bump));
    };
  }, [room]);

  return room ? Array.from(room.remoteParticipants.values()) : [];
}

function userIdFromIdentity(identity: string): number | null {
  const match = /^user_(\d+)$/.exec(identity);
  return match ? Number(match[1]) : null;
}

function displayName(participant: RemoteParticipant): string {
  return participant.name || participant.identity || "Guest";
}

function GuestTile({
  participant,
  onOpenProfile,
}: {
  participant: RemoteParticipant;
  onOpenProfile: (target: GuestProfileTarget) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const track = participant.getTrackPublication(Track.Source.Camera)?.track;

  // Each guest's camera gets its own element. Detaching on cleanup keeps a
  // removed track from holding a stale frame.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  const name = displayName(participant);
  const userId = userIdFromIdentity(participant.identity);
  const micOff = !participant.isMicrophoneEnabled;

  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#1b2230]">
      {track ? (
        <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/25 text-sm font-bold text-white">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      <button
        type="button"
        disabled={userId === null}
        onClick={() => {
          if (userId !== null) onOpenProfile({ id: userId, name });
        }}
        className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm disabled:cursor-default"
      >
        <span className="truncate">{name}</span>
        {micOff && <MicrophoneSlash weight="fill" className="h-3 w-3 shrink-0 text-white/80" />}
      </button>
    </div>
  );
}

function HostTile({
  hostName,
  hostAvatar,
  videoRef,
  muted,
  onOpenProfile,
  hostId,
}: {
  hostName: string;
  hostAvatar?: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  muted: boolean;
  onOpenProfile: (target: GuestProfileTarget) => void;
  hostId?: number;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#1b2230]">
      <video ref={videoRef} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
        Host
      </span>
      <button
        type="button"
        disabled={hostId === undefined}
        onClick={() => {
          if (hostId !== undefined) onOpenProfile({ id: hostId, name: hostName, avatar_url: hostAvatar });
        }}
        className="absolute bottom-2 left-2 right-2 truncate rounded-full bg-black/60 px-2 py-0.5 text-left text-[11px] font-semibold text-white backdrop-blur-sm disabled:cursor-default"
      >
        {hostName}
      </button>
    </div>
  );
}

interface LiveGuestGridProps {
  room: Room | null;
  /** LiveKit identity of the broadcaster, e.g. `user_12`. Null until known. */
  hostIdentity: string | null;
  hostId?: number;
  hostName: string;
  hostAvatar?: string | null;
  /** Shared with the stage so the host's camera keeps attaching to one element. */
  hostVideoRef: RefObject<HTMLVideoElement | null>;
  isHostView: boolean;
  canRequest: boolean;
  requestSent: boolean;
  onRequestSlot: () => void;
  onOpenProfile: (target: GuestProfileTarget) => void;
}

export function LiveGuestGrid({
  room,
  hostIdentity,
  hostId,
  hostName,
  hostAvatar,
  hostVideoRef,
  isHostView,
  canRequest,
  requestSent,
  onRequestSlot,
  onOpenProfile,
}: LiveGuestGridProps) {
  const participants = useRemoteParticipants(room);
  const guests = participants
    .filter((p) => p.identity !== hostIdentity)
    .filter((p) => p.trackPublications.size > 0)
    .slice(0, MAX_GUESTS);

  const showRequestTile = canRequest && guests.length < MAX_GUESTS;
  const tileCount = 1 + guests.length + (showRequestTile ? 1 : 0);
  const hostIsOnlyTile = tileCount === 1;

  return (
    <div
      className={`grid h-full w-full gap-1.5 p-1.5 ${hostIsOnlyTile ? "grid-cols-1" : "grid-cols-2 content-center"}`}
    >
      <div className={hostIsOnlyTile ? "h-full" : "aspect-[3/4]"}>
        <HostTile
          hostName={hostName}
          hostAvatar={hostAvatar}
          videoRef={hostVideoRef}
          muted={isHostView}
          onOpenProfile={onOpenProfile}
          hostId={hostId}
        />
      </div>

      {guests.map((guest) => (
        <GuestTile key={guest.identity} participant={guest} onOpenProfile={onOpenProfile} />
      ))}

      {showRequestTile && (
        <button
          type="button"
          onClick={onRequestSlot}
          disabled={requestSent}
          className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/25 bg-white/5 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-60"
        >
          <Plus weight="bold" className="h-6 w-6" />
          <span>{requestSent ? "Requested" : "Request"}</span>
        </button>
      )}
    </div>
  );
}
