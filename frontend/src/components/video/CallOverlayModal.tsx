import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Phone,
  PhoneSlash,
  Microphone as Mic,
  MicrophoneSlash as MicOff,
  VideoCamera as Video,
  VideoCameraSlash,
  ChatTeardropText as MessageSquare,
  Spinner,
  Monitor,
  UserPlus,
  X,
  MagnifyingGlass as Search,
  DotsThree,
  CaretDown,
  ArrowsLeftRight,
  CornersOut,
} from "@phosphor-icons/react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  Participant,
  ConnectionState,
  AudioPresets,
} from 'livekit-client';
import { startOutgoingRingback, startIncomingRingtone, stopCallSounds } from '@/lib/sound';
import { getEcho } from '@/lib/echo';
import { getAuthToken } from '@/lib/auth/token';
import { useAuth } from '@/hooks/useAuth';

function RemoteVideoTrackElement({ track, muted = false }: { track: Track; muted?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el && track) {
      track.attach(el);
      return () => {
        try {
          track.detach(el);
        } catch (_) {}
      };
    }
  }, [track]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className="w-full h-full object-cover transition-opacity duration-300 pointer-events-none"
    />
  );
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'https://api-staging.murihspace.com/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type WebCallState =
  | 'idle'
  | 'outgoing'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ending'
  | 'ended'
  | 'connection_failed';

export type CallType = 'audio' | 'video';

interface CallReactionItem {
  id: string;
  emoji: string;
  x: number;
}

interface CallOverlayModalProps {
  isOpen: boolean;
  callId?: number;
  callType?: CallType;
  callMode?: 'outgoing' | 'incoming' | 'connected';
  contactName?: string;
  contactAvatar?: string;
  roomName?: string;
  livekitToken?: string;
  livekitHost?: string;
  onClose: () => void;
  onAnswer?: () => void;
  onOpenChat?: () => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
}

const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '🔥', '👏', '🎉'];

