import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowsOut,
  CaretDown,
  Microphone,
  MicrophoneSlash,
  PhoneSlash,
  SquaresFour,
  VideoCamera,
  VideoCameraSlash,
  WarningCircle,
} from "@phosphor-icons/react";
import { Track, RoomEvent, type Room } from "livekit-client";
import { Button } from "@/components/ui/button";
import { liveSessionStore, type LiveSessionRecord } from "@/lib/session/liveSessionStore";
import { useElapsedMinutes, useLiveSessions } from "@/lib/session/useLiveSessions";

/**
 * Floating dock that keeps an active call / meeting / live broadcast on screen
 * while the user browses the rest of the app.
 *
 * The media element here attaches directly to the shared LiveKit `Room` owned by
 * the session store, so switching routes never drops the connection — which is
 * exactly what used to happen when each page tore its own room down on unmount.
 */

function RoomVideoSurface({ session, room }: { session: LiveSessionRecord; room: Room | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !room) return;

    const attachVideo = () => {
      const participants = room.remoteParticipants;

      const track = Array.from(participants.values())
        .flatMap((participant) => Array.from(participant.videoTrackPublications.values()))
        .map((publication) => publication.track)
        .find((candidate) => candidate !== undefined && candidate.kind === Track.Kind.Video);

      if (track) {
        track.attach(element);
        setHasVideo(true);
      } else {
        setHasVideo(false);
      }
    };

    attachVideo();

    const onTrack = () => attachVideo();
    room.on(RoomEvent.TrackSubscribed, onTrack);
    room.on(RoomEvent.TrackUnsubscribed, onTrack);
    room.on(RoomEvent.TrackPublished, onTrack);
    room.on(RoomEvent.ParticipantConnected, onTrack);
    room.on(RoomEvent.ParticipantDisconnected, onTrack);

    return () => {
      // Detach only this element: the room itself stays alive in the store.
      room.off(RoomEvent.TrackSubscribed, onTrack);
      room.off(RoomEvent.TrackUnsubscribed, onTrack);
      room.off(RoomEvent.TrackPublished, onTrack);
      room.off(RoomEvent.ParticipantConnected, onTrack);
      room.off(RoomEvent.ParticipantDisconnected, onTrack);

      if (element.srcObject) {
        element.srcObject = null;
      }
    };
  }, [room]);

  if (!room) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0B0F16]">
        <span className="text-[11px] font-medium text-white/50">Connecting…</span>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[#0B0F16]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={session.kind === "live" && !session.isMuted ? false : true}
        className={`h-full w-full object-cover ${hasVideo ? "" : "invisible"}`}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 px-3 text-center">
          <WarningCircle weight="fill" className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="text-[11px] font-medium text-white/70">
            {session.kind === "live" ? "Audio only" : "Camera is off"}
          </span>
        </div>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: LiveSessionRecord }) {
  const navigate = useNavigate();
  const room = liveSessionStore.getRoom(session.id);
  const elapsedMinutes = useElapsedMinutes(session.startedAt);
  const [expanded, setExpanded] = useState(false);

  const isConnecting = session.status === "connecting" || session.status === "reconnecting";

  const toggleMic = useCallback(() => {
    const target = liveSessionStore.getRoom(session.id);
    const next = !session.isMuted;
    void target?.localParticipant.setMicrophoneEnabled(!next).catch(() => undefined);
    liveSessionStore.patch(session.id, { isMuted: next });
  }, [session.id, session.isMuted]);

  const toggleCamera = useCallback(() => {
    const target = liveSessionStore.getRoom(session.id);
    const next = !session.isCameraOn;
    void target?.localParticipant.setCameraEnabled(next).catch(() => undefined);
    liveSessionStore.patch(session.id, { isCameraOn: next });
  }, [session.id, session.isCameraOn]);

  const leave = useCallback(() => {
    void liveSessionStore.end(session.id, "left");
  }, [session.id]);

  const openFullView = useCallback(() => {
    if (session.returnTo) {
      navigate(session.returnTo);
      setExpanded(false);
      return;
    }

    setExpanded((previous) => !previous);
  }, [navigate, session.returnTo]);

  return (
    <div className="pointer-events-auto w-[280px] overflow-hidden rounded-2xl border border-black/10 bg-[#111722] shadow-2xl shadow-black/50 dark:border-white/10">
      <div className="relative">
        <div className={expanded ? "h-52" : "h-36"}>
          <RoomVideoSurface session={session} room={room} />
        </div>

        {isConnecting && (
          <div className="absolute top-2 left-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {session.status === "reconnecting" ? "Reconnecting" : "Connecting"}
          </div>
        )}

        {session.kind === "live" && !session.isMuted && (
          <span className="absolute top-2 right-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
            Live
          </span>
        )}

        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          aria-label={expanded ? "Shrink" : "Expand"}
          className="absolute right-2 bottom-2 rounded-full bg-black/60 p-1.5 text-white/80 transition-colors hover:bg-black/80 hover:text-white"
        >
          {expanded ? <CaretDown weight="bold" className="h-3.5 w-3.5" /> : <ArrowsOut weight="bold" className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-white">{session.title}</p>
          <p className="truncate text-[11px] text-white/50">
            {session.subtitle ? `${session.subtitle} · ${elapsedMinutes}m` : `${elapsedMinutes}m`}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleMic}
            aria-label={session.isMuted ? "Unmute microphone" : "Mute microphone"}
            className={`h-8 w-8 rounded-full ${
              session.isMuted ? "bg-red-600 text-white hover:bg-red-500" : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            {session.isMuted ? <MicrophoneSlash weight="bold" className="h-4 w-4" /> : <Microphone weight="bold" className="h-4 w-4" />}
          </Button>

          {session.kind !== "live" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleCamera}
              aria-label={session.isCameraOn ? "Turn camera off" : "Turn camera on"}
              className={`h-8 w-8 rounded-full ${
                session.isCameraOn ? "text-white/80 hover:bg-white/10 hover:text-white" : "bg-red-600 text-white hover:bg-red-500"
              }`}
            >
              {session.isCameraOn ? <VideoCamera weight="bold" className="h-4 w-4" /> : <VideoCameraSlash weight="bold" className="h-4 w-4" />}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={openFullView}
            aria-label="Open full view"
            className="h-8 w-8 rounded-full text-white/80 hover:bg-white/10 hover:text-white"
          >
            <SquaresFour weight="bold" className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={leave}
            aria-label="Leave session"
            className="h-8 w-8 rounded-full bg-red-600 text-white hover:bg-red-500"
          >
            <PhoneSlash weight="bold" className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Rendered once from the app shell. Sessions currently shown full screen are
 * skipped so the app never renders the same media twice at once.
 */
export function SessionDock() {
  const sessions = useLiveSessions();

  const visible = useMemo(
    () => sessions.filter((session) => session.status !== "ended" && !session.isExpanded),
    [sessions],
  );

  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-20 z-50 flex flex-col items-end gap-3 md:bottom-6">
      {visible.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}