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
} from "@phosphor-icons/react";
import { Room, RoomEvent, Track, RemoteTrack, RemoteTrackPublication, Participant } from 'livekit-client';
import { startOutgoingRingback, startIncomingRingtone, stopCallSounds } from '@/lib/sound';
import { getEcho } from '@/lib/echo';
import { getAuthToken } from '@/lib/auth/token';
import { useAuth } from '@/hooks/useAuth';

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
  const [remoteParticipantName, setRemoteParticipantName] = useState<string>('');

  const [activeToken, setActiveToken] = useState<string | undefined>(initialToken);
  const [activeHost, setActiveHost] = useState<string | undefined>(initialHost);
  const [activeRoomName, setActiveRoomName] = useState<string | undefined>(initialRoomName);

  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [outgoingPhase, setOutgoingPhase] = useState<'connecting' | 'ringing'>('connecting');
  const previewStreamRef = useRef<MediaStream | null>(null);
  const outgoingPreviewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Synchronize state from props
  useEffect(() => {
    setMode(initialMode);
    if (initialMode === 'outgoing') {
      setOutgoingPhase('connecting');
      const timer = setTimeout(() => {
        setOutgoingPhase('ringing');
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [initialMode]);

  // Turn on local camera preview immediately for outgoing video calls
  useEffect(() => {
    if (isOpen && mode === 'outgoing' && callType === 'video') {
      let isMounted = true;
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then((stream) => {
          if (!isMounted) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          previewStreamRef.current = stream;
          if (outgoingPreviewVideoRef.current) {
            outgoingPreviewVideoRef.current.srcObject = stream;
          }
        })
        .catch(() => {});

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

  // Ringtone / Ringback sound management: only ring once connected to recipient
  useEffect(() => {
    if (!isOpen) {
      stopCallSounds();
      return;
    }

    if (mode === 'outgoing' && outgoingPhase === 'ringing') {
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
  }, [isOpen, mode, outgoingPhase]);

  // Duration timer when call is connected
  useEffect(() => {
    if (mode === 'connected') {
      setDurationSeconds(0);
      durationTimerRef.current = setInterval(() => {
        setDurationSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [mode]);

  const { user } = useAuth();

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

    const handleCallAccepted = (data: any) => {
      if (data && callId && data.id && Number(data.id) !== Number(callId)) return;
      stopCallSounds();
      if (data?.livekit_host) setActiveHost(data.livekit_host);
      if (data?.room_name) setActiveRoomName(data.room_name);
      setMode('connected');
    };

    const handleCallDeclined = (data?: any) => {
      if (data && callId && data.id && Number(data.id) !== Number(callId)) return;
      stopCallSounds();
      setConnectionStatus('Call declined');
      setTimeout(() => {
        // Cleanup without re-posting to API (remote side already ended)
        if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; }
        onClose();
      }, 1500);
    };

    const handleCallEnded = (data?: any) => {
      if (data && callId && data.id && Number(data.id) !== Number(callId)) return;
      stopCallSounds();
      setConnectionStatus('Call ended');
      setTimeout(() => {
        // Cleanup without re-posting to API (remote side already ended)
        if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; }
        onClose();
      }, 1200);
    };

    if (callChannel) {
      callChannel.listen('.call.accepted', handleCallAccepted);
      callChannel.listen('.call.declined', handleCallDeclined);
      callChannel.listen('.call.ended', handleCallEnded);
      callChannel.listen('CallAccepted', handleCallAccepted);
      callChannel.listen('CallDeclined', handleCallDeclined);
      callChannel.listen('CallEnded', handleCallEnded);
    }

    if (userChannel) {
      userChannel.listen('.call.accepted', handleCallAccepted);
      userChannel.listen('.call.declined', handleCallDeclined);
      userChannel.listen('.call.ended', handleCallEnded);
      userChannel.listen('CallAccepted', handleCallAccepted);
      userChannel.listen('CallDeclined', handleCallDeclined);
      userChannel.listen('CallEnded', handleCallEnded);
    }

    return () => {
      if (callChannel && channelName) {
        callChannel.stopListening('.call.accepted', handleCallAccepted);
        callChannel.stopListening('.call.declined', handleCallDeclined);
        callChannel.stopListening('.call.ended', handleCallEnded);
        callChannel.stopListening('CallAccepted', handleCallAccepted);
        callChannel.stopListening('CallDeclined', handleCallDeclined);
        callChannel.stopListening('CallEnded', handleCallEnded);
        echo.leave(channelName);
      }
      if (userChannel && user?.id) {
        userChannel.stopListening('.call.accepted', handleCallAccepted);
        userChannel.stopListening('.call.declined', handleCallDeclined);
        userChannel.stopListening('.call.ended', handleCallEnded);
        userChannel.stopListening('CallAccepted', handleCallAccepted);
        userChannel.stopListening('CallDeclined', handleCallDeclined);
        userChannel.stopListening('CallEnded', handleCallEnded);
      }
    };
  }, [isOpen, callId, activeRoomName, user?.id]);

  // Outgoing call status polling heartbeat: ensures that when recipient picks up on mobile,
  // the caller on web immediately switches to connected even if websocket event is delayed.
  useEffect(() => {
    if (!isOpen || mode !== 'outgoing' || !callId) return;

    const pollInterval = setInterval(() => {
      fetch(`${API_BASE}/calls/${callId}`, { headers: getAuthHeaders() })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.call) return;
          const status = data.call.status;
          if (status === 'accepted') {
            stopCallSounds();
            if (data.livekit_token) setActiveToken(data.livekit_token);
            if (data.livekit_host) setActiveHost(data.livekit_host);
            if (data.room_name) setActiveRoomName(data.room_name);
            setMode('connected');
          } else if (status === 'declined') {
            stopCallSounds();
            setConnectionStatus('Call declined');
            setTimeout(() => {
              if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; }
              onClose();
            }, 1500);
          } else if (status === 'ended') {
            stopCallSounds();
            setConnectionStatus('Call ended');
            setTimeout(() => {
              if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; }
              onClose();
            }, 1200);
          }
        })
        .catch(() => {});
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [isOpen, mode, callId]);

  // Fetch token if connected but token not yet present
  useEffect(() => {
    if (mode === 'connected' && (!activeToken || !activeHost) && callId) {
      fetch(`${API_BASE}/calls/${callId}/token`, { headers: getAuthHeaders() })
        .then((res) => res.json())
        .then((data) => {
          if (data.livekit_token) setActiveToken(data.livekit_token);
          if (data.livekit_host) setActiveHost(data.livekit_host);
          if (data.room_name) setActiveRoomName(data.room_name);
        })
        .catch(() => {});
    }
  }, [mode, activeToken, activeHost, callId]);

  // Connect to LiveKit SFU when in 'connected' mode and token is ready
  useEffect(() => {
    if (!isOpen || mode !== 'connected' || !activeToken || !activeHost) return;

    let isCancelled = false;
    let room: Room;

    const connectLiveKit = async () => {
      try {
        setConnectionStatus('Connecting to audio/video server...');

        room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: { width: 1280, height: 720, frameRate: 30 },
          },
        });
        roomRef.current = room;

        // Remote track subscribed
        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, _publication: RemoteTrackPublication, participant: Participant) => {
            setRemoteParticipantName(participant.name || contactName);

            if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
              track.attach(remoteVideoRef.current);
              setHasRemoteVideo(true);
            } else if (track.kind === Track.Kind.Audio) {
              let audioEl: HTMLAudioElement;
              if (remoteAudioRef.current) {
                track.attach(remoteAudioRef.current);
                audioEl = remoteAudioRef.current;
              } else {
                audioEl = track.attach() as HTMLAudioElement;
                audioEl.autoplay = true;
                document.body.appendChild(audioEl);
              }
              // Explicitly call play() to bypass browser autoplay policy
              audioEl.play().catch(() => {});
            }
          }
        );

        // Remote track unsubscribed
        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach();
          if (track.kind === Track.Kind.Video) {
            setHasRemoteVideo(false);
          }
        });

        // Participant disconnected
        room.on(RoomEvent.ParticipantDisconnected, () => {
          setConnectionStatus('Other participant left');
          setTimeout(() => {
            cleanupAndClose();
          }, 1500);
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

        // Publish local mic
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMuted(false);

        // Publish local camera if video call
        if (callType === 'video') {
          if (previewStreamRef.current) {
            previewStreamRef.current.getTracks().forEach((t) => t.stop());
            previewStreamRef.current = null;
          }

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
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [isOpen, mode, activeToken, activeHost, callType, contactName]);

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

  // Internal cleanup: disconnect LiveKit and close modal WITHOUT posting to API
  const cleanupAndClose = () => {
    stopCallSounds();
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    onClose();
  };

  // End / Hang up call — user-initiated, posts to API then cleans up
  const handleEndCall = async () => {
    stopCallSounds();
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

  // Answer call — posts accept, transitions to connected only if accepted
  const handleAnswerCall = async () => {
    stopCallSounds();
    if (callId) {
      try {
        const res = await fetch(`${API_BASE}/calls/${callId}/accept`, {
          method: 'POST',
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
          // Call may have been cancelled by caller already
          setConnectionStatus(data?.message || 'Call no longer available');
          setTimeout(() => cleanupAndClose(), 1500);
          return;
        }
        if (data.livekit_token) setActiveToken(data.livekit_token);
        if (data.livekit_host) setActiveHost(data.livekit_host);
        if (data.room_name) setActiveRoomName(data.room_name);
      } catch {
        setConnectionStatus('Failed to connect');
        setTimeout(() => cleanupAndClose(), 1500);
        return;
      }
    }
    setMode('connected');
    if (onAnswer) onAnswer();
  };


  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl text-white overflow-hidden animate-in fade-in duration-300">
      <audio ref={remoteAudioRef} autoPlay />

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
        <div className="relative w-full h-full max-w-4xl max-h-[92vh] flex flex-col justify-between p-4 bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden mx-4">
          {/* Main Remote Video or Audio Avatar Area */}
          <div className="absolute inset-0 z-0 bg-slate-900 flex items-center justify-center overflow-hidden">
            {callType === 'video' ? (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    hasRemoteVideo ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                {!hasRemoteVideo && (
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
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />
          </div>

          {/* Top Bar: Contact Name, Call Duration, & PIP Local Video */}
          <div className="relative z-10 flex items-start justify-between p-2">
            <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-white">{remoteParticipantName || contactName}</span>
              <span className="text-xs text-slate-300 font-mono border-l border-white/20 pl-2">
                {formatTimer(durationSeconds)}
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
