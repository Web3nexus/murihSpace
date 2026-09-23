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
  ChatCircle,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import {
  Room,
  RoomEvent,
  LocalParticipant,
  Track,
  Participant,
  RemoteParticipant,
  DataPacket_Kind,
} from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAuthToken } from '@/lib/auth/token';
import { mapApplicationError } from '@/lib/errorMapper';

// Resolve the API against the environment the web app is served from (same
// origin in production/staging) instead of a hardcoded fallback host.
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ??
  `${window.location.origin}/api/v1`;

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

interface MeetingChatMessage {
  sender: string;
  text: string;
  mine: boolean;
  time: number;
}

interface MeetingEmojiReaction {
  id: number;
  emoji: string;
  dx: number; // 0..100 (%)
  delay: number; // ms
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '🙌', '✋', '👏'];

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

  // In-meeting chat + emoji reactions + raise-hand broadcast
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [reactions, setReactions] = useState<MeetingEmojiReaction[]>([]);
  const [raisedByIdentity, setRaisedByIdentity] = useState<Set<string>>(new Set());
  const [myName, setMyName] = useState('You');

  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const reactionSeq = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Broadcast a JSON payload to every participant in the room over the
  // LiveKit data channel (chat, emoji reactions, raise-hand events).
  const publishData = (payload: Record<string, unknown>) => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      room.localParticipant.publishData(bytes, { reliable: true });
    } catch (e) {
      console.error('[Meeting] publishData error', e);
    }
  };

  const addReaction = (emoji: string) => {
    const id = reactionSeq.current++;
    setReactions((prev) => [...prev.slice(-18), { id, emoji, dx: 8 + Math.random() * 84, delay: Math.random() * 140 }]);
    window.setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2400);
  };

  const handleDataReceived: (payload: Uint8Array, participant?: RemoteParticipant, kind?: DataPacket_Kind) => void = (payload, participant) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
      const from = (data.from as string) || participant?.name || 'Guest';
      switch (data.type) {
        case 'chat':
          setChatMessages((m) => [...m, { sender: from, text: String(data.text ?? ''), mine: false, time: Date.now() }]);
          setUnreadChat((u) => u + 1);
          break;
        case 'reaction':
          addReaction(String(data.emoji ?? '👍'));
          break;
        case 'raise': {
          const identity = participant?.identity ?? '';
          setRaisedByIdentity((prev) => {
            const next = new Set(prev);
            if (data.state === true) next.add(identity);
            else next.delete(identity);
            return next;
          });
          if (data.state === true) addReaction('✋');
          break;
        }
      }
    } catch {
      // Ignore non-JSON / unknown payloads
    }
  };

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
      room.on(RoomEvent.DataReceived, handleDataReceived);
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (speakers.length > 0) setActiveSpeaker(speakers[0].identity);
        else setActiveSpeaker(null);
      });

      await room.connect(host, token);
      roomRef.current = room;

      setMyName(room.localParticipant?.name || 'You');

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

  // Auto-scroll chat to the newest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatOpen]);

  // Reset the unread badge whenever the chat panel is opened
  const toggleChat = () => {
    setChatOpen((v) => !v);
    if (!chatOpen) setUnreadChat(0);
  };

  const sendChatMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    setChatMessages((m) => [...m, { sender: myName, text, mine: true, time: Date.now() }]);
    publishData({ type: 'chat', from: myName, text });
    setChatInput('');
  };

  const sendReaction = (emoji: string) => {
    addReaction(emoji);
    publishData({ type: 'reaction', from: myName, emoji });
  };

  const toggleRaiseHand = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    publishData({ type: 'raise', from: myName, state: next });
    if (next) addReaction('✋');
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
      <style>{`
        @keyframes meeting-emoji-rise {
          0% { opacity: 0; transform: translateY(16px) scale(0.55) rotate(-12deg); }
          12% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-240px) scale(1.2) rotate(14deg); }
        }
        @keyframes meeting-slide-right {
          from { opacity: 0.5; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .meeting-emoji-bubble {
          animation: meeting-emoji-rise 2.3s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        .meeting-slide-right {
          animation: meeting-slide-right 0.2s ease-out forwards;
        }
      `}</style>
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

          <button
            type="button"
            onClick={toggleChat}
            className={`h-8 px-3 rounded-full text-xs font-semibold gap-1.5 flex items-center border transition-colors ${
              chatOpen
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'border-[#3c4043] text-neutral-300 hover:text-white'
            }`}
            title="Open in-meeting chat"
          >
            <ChatCircle weight="bold" className="w-3.5 h-3.5" />
            <span>{chatOpen ? 'Hide Chat' : 'Chat'}</span>
            {unreadChat > 0 && !chatOpen && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950 flex items-center justify-center">
                {unreadChat}
              </span>
            )}
          </button>

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

      {/* Main Video / Participant Grid + Reactions + Chat */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative min-w-0">
          <div
            className="absolute inset-0 p-4 grid gap-4 auto-rows-fr overflow-y-auto"
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
          const raisedHand = isLocal ? isHandRaised : raisedByIdentity.has(pState.participant.identity);

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
                {raisedHand && <span title="Raised hand">✋</span>}
                <span>{participantName}</span>
                {isSpeaking ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                ) : (
                  !pState.audioTrack && <MicOff weight="fill" className="w-3 h-3 text-red-400" />
                )}
              </div>

              {/* Raised-hand badge */}
              {raisedHand && (
                <div className="absolute top-3 right-3 bg-amber-500 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                  <Hand weight="fill" className="w-3 h-3" />
                  HAND UP
                </div>
              )}
            </div>
          );
        })}
          </div>
          {/* Floating emoji reaction overlay (reactions + raise-hand) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
            {reactions.map((r) => (
              <MeetingEmojiBubble key={r.id} emoji={r.emoji} dx={r.dx} delay={r.delay} />
            ))}
          </div>
        </div>

        {/* In-meeting Chat Panel */}
        {chatOpen && (
          <div className="w-80 shrink-0 border-l border-[#3c4043]/80 bg-[#1e1f20] flex flex-col min-h-0 meeting-slide-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c4043]/60">
              <div className="flex items-center gap-2 text-white text-sm font-bold">
                <ChatCircle weight="fill" className="w-4 h-4 text-emerald-400" />
                In-Meeting Chat
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="h-7 w-7 rounded-full text-neutral-400 hover:text-white hover:bg-[#3c4043] flex items-center justify-center transition-colors"
                title="Close chat"
              >
                ✕
              </button>
            </div>

            <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {chatMessages.length === 0 && (
                <p className="text-center text-[11px] text-neutral-500 pt-8">
                  No messages yet. Say hello! 👋
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-xs ${
                    msg.mine ? 'bg-[#1877f2] text-white' : 'bg-[#3c4043] text-neutral-100'
                  }`}>
                    {!msg.mine && <div className="text-[10px] font-bold text-emerald-300 mb-0.5">{msg.sender}</div>}
                    <div className="leading-snug">{msg.text}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick emoji reactions */}
            <div className="px-3 pt-2 flex items-center gap-1.5 flex-wrap">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  className="h-8 w-8 rounded-lg bg-[#3c4043] hover:bg-[#4a4e51] transition-colors text-[15px]"
                  title={`Send ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <form onSubmit={sendChatMessage} className="p-3 flex items-center gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 h-9 bg-[#3c4043] border border-[#3c4043] focus:border-[#1877f2] rounded-full px-3 text-xs text-white outline-none placeholder:text-neutral-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="h-9 w-9 rounded-full bg-[#1877f2] text-white flex items-center justify-center disabled:opacity-40 transition-colors hover:bg-[#166fe5]"
                title="Send message"
              >
                <PaperPlaneTilt weight="fill" className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
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
            onClick={toggleRaiseHand}
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

// Floating emoji particle used for reactions and raise-hand animations
function MeetingEmojiBubble({ emoji, dx, delay }: { emoji: string; dx: number; delay: number }) {
  return (
    <span
      className="meeting-emoji-bubble absolute bottom-20 select-none pointer-events-none"
      style={{ left: `${dx}%`, animationDelay: `${delay}ms`, fontSize: '2rem', lineHeight: 1 }}
    >
      {emoji}
    </span>
  );
}

export default LiveKitVideoConference;