export const CallOverlayModal: React.FC<CallOverlayModalProps> = ({
  isOpen,
  callId,
  callType = 'video',
  callMode: initialMode = 'outgoing',
  contactName = 'Contact',
  contactAvatar,
  roomName: initialRoomName,
  livekitToken: initialToken,
  livekitHost: initialHost,
  onClose,
  onAnswer,
  onOpenChat,
  onMinimize,
  isMinimized = false,
}) => {
  // Explicit Call State Machine
  const [callState, setCallState] = useState<WebCallState>(
    initialMode === 'connected' ? 'connected' : initialMode === 'incoming' ? 'ringing' : 'outgoing'
  );

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === 'video');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  // Handlers registered inside the connect effect close over the render they
  // were created in, so anything that must be current reads from this ref.
  const durationRef = useRef(0);
  useEffect(() => {
    durationRef.current = durationSeconds;
  }, [durationSeconds]);

  // Video track & presentation state
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<RemoteTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<Track | null>(null);
  const [isSwapped, setIsSwapped] = useState(false);
  const [isPipExpanded, setIsPipExpanded] = useState(false);
  const [pipPos, setPipPos] = useState({ x: 20, y: 80 });
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);

  // More menu & Reactions
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [reactions, setReactions] = useState<CallReactionItem[]>([]);

  // Room credentials
  const [activeToken, setActiveToken] = useState<string | undefined>(initialToken);
  const [activeHost, setActiveHost] = useState<string | undefined>(initialHost);
  const [activeRoomName, setActiveRoomName] = useState<string | undefined>(initialRoomName);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const attachedAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAnsweringRef = useRef(false);

  // Participants & Add User
  const [remoteParticipants, setRemoteParticipants] = useState<Participant[]>([]);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [participantSearchQuery, setParticipantSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [invitingUserIds, setInvitingUserIds] = useState<Record<number, boolean>>({});
  const [invitedUserIds, setInvitedUserIds] = useState<Record<number, boolean>>({});
  const [inviteFeedback, setInviteFeedback] = useState<{ message: string; isError?: boolean } | null>(null);

  const handleSearchParticipants = async (query: string) => {
    setParticipantSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearchingUsers(true);
    try {
      const res = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const raw = await res.json();
        const users = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
        setSearchResults(users);
      }
    } catch (_) {
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const handleInviteUser = async (userId: number) => {
    if (!callId) return;
    setInvitingUserIds((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`${API_BASE}/calls/${callId}/invite`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        setInvitedUserIds((prev) => ({ ...prev, [userId]: true }));
        setInviteFeedback({ message: 'Invitation sent!' });
      } else {
        setInviteFeedback({ message: 'Failed to send invite', isError: true });
      }
    } catch (_) {
      setInviteFeedback({ message: 'Network error', isError: true });
    } finally {
      setInvitingUserIds((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const { user } = useAuth();

  // Sync props when new token/host arrive
  useEffect(() => {
    if (initialToken) setActiveToken(initialToken);
    if (initialHost) setActiveHost(initialHost);
    if (initialRoomName) setActiveRoomName(initialRoomName);
  }, [initialToken, initialHost, initialRoomName]);

  // Trigger floating reaction animation
  const triggerReaction = useCallback((emoji: string, broadcast = true) => {
    const item: CallReactionItem = {
      id: `${Date.now()}_${Math.random()}`,
      emoji,
      x: 65 + Math.random() * 20,
    };
    setReactions((prev) => [...prev, item]);

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== item.id));
    }, 2200);

    if (broadcast && roomRef.current && roomRef.current.state === ConnectionState.Connected) {
      try {
        const payload = new TextEncoder().encode(JSON.stringify({ type: 'reaction', emoji }));
        roomRef.current.localParticipant.publishData(payload);
      } catch (_) {}
    }
  }, []);

  // Manage call audio ringtone & ringback sounds
  useEffect(() => {
    if (!isOpen || isMinimized) {
      stopCallSounds();
      return;
    }

    if (callState === 'ringing' && initialMode === 'incoming') {
      startIncomingRingtone();
    } else if (callState === 'outgoing' || callState === 'ringing') {
      // An outgoing call must keep ringing back after the callee's device
      // starts ringing, or the caller hears silence until it is answered.
      startOutgoingRingback();
    } else {
      stopCallSounds();
    }

    return () => {
      stopCallSounds();
    };
  }, [isOpen, isMinimized, callState, initialMode]);

  // Duration timer: runs steadily while in connected state
  useEffect(() => {
    if (callState === 'connected') {
      const updateDuration = () => {
        if (startedAt) {
          const startTime = new Date(startedAt).getTime();
          const diff = Math.floor((Date.now() - startTime) / 1000);
          if (diff >= 0 && diff < 86400) {
            setDurationSeconds(diff);
            return;
          }
        }
        setDurationSeconds((s) => s + 1);
      };

      updateDuration();
      durationTimerRef.current = setInterval(updateDuration, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      if (callState !== 'reconnecting') {
        setDurationSeconds(0);
      }
    }

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [callState, startedAt]);

  // 45-second timeout for unanswered calls
  useEffect(() => {
    if (!isOpen || callState === 'connected' || callState === 'connecting') return;

    const ringTimeout = setTimeout(() => {
      if (isAnsweringRef.current) return;
      stopCallSounds();
      setCallState('connection_failed');
      if (callId) {
        fetch(`${API_BASE}/calls/${callId}/end`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ duration_seconds: 0 }),
        }).catch(() => {});
      }
      setTimeout(() => {
        cleanupAndDisconnect();
        onClose();
      }, 1800);
    }, 45000);

    return () => clearTimeout(ringTimeout);
  }, [isOpen, callState, callId, onClose]);

  // Listen to call events via Echo
  useEffect(() => {
    if (!isOpen || !callId) return;

    let echo: any;
    try {
      echo = getEcho();
    } catch {
      return;
    }

    const channelName = activeRoomName ? `call.${activeRoomName}` : null;
    const callChannel = channelName ? echo.private(channelName) : null;
    const userChannel = user?.id ? echo.private(`user.${user.id}`) : null;
    const appUserChannel = user?.id ? echo.private(`App.Models.User.${user.id}`) : null;

    const handleCallRinging = (raw?: any) => {
      const data = raw?.call || raw?.data?.call || raw?.data || raw;
      const id = data?.id || raw?.id;
      if (id && callId && Number(id) !== Number(callId)) return;
      if (callState === 'outgoing') {
        setCallState('ringing');
      }
    };

    const handleCallAccepted = (raw: any) => {
      const data = raw?.call || raw?.data?.call || raw?.data || raw;
      const id = data?.id || raw?.id;
      if (id && callId && Number(id) !== Number(callId)) return;
      stopCallSounds();
      const startedAtTime = data?.started_at || raw?.started_at || raw?.call?.started_at;
      if (startedAtTime) setStartedAt(startedAtTime);

      const token = data?.livekit_token || raw?.livekit_token;
      const host = data?.livekit_host || raw?.livekit_host;
      const room = data?.room_name || raw?.room_name;
      if (token) setActiveToken(token);
      if (host) setActiveHost(host);
      if (room) setActiveRoomName(room);

      // Explicit transition to CONNECTING state (never flash Disconnected)
      setCallState('connecting');
    };

    const handleCallDeclined = (raw?: any) => {
      const data = raw?.call || raw?.data?.call || raw?.data || raw;
      const id = data?.id || raw?.id;
      if (id && callId && Number(id) !== Number(callId)) return;
      stopCallSounds();
      setCallState('ended');
      setTimeout(() => {
        cleanupAndDisconnect();
        onClose();
      }, 1500);
    };

    const handleCallEnded = (raw?: any) => {
      const data = raw?.call || raw?.data?.call || raw?.data || raw;
      const id = data?.id || raw?.id;
      if (id && callId && Number(id) !== Number(callId)) return;
      stopCallSounds();
      setCallState('ended');
      setTimeout(() => {
        cleanupAndDisconnect();
        onClose();
      }, 1200);
    };

    [callChannel, userChannel, appUserChannel].forEach((channel) => {
      if (!channel) return;
      channel.listen('.call.ringing', handleCallRinging);
      channel.listen('CallRinging', handleCallRinging);
      channel.listen('.call.accepted', handleCallAccepted);
      channel.listen('.call.declined', handleCallDeclined);
      channel.listen('.call.ended', handleCallEnded);
      channel.listen('CallAccepted', handleCallAccepted);
      channel.listen('CallDeclined', handleCallDeclined);
      channel.listen('CallEnded', handleCallEnded);
    });

    return () => {
      [callChannel, userChannel, appUserChannel].forEach((channel) => {
        if (!channel) return;
        channel.stopListening('.call.ringing', handleCallRinging);
        channel.stopListening('CallRinging', handleCallRinging);
        channel.stopListening('.call.accepted', handleCallAccepted);
        channel.stopListening('.call.declined', handleCallDeclined);
        channel.stopListening('.call.ended', handleCallEnded);
        channel.stopListening('CallAccepted', handleCallAccepted);
        channel.stopListening('CallDeclined', handleCallDeclined);
        channel.stopListening('CallEnded', handleCallEnded);
      });
    };
  }, [isOpen, callId, activeRoomName, user?.id, callState, onClose]);

  // Connect to LiveKit Room once token & host are present and in connecting state
  useEffect(() => {
    if (!isOpen) return;
    if (callState !== 'connecting' && callState !== 'connected') return;
    if (!activeToken) return;
    if (roomRef.current && roomRef.current.state === ConnectionState.Connected) return;

    let isCancelled = false;
    let room: Room;

    const connectLiveKit = async () => {
      try {
        let hostUrl = activeHost || 'wss://livekit.murihspace.com';
        if (!hostUrl.startsWith('ws://') && !hostUrl.startsWith('wss://')) {
          hostUrl = `wss://${hostUrl}`;
        }

        room = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
          },
          publishDefaults: {
            dtx: true,
            audioPreset: AudioPresets.speech,
          },
          videoCaptureDefaults: {
            resolution: { width: 1280, height: 720, frameRate: 30 },
          },
        });
        roomRef.current = room;

        room.on(RoomEvent.Connected, () => {
          if (!isCancelled) {
            setCallState('connected');
          }
        });

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          if (state === ConnectionState.Reconnecting) {
            setCallState('reconnecting');
          } else if (state === ConnectionState.Connected) {
            setCallState('connected');
          }
        });

        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Video) {
            setRemoteVideoTrack(track);
          } else if (track.kind === Track.Kind.Audio) {
            const audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            track.attach(audioEl);
            if (track.sid) {
              attachedAudioElementsRef.current.set(track.sid, audioEl);
            }
          }
          setRemoteParticipants(Array.from(room.remoteParticipants.values()));
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Video) {
            setRemoteVideoTrack(null);
          } else if (track.kind === Track.Kind.Audio) {
            if (track.sid) {
              const el = attachedAudioElementsRef.current.get(track.sid);
              if (el) {
                track.detach(el);
                el.remove();
                attachedAudioElementsRef.current.delete(track.sid);
              }
            }
          }
          setRemoteParticipants(Array.from(room.remoteParticipants.values()));
        });

        room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
          try {
            const str = new TextDecoder().decode(payload);
            const data = JSON.parse(str);
            if (data?.type === 'reaction' && data.emoji) {
              triggerReaction(data.emoji, false);
            }
          } catch (_) {}
        });

        room.on(RoomEvent.ParticipantConnected, () => {
          setRemoteParticipants(Array.from(room.remoteParticipants.values()));
        });

        room.on(RoomEvent.ParticipantDisconnected, () => {
          setRemoteParticipants(Array.from(room.remoteParticipants.values()));
          if (room.remoteParticipants.size === 0) {
            setTimeout(() => {
              if (room.remoteParticipants.size === 0 && room.state === ConnectionState.Connected) {
                handleEndCall();
              }
            }, 6000);
          }
        });

        await room.connect(hostUrl, activeToken);

        try {
          await room.startAudio();
        } catch (_) {}

        // Enable microphone
        await room.localParticipant.setMicrophoneEnabled(true);

        // Enable video if video call
        if (callType === 'video' && isVideoOn) {
          await room.localParticipant.setCameraEnabled(true);
          const localPub = room.localParticipant.videoTrackPublications.values().next().value;
          if (localPub?.track) {
            setLocalVideoTrack(localPub.track);
            if (localVideoRef.current) {
              localPub.track.attach(localVideoRef.current);
            }
          }
        }

        if (!isCancelled) {
          setCallState('connected');
        }
      } catch (err) {
        console.warn('[LiveKit] Connection error:', err);
        if (!isCancelled) {
          setCallState('connection_failed');
          setTimeout(() => {
            cleanupAndDisconnect();
            onClose();
          }, 2500);
        }
      }
    };

    connectLiveKit();

    return () => {
      isCancelled = true;
      // CRITICAL: Do NOT disconnect room here!
      // The room connection must remain alive when modal minimizes or switches views.
    };
  }, [isOpen, callState, activeToken, activeHost, callType, isVideoOn, onClose, triggerReaction]);

  const cleanupAndDisconnect = useCallback(() => {
    stopCallSounds();
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (_) {}
      roomRef.current = null;
    }
    attachedAudioElementsRef.current.forEach((el) => {
      el.remove();
    });
    attachedAudioElementsRef.current.clear();
  }, []);

  const handleEndCall = () => {
    stopCallSounds();
    setCallState('ending');
    if (callId) {
      fetch(`${API_BASE}/calls/${callId}/end`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ duration_seconds: durationRef.current }),
      }).catch(() => {});
    }
    setTimeout(() => {
      setCallState('ended');
      cleanupAndDisconnect();
      onClose();
    }, 400);
  };

  const handleDeclineCall = () => {
    stopCallSounds();
    setCallState('ended');
    if (callId) {
      fetch(`${API_BASE}/calls/${callId}/decline`, {
        method: 'POST',
        headers: getAuthHeaders(),
      }).catch(() => {});
    }
    setTimeout(() => {
      cleanupAndDisconnect();
      onClose();
    }, 400);
  };

  const handleAnswerCall = async () => {
    isAnsweringRef.current = true;
    stopCallSounds();
    setCallState('connecting');
    onAnswer?.();

    if (callId) {
      try {
        const res = await fetch(`${API_BASE}/calls/${callId}/accept`, {
          method: 'POST',
          headers: getAuthHeaders(),
        });
        const raw = await res.json();
        const data = raw?.data ?? raw;
        if (data.livekit_token) setActiveToken(data.livekit_token);
        if (data.livekit_host) setActiveHost(data.livekit_host);
      } catch (_) {}
    }
  };

  const toggleMute = async () => {
    const next = !isMuted;
    setIsMuted(next);
    if (roomRef.current?.localParticipant) {
      try {
        await roomRef.current.localParticipant.setMicrophoneEnabled(!next);
      } catch (_) {}
    }
  };

  const toggleVideo = async () => {
    const next = !isVideoOn;
    setIsVideoOn(next);
    if (roomRef.current?.localParticipant) {
      try {
        await roomRef.current.localParticipant.setCameraEnabled(next);
        if (next) {
          const pub = roomRef.current.localParticipant.videoTrackPublications.values().next().value;
          if (pub?.track) {
            setLocalVideoTrack(pub.track);
            if (localVideoRef.current) pub.track.attach(localVideoRef.current);
          }
        } else {
          setLocalVideoTrack(null);
        }
      } catch (_) {}
    }
  };

  const toggleScreenShare = async () => {
    const next = !isScreenSharing;
    setIsScreenSharing(next);
    if (roomRef.current?.localParticipant) {
      try {
        await roomRef.current.localParticipant.setScreenShareEnabled(next);
      } catch (_) {
        setIsScreenSharing(false);
      }
    }
  };

  // PiP Drag handlers for small video
  const handlePipMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingPip(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: pipPos.x,
      startY: pipPos.y,
    };
  };

  const handlePipMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingPip || !dragStartRef.current) return;
    const deltaX = dragStartRef.current.mouseX - e.clientX;
    const deltaY = dragStartRef.current.mouseY - e.clientY;
    setPipPos({
      x: Math.max(12, Math.min(window.innerWidth - 180, dragStartRef.current.startX + deltaX)),
      y: Math.max(12, Math.min(window.innerHeight - 240, dragStartRef.current.startY + deltaY)),
    });
  };

  const handlePipMouseUp = () => {
    setIsDraggingPip(false);
    dragStartRef.current = null;
  };

  if (!isOpen) return null;

  // ── Render Floating Mini-Call Window on Web when minimized ──────────────────
  if (isMinimized) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 w-44 h-64 rounded-2xl bg-slate-900 border border-white/20 shadow-2xl overflow-hidden flex flex-col cursor-pointer transition-transform hover:scale-105"
        onClick={onMinimize} // toggles / restores full screen
      >
        <div className="relative flex-1 bg-slate-950 overflow-hidden">
          {remoteVideoTrack ? (
            <RemoteVideoTrackElement track={remoteVideoTrack} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 p-2">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg mb-1">
                {contactName[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-white text-xs font-semibold truncate max-w-[120px]">{contactName}</span>
            </div>
          )}

          {/* Duration Badge & Restore */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-[11px] text-white">
            <span className="px-2 py-0.5 rounded-full bg-black/60 font-mono">
              {Math.floor(durationSeconds / 60)}:{(durationSeconds % 60).toString().padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMinimize?.();
              }}
              className="p-1 rounded-full bg-black/60 hover:bg-black/80"
              title="Expand call"
            >
              <CornersOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mini Controls */}
        <div
          className="h-12 bg-slate-900/90 backdrop-blur px-3 flex items-center justify-between border-t border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={toggleMute}
            className={`p-2 rounded-full ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleEndCall}
            className="p-2 rounded-full bg-red-600 hover:bg-red-500 text-white"
          >
            <PhoneSlash className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ── Render Full Call Modal with Top-Right Controls, PiP Swap, and More Menu ──
  const isConnected = callState === 'connected';
  const isConnecting = callState === 'connecting';
  const isWaiting = callState === 'outgoing' || callState === 'ringing' || isConnecting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 select-none"
      onMouseMove={handlePipMouseMove}
      onMouseUp={handlePipMouseUp}
    >
      <div className="relative w-full h-full max-w-5xl max-h-[92vh] rounded-3xl bg-slate-950 border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Background Video / Audio Pattern Canvas */}
        <div
          className="absolute inset-0 bg-slate-950 flex items-center justify-center overflow-hidden"
          onClick={() => {
            if (isPipExpanded) {
              setIsPipExpanded(false);
            } else if (isConnected && remoteVideoTrack && localVideoTrack) {
              setIsSwapped((s) => !s);
            }
          }}
        >
          {isConnected && (isSwapped ? localVideoTrack : remoteVideoTrack) ? (
            <RemoteVideoTrackElement track={isSwapped ? (localVideoTrack as any) : remoteVideoTrack!} />
          ) : (
            <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900">
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative mb-6">
                  {contactAvatar ? (
                    <img
                      src={contactAvatar}
                      alt={contactName}
                      className="w-32 h-32 rounded-full object-cover border-4 border-primary/40 shadow-2xl"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-primary/20 border-4 border-primary/40 flex items-center justify-center text-primary text-4xl font-bold shadow-2xl">
                      {contactName[0]?.toUpperCase() || 'U'}
                    </div>
                  )}

                  {/* Pulsing ring when waiting or connecting */}
                  {isConnecting ? (
                    <div className="absolute -inset-2 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                  ) : (
                    <div className="absolute -inset-2 rounded-full border-2 border-primary/40 animate-ping opacity-35" />
                  )}
                </div>

                <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">{contactName}</h2>

                {/* Status pill (Never shows Disconnected) */}
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/10 text-sm font-medium">
                  {isConnecting ? (
                    <>
                      <Spinner className="w-4 h-4 text-emerald-400 animate-spin" />
                      <span className="text-emerald-400">Connecting…</span>
                    </>
                  ) : callState === 'reconnecting' ? (
                    <>
                      <Spinner className="w-4 h-4 text-amber-400 animate-spin" />
                      <span className="text-amber-400">Reconnecting…</span>
                    </>
                  ) : callState === 'ringing' ? (
                    <span className="text-white/80">Ringing…</span>
                  ) : callState === 'outgoing' ? (
                    <span className="text-white/80">Calling…</span>
                  ) : (
                    <span className="text-emerald-400">Connected</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Top Bar: Minimize on Left, [+] [🖥️] [•••] on Right ────────────── */}
        <div className="relative z-20 flex items-center justify-between p-5 bg-gradient-to-b from-black/80 via-black/30 to-transparent">
          {/* Top-Left: Minimize Button & Timer */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onMinimize}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors"
              title="Minimize call to floating window"
            >
              <CaretDown className="w-5 h-5" />
            </button>
            {isConnected && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 border border-white/10 text-white font-mono text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {Math.floor(durationSeconds / 60).toString().padStart(2, '0')}:
                  {(durationSeconds % 60).toString().padStart(2, '0')}
                </span>
                {remoteParticipants.length > 0 && (
                  <span className="text-xs text-white/60 font-sans ml-1">
                    ({remoteParticipants.length + 1})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Top-Right: [+] [🖥️] [•••] Action Area */}
          {isConnected && (
            <div className="flex items-center gap-2.5">
              {/* [+] Add Participant */}
              <button
                type="button"
                onClick={() => setIsAddParticipantOpen(true)}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors"
                title="Add person to call"
              >
                <UserPlus className="w-5 h-5" />
              </button>

              {/* [🖥️] Share Screen */}
              <button
                type="button"
                onClick={toggleScreenShare}
                className={`p-2.5 rounded-full border border-white/10 transition-colors ${
                  isScreenSharing ? 'bg-primary text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Share screen"
              >
                <Monitor className="w-5 h-5" />
              </button>

              {/* [•••] More Actions */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen((v) => !v)}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors"
                  title="More actions"
                >
                  <DotsThree weight="bold" className="w-5 h-5" />
                </button>

                {/* More Actions Dropdown Menu */}
                {isMoreMenuOpen && (
                  <div className="absolute right-0 top-12 w-64 rounded-2xl bg-slate-900 border border-white/15 shadow-2xl p-3 z-30 animate-in fade-in slide-in-from-top-2">
                    {/* Emoji Reaction Bar */}
                    <div className="text-xs font-semibold text-white/60 mb-2 px-1">Reactions</div>
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            triggerReaction(emoji);
                            setIsMoreMenuOpen(false);
                          }}
                          className="text-xl p-1 hover:scale-125 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {/* Actions List */}
                    <div className="pt-2 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          toggleVideo();
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/90 hover:bg-white/10 transition-colors text-left"
                      >
                        {isVideoOn ? <Video className="w-4 h-4 text-primary" /> : <VideoCameraSlash className="w-4 h-4 text-red-400" />}
                        <span>{isVideoOn ? 'Turn Camera Off' : 'Turn Camera On'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          toggleScreenShare();
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/90 hover:bg-white/10 transition-colors text-left"
                      >
                        <Monitor className="w-4 h-4 text-primary" />
                        <span>{isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}</span>
                      </button>

                      {onOpenChat && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            onOpenChat();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/90 hover:bg-white/10 transition-colors text-left"
                        >
                          <MessageSquare className="w-4 h-4 text-primary" />
                          <span>Send Message</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Floating Reaction Bubbles ───────────────────────────────────────── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-25">
          {reactions.map((r) => (
            <div
              key={r.id}
              style={{ left: `${r.x}%` }}
              className="absolute bottom-24 text-4xl animate-bounce transition-all duration-1000 ease-out pointer-events-none"
            >
              {r.emoji}
            </div>
          ))}
        </div>

        {/* ── WhatsApp-Style Movable PiP Video Preview (Tap expands, Tap swaps) ─ */}
        {isConnected && (isSwapped ? remoteVideoTrack : localVideoTrack) && (
          <div
            style={{ right: `${pipPos.x}px`, bottom: `${pipPos.y}px` }}
            className={`absolute z-30 rounded-2xl border border-white/20 shadow-2xl bg-slate-900 overflow-hidden cursor-grab active:cursor-grabbing transition-all ${
              isPipExpanded ? 'w-56 h-80' : 'w-36 h-52'
            }`}
            onMouseDown={handlePipMouseDown}
            onClick={() => {
              if (!isPipExpanded) {
                // First tap: expands preview
                setIsPipExpanded(true);
              } else {
                // Second tap: swaps small preview with main video
                setIsSwapped((s) => !s);
                setIsPipExpanded(false);
              }
            }}
          >
            {isSwapped && remoteVideoTrack ? (
              <RemoteVideoTrackElement track={remoteVideoTrack} />
            ) : localVideoTrack ? (
              // The raw <video> ref never worked: this element mounts after
              // the track is set, so the track was never attached to it.
              <RemoteVideoTrackElement track={localVideoTrack} muted />
            ) : null}

            {/* Tap hint button */}
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-white flex items-center gap-1">
              <ArrowsLeftRight className="w-3 h-3" />
              <span>{isPipExpanded ? 'Swap' : 'Preview'}</span>
            </div>
          </div>
        )}

        {/* ── Bottom Call Action Tray: Mute | Hang Up ─────────────────────────── */}
        <div className="relative z-20 mt-auto p-6 flex items-center justify-center bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          {isWaiting ? (
            /* Waiting / Incoming Actions */
            initialMode === 'incoming' && !isConnecting ? (
              <div className="flex items-center gap-8">
                <button
                  type="button"
                  onClick={handleDeclineCall}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
                    <PhoneSlash className="w-7 h-7" />
                  </div>
                  <span className="text-white text-xs font-semibold">Decline</span>
                </button>
                <button
                  type="button"
                  onClick={handleAnswerCall}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 transition-transform group-hover:scale-110 animate-pulse">
                    <Phone className="w-7 h-7" />
                  </div>
                  <span className="text-white text-xs font-semibold">Accept</span>
                </button>
              </div>
            ) : (
              /* Outgoing / Connecting Hang Up */
              <button
                type="button"
                onClick={handleEndCall}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
                  <PhoneSlash className="w-7 h-7" />
                </div>
                <span className="text-white text-xs font-semibold">{isConnecting ? 'Cancel' : 'End Call'}</span>
              </button>
            )
          ) : (
            /* Active Connected Controls: Focused Mute | Hang Up */
            <div className="flex items-center gap-8 px-8 py-3 rounded-full bg-black/60 backdrop-blur-2xl border border-white/15 shadow-2xl">
              {/* 1. Mute Toggle */}
              <button
                type="button"
                onClick={toggleMute}
                className={`p-4 rounded-full transition-all ${
                  isMuted ? 'bg-red-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              {/* 2. Hang Up Button */}
              <button
                type="button"
                onClick={handleEndCall}
                className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-600/40 hover:scale-105 active:scale-95"
                title="End Call"
              >
                <PhoneSlash className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
        {/* ── Add Participant Modal ────────────────────────────────────────── */}
        {isAddParticipantOpen && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-white/15 p-5 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  <span>Add to Call</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddParticipantOpen(false)}
                  className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Search name or username…"
                  value={participantSearchQuery}
                  onChange={(e) => handleSearchParticipants(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-primary"
                />
              </div>

              {inviteFeedback && (
                <div className={`text-xs px-3 py-1.5 rounded-lg ${inviteFeedback.isError ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                  {inviteFeedback.message}
                </div>
              )}

              {/* Search Results */}
              <div className="max-h-52 overflow-y-auto divide-y divide-white/5">
                {isSearchingUsers ? (
                  <div className="py-6 flex items-center justify-center">
                    <Spinner className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="py-6 text-center text-xs text-white/40">
                    {participantSearchQuery ? 'No users found.' : 'Search for users to invite'}
                  </p>
                ) : (
                  searchResults.map((u: any) => (
                    <div key={u.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {u.avatar_url || u.avatar ? (
                          <img src={u.avatar_url || u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                            {(u.name || 'U')[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm text-white font-medium truncate">{u.name || u.username}</span>
                      </div>
                      <button
                        type="button"
                        disabled={invitingUserIds[u.id] || invitedUserIds[u.id]}
                        onClick={() => handleInviteUser(u.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          invitedUserIds[u.id]
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-primary hover:bg-primary/90 text-white'
                        }`}
                      >
                        {invitingUserIds[u.id] ? 'Inviting…' : invitedUserIds[u.id] ? 'Invited' : 'Invite'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
