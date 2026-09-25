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
  ArrowsClockwise,
  ShieldCheck,
  UserCircle,
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
import { env } from '@/config/env';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { authFetch } from '@/lib/api/authFetch';
import { mapApplicationError } from '@/lib/errorMapper';
import { useAuth } from '@/hooks/useAuth';

// Resolve the API against the environment the web app is served from (same
// origin in production/staging) instead of a hardcoded fallback host.
const API_BASE = env.VITE_API_BASE_URL;

interface Props {
  roomId?: number;
  tokenEndpoint?: string;
  directToken?: { token: string; host: string; room?: string };
  roomTitle?: string;
  isHost?: boolean;
  isPublisher?: boolean;
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
  isPublisher = true,
  meetingCode,
  onLeave,
  onError,
}: Props) {
  const { user } = useAuth();
  const [stage, setStage] = useState<'prejoin' | 'connecting' | 'connected'>('prejoin');
  const [isMicOn, setIsMicOn] = useState(isPublisher);
  const [isCamOn, setIsCamOn] = useState(isPublisher);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [participants, setParticipants] = useState<ParticipantTrackState[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<{ title: string; message: string; suggestion?: string } | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // In-meeting chat + emoji reactions + raise-hand broadcast
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [reactions, setReactions] = useState<MeetingEmojiReaction[]>([]);
  const [raisedByIdentity, setRaisedByIdentity] = useState<Set<string>>(new Set());
  const [myName, setMyName] = useState(user?.name || 'You');

  const roomRef = useRef<Room | null>(null);
  const mountedRef = useRef(true);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
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
    if (stage === 'prejoin' && isPublisher) {
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
    } else {
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    }
    return () => {
      active = false;
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = null;
      }
    };
  }, [stage, isCamOn, isPublisher]);

  // Pre-join audio level visualizer (Web Audio API)
  useEffect(() => {
    let animId: number;
    let localStream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;

    if (stage === 'prejoin' && isMicOn && isPublisher) {
      navigator.mediaDevices
        ?.getUserMedia({ audio: true, video: false })
        .then((stream) => {
          localStream = stream;
          audioStreamRef.current = stream;
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (!AudioContextClass) return;
          audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const checkVolume = () => {
            if (!analyser) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animId = requestAnimationFrame(checkVolume);
          };
          checkVolume();
        })
        .catch(() => {
          setAudioLevel(0);
        });
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
      audioStreamRef.current = null;
      audioContextRef.current = null;
      setAudioLevel(0);
    };
  }, [stage, isMicOn, isPublisher]);

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

    // Stop pre-join preview streams so LiveKit can take the device cleanly
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setStage('connecting');
    let createdRoom: Room | null = null;
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

        const res = await authFetch(endpoint);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message ?? json.error ?? 'Failed to issue LiveKit token.');
        }

        const data = (json && typeof json === 'object' && 'data' in json && json.data) ? json.data : json;
        token = data?.token ?? json?.token ?? data?.livekit_token ?? json?.livekit_token;
        host = data?.host ?? json?.host;
      }

      if (!token || !host) {
        throw new Error('Video meeting host or authorization token was not returned by the server. Please try again.');
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720, frameRate: 30 },
        },
      });
      createdRoom = room;

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
      if (!mountedRef.current) {
        await room.disconnect().catch(() => undefined);
        return;
      }
      roomRef.current = room;

      setMyName(room.localParticipant?.name || user?.name || 'You');

      if (isPublisher) {
        await room.localParticipant.setMicrophoneEnabled(isMicOn);
        await room.localParticipant.setCameraEnabled(isCamOn);
      } else {
        await room.localParticipant.setMicrophoneEnabled(false);
        await room.localParticipant.setCameraEnabled(false);
      }

      if (!mountedRef.current) {
        return;
      }
      setStage('connected');
      updateParticipantsState();
    } catch (err: unknown) {
      if (createdRoom) {
        await createdRoom.disconnect().catch(() => undefined);
      }
      if (roomRef.current === createdRoom) {
        roomRef.current = null;
      }
      const rawMsg = err instanceof Error ? err.message : 'Connection error';
      const mapped = mapApplicationError(err);
      if (mountedRef.current) {
        setConnectionError({
          title: mapped.title,
          message: mapped.description,
          suggestion: mapped.suggestion,
        });
        onError?.(rawMsg);
        setStage('prejoin');
      }
    }
  };

  const leaveConference = () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      void room.disconnect().catch(() => undefined);
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
    if (!isPublisher) return;
    if (!roomRef.current?.localParticipant) {
      setIsMicOn(!isMicOn);
      return;
    }
    const nextState = !isMicOn;
    await roomRef.current.localParticipant.setMicrophoneEnabled(nextState);
    setIsMicOn(nextState);
  };

  const toggleCam = async () => {
    if (!isPublisher) return;
    if (!roomRef.current?.localParticipant) {
      setIsCamOn(!isCamOn);
      return;
    }
    const nextState = !isCamOn;
    await roomRef.current.localParticipant.setCameraEnabled(nextState);
    setIsCamOn(nextState);
  };

  const toggleScreenShare = async () => {
    if (!isPublisher || !roomRef.current?.localParticipant) return;
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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const room = roomRef.current;
      roomRef.current = null;
      if (room) {
        void room.disconnect().catch(() => undefined);
      }
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // ── PRE-JOIN SCREEN (Theme-Conscious Conference Lobby) ─────────────────
  if (stage === 'prejoin') {
    return (
      <div className="w-full max-w-4xl mx-auto p-5 sm:p-8 bg-card text-card-foreground rounded-3xl shadow-xl border border-border flex flex-col md:flex-row items-center justify-between gap-8 transition-colors">
        {/* Left: Camera Preview Viewfinder */}
        <div className="w-full md:w-3/5 flex flex-col items-center">
          <div className="relative w-full aspect-video bg-neutral-950 rounded-2xl overflow-hidden border border-border/80 flex items-center justify-center shadow-inner">
            {isCamOn ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-neutral-300 p-6 text-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-primary/20 text-primary-foreground flex items-center justify-center font-bold text-2xl shadow-md ring-4 ring-neutral-800">
                    {user?.name?.charAt(0).toUpperCase() || <UserCircle weight="fill" className="w-12 h-12" />}
                  </div>
                  <span className="absolute -bottom-1 -right-1 p-1 bg-destructive rounded-full text-destructive-foreground shadow-sm">
                    <VideoCameraSlash weight="fill" className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-neutral-200">Camera is turned off</p>
                  <p className="text-[11px] text-neutral-400">Your video will remain off when you enter the call</p>
                </div>
              </div>
            )}

            {/* Top-Left Audio Level & Status Indicator */}
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-background/85 dark:bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-border/80 text-xs shadow-sm text-foreground">
              {isMicOn ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-end gap-0.5 h-3">
                    {[0.2, 0.4, 0.7, 1.0].map((threshold, i) => (
                      <span
                        key={i}
                        className={`w-1 rounded-full transition-all duration-75 ${
                          audioLevel > threshold * 15 ? 'bg-emerald-500 h-3' : 'bg-muted-foreground/30 h-1'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Mic Active</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MicOff weight="fill" className="w-3.5 h-3.5 text-destructive" />
                  <span className="text-[11px] text-destructive font-semibold">Muted</span>
                </div>
              )}
            </div>

            {isPublisher && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-background/90 dark:bg-neutral-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-border/80 shadow-lg">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${
                    isMicOn
                      ? 'bg-muted hover:bg-muted/80 text-foreground dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-white ring-2 ring-emerald-500/30'
                      : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground ring-2 ring-destructive/40'
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
                      ? 'bg-muted hover:bg-muted/80 text-foreground dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-white'
                      : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground ring-2 ring-destructive/40'
                  }`}
                  title={isCamOn ? 'Turn off camera' : 'Turn on camera'}
                >
                  {isCamOn ? <VideoIcon weight="fill" className="w-5 h-5" /> : <VideoCameraSlash weight="fill" className="w-5 h-5" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Meeting Info & Join CTA */}
        <div className="w-full md:w-2/5 flex flex-col justify-center space-y-4 text-center md:text-left">
          {/* User Preview Pill */}
          {user && (
            <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-muted/50 border border-border/80 text-left">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 overflow-hidden text-xs">
                {user.avatar || user.avatar_url ? (
                  <img src={user.avatar || user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  user.name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-foreground truncate">{user.name}</p>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize bg-background text-muted-foreground border-border">
                    {user.role}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {user.username ? `@${user.username}` : user.email}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold px-2.5 py-0.5">
                MurihSpace Meeting
              </Badge>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck weight="fill" className="w-3.5 h-3.5 text-emerald-500" />
                Encrypted Room
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">{roomTitle}</h2>
            <p className="text-xs text-muted-foreground">
              HD Audio &amp; Video · Built-in Screen Sharing · Live Chat
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-2 text-xs text-foreground">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Microphone:</span>
              <span className={isMicOn ? 'text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1' : 'text-muted-foreground'}>
                {isMicOn ? 'Active (Ready)' : 'Muted'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Camera:</span>
              <span className={isCamOn ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-muted-foreground'}>
                {isCamOn ? 'Active (HD Ready)' : 'Off'}
              </span>
            </div>
          </div>

          {connectionError && (
            <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-left space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-bold text-xs">
                <WarningCircle weight="fill" className="w-4 h-4 shrink-0" />
                <span>{connectionError.title}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-destructive/90">
                {connectionError.message}
              </p>
              {connectionError.suggestion && (
                <p className="text-[10px] leading-relaxed pt-1 border-t border-destructive/20 text-destructive/80">
                  Tip: {connectionError.suggestion}
                </p>
              )}
              <Button
                size="sm"
                onClick={joinConference}
                className="w-full h-8 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-xs gap-1.5"
              >
                <ArrowsClockwise weight="bold" className="w-3.5 h-3.5" />
                Retry Connection
              </Button>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <Button
              onClick={joinConference}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-md gap-2 transition-all hover:scale-[1.01]"
            >
              <VideoIcon weight="fill" className="w-4 h-4" />
              Join Meeting Now
            </Button>

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="flex-1 h-10 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold gap-1.5 transition-colors"
              >
                {copiedLink ? <Check weight="bold" className="w-3.5 h-3.5 text-emerald-500" /> : <Copy weight="bold" className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
              </Button>

              {onLeave && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLeave}
                  className="flex-1 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-semibold transition-colors"
                >
                  Back to Hub
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── CONNECTING SCREEN ───────────────────────────────────────────────────
  if (stage === 'connecting') {
    return (
      <div className="w-full max-w-lg mx-auto py-16 px-6 bg-card text-card-foreground rounded-3xl flex flex-col items-center justify-center space-y-4 border border-border shadow-xl">
        <Spinner weight="bold" className="w-10 h-10 animate-spin text-primary" />
        <div className="text-center space-y-1">
          <p className="text-base font-bold text-foreground">Connecting to Meeting Room...</p>
          <p className="text-xs text-muted-foreground">Establishing encrypted audio and video stream</p>
        </div>
        {meetingCode && (
          <span className="font-mono text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground border border-border">
            {meetingCode}
          </span>
        )}
      </div>
    );
  }

  // ── CONNECTED CONFERENCE EXPERIENCE ─────────────────────────────────────
  return (
    <div className="relative w-full h-[720px] bg-card text-card-foreground rounded-3xl overflow-hidden border border-border flex flex-col shadow-xl select-none transition-colors">
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
      <div className="flex items-center justify-between px-6 py-3.5 bg-card/95 border-b border-border backdrop-blur-md z-10 text-foreground">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            IN CALL
          </span>
          <h3 className="font-bold text-sm sm:text-base text-foreground truncate max-w-xs sm:max-w-md">
            {roomTitle}
          </h3>
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border">
            <Clock weight="fill" className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{formatDuration(callDuration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isHost && (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs font-semibold">
              Host
            </Badge>
          )}
          <Badge variant="outline" className="text-foreground border-border text-xs bg-card">
            <Users weight="fill" className="w-3.5 h-3.5 mr-1 text-primary" />
            {participants.length} {participants.length === 1 ? 'Person' : 'People'}
          </Badge>

          <button
            type="button"
            onClick={toggleChat}
            className={`h-8 px-3 rounded-full text-xs font-semibold gap-1.5 flex items-center border transition-colors ${
              chatOpen
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title="Open in-meeting chat"
          >
            <ChatCircle weight="bold" className="w-3.5 h-3.5" />
            <span>{chatOpen ? 'Hide Chat' : 'Chat'}</span>
            {unreadChat > 0 && !chatOpen && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-white flex items-center justify-center">
                {unreadChat}
              </span>
            )}
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="h-8 rounded-full border-border text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-semibold gap-1.5"
            title="Copy meeting link to invite others"
          >
            {copiedLink ? <Check weight="bold" className="w-3.5 h-3.5 text-emerald-500" /> : <Copy weight="bold" className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
          </Button>
        </div>
      </div>

      {/* Main Video / Participant Grid + Reactions + Chat */}
      <div className="flex-1 flex min-h-0 bg-neutral-950">
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
              className={`relative bg-neutral-900 rounded-2xl overflow-hidden border transition-all flex items-center justify-center ${
                isSpeaking
                  ? 'border-emerald-500 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20'
                  : 'border-neutral-800'
              }`}
            >
              {pState.videoTrack && (isLocal ? isCamOn : true) ? (
                <ParticipantVideoElement track={pState.videoTrack} isLocal={isLocal} />
              ) : (
                <div className="flex flex-col items-center gap-3 text-neutral-400 p-6 text-center">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-primary/20 text-white flex items-center justify-center font-black text-2xl shadow-xl">
                      {participantName.charAt(0).toUpperCase()}
                    </div>
                    {isSpeaking && (
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 ring-2 ring-neutral-900 animate-pulse" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-white">{participantName}</p>
                    <span className="text-[11px] text-neutral-400">Camera off</span>
                  </div>
                </div>
              )}

              {/* Participant Name Overlay Badge */}
              <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-xs font-semibold flex items-center gap-2 text-white">
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
          <div className="w-80 shrink-0 border-l border-border bg-card text-card-foreground flex flex-col min-h-0 meeting-slide-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 text-foreground text-sm font-bold">
                <ChatCircle weight="fill" className="w-4 h-4 text-emerald-500" />
                In-Meeting Chat
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                title="Close chat"
              >
                ✕
              </button>
            </div>

            <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {chatMessages.length === 0 && (
                <p className="text-center text-[11px] text-muted-foreground pt-8">
                  No messages yet. Say hello! 👋
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-xs ${
                    msg.mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground border border-border/50'
                  }`}>
                    {!msg.mine && <div className="text-[10px] font-bold text-primary mb-0.5">{msg.sender}</div>}
                    <div className="leading-snug">{msg.text}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick emoji reactions */}
            <div className="px-3 pt-2 flex items-center gap-1.5 flex-wrap border-t border-border/50">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  className="h-8 w-8 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-[15px] border border-border/40"
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
                className="flex-1 h-9 bg-muted/60 border border-border focus:border-primary rounded-full px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-colors hover:bg-primary/90"
                title="Send message"
              >
                <PaperPlaneTilt weight="fill" className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Floating Bottom Control Dock */}
      <div className="flex items-center justify-between px-6 py-4 bg-card/95 border-t border-border backdrop-blur-md z-10 gap-4 text-foreground">
        {/* Left: Meeting details */}
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground truncate max-w-xs">{roomTitle}</span>
          <span>·</span>
          <span>{formatDuration(callDuration)}</span>
        </div>

        {/* Center: Controls Pill */}
        <div className="flex items-center justify-center gap-3 mx-auto">
          {isPublisher && (
            <>
              <button
                type="button"
                onClick={toggleMic}
                className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${
                  isMicOn
                    ? 'bg-muted hover:bg-muted/80 text-foreground border border-border/60'
                    : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground ring-2 ring-destructive/40'
                }`}
                title={isMicOn ? 'Turn off microphone' : 'Turn on microphone'}
              >
                {isMicOn ? <Mic weight="fill" className="w-5 h-5" /> : <MicOff weight="fill" className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={toggleCam}
                className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${
                  isCamOn
                    ? 'bg-muted hover:bg-muted/80 text-foreground border border-border/60'
                    : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground ring-2 ring-destructive/40'
                }`}
                title={isCamOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {isCamOn ? <VideoIcon weight="fill" className="w-5 h-5" /> : <VideoCameraSlash weight="fill" className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={toggleScreenShare}
                className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${
                  isScreenSharing
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/40'
                    : 'bg-muted hover:bg-muted/80 text-foreground border border-border/60'
                }`}
                title={isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}
              >
                <Monitor weight="fill" className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Raise Hand */}
          <button
            type="button"
            onClick={toggleRaiseHand}
            className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${
              isHandRaised
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-muted hover:bg-muted/80 text-foreground border border-border/60'
            }`}
            title={isHandRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand weight="fill" className="w-5 h-5" />
          </button>

          {/* Leave Call */}
          <button
            type="button"
            onClick={leaveConference}
            className="h-11 px-5 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-xs flex items-center gap-2 transition-all hover:scale-[1.02] shadow-md"
            title="Leave call"
          >
            <PhoneSlash weight="fill" className="w-4 h-4" />
            <span className="hidden sm:inline">End Call</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLink}
            className="text-muted-foreground hover:text-foreground text-xs font-semibold gap-1.5"
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
    >
      <track
        kind="captions"
        src="data:text/vtt,WEBVTT%0A%0A"
        srcLang="en"
        label="Captions"
      />
    </video>
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
