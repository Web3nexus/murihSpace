import React, { useState, useEffect, useRef } from 'react';
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
  Lock,
  SpeakerSlash as VolumeX,
  UserPlus,
  X,
  MagnifyingGlass as Search,
} from "@phosphor-icons/react";
import { Room, RoomEvent, Track, RemoteTrack, RemoteTrackPublication, Participant, ConnectionState, AudioPresets } from 'livekit-client';
import { startOutgoingRingback, startIncomingRingtone, stopCallSounds } from '@/lib/sound';
import { getEcho } from '@/lib/echo';
import { getAuthToken } from '@/lib/auth/token';
import { useAuth } from '@/hooks/useAuth';

function RemoteVideoTrackElement({ track }: { track: Track }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el && track) {
      track.attach(el);
      return () => {
        track.detach(el);
      };
    }
  }, [track]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover transition-opacity duration-300"
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

export type CallMode = 'outgoing' | 'incoming' | 'connected';
export type CallType = 'audio' | 'video';

interface CallOverlayModalProps {
  isOpen: boolean;
  callId?: number;
  callType?: CallType;
  callMode?: CallMode;
  contactName?: string;
  contactAvatar?: string;
  roomName?: string;
  livekitToken?: string;
  livekitHost?: string;
  onClose: () => void;
  onAnswer?: () => void;
  onOpenChat?: () => void;
}

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
}) => {
  const [mode, setMode] = useState<CallMode>(initialMode);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === 'video');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<RemoteTrack | null>(null);
  const [remoteParticipantName, setRemoteParticipantName] = useState<string>('');

  const [activeToken, setActiveToken] = useState<string | undefined>(initialToken);
  const [activeHost, setActiveHost] = useState<string | undefined>(initialHost);
  const [activeRoomName, setActiveRoomName] = useState<string | undefined>(initialRoomName);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const attachedAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAnsweringRef = useRef(false);

  const [remoteParticipants, setRemoteParticipants] = useState<Participant[]>([]);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [participantSearchQuery, setParticipantSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [invitingUserIds, setInvitingUserIds] = useState<Record<number, boolean>>({});
  const [invitedUserIds, setInvitedUserIds] = useState<Record<number, boolean>>({});
  const [inviteFeedback, setInviteFeedback] = useState<{ message: string; isError?: boolean } | null>(null);

  const [outgoingPhase, setOutgoingPhase] = useState<'connecting' | 'ringing'>('connecting');
  const previewStreamRef = useRef<MediaStream | null>(null);
  const outgoingPreviewVideoRef = useRef<HTMLVideoElement | null>(null);

  const refreshParticipants = () => {
    if (!roomRef.current) return;
    const remotes = Array.from(roomRef.current.remoteParticipants.values());
    setRemoteParticipants(remotes);
  };

  // Synchronize state from props
  useEffect(() => {
    if (mode !== 'connected') {
      setMode(initialMode);
      if (initialMode === 'outgoing') {
        setOutgoingPhase('connecting');
      }
    }
  }, [initialMode]);

  // Pre-warm camera preview immediately when outgoing video call starts
  // Note: audio is NOT captured here to prevent local microphone loopback/echo
  useEffect(() => {
    if (isOpen && mode === 'outgoing' && callType === 'video') {
      let isMounted = true;
      navigator.mediaDevices
        ?.getUserMedia({
          audio: false,
          video: { facingMode: 'user' },
        })
        .then((stream) => {
          if (!isMounted) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          previewStreamRef.current = stream;
          if (outgoingPreviewVideoRef.current) {
            outgoingPreviewVideoRef.current.muted = true;
            outgoingPreviewVideoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn('[CallOverlayModal] Pre-warm camera preview error:', err);
        });

      return () => {
        isMounted = false;
        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach((t) => t.stop());
          previewStreamRef.current = null;
        }
      };
    }
  }, [isOpen, mode, callType]);

  useEffect(() => {
    if (initialToken) setActiveToken(initialToken);
    if (initialHost) setActiveHost(initialHost);
    if (initialRoomName) setActiveRoomName(initialRoomName);
  }, [initialToken, initialHost, initialRoomName]);

  // Ringtone / Ringback sound management: play ringback immediately on outgoing call
  useEffect(() => {
    if (!isOpen) {
      stopCallSounds();
      return;
    }

    if (mode === 'outgoing') {
      const stop = startOutgoingRingback();
      return () => {
        stop();
        stopCallSounds();
      };
    } else if (mode === 'incoming') {
      const stop = startIncomingRingtone();
      return () => {
        stop();
        stopCallSounds();
      };
    } else {
      stopCallSounds();
    }
  }, [isOpen, mode]);

  // Duration timer: runs steadily while connected for synchronous display
  useEffect(() => {
    if (isOpen && mode === 'connected') {
      const updateDuration = () => {
        if (startedAt) {
          const startTime = new Date(startedAt).getTime();
          const now = Date.now();
          const diff = Math.floor((now - startTime) / 1000);
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
      setDurationSeconds(0);
    }
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [isOpen, mode, startedAt]);

  // Thorough cleanup whenever modal is closed
  useEffect(() => {
    if (!isOpen) {
      stopCallSounds();
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      setDurationSeconds(0);
      setStartedAt(null);
      setMode(initialMode);
      setConnectionStatus('');
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    }
  }, [isOpen, initialMode]);

  // 45-second ringing timeout limit for unanswered calls
  useEffect(() => {
    if (!isOpen || mode === 'connected') return;

    const ringTimeout = setTimeout(() => {
      if (isAnsweringRef.current) return;  // User is answering — don't timeout
      stopCallSounds();
      const statusText = mode === 'outgoing' ? 'No answer' : 'Missed call';
      setConnectionStatus(statusText);
      if (callId) {
        fetch(`${API_BASE}/calls/${callId}/end`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ duration_seconds: 0 }),
        }).catch(() => {});
      }
      setTimeout(() => {
        if (roomRef.current) {
          roomRef.current.disconnect();
          roomRef.current = null;
        }
        onClose();
      }, 1500);
    }, 45000);

    return () => clearTimeout(ringTimeout);
  }, [isOpen, mode, callId, onClose]);

  const { user } = useAuth();

  // Load friends or search results for adding participants
  useEffect(() => {
    if (!isAddParticipantOpen) {
      setParticipantSearchQuery('');
      setSearchResults([]);
      setInviteFeedback(null);
      return;
    }

    let isMounted = true;
    setIsSearchingUsers(true);

    const timer = setTimeout(() => {
      const q = participantSearchQuery.trim();
      const url = q ? `${API_BASE}/friends/search?q=${encodeURIComponent(q)}` : `${API_BASE}/friends`;

      fetch(url, { headers: getAuthHeaders() })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isMounted || !data) return;
          const rawList = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
          const normalized = rawList
            .map((item: any) => {
              if (item.friend) return item.friend;
              if (item.sender && item.sender.id !== user?.id) return item.sender;
              return item;
            })
            .filter((u: any) => u && u.id && u.id !== user?.id);
          setSearchResults(normalized);
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsSearchingUsers(false);
        });
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isAddParticipantOpen, participantSearchQuery, user?.id]);

  const handleInviteUser = async (targetUser: any) => {
    if (!callId) return;
    setInvitingUserIds((prev) => ({ ...prev, [targetUser.id]: true }));
    setInviteFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/calls/${callId}/invite`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ user_id: targetUser.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteFeedback({ message: data.message || 'Failed to invite user', isError: true });
      } else {
        setInvitedUserIds((prev) => ({ ...prev, [targetUser.id]: true }));
        setInviteFeedback({ message: `Invitation sent to ${targetUser.name || 'user'}` });
      }
    } catch (e: any) {
      setInviteFeedback({ message: e.message || 'Network error sending invite', isError: true });
    } finally {
      setInvitingUserIds((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  };

  // Listen to call events via Echo for this specific room / call
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
      setOutgoingPhase('ringing');
    };

    const handleCallAccepted = (raw: any) => {
      const data = raw?.call || raw?.data?.call || raw?.data || raw;
      const id = data?.id || raw?.id;
      if (id && callId && Number(id) !== Number(callId)) return;
      stopCallSounds();
      const startedAtTime = data?.started_at || raw?.started_at || raw?.call?.started_at;
      if (startedAtTime) setStartedAt(startedAtTime);

      // Only the CALLER adopts token/host/room from CallAccepted.
      // Callee already has their own unique recipient token.
      if (mode === 'outgoing') {
        const token = data?.livekit_token || raw?.livekit_token;
        const host = data?.livekit_host || raw?.livekit_host;
        const room = data?.room_name || raw?.room_name;
        if (token && !activeToken) setActiveToken(token);
        if (host && !activeHost) setActiveHost(host);
        if (room && !activeRoomName) setActiveRoomName(room);
        setMode('connected');
      }
    };

    const handleCallDeclined = (raw?: any) => {
      const data = raw?.call || raw?.data?.call || raw?.data || raw;
      const id = data?.id || raw?.id;
      if (id && callId && Number(id) !== Number(callId)) return;
      stopCallSounds();
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      setConnectionStatus('Call declined');
      setTimeout(() => {
        cleanupAndClose();
      }, 1500);
    };

    const handleCallEnded = (raw?: any) => {
      const data = raw?.call || raw?.data?.call || raw?.data || raw;
      const id = data?.id || raw?.id;
      if (id && callId && Number(id) !== Number(callId)) return;
      stopCallSounds();
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      setConnectionStatus('Call ended');
      setTimeout(() => {
        cleanupAndClose();
      }, 1200);
    };

    const handleParticipantInvited = (raw?: any) => {
      console.log('[LiveKit] Participant invited:', raw);
    };

    const handleParticipantJoined = (raw?: any) => {
      console.log('[LiveKit] Participant joined:', raw);
      refreshParticipants();
    };

    const handleParticipantLeft = (raw?: any) => {
      console.log('[LiveKit] Participant left:', raw);
      refreshParticipants();
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
      channel.listen('.call.participant.invited', handleParticipantInvited);
      channel.listen('CallParticipantInvited', handleParticipantInvited);
      channel.listen('.call.participant.joined', handleParticipantJoined);
      channel.listen('CallParticipantJoined', handleParticipantJoined);
      channel.listen('.call.participant.left', handleParticipantLeft);
      channel.listen('CallParticipantLeft', handleParticipantLeft);
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
        channel.stopListening('.call.participant.invited', handleParticipantInvited);
        channel.stopListening('CallParticipantInvited', handleParticipantInvited);
        channel.stopListening('.call.participant.joined', handleParticipantJoined);
        channel.stopListening('CallParticipantJoined', handleParticipantJoined);
        channel.stopListening('.call.participant.left', handleParticipantLeft);
        channel.stopListening('CallParticipantLeft', handleParticipantLeft);
      });
      if (callChannel && channelName) {
        echo.leave(channelName);
      }
    };
  }, [isOpen, callId, activeRoomName, user?.id]);

  // Call status polling heartbeat: ensures that when recipient picks up or remote party hangs up,
  // the client on web immediately synchronizes state even if WebSocket event is delayed.
  useEffect(() => {
    if (!isOpen || !callId || (mode !== 'outgoing' && mode !== 'connected')) return;

    const pollInterval = setInterval(() => {
      fetch(`${API_BASE}/calls/${callId}`, { headers: getAuthHeaders() })
        .then((res) => (res.ok ? res.json() : null))
        .then((raw) => {
          if (!raw) return;
          const data = raw?.data ?? raw;
          const call = data?.call || (data?.id ? data : null);
          if (!call) return;
          const status = call.status;

          if (mode === 'outgoing') {
            if (status === 'ringing') {
              setOutgoingPhase('ringing');
            } else if (status === 'accepted') {
              stopCallSounds();
              const token = data.livekit_token || call.livekit_token;
              const host = data.livekit_host || call.livekit_host;
              const room = data.room_name || call.room_name;
              const startedAtTime = data.started_at || call.started_at;
              if (startedAtTime) setStartedAt(startedAtTime);
              if (token && !activeToken) setActiveToken(token);
              if (host && !activeHost) setActiveHost(host);
              if (room && !activeRoomName) setActiveRoomName(room);
              setMode('connected');
            } else if (status === 'declined') {
              stopCallSounds();
              if (durationTimerRef.current) {
                clearInterval(durationTimerRef.current);
                durationTimerRef.current = null;
              }
              setConnectionStatus('Call declined');
              setTimeout(() => {
                cleanupAndClose();
              }, 1500);
            } else if (status === 'ended') {
              stopCallSounds();
              if (durationTimerRef.current) {
                clearInterval(durationTimerRef.current);
                durationTimerRef.current = null;
              }
              setConnectionStatus('Call ended');
              setTimeout(() => {
                cleanupAndClose();
              }, 1200);
            }
          } else if (mode === 'connected') {
            if (status === 'ended' || status === 'declined') {
              stopCallSounds();
              if (durationTimerRef.current) {
                clearInterval(durationTimerRef.current);
                durationTimerRef.current = null;
              }
              setConnectionStatus('Call ended');
              setTimeout(() => {
                cleanupAndClose();
              }, 1200);
            }
          }
        })
        .catch(() => {});
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [isOpen, mode, callId]);

  // Fetch token if connected but token not yet present
  useEffect(() => {
    if (mode === 'connected' && (!activeToken || !activeHost) && callId) {
      fetch(`${API_BASE}/calls/${callId}/token`, { headers: getAuthHeaders() })
        .then((res) => res.json())
        .then((raw) => {
          const data = raw?.data ?? raw;
          const call = data?.call || data;
          const token = data?.livekit_token || call?.livekit_token;
          const host = data?.livekit_host || call?.livekit_host;
          const room = data?.room_name || call?.room_name;
          if (token) setActiveToken(token);
          if (host) setActiveHost(host);
          if (room) setActiveRoomName(room);
        })
        .catch(() => {});
    }
  }, [mode, activeToken, activeHost, callId]);

  // Connect to LiveKit SFU when in 'connected' mode and token is ready
  useEffect(() => {
    if (!isOpen || mode !== 'connected' || !activeToken || !activeHost) return;
    if (roomRef.current && (roomRef.current.state === ConnectionState.Connected || roomRef.current.state === ConnectionState.Connecting)) {
      return;
    }

    let isCancelled = false;
    let room: Room;

    const connectLiveKit = async () => {
      try {
        setConnectionStatus('Connecting to audio/video server...');

        // CRITICAL: Stop and release any pre-warm mic/camera streams immediately
        // so WebRTC does not hit device resource contention or mute on the microphone
        if (previewStreamRef.current) {
          try {
            previewStreamRef.current.getTracks().forEach((t) => t.stop());
          } catch (_) {}
          previewStreamRef.current = null;
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
            dtx: false,
            red: true,
            audioPreset: AudioPresets.speech,
          },
          videoCaptureDefaults: {
            resolution: { width: 1280, height: 720, frameRate: 30 },
          },
        });
        roomRef.current = room;

        // Signaling connected
        room.on(RoomEvent.SignalConnected, () => {
          console.log('[LiveKit] 📡 Signaling connected to SFU');
        });

        // Room connected
        room.on(RoomEvent.Connected, () => {
          console.log('[LiveKit] 🔗 Connected to room:', room.name);
        });

        // Audio playback status changed
        room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          console.log('[LiveKit] 🔊 AudioPlaybackStatusChanged: canPlaybackAudio =', room.canPlaybackAudio);
          setAudioPlaybackBlocked(!room.canPlaybackAudio);
        });

        // Connection state changed
        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          console.log('[LiveKit] 📶 ConnectionStateChanged:', state);
          if (state === ConnectionState.Connecting) {
            setConnectionStatus('Connecting media...');
          } else if (state === ConnectionState.Connected) {
            setConnectionStatus('Connected');
          } else if (state === ConnectionState.Reconnecting) {
            setConnectionStatus('Reconnecting...');
          } else if (state === ConnectionState.Disconnected) {
            setConnectionStatus('Disconnected');
          }
        });

        // Track published by local participant
        room.on(RoomEvent.TrackPublished, (publication, participant) => {
          console.log(`[LiveKit] 📤 TrackPublished: kind=${publication.kind}, participant=${participant.identity}`);
        });

        // Remote track subscribed
        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, _publication: RemoteTrackPublication, participant: Participant) => {
            console.log(`[LiveKit] 📥 TrackSubscribed: kind=${track.kind}, sid=${track.sid}, from=${participant.identity}`);
            setRemoteParticipantName(participant.name || contactName);

            if (track.kind === Track.Kind.Video) {
              setRemoteVideoTrack(track);
              setHasRemoteVideo(true);
              if (remoteVideoRef.current) {
                track.attach(remoteVideoRef.current);
              }
            } else if (track.kind === Track.Kind.Audio) {
              const audioKey = track.sid || participant.identity;
              const audioEl = track.attach();
              audioEl.muted = false;
              audioEl.volume = 1.0;
              audioEl.setAttribute('data-livekit-call-audio', audioKey);
              document.body.appendChild(audioEl);
              attachedAudioElementsRef.current.set(audioKey, audioEl);

              audioEl.play().then(() => {
                setAudioPlaybackBlocked(false);
              }).catch((e) => {
                console.warn('[LiveKit] 🔇 Audio autoplay blocked by browser:', e);
                setAudioPlaybackBlocked(true);
              });
            }
            refreshParticipants();
          }
        );

        // Remote track unsubscribed
        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          console.log(`[LiveKit] 📴 TrackUnsubscribed: kind=${track.kind}, sid=${track.sid}`);
          track.detach().forEach((el) => {
            try {
              (el as HTMLAudioElement).pause();
              el.remove();
            } catch (_) {}
          });
          if (track.sid && attachedAudioElementsRef.current.has(track.sid)) {
            const el = attachedAudioElementsRef.current.get(track.sid);
            try {
              el?.pause();
              el?.remove();
            } catch (_) {}
            attachedAudioElementsRef.current.delete(track.sid);
          }
          if (track.kind === Track.Kind.Video) {
            setRemoteVideoTrack(null);
            setHasRemoteVideo(false);
          }
          refreshParticipants();
        });

        // Participant joined
        room.on(RoomEvent.ParticipantConnected, (participant: Participant) => {
          console.log('[LiveKit] 👤 ParticipantConnected:', participant.identity, participant.name);
          setRemoteParticipantName(participant.name || contactName);
          refreshParticipants();
          if (!room.canPlaybackAudio) {
            room.startAudio().catch(() => {});
          }
        });

        // Participant disconnected — apply 8s grace period in case of network handover
        room.on(RoomEvent.ParticipantDisconnected, (participant: Participant) => {
          console.log('[LiveKit] 👤 ParticipantDisconnected:', participant.identity);
          refreshParticipants();
          if (isCancelled || roomRef.current !== room) return;
          setTimeout(() => {
            if (isCancelled || roomRef.current !== room) return;
            if (!room.remoteParticipants || room.remoteParticipants.size === 0) {
              setConnectionStatus('Other participant left');
              if (durationTimerRef.current) {
                clearInterval(durationTimerRef.current);
                durationTimerRef.current = null;
              }
              cleanupAndClose();
            }
          }, 8000);
        });

        // Room disconnected
        room.on(RoomEvent.Disconnected, (reason) => {
          console.warn('[LiveKit] ⚠️ Room Disconnected, reason:', reason);
          // If this room instance was superseded, cancelled, or cleaned up by React, do NOT close modal
          if (isCancelled || roomRef.current !== room) return;
          setConnectionStatus('Call ended');
          if (durationTimerRef.current) {
            clearInterval(durationTimerRef.current);
            durationTimerRef.current = null;
          }
          setTimeout(() => {
            if (isCancelled || roomRef.current !== room) return;
            cleanupAndClose();
          }, 1200);
        });

        // Normalize host URL
        let hostUrl = activeHost.trim();
        if (hostUrl.startsWith('https://')) {
          hostUrl = 'wss://' + hostUrl.slice(8);
        } else if (hostUrl.startsWith('http://')) {
          hostUrl = 'ws://' + hostUrl.slice(7);
        }

        await room.connect(hostUrl, activeToken);

        if (isCancelled) {
          room.disconnect();
          return;
        }

        setConnectionStatus('Connected');

        // Unlock browser audio playback right after connection
        try {
          await room.startAudio();
        } catch (_) {}
        setAudioPlaybackBlocked(!room.canPlaybackAudio);

        // Attach any tracks that were already published before this client connected
        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((pub) => {
            if (pub.isSubscribed && pub.track) {
              console.log(`[LiveKit] 📥 Attaching pre-existing track: kind=${pub.track.kind}, sid=${pub.track.sid}`);
              if (pub.track.kind === Track.Kind.Audio) {
                const audioKey = pub.track.sid || participant.identity;
                if (!attachedAudioElementsRef.current.has(audioKey)) {
                  const audioEl = pub.track.attach() as HTMLAudioElement;
                  audioEl.muted = false;
                  audioEl.volume = 1.0;
                  audioEl.setAttribute('data-livekit-call-audio', audioKey);
                  document.body.appendChild(audioEl);
                  attachedAudioElementsRef.current.set(audioKey, audioEl);

                  audioEl.play().then(() => {
                    setAudioPlaybackBlocked(false);
                  }).catch((e) => {
                    console.warn('[LiveKit] 🔇 Pre-existing audio track playback blocked:', e);
                    setAudioPlaybackBlocked(true);
                  });
                }
              } else if (pub.track.kind === Track.Kind.Video) {
                setRemoteVideoTrack(pub.track);
                setHasRemoteVideo(true);
                if (remoteVideoRef.current) {
                  pub.track.attach(remoteVideoRef.current);
                }
              }
            }
          });
        });
        refreshParticipants();

        // Publish local mic
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMuted(false);

        // Publish local camera if video call
        if (callType === 'video') {
          const camPub = await room.localParticipant.setCameraEnabled(true);
          setIsVideoOn(true);

          // Attach local preview
          const camTrack = (camPub?.track || room.localParticipant.getTrackPublication(Track.Source.Camera)?.track) as any;
          if (camTrack && localVideoRef.current) {
            camTrack.attach(localVideoRef.current);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setConnectionStatus(err.message || 'Failed to establish media connection.');
        }
      }
    };

    connectLiveKit();

    return () => {
      isCancelled = true;
      cleanupAttachedAudio();
      if (roomRef.current === room) {
        roomRef.current = null;
      }
      room?.disconnect();
    };
  }, [isOpen, mode, activeToken, activeHost, callType]);

  // Clean up all dynamically attached audio elements from the DOM
  const cleanupAttachedAudio = () => {
    attachedAudioElementsRef.current.forEach((el) => {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch (_) {}
    });
    attachedAudioElementsRef.current.clear();
    if (typeof document !== 'undefined') {
      document.querySelectorAll('audio[data-livekit-call-audio]').forEach((el) => {
        try {
          (el as HTMLAudioElement).pause();
          (el as HTMLAudioElement).srcObject = null;
          el.remove();
        } catch (_) {}
      });
    }
  };

  // Browser Audio Autoplay Unblock Handler
  const handleUnblockAudio = async () => {
    if (roomRef.current) {
      try {
        await roomRef.current.startAudio();
        setAudioPlaybackBlocked(!roomRef.current.canPlaybackAudio);
      } catch (e) {
        console.warn('[LiveKit] Failed to start audio on user action:', e);
      }
    }
    attachedAudioElementsRef.current.forEach((el) => {
      try {
        el.muted = false;
        el.volume = 1.0;
        el.play().catch(() => {});
      } catch (_) {}
    });
    setAudioPlaybackBlocked(false);
  };

  // Mute / Unmute
  const toggleMute = async () => {
    if (!roomRef.current?.localParticipant) return;
    const next = !isMuted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(!next);
    setIsMuted(next);
  };

  // Video On / Off
  const toggleVideo = async () => {
    if (!roomRef.current?.localParticipant) return;
    const next = !isVideoOn;
    await roomRef.current.localParticipant.setCameraEnabled(next);
    setIsVideoOn(next);

    if (next && localVideoRef.current) {
      const videoTrackPub = Array.from(roomRef.current.localParticipant.videoTrackPublications.values())[0];
      if (videoTrackPub?.videoTrack) {
        videoTrackPub.videoTrack.attach(localVideoRef.current);
      }
    }
  };

  // Screen Share Toggle
  const toggleScreenShare = async () => {
    if (!roomRef.current?.localParticipant) return;
    const next = !isScreenSharing;
    try {
      await roomRef.current.localParticipant.setScreenShareEnabled(next);
      setIsScreenSharing(next);
    } catch {
      setIsScreenSharing(false);
    }
  };

  // Internal cleanup: disconnect LiveKit, reset state, and close modal WITHOUT posting to API
  const cleanupAndClose = () => {
    stopCallSounds();
    cleanupAttachedAudio();
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    setDurationSeconds(0);
    setStartedAt(null);
    setMode(initialMode);
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    onClose();
  };

  // End / Hang up call — user-initiated, posts to API then cleans up
  const handleEndCall = async () => {
    stopCallSounds();
    cleanupAttachedAudio();
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    setDurationSeconds(0);
    setStartedAt(null);
    setMode(initialMode);
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (callId) {
      fetch(`${API_BASE}/calls/${callId}/end`, {
        method: 'POST',
        headers: getAuthHeaders(),
      }).catch(() => {});
    }
    onClose();
  };

  // Decline call — user-initiated
  const handleDeclineCall = async () => {
    stopCallSounds();
    if (callId) {
      fetch(`${API_BASE}/calls/${callId}/decline`, {
        method: 'POST',
        headers: getAuthHeaders(),
      }).catch(() => {});
    }
    onClose();
  };

  // Answer call — posts accept, transitions to connected immediately
  const handleAnswerCall = async () => {
    isAnsweringRef.current = true;  // Prevent ringing timeout
    stopCallSounds();
    if (onAnswer) onAnswer();

    // Unlock browser audio policy immediately on this user gesture,
    // before any async work. This is the earliest possible moment.
    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        await ctx.resume();
        ctx.close();
      }
    } catch (_) {}

    // Free pre-warm media streams immediately
    if (previewStreamRef.current) {
      try {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      previewStreamRef.current = null;
    }

    // Immediately transition to connected mode so the modal remains open and media connects
    setMode('connected');

    if (callId) {
      try {
        const res = await fetch(`${API_BASE}/calls/${callId}/accept`, {
          method: 'POST',
          headers: getAuthHeaders(),
        });
        const raw = await res.json();
        const data = raw?.data ?? raw;
        if (!res.ok) {
          console.warn('[CallOverlayModal] accept returned non-OK status:', res.status, data);
          // If credentials are already present or returned, remain connected
          if (activeToken || data?.livekit_token) {
            const token = data?.livekit_token || data?.call?.livekit_token;
            if (token) setActiveToken(token);
            setMode('connected');
            return;
          }
          // Only close if status is explicitly ended or declined
          if (res.status === 400 && (data?.status === 'ended' || data?.status === 'declined')) {
            setConnectionStatus(data?.message || 'Call no longer active');
            setTimeout(() => cleanupAndClose(), 1500);
            return;
          }
        }
        const call = data?.call || data;
        const token = data?.livekit_token || call?.livekit_token;
        const host = data?.livekit_host || call?.livekit_host;
        const room = data?.room_name || call?.room_name;
        const startedAtTime = data?.started_at || call?.started_at;
        if (startedAtTime) setStartedAt(startedAtTime);

        if (token) setActiveToken(token);
        if (host) setActiveHost(host);
        if (room) setActiveRoomName(room);
      } catch (err) {
        console.warn('[CallOverlayModal] accept error:', err);
      }
    }
  };


  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={() => {
        if (roomRef.current && (!roomRef.current.canPlaybackAudio || audioPlaybackBlocked)) {
          handleUnblockAudio();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl text-white overflow-hidden animate-in fade-in duration-300"
    >
      {/* ── State 1: OUTGOING (Connecting -> Ringing) ──────────────────────── */}
      {mode === 'outgoing' && (
        <div className="relative w-full h-full max-w-md flex flex-col justify-between p-6 text-center overflow-hidden">
          {/* Local Camera Preview Background for Video Calls */}
          {callType === 'video' && (
            <div className="absolute inset-0 z-0">
              <video
                ref={outgoingPreviewVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/80" />
            </div>
          )}

          <div className="relative z-10 pt-12 space-y-4">
            <span className="inline-block px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-slate-200 border border-white/10">
              {callType === 'video' ? 'Outgoing Video Call' : 'Outgoing Audio Call'}
            </span>
            <div className="relative mx-auto w-28 h-28">
              <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
              <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl mx-auto bg-slate-800">
                {contactAvatar ? (
                  <img src={contactAvatar} alt={contactName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold bg-gradient-to-br from-primary to-secondary">
                    {contactName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">{contactName}</h2>
            <div className="flex items-center justify-center gap-2">
              {outgoingPhase === 'connecting' && (
                <Spinner className="h-4 w-4 animate-spin text-slate-300" />
              )}
              <p className="text-sm text-slate-200 font-medium drop-shadow animate-pulse">
                {outgoingPhase === 'connecting' ? 'Connecting...' : 'Ringing...'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-xs text-white/50 pt-1">
              <Lock weight="bold" className="w-3.5 h-3.5 text-emerald-400" />
              <span>End-to-End Encrypted</span>
            </div>
          </div>

          <div className="relative z-10 pb-12 flex justify-center">
            <button
              type="button"
              onClick={handleEndCall}
              className="p-5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-2xl transition-transform hover:scale-105 active:scale-95"
              title="Cancel Call"
            >
              <PhoneSlash weight="fill" className="h-7 w-7" />
            </button>
          </div>
        </div>
      )}

      {/* ── State 2: INCOMING CALL ────────────────────────────────────────── */}
      {mode === 'incoming' && (
        <div className="relative w-full h-full max-w-md flex flex-col justify-between p-6 text-center">
          <div className="pt-12 space-y-4">
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold uppercase tracking-wider">
              {callType === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call'}
            </span>
            <div className="relative mx-auto w-32 h-32">
              <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-500/40 shadow-2xl mx-auto bg-slate-800">
                {contactAvatar ? (
                  <img src={contactAvatar} alt={contactName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold bg-gradient-to-br from-primary to-secondary">
                    {contactName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">{contactName}</h2>
            <p className="text-sm text-slate-300 animate-pulse">is calling you...</p>
            <div className="flex items-center justify-center gap-1.5 text-xs text-white/50 pt-1">
              <Lock weight="bold" className="w-3.5 h-3.5 text-emerald-400" />
              <span>End-to-End Encrypted</span>
            </div>
          </div>

          <div className="pb-12 flex items-center justify-center gap-12">
            <button
              type="button"
              onClick={handleDeclineCall}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="p-5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-2xl transition-transform group-hover:scale-110 active:scale-95">
                <PhoneSlash weight="fill" className="h-7 w-7" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Decline</span>
            </button>

            <button
              type="button"
              onClick={handleAnswerCall}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="p-5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-2xl transition-transform group-hover:scale-110 active:scale-95 animate-bounce">
                <Phone weight="fill" className="h-7 w-7" />
              </div>
              <span className="text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">Answer</span>
            </button>
          </div>
        </div>
      )}

      {/* ── State 3: CONNECTED REAL CALL ──────────────────────────────────── */}
      {mode === 'connected' && (
        <div
          onClick={() => {
            if (audioPlaybackBlocked) handleUnblockAudio();
          }}
          className="relative w-full h-full max-w-4xl max-h-[92vh] flex flex-col justify-between p-4 bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden mx-4"
        >
          {/* Autoplay Audio Unblock Banner */}
          {audioPlaybackBlocked && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleUnblockAudio();
              }}
              className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-full shadow-lg transition-all animate-bounce cursor-pointer"
            >
              <VolumeX weight="bold" className="w-4 h-4" />
              <span>Click anywhere to unmute audio</span>
            </button>
          )}

          {/* Main Remote Video or Audio Avatar Area */}
          <div className="absolute inset-0 z-0 bg-slate-900 flex items-center justify-center overflow-hidden">
            {remoteParticipants.length > 1 ? (
              /* Multi-Participant Grid View */
              <div className="w-full h-full p-4 grid grid-cols-2 gap-3 items-center justify-center auto-rows-fr">
                {remoteParticipants.map((p) => {
                  const videoPub = Array.from(p.videoTrackPublications.values()).find(
                    (pub) => pub.track && pub.isSubscribed && !pub.isMuted
                  );
                  const audioPub = Array.from(p.audioTrackPublications.values()).find(
                    (pub) => pub.track && pub.isSubscribed
                  );
                  const isPeerMuted = !audioPub || audioPub.isMuted;
                  const displayName = p.name || p.identity;

                  return (
                    <div
                      key={p.identity}
                      className="relative w-full h-full min-h-[160px] bg-slate-800/90 rounded-2xl overflow-hidden border border-white/10 shadow-lg flex items-center justify-center"
                    >
                      {videoPub?.track ? (
                        <RemoteVideoTrackElement track={videoPub.track} />
                      ) : (
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-16 h-16 rounded-full bg-primary/80 border-2 border-white/20 flex items-center justify-center text-xl font-bold text-white shadow-md">
                            {displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-slate-300">{displayName}</span>
                        </div>
                      )}

                      {/* Participant Overlay Info */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                        <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-semibold text-white border border-white/10 truncate max-w-[70%]">
                          {displayName}
                        </span>
                        <span
                          className={`p-1.5 rounded-lg backdrop-blur-md ${
                            isPeerMuted ? 'bg-red-500/80 text-white' : 'bg-black/40 text-emerald-400'
                          }`}
                        >
                          {isPeerMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic weight="fill" className="w-3.5 h-3.5" />}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : callType === 'video' ? (
              <>
                {remoteVideoTrack ? (
                  <RemoteVideoTrackElement track={remoteVideoTrack} />
                ) : (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={`w-full h-full object-cover transition-opacity duration-300 ${
                      hasRemoteVideo ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                )}
                {!hasRemoteVideo && !remoteVideoTrack && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-slate-950">
                    <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-800">
                      {contactAvatar ? (
                        <img src={contactAvatar} alt={contactName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl font-bold bg-primary text-white">
                          {contactName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-lg font-bold text-white">{contactName}</p>
                      <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
                        <Spinner className="h-3.5 w-3.5 animate-spin" />
                        {connectionStatus}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                  <div className="relative w-36 h-36 rounded-full overflow-hidden border-4 border-emerald-500/30 shadow-2xl bg-slate-800">
                    {contactAvatar ? (
                      <img src={contactAvatar} alt={contactName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl font-bold bg-primary text-white">
                        {contactName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-2xl font-bold text-white">{contactName}</h3>
                  <p className="text-sm font-semibold text-emerald-400 font-mono tracking-wider">
                    {formatTimer(durationSeconds)}
                  </p>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-white/50 pt-1">
                    <Lock weight="bold" className="w-3 h-3 text-emerald-400" />
                    <span>End-to-End Encrypted</span>
                  </div>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />
          </div>

          {/* Top Bar: Contact Name, Call Duration, & PIP Local Video */}
          <div className="relative z-10 flex items-start justify-between p-2">
            <div className="flex items-center gap-2.5 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-white">
                {remoteParticipants.length > 1
                  ? `${remoteParticipants.length + 1} Participants`
                  : remoteParticipantName || contactName}
              </span>
              <span className="text-xs text-slate-300 font-mono border-l border-white/20 pl-2">
                {formatTimer(durationSeconds)}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium border-l border-white/20 pl-2">
                <Lock weight="fill" className="w-2.5 h-2.5" />
                <span>Encrypted</span>
              </span>
            </div>

            {/* Inset Self Video Preview (Video calls only) */}
            {callType === 'video' && (
              <div className="h-32 w-24 rounded-xl overflow-hidden border-2 border-white/30 shadow-2xl bg-black relative">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isVideoOn ? 'block' : 'hidden'}`}
                />
                {!isVideoOn && (
                  <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-[10px] font-bold text-slate-400 p-1 text-center">
                    <VideoCameraSlash className="h-5 w-5 mb-1 text-slate-500" />
                    Camera Off
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Add Participant Modal Overlay */}
          {isAddParticipantOpen && (
            <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-slate-900 border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85%] animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <UserPlus weight="bold" className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-white text-sm">Add Person to Call</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddParticipantOpen(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X weight="bold" className="w-4 h-4" />
                  </button>
                </div>

                {/* Search Input */}
                <div className="p-3 border-b border-white/10">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={participantSearchQuery}
                      onChange={(e) => setParticipantSearchQuery(e.target.value)}
                      placeholder="Search friends by name or username..."
                      className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Feedback Message */}
                {inviteFeedback && (
                  <div
                    className={`px-4 py-2 text-xs font-medium ${
                      inviteFeedback.isError
                        ? 'bg-red-500/20 text-red-300 border-b border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-b border-emerald-500/30'
                    }`}
                  >
                    {inviteFeedback.message}
                  </div>
                )}

                {/* Friends / Users List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-white/5">
                  {isSearchingUsers ? (
                    <div className="py-8 flex flex-col items-center justify-center text-slate-400 text-xs">
                      <Spinner className="w-5 h-5 animate-spin mb-2 text-primary" />
                      Searching contacts...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      {participantSearchQuery ? 'No matching contacts found' : 'No friends found to invite'}
                    </div>
                  ) : (
                    searchResults.map((u) => {
                      const isInviting = invitingUserIds[u.id];
                      const isInvited = invitedUserIds[u.id];
                      const avatar = u.avatar_url || u.avatar;
                      return (
                        <div
                          key={u.id}
                          className="pt-1.5 first:pt-0 flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-800 flex-shrink-0 border border-white/10">
                              {avatar ? (
                                <img src={avatar} alt={u.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-primary">
                                  {(u.name || 'U').slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white truncate">{u.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">@{u.username || 'user'}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isInviting || isInvited}
                            onClick={() => handleInviteUser(u)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              isInvited
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : isInviting
                                ? 'bg-primary/50 text-white cursor-wait'
                                : 'bg-primary hover:bg-primary/90 text-white active:scale-95 shadow-md'
                            }`}
                          >
                            {isInvited ? 'Invited' : isInviting ? 'Inviting...' : 'Invite'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Floating Control Bar */}
          <div className="relative z-10 w-full pb-2">
            <div className="flex items-center justify-center gap-3 p-3 rounded-full bg-black/60 backdrop-blur-2xl border border-white/20 shadow-2xl max-w-md mx-auto">
              {/* Mic Toggle */}
              <button
                type="button"
                onClick={toggleMute}
                className={`p-3.5 rounded-full transition-all ${
                  isMuted ? 'bg-red-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic weight="fill" className="h-5 w-5" />}
              </button>

              {/* Video Camera Toggle (only for video calls) */}
              {callType === 'video' && (
                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`p-3.5 rounded-full transition-all ${
                    !isVideoOn ? 'bg-red-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                  title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
                >
                  {isVideoOn ? <Video weight="fill" className="h-5 w-5" /> : <VideoCameraSlash weight="fill" className="h-5 w-5" />}
                </button>
              )}

              {/* Screen Share (video calls) */}
              {callType === 'video' && (
                <button
                  type="button"
                  onClick={toggleScreenShare}
                  className={`p-3.5 rounded-full transition-all ${
                    isScreenSharing ? 'bg-primary text-white' : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                  title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
                >
                  <Monitor weight="fill" className="h-5 w-5" />
                </button>
              )}

              {/* Add Participant Button */}
              <button
                type="button"
                onClick={() => setIsAddParticipantOpen(true)}
                className={`p-3.5 rounded-full transition-all ${
                  isAddParticipantOpen ? 'bg-primary text-white' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
                title="Add person to call"
              >
                <UserPlus weight="bold" className="h-5 w-5" />
              </button>

              {/* Chat button */}
              {onOpenChat && (
                <button
                  type="button"
                  onClick={onOpenChat}
                  className="p-3.5 rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
                  title="Open Chat"
                >
                  <MessageSquare weight="fill" className="h-5 w-5" />
                </button>
              )}

              {/* End Call Button */}
              <button
                type="button"
                onClick={handleEndCall}
                className="p-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg hover:scale-105 active:scale-95"
                title="End Call"
              >
                <PhoneSlash weight="fill" className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
