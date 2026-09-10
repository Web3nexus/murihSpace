import { useEffect, useRef, useState } from 'react';
import {
  Microphone as Mic,
  MicrophoneSlash as MicOff,
  VideoCamera as VideoIcon,
  VideoCameraSlash,
  Monitor,
  PhoneSlash,
  Users,
  Spinner,
  Copy,
  Check,
  Hand,
  Clock,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  Room,
  RoomEvent,
  LocalParticipant,
  Track,
  Participant,
} from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAuthToken } from '@/lib/auth/token';
import { mapApplicationError } from '@/lib/errorMapper';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Props {
  roomId?: number;
  tokenEndpoint?: string;
  directToken?: { token: string; host: string; room?: string };
  roomTitle?: string;
  isHost?: boolean;
  meetingCode?: string;
  onLeave?: () => void;
  onError?: (msg: string) => void;
}

interface ParticipantTrackState {
  participant: Participant;
  videoTrack?: Track;
  audioTrack?: Track;
}

export function LiveKitVideoConference({
  roomId,
  tokenEndpoint,
  directToken,
  roomTitle = 'MurihSpace Video Meeting',
  isHost = false,
  meetingCode,
  onLeave,
  onError,
}: Props) {
  const [stage, setStage] = useState<'prejoin' | 'connecting' | 'connected'>('prejoin');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [participants, setParticipants] = useState<ParticipantTrackState[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<{ title: string; message: string; suggestion?: string } | null>(null);

  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  // Pre-join camera preview stream
  useEffect(() => {
    let active = true;
    if (stage === 'prejoin') {
      if (isCamOn) {
        navigator.mediaDevices
          ?.getUserMedia({ video: true, audio: false })
          .then((stream) => {
            if (!active) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }
            previewStreamRef.current = stream;
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          })
          .catch(() => {
            // Camera unavailable or blocked
          });
      } else {
        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach((t) => t.stop());
          previewStreamRef.current = null;
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
      }
    }
    return () => {
      active = false;
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = null;
      }
    };
  }, [stage, isCamOn]);

  // Call timer when connected
  useEffect(() => {
    if (stage !== 'connected') return;
    const interval = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [stage]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Connect to LiveKit Room
  const joinConference = async () => {
    setConnectionError(null);
    // Stop pre-join preview stream so LiveKit can take the device
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
    }

    setStage('connecting');
    try {
      let token: string;
      let host: string;

      if (directToken) {
        token = directToken.token;
        host = directToken.host;
      } else {
        const endpoint = tokenEndpoint
          ? (tokenEndpoint.startsWith('http')
              ? tokenEndpoint
              : `${API_BASE}${tokenEndpoint.startsWith('/') ? '' : '/'}${tokenEndpoint}`)
          : `${API_BASE}/audio-rooms/${roomId}/livekit-token`;

        const res = await fetch(endpoint, { headers: getAuthHeaders() });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.message ?? 'Failed to issue LiveKit token.');
        }
        const json = await res.json();
        token = json.token;
        host = json.host;
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720, frameRate: 30 },
        },
      });

      const updateParticipantsState = () => {
        const list: ParticipantTrackState[] = [];
        if (room.localParticipant) {
          const localPubs = Array.from(room.localParticipant.trackPublications.values());
          const vTrack = localPubs.find((p) => p.kind === Track.Kind.Video)?.track;
          const aTrack = localPubs.find((p) => p.kind === Track.Kind.Audio)?.track;
          list.push({
            participant: room.localParticipant,
            videoTrack: vTrack,
            audioTrack: aTrack,
          });
        }
        room.remoteParticipants.forEach((remote) => {
          const remotePubs = Array.from(remote.trackPublications.values());
          const vTrack = remotePubs.find((p) => p.kind === Track.Kind.Video)?.track;
          const aTrack = remotePubs.find((p) => p.kind === Track.Kind.Audio)?.track;
          list.push({
            participant: remote,
            videoTrack: vTrack,
            audioTrack: aTrack,
          });
        });
        setParticipants(list);
      };

      room.on(RoomEvent.ParticipantConnected, updateParticipantsState);
      room.on(RoomEvent.ParticipantDisconnected, updateParticipantsState);
      room.on(RoomEvent.TrackSubscribed, updateParticipantsState);
      room.on(RoomEvent.TrackUnsubscribed, updateParticipantsState);
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (speakers.length > 0) setActiveSpeaker(speakers[0].identity);
        else setActiveSpeaker(null);
      });

      await room.connect(host, token);
      roomRef.current = room;

      // Apply initial mic/camera states
      await room.localParticipant.setMicrophoneEnabled(isMicOn);
      await room.localParticipant.setCameraEnabled(isCamOn);

      setStage('connected');
      updateParticipantsState();
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Connection error';
      const mapped = mapApplicationError(err);
      setConnectionError({
        title: mapped.title,
        message: mapped.description,
        suggestion: mapped.suggestion,
      });
      onError?.(rawMsg);
      setStage('prejoin');
    }
  };

  const leaveConference = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setStage('prejoin');
    if (onLeave) onLeave();
  };

  const toggleMic = async () => {
    if (!roomRef.current?.localParticipant) {
      setIsMicOn(!isMicOn);
      return;
    }
    const nextState = !isMicOn;
    await roomRef.current.localParticipant.setMicrophoneEnabled(nextState);
    setIsMicOn(nextState);
  };

  const toggleCam = async () => {
    if (!roomRef.current?.localParticipant) {
      setIsCamOn(!isCamOn);
      return;
    }
    const nextState = !isCamOn;
    await roomRef.current.localParticipant.setCameraEnabled(nextState);
    setIsCamOn(nextState);
  };

  const toggleScreenShare = async () => {
    if (!roomRef.current?.localParticipant) return;
    const nextState = !isScreenSharing;
    try {
      await roomRef.current.localParticipant.setScreenShareEnabled(nextState);
      setIsScreenSharing(nextState);
    } catch (e) {
      console.error('Screen share error', e);
    }
  };

  const handleCopyLink = () => {
    const link = meetingCode
      ? `${window.location.origin}/app/meeting/${meetingCode}`
      : window.location.href;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  // ── PRE-JOIN SCREEN (Google Meet Lobby Style) ───────────────────────────
  if (stage === 'prejoin') {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-8 bg-[#1e1f20] text-white rounded-3xl shadow-2xl border border-[#3c4043] flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Left: Camera Preview Tile */}
        <div className="w-full md:w-3/5 flex flex-col items-center">
          <div className="relative w-full aspect-video bg-[#131314] rounded-2xl overflow-hidden border border-[#3c4043] flex items-center justify-center shadow-inner">
            {isCamOn ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-neutral-400">
                <div className="w-20 h-20 rounded-full bg-[#2a2b2e] flex items-center justify-center text-neutral-300">
                  <VideoCameraSlash weight="fill" className="w-9 h-9 text-neutral-400" />
                </div>
                <p className="text-xs font-medium text-neutral-400">Camera is turned off</p>
              </div>
            )}

            {/* Bottom Floating Mic / Cam Pill */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#202124]/90 backdrop-blur-md px-4 py-2 rounded-full border border-[#3c4043] shadow-lg">
              <button
                type="button"
                onClick={toggleMic}
                className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${
                  isMicOn
                    ? 'bg-[#3c4043] hover:bg-[#4a4e51] text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white ring-2 ring-red-500/40'
                }`}
                title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
              >
                {isMicOn ? <Mic weight="fill" className="w-5 h-5" /> : <MicOff weight="fill" className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={toggleCam}
                className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${
                  isCamOn
                    ? 'bg-[#3c4043] hover:bg-[#4a4e51] text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white ring-2 ring-red-500/40'
                }`}
                title={isCamOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {isCamOn ? <VideoIcon weight="fill" className="w-5 h-5" /> : <VideoCameraSlash weight="fill" className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Meeting Info & Join CTA */}
        <div className="w-full md:w-2/5 flex flex-col justify-center space-y-5 text-center md:text-left">
          <div className="space-y-1.5">
            <Badge className="bg-[#1877f2]/15 text-[#7ab0ff] border-[#1877f2]/30 text-xs font-semibold px-2.5 py-0.5 w-fit mx-auto md:mx-0">
              MurihSpace Meeting Room
            </Badge>
            <h2 className="text-2xl font-black tracking-tight text-white">{roomTitle}</h2>
            <p className="text-xs text-neutral-400">
              HD Audio &amp; Video · Built-in Screen Sharing · Private Conference
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#131314] border border-[#3c4043]/80 space-y-2 text-xs text-neutral-300">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Microphone:</span>
              <span className={isMicOn ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}>
                {isMicOn ? 'Active' : 'Muted'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Camera:</span>
              <span className={isCamOn ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}>
                {isCamOn ? 'Active' : 'Off'}
              </span>
            </div>
          </div>

          {connectionError && (
            <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-left space-y-1 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <WarningCircle weight="fill" className="w-4 h-4 shrink-0" />
                <span>{connectionError.title}</span>
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                {connectionError.message}
              </p>
              {connectionError.suggestion && (
                <p className="text-[10px] text-amber-300/80 leading-relaxed pt-1 border-t border-amber-500/20">
                  Tip: {connectionError.suggestion}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <Button
              onClick={joinConference}
              className="w-full h-12 rounded-full bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-sm shadow-lg shadow-[#1877f2]/25 gap-2 transition-all hover:scale-[1.01]"
            >
              <VideoIcon weight="fill" className="w-4 h-4" />
              Join Meeting Now
            </Button>
            {onLeave && (
              <Button
                variant="ghost"
                onClick={onLeave}
                className="w-full sm:w-auto h-12 rounded-full text-neutral-400 hover:text-white text-xs font-semibold"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── CONNECTING SCREEN ───────────────────────────────────────────────────
  if (stage === 'connecting') {
    return (
      <div className="w-full h-96 bg-[#131314] text-white rounded-3xl flex flex-col items-center justify-center space-y-4 border border-[#3c4043] shadow-2xl">
        <Spinner weight="bold" className="w-10 h-10 animate-spin text-[#1877f2]" />
        <div className="text-center space-y-1">
          <p className="text-base font-bold">Connecting to MurihSpace Conference...</p>
          <p className="text-xs text-neutral-400">Setting up encrypted audio and video stream</p>
        </div>
      </div>
    );
  }

  // ── CONNECTED GOOGLE MEET EXPERIENCE ────────────────────────────────────
  return (
    <div className="relative w-full h-[700px] bg-[#131314] text-white rounded-3xl overflow-hidden border border-[#3c4043] flex flex-col shadow-2xl select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-[#1e1f20]/90 border-b border-[#3c4043]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            IN CALL
          </span>
          <h3 className="font-bold text-sm sm:text-base text-white truncate max-w-xs sm:max-w-md">
            {roomTitle}
          </h3>
          <div className="hidden sm:flex items-center gap-1 text-xs text-neutral-400 bg-[#131314] px-2.5 py-1 rounded-full border border-[#3c4043]">
            <Clock weight="fill" className="w-3.5 h-3.5 text-neutral-400" />
            <span>{formatDuration(callDuration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isHost && (
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs font-semibold">
              Host
            </Badge>
          )}
          <Badge variant="outline" className="text-neutral-300 border-[#3c4043] text-xs">
            <Users weight="fill" className="w-3.5 h-3.5 mr-1 text-[#7ab0ff]" />
            {participants.length} {participants.length === 1 ? 'Person' : 'People'}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="h-8 rounded-full border-[#3c4043] text-neutral-300 hover:text-white text-xs font-semibold gap-1.5"
            title="Copy meeting link to invite others"
          >
            {copiedLink ? <Check weight="bold" className="w-3.5 h-3.5 text-emerald-400" /> : <Copy weight="bold" className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
          </Button>
        </div>
      </div>

      {/* Main Video / Participant Grid */}
      <div
        className="flex-1 p-4 grid gap-4 auto-rows-fr overflow-y-auto"
        style={{
          gridTemplateColumns:
            participants.length <= 1
              ? '1fr'
              : participants.length === 2
                ? 'repeat(auto-fit, minmax(340px, 1fr))'
                : 'repeat(auto-fit, minmax(280px, 1fr))',
        }}
      >
        {participants.map((pState, idx) => {
          const isSpeaking = activeSpeaker === pState.participant.identity;
          const isLocal = pState.participant instanceof LocalParticipant;
          const participantName = isLocal ? 'You' : (pState.participant.name || `Guest #${pState.participant.identity.slice(-4)}`);

          return (
            <div
              key={pState.participant.identity || idx}
              className={`relative bg-[#1e1f20] rounded-2xl overflow-hidden border transition-all flex items-center justify-center ${
                isSpeaking
                  ? 'border-emerald-500 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'border-[#3c4043]'
              }`}
            >
              {pState.videoTrack && (isLocal ? isCamOn : true) ? (
                <ParticipantVideoElement track={pState.videoTrack} isLocal={isLocal} />
              ) : (
                <div className="flex flex-col items-center gap-3 text-neutral-400 p-6 text-center">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-[#1877f2] text-white flex items-center justify-center font-black text-2xl shadow-xl">
                      {participantName.charAt(0).toUpperCase()}
                    </div>
                    {isSpeaking && (
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 ring-2 ring-[#1e1f20] animate-pulse" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-white">{participantName}</p>
                    <span className="text-[11px] text-neutral-400">Camera off</span>
                  </div>
                </div>
              )}

              {/* Participant Name Overlay Badge (Google Meet style) */}
              <div className="absolute bottom-3 left-3 bg-[#202124]/85 backdrop-blur-md px-3 py-1 rounded-full border border-[#3c4043] text-xs font-semibold flex items-center gap-2 text-white">
                <span>{participantName}</span>
                {isSpeaking ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                ) : (
                  !pState.audioTrack && <MicOff weight="fill" className="w-3 h-3 text-red-400" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Control Dock (Google Meet Style) */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#1e1f20]/95 border-t border-[#3c4043]/80 backdrop-blur-md z-10 gap-4">
        {/* Left: Meeting details */}
        <div className="hidden md:flex items-center gap-2 text-xs text-neutral-400">
          <span className="font-semibold text-white truncate max-w-xs">{roomTitle}</span>
          <span>·</span>
          <span>{formatDuration(callDuration)}</span>
        </div>

        {/* Center: Controls Pill */}
        <div className="flex items-center justify-center gap-3 mx-auto">
          {/* Mic */}
          <button
            type="button"
            onClick={toggleMic}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${
              isMicOn
                ? 'bg-[#3c4043] hover:bg-[#4a4e51] text-white'
                : 'bg-red-600 hover:bg-red-700 text-white ring-2 ring-red-500/40'
            }`}
            title={isMicOn ? 'Turn off microphone' : 'Turn on microphone'}
          >
            {isMicOn ? <Mic weight="fill" className="w-5 h-5" /> : <MicOff weight="fill" className="w-5 h-5" />}
          </button>

          {/* Camera */}
          <button
            type="button"
            onClick={toggleCam}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${
              isCamOn
                ? 'bg-[#3c4043] hover:bg-[#4a4e51] text-white'
                : 'bg-red-600 hover:bg-red-700 text-white ring-2 ring-red-500/40'
            }`}
            title={isCamOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {isCamOn ? <VideoIcon weight="fill" className="w-5 h-5" /> : <VideoCameraSlash weight="fill" className="w-5 h-5" />}
          </button>

          {/* Screen share */}
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${
              isScreenSharing
                ? 'bg-[#1877f2] text-white ring-2 ring-[#1877f2]/50'
                : 'bg-[#3c4043] hover:bg-[#4a4e51] text-white'
            }`}
            title={isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}
          >
            <Monitor weight="fill" className="w-5 h-5" />
          </button>

          {/* Raise Hand */}
          <button
            type="button"
            onClick={() => setIsHandRaised(!isHandRaised)}
            className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${
              isHandRaised
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[#3c4043] hover:bg-[#4a4e51] text-white'
            }`}
            title={isHandRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand weight="fill" className="w-5 h-5" />
          </button>

          {/* Leave Call (Red Pill Button) */}
          <button
            type="button"
            onClick={leaveConference}
            className="h-12 px-6 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-red-600/30"
            title="Leave call"
          >
            <PhoneSlash weight="fill" className="w-5 h-5" />
            <span className="hidden sm:inline">End Call</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLink}
            className="text-neutral-300 hover:text-white text-xs font-semibold gap-1.5"
          >
            <Copy weight="bold" className="w-4 h-4" />
            <span>Invite</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

// Subcomponent to attach HTMLMediaElement safely
function ParticipantVideoElement({ track, isLocal }: { track: Track; isLocal?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && track) {
      track.attach(el);
      return () => {
        track.detach(el);
      };
    }
  }, [track]);

  return (
    <video
      ref={ref}
      className={`w-full h-full object-cover ${isLocal ? '-scale-x-100' : ''}`}
      autoPlay
      playsInline
      muted={isLocal}
    />
  );
}

export default LiveKitVideoConference;
