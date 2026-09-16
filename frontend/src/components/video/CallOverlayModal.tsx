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
} from "@phosphor-icons/react";
import { Room, RoomEvent, Track, RemoteTrack, RemoteTrackPublication, Participant, ConnectionState } from 'livekit-client';
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
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [outgoingPhase, setOutgoingPhase] = useState<'connecting' | 'ringing'>('connecting');
  const previewStreamRef = useRef<MediaStream | null>(null);
  const outgoingPreviewVideoRef = useRef<HTMLVideoElement | null>(null);

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
            audioPreset: {
              maxBitrate: 32000,
            },
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
              let audioEl: HTMLAudioElement;
              if (remoteAudioRef.current) {
                audioEl = remoteAudioRef.current;
                track.attach(audioEl);
              } else {
                audioEl = track.attach();
                document.body.appendChild(audioEl);
              }
              audioEl.muted = false;
              audioEl.volume = 1.0;
              audioEl.play().then(() => {
                setAudioPlaybackBlocked(false);
              }).catch((e) => {
                console.warn('[LiveKit] 🔇 Audio autoplay blocked by browser:', e);
                setAudioPlaybackBlocked(true);
              });
            }
          }
        );

        // Remote track unsubscribed
        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          console.log(`[LiveKit] 📴 TrackUnsubscribed: kind=${track.kind}, sid=${track.sid}`);
          track.detach();
          if (track.kind === Track.Kind.Video) {
            setRemoteVideoTrack(null);
            setHasRemoteVideo(false);
          }
        });

        // Participant joined
        room.on(RoomEvent.ParticipantConnected, (participant: Participant) => {
          console.log('[LiveKit] 👤 ParticipantConnected:', participant.identity, participant.name);
          setRemoteParticipantName(participant.name || contactName);
          if (!room.canPlaybackAudio) {
            room.startAudio().catch(() => {});
          }
        });

        // Participant disconnected — apply 8s grace period in case of network handover
        room.on(RoomEvent.ParticipantDisconnected, (participant: Participant) => {
          console.log('[LiveKit] 👤 ParticipantDisconnected:', participant.identity);
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
                let audioEl: HTMLAudioElement;
                if (remoteAudioRef.current) {
                  audioEl = remoteAudioRef.current;
                  pub.track.attach(audioEl);
                } else {
                  audioEl = pub.track.attach() as HTMLAudioElement;
                  document.body.appendChild(audioEl);
                }
                audioEl.muted = false;
                audioEl.volume = 1.0;
                audioEl.play().then(() => {
                  setAudioPlaybackBlocked(false);
                }).catch((e) => {
                  console.warn('[LiveKit] 🔇 Pre-existing audio track playback blocked:', e);
                  setAudioPlaybackBlocked(true);
                });
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
      if (roomRef.current === room) {
        roomRef.current = null;
      }
      room?.disconnect();
    };
  }, [isOpen, mode, activeToken, activeHost, callType]);

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
    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.volume = 1.0;
        await remoteAudioRef.current.play();
        setAudioPlaybackBlocked(false);
      } catch (e) {
        console.warn('[LiveKit] Failed to play remote audio element:', e);
      }
    }
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
    stopCallSounds();
    if (onAnswer) onAnswer();

    // Free pre-warm media streams immediately
    if (previewStreamRef.current) {
      try {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      previewStreamRef.current = null;
    }

    if (callId) {
      try {
        const res = await fetch(`${API_BASE}/calls/${callId}/accept`, {
          method: 'POST',
          headers: getAuthHeaders(),
        });
        const raw = await res.json();
        const data = raw?.data ?? raw;
        if (!res.ok) {
          // If status is 400 because call was already accepted, continue if credentials present
          if (res.status === 400 && (activeToken || data?.livekit_token)) {
            const token = data?.livekit_token || data?.call?.livekit_token;
            if (token) setActiveToken(token);
            setMode('connected');
            return;
          }
          setConnectionStatus(data?.message || 'Call no longer available');
          setTimeout(() => cleanupAndClose(), 1500);
          return;
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
        if (!activeToken || !activeHost) {
          setConnectionStatus('Failed to connect');
          setTimeout(() => cleanupAndClose(), 1500);
          return;
        }
      }
    }
    setMode('connected');
  };


  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl text-white overflow-hidden animate-in fade-in duration-300">
      <audio ref={remoteAudioRef} autoPlay playsInline />

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
            {callType === 'video' ? (
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
              <span className="text-xs font-semibold text-white">{remoteParticipantName || contactName}</span>
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
