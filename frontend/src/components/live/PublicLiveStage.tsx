import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowsIn,
  ArrowsOut,
  Check,
  Gift as GiftIcon,
  Heart,
  Microphone,
  MicrophoneSlash,
  PaperPlaneRight,
  PhoneSlash,
  PushPin,
  Radio,
  ShareNetwork,
  ShoppingBag,
  SpeakerHigh,
  SpeakerSimpleSlash,
  Spinner,
  Trophy,
  Users,
  VideoCamera,
  VideoCameraSlash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  ConnectionState,
  Participant,
  RemoteParticipant,
  Room,
  RoomEvent,
  Track,
  TrackPublication,
} from "livekit-client";
import { toast } from "sonner";
import { LiveGiftOverlay, type GiftEventPayload } from "@/components/gifts/LiveGiftOverlay";
import { LiveGiftTrayModal } from "@/components/gifts/LiveGiftTrayModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/api/authFetch";
import { apiClient } from "@/lib/api/client";
import { type LiveStreamEndedPayload } from "@/hooks/useLiveStreamEnded";
import { getEcho } from "@/lib/echo";
import { liveSessionStore } from "@/lib/session/liveSessionStore";

interface LiveHost {
  id: number;
  name: string;
  username?: string | null;
  avatar_url?: string | null;
}

interface LiveCommunity {
  id: number;
  name: string;
  slug?: string | null;
}

export interface LiveStream {
  id: number;
  tracking_id: string;
  title: string;
  description: string | null;
  stream_mode: string;
  status: string;
  viewers_count: number;
  likes_count?: number;
  total_coins_earned?: number;
  started_at: string | null;
  host: LiveHost | null;
  community: LiveCommunity | null;
  pinned_product?: {
    id: number;
    title: string;
    price: number;
    image_url?: string;
  } | null;
}

export interface LiveKitAccess {
  token: string;
  host: string;
  room?: string;
  isPublisher: boolean;
}

interface ChatMessage {
  id: number | string;
  message: string;
  user: {
    id: number;
    name: string;
    username?: string | null;
    avatar?: string | null;
    role?: string;
  };
  created_at?: string;
  is_gift?: boolean;
}

interface FloatingHeartItem {
  id: number;
  x: number;
  color: string;
}

interface Props {
  stream: LiveStream;
  liveKitAccess: LiveKitAccess;
  isHost: boolean;
  onLeave: () => void;
  onStreamEnded?: (payload: LiveStreamEndedPayload) => void;
}

export function PublicLiveStage({ stream, liveKitAccess, isHost, onLeave, onStreamEnded }: Props) {
  const sessionId = `live:${stream.id}`;
  // LiveKit state. The room itself belongs to the session store so navigating
  // away keeps the broadcast (and the roster) alive for everyone else.
  const [room, setRoom] = useState<Room | null>(liveSessionStore.getRoom(sessionId));
  const [connecting, setConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Host publishing controls
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(stream.stream_mode !== "audio");
  const [isEndingStream, setIsEndingStream] = useState(false);

  // Stream metrics
  const [viewerCount, setViewerCount] = useState(stream.viewers_count || 1);
  const [likesCount, setLikesCount] = useState(stream.likes_count || 0);
  const [totalCoins, setTotalCoins] = useState(stream.total_coins_earned || 0);
  const [pinnedProduct, setPinnedProduct] = useState(stream.pinned_product || null);
  const [pinnedComment, setPinnedComment] = useState<{
    id: number;
    message: string;
    user: { id?: number; name?: string; username?: string | null; avatar_url?: string | null };
    pinned_at?: string;
  } | null>(null);

  // Rankings modal state
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [rankings, setRankings] = useState<{
    top_gifters: Array<{ user_id: number; name: string; username: string; avatar_url?: string; total_coins: number }>;
    top_engagers: Array<{ user_id: number; name: string; username: string; avatar_url?: string; total_likes: number }>;
  } | null>(null);
  const [loadingRankings, setLoadingRankings] = useState(false);

  // Live Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [celebrationGift, setCelebrationGift] = useState<GiftEventPayload | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Floating hearts
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeartItem[]>([]);

  // DOM refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const seenGiftIdsRef = useRef<Set<number | string>>(new Set());
  // Guards the poll fallback so detect-and-nofify of an ended stream runs once.
  const endedNotifiedRef = useRef(false);
  // Mirrors isAudioMuted so the LiveKit connect effect (which must not depend on
  // mute state) can honour the current choice when it attaches audio tracks.
  const isAudioMutedRef = useRef(false);
  // Audio elements this room created. LiveKit attaches remote audio to audioRef
  // when one is available, but otherwise creates its own element and appends it
  // to <body>; those fallbacks are tracked here so muting this stream never
  // reaches audio elements owned by other players on the page.
  const ownedAudioElsRef = useRef<Set<HTMLAudioElement>>(new Set());

  // Applies the mute state to the audio elements this room has attached.
  const applyAudioMute = useCallback((muted: boolean, resumePlayback = false) => {
    isAudioMutedRef.current = muted;

    const elements = Array.from(ownedAudioElsRef.current);
    if (audioRef.current && !elements.includes(audioRef.current)) {
      elements.push(audioRef.current);
    }

    elements.forEach((el) => {
      el.muted = muted;
    });

    if (!muted && resumePlayback) {
      elements.forEach((el) => {
        void el.play().catch(() => {
          // Autoplay policy can still block; the audioBlocked banner handles it.
        });
      });
    }
  }, []);

  // Auto-scroll chat to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // Poll stream metrics and chat messages every 3s
  const pollMetricsAndChat = useCallback(async () => {
    try {
      const [streamRes, chatRes] = await Promise.all([
        authFetch(`/live/${stream.id}`),
        authFetch(`/live/${stream.id}/chat`),
      ]);

      if (streamRes.ok) {
        const json = await streamRes.json().catch(() => ({}));
        const data = json?.data?.stream || json?.stream || json?.data;
        if (data) {
          if (typeof data.viewers_count === "number") setViewerCount(data.viewers_count);
          if (typeof data.likes_count === "number") setLikesCount(data.likes_count);
          if (typeof data.total_coins_earned === "number") setTotalCoins(data.total_coins_earned);
          if (json?.data?.pinned_product) setPinnedProduct(json.data.pinned_product);

          // Fallback if the realtime push is missed: once the stream flips to
          // "ended" mid-session, close the stage for this viewer too.
          if (
            data.status === "ended"
            && stream.status === "live"
            && onStreamEnded
            && !endedNotifiedRef.current
          ) {
            endedNotifiedRef.current = true;
onStreamEnded({
                stream: {
                  id: stream.id,
                  tracking_id: stream.tracking_id ?? "",
                  title: data.title || stream.title,
                  status: "ended",
                  started_at: data.started_at ?? stream.started_at,
                  ended_at: data.ended_at ?? null,
                },
                // /live/{id} returns the raw model (no `summary` field), so
                // rebuild the summary from the final metric columns so the
                // ended view shows the true totals instead of stale ones.
                summary: {
                  total_likes:
                    typeof data.likes_count === "number"
                      ? data.likes_count
                      : stream.likes_count,
                  peak_viewers:
                    typeof data.peak_viewers === "number"
                      ? data.peak_viewers
                      : undefined,
                  total_coins_earned:
                    typeof data.total_coins_earned === "number"
                      ? data.total_coins_earned
                      : stream.total_coins_earned,
                },
              });
          }
        }
      }

      if (chatRes.ok) {
        const json = await chatRes.json().catch(() => ({}));
        const list: any[] = json?.data?.data || json?.data || [];
        if (Array.isArray(list)) {
          const parsed: ChatMessage[] = list.map((item) => ({
            id: item.id,
            message: item.message || "",
            user: item.user || { id: 0, name: "Viewer" },
            created_at: item.created_at,
            is_gift:
              item.message?.includes("🎁") ||
              item.type === "gift" ||
              item.message?.includes("sent a gift"),
          }));

          setChatMessages(parsed);

          // Check if any new gift was received from others to show celebration overlay
          for (const msg of parsed) {
            if (msg.is_gift && !seenGiftIdsRef.current.has(msg.id)) {
              seenGiftIdsRef.current.add(msg.id);
              setCelebrationGift({
                sender: {
                  id: msg.user.id,
                  name: msg.user.name,
                  username: msg.user.username || msg.user.name.toLowerCase().replace(/\s+/g, ""),
                  avatar: msg.user.avatar || undefined,
                },
                gift: {
                  id: 1,
                  name: msg.message.replace(/🎁\s*/, ""),
                  icon: "🎁",
                  animation_type: "premium",
                },
                amount: 100,
                currency: "NGN",
                sent_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch {
      // Ignore polling errors
    }
  }, [onStreamEnded, stream.id, stream.started_at, stream.status, stream.title, stream.tracking_id, stream.likes_count, stream.total_coins_earned]);

  useEffect(() => {
    void pollMetricsAndChat();
    const interval = setInterval(pollMetricsAndChat, 3000);
    return () => clearInterval(interval);
  }, [pollMetricsAndChat]);

  // Scroll to bottom when messages list updates
  useEffect(() => {
    scrollToBottom(false);
  }, [chatMessages.length, scrollToBottom]);

  // Spawn floating heart
  const spawnFloatingHeart = useCallback((colorOverride?: string) => {
    const id = Date.now() + Math.random();
    const x = Math.floor(Math.random() * 50) + 35; // 35% to 85% width
    const colors = ["#ef4444", "#ec4899", "#f59e0b", "#8b5cf6", "#06b6d4", "#10b981"];
    const color = colorOverride || colors[Math.floor(Math.random() * colors.length)];

    setFloatingHearts((prev) => [...prev.slice(-25), { id, x, color }]);

    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
    }, 2000);
  }, []);

  const likeBatchRef = useRef<number>(0);
  const likeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const flushLikes = useCallback(async () => {
    const count = likeBatchRef.current;
    if (count <= 0) return;
    likeBatchRef.current = 0;
    try {
      await authFetch(`/live/${stream.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
    } catch {
      // Ignore background network failure
    }
  }, [stream.id]);

  // Handle user tap like (immediate visual heart + buffered batch network send)
  const handleLike = useCallback(() => {
    spawnFloatingHeart();
    setLikesCount((prev) => prev + 1);

    likeBatchRef.current += 1;
    if (likeTimerRef.current) clearTimeout(likeTimerRef.current);
    // The server rejects batches over 50 (HTTP 422, dropped silently), so flush
    // as soon as we hit the cap instead of letting the batch grow past it.
    if (likeBatchRef.current >= 50) {
      void flushLikes();
    } else {
      likeTimerRef.current = setTimeout(flushLikes, 400);
    }
  }, [spawnFloatingHeart, flushLikes]);

  // Flush any buffered likes and clear the timer when leaving the stream.
  useEffect(() => {
    return () => {
      if (likeTimerRef.current) clearTimeout(likeTimerRef.current);
      void flushLikes();
    };
  }, [flushLikes]);

  // Real-time Echo listener for synchronized live events
  useEffect(() => {
    if (!stream.id) return;
    const echo = getEcho();
    const channel = echo.channel(`live-stream.${stream.id}`);

    // 1. Synchronized real-time Likes
    channel.listen("LiveStreamLiked", (payload: any) => {
      if (typeof payload.total_likes === "number") {
        setLikesCount(payload.total_likes);
      } else if (typeof payload.count === "number") {
        setLikesCount((prev) => prev + payload.count);
      }
      const count = Math.min(payload.count || 1, 6);
      for (let i = 0; i < count; i++) {
        setTimeout(() => spawnFloatingHeart(), i * 70);
      }
    });

    // 2. Synchronized real-time Gifts
    channel.listen("LiveStreamGiftSent", (payload: any) => {
      if (typeof payload.total_coins_earned === "number") {
        setTotalCoins(payload.total_coins_earned);
      }
      const gift = payload.gift || {};
      const sender = payload.sender || {};
      setCelebrationGift({
        sender: {
          id: sender.id || 0,
          name: sender.name || "Fan",
          username: sender.username || "fan",
          avatar: sender.avatar_url || undefined,
        },
        gift: {
          id: gift.id || 1,
          name: gift.name || "Gift",
          icon: gift.icon_url || "🎁",
          animation_type: gift.animation_tier || "premium",
        },
        amount: gift.coin_price || 100,
        currency: "COINS",
        sent_at: new Date().toISOString(),
      });
    });

    // 3. Real-time Chat Messages
    channel.listen("LiveStreamChatMessage", (payload: any) => {
      const msg = payload.message;
      if (msg) {
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [
            ...prev,
            {
              id: msg.id,
              message: msg.message || "",
              user: msg.user || { id: 0, name: "Viewer" },
              created_at: msg.created_at,
              is_gift: Boolean(msg.gift_id || msg.message?.includes("🎁")),
            },
          ];
        });
        scrollToBottom();
      }
    });

    // 4. Product Pinning
    channel.listen("LiveStreamProductPinned", (payload: any) => {
      if (payload.product) {
        setPinnedProduct(payload.product);
        toast.info(`Featured Product: ${payload.product.title}`);
      }
    });

    // 5. Product Unpinning
    channel.listen("LiveStreamProductUnpinned", () => {
      setPinnedProduct(null);
    });

    // 6. Comment Pinning
    channel.listen("LiveStreamCommentPinned", (payload: any) => {
      if (payload.comment) {
        setPinnedComment(payload.comment);
      }
    });

    // 7. Comment Unpinning
    channel.listen("LiveStreamCommentUnpinned", () => {
      setPinnedComment(null);
    });

    // 8. Guest Action
    channel.listen("LiveStreamGuestAction", (payload: any) => {
      if (payload.action === "requested" && isHost) {
        toast.info(`${payload.guest?.name || "A viewer"} requested to join as co-host!`);
      } else if (payload.action === "invited") {
        toast.info("Host invited a guest to co-host!");
      }
    });

    // 9. Viewer Count Update
    channel.listen("LiveStreamViewerCountUpdated", (payload: any) => {
      if (typeof payload.viewers_count === "number") {
        setViewerCount(payload.viewers_count);
      }
    });

    return () => {
      try {
        channel.stopListening("LiveStreamLiked");
        channel.stopListening("LiveStreamGiftSent");
        channel.stopListening("LiveStreamChatMessage");
        channel.stopListening("LiveStreamProductPinned");
        channel.stopListening("LiveStreamProductUnpinned");
        channel.stopListening("LiveStreamCommentPinned");
        channel.stopListening("LiveStreamCommentUnpinned");
        channel.stopListening("LiveStreamGuestAction");
        channel.stopListening("LiveStreamViewerCountUpdated");
        (channel as any).leave?.();
      } catch {}
    };
  }, [isHost, scrollToBottom, spawnFloatingHeart, stream.id]);

  // Register with the persistent session registry so the floating dock can keep
  // this broadcast on screen while the user browses the rest of the app.
  useEffect(() => {
    liveSessionStore.start({
      id: sessionId,
      kind: "live",
      title: stream.title || "Live broadcast",
      subtitle: isHost ? "Hosting" : `${Math.max(1, stream.viewers_count || 1)} watching`,
      avatarUrl: stream.host?.avatar_url ?? null,
      returnTo: null,
      notifyLeave: async () => {
        const res = await authFetch(`/live/${stream.id}/leave`, { method: "POST" });
        if (!res.ok) {
          // Presence is reconciled server-side, so a failed leave is recoverable.
          return;
        }
      },
      onEnded: (reason) => {
        if (reason === "left") {
          onLeave();
        }
      },
    });
  }, [sessionId, stream.id, stream.title, stream.viewers_count, stream.host?.avatar_url, isHost, onLeave]);

  // Initialize and connect to LiveKit
  useEffect(() => {
    let isDisposed = false;

    const connectLiveKit = async () => {
      setConnecting(true);
      setConnectionError(null);

      try {
        // Re-attach to an existing room instead of creating a second one.
        const roomInstance = liveSessionStore.getRoom(sessionId) ?? new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          videoCaptureDefaults: {
            resolution: { width: 1280, height: 720, frameRate: 30 },
          },
        });

        setRoom(roomInstance);

        let host = liveKitAccess.host;
        if (!host || host.includes("localhost") || host.includes("127.0.0.1")) {
          host = window.location.hostname.includes("murihspace.com")
            ? "https://live-staging.murihspace.com"
            : host;
        }

        await roomInstance.connect(host, liveKitAccess.token);

        if (isDisposed) {
          await roomInstance.disconnect();
          return;
        }

        // The room is now owned by the session store.
        liveSessionStore.setRoom(sessionId, roomInstance);
        liveSessionStore.patch(sessionId, { status: "connected", isMuted: isAudioMutedRef.current });

        // Check audio autoplay
        if (!roomInstance.canPlaybackAudio) {
          setAudioBlocked(true);
        } else {
          try {
            await roomInstance.startAudio();
          } catch {
            setAudioBlocked(true);
          }
        }

        // If current user is host / publisher, publish local tracks
        if (isHost || liveKitAccess.isPublisher) {
          const local = roomInstance.localParticipant;
          if (local) {
            try {
              await local.setMicrophoneEnabled(true);
              setIsMicOn(true);
            } catch (micErr) {
              console.warn("Could not publish microphone track:", micErr);
            }

            if (stream.stream_mode !== "audio") {
              try {
                await local.setCameraEnabled(true);
                setIsCamOn(true);
                const localVideoPub = Array.from(local.videoTrackPublications.values())[0];
                if (localVideoPub?.track && videoRef.current) {
                  localVideoPub.track.attach(videoRef.current);
                }
              } catch (camErr) {
                console.warn("Could not publish camera track:", camErr);
              }
            }
          }
        }

        // Already-published remote tracks are attached by the listener effect,
        // which re-syncs once this element exists.

        setConnecting(false);
      } catch (err: unknown) {
        if (!isDisposed) {
          setConnectionError(err instanceof Error ? err.message : "Failed to connect to live stream.");
          setConnecting(false);
        }
      }
    };

    void connectLiveKit();

    return () => {
      isDisposed = true;
      // Deliberately no `disconnect()` here: this view unmounting is not the
      // same as the user leaving. The room and its audio stay in the session
      // store and keep running until an explicit leave or a real failure.
      setRoom(liveSessionStore.getRoom(sessionId));
    };
  }, [applyAudioMute, isHost, liveKitAccess, sessionId, stream.stream_mode]);

  // Room listeners live in their own effect: the room is shared and long-lived,
  // so registering them inside the connect effect would stack duplicates every
  // time the page re-attached.
  useEffect(() => {
    const roomInstance = room;
    if (!roomInstance) return;

    const attachVideoTrack = (track: Track) => {
      if (videoRef.current && track.kind === Track.Kind.Video) {
        track.attach(videoRef.current);
      }
    };

    const attachAudioTrack = (track: Track) => {
      if (track.kind !== Track.Kind.Audio) return;

      if (audioRef.current) {
        track.attach(audioRef.current);
        ownedAudioElsRef.current.add(audioRef.current);
        liveSessionStore.adoptAudioElement(sessionId, audioRef.current);
      } else {
        // LiveKit created and appended this to <body>; hand it to the store so
        // audio survives this view unmounting.
        const el = track.attach();
        el.autoplay = true;
        document.body.appendChild(el);
        ownedAudioElsRef.current.add(el);
        liveSessionStore.adoptAudioElement(sessionId, el);
      }

      // Honour a mute chosen before this track arrived.
      applyAudioMute(isAudioMutedRef.current);
    };

    const syncParticipantTracks = (participant: Participant) => {
      participant.trackPublications.forEach((pub: TrackPublication) => {
        if (pub.track) {
          if (pub.kind === Track.Kind.Video) attachVideoTrack(pub.track);
          if (pub.kind === Track.Kind.Audio) attachAudioTrack(pub.track);
        }
      });
    };

    const onTrackSubscribed = (track: Track) => {
      if (track.kind === Track.Kind.Video) attachVideoTrack(track);
      if (track.kind === Track.Kind.Audio) attachAudioTrack(track);
    };

    const onAudioPlaybackStatus = () => {
      setAudioBlocked(!roomInstance.canPlaybackAudio);
    };

    const onParticipantConnected = (p: RemoteParticipant) => {
      syncParticipantTracks(p);
    };

    const onDisconnected = () => {
      // Only a real transport disconnect ends the session; navigating away
      // unmounts this view without reaching here.
      liveSessionStore.close(sessionId, "error");
    };

    const onConnectionStateChanged = (state: ConnectionState) => {
      liveSessionStore.patch(sessionId, {
        status:
          state === ConnectionState.Connected
            ? "connected"
            : state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting
              ? "reconnecting"
              : "connecting",
      });
    };

    roomInstance.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    roomInstance.on(RoomEvent.AudioPlaybackStatusChanged, onAudioPlaybackStatus);
    roomInstance.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    roomInstance.on(RoomEvent.Disconnected, onDisconnected);
    roomInstance.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);

    // Remote tracks may have arrived before this element existed.
    roomInstance.remoteParticipants.forEach(syncParticipantTracks);

    return () => {
      roomInstance.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      roomInstance.off(RoomEvent.AudioPlaybackStatusChanged, onAudioPlaybackStatus);
      roomInstance.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      roomInstance.off(RoomEvent.Disconnected, onDisconnected);
      roomInstance.off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
    };
  }, [applyAudioMute, room, sessionId]);

  // Explicit, user-initiated leave: posts the presence leave exactly once and
  // tears the media down. Navigating away must never call this.
  const handleLeaveSession = () => {
    void liveSessionStore.end(sessionId, "left");
  };

  // Toggle viewer mute
  const toggleMute = () => {
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    applyAudioMute(next, !next);
  };

  // Handle Unmute Audio Banner click
  const handleUnmuteAudio = async () => {
    if (room) {
      try {
        await room.startAudio();
        setAudioBlocked(false);
        setIsAudioMuted(false);
        applyAudioMute(false, true);
        toast.success("Audio unmuted!");
      } catch (err) {
        console.error("Audio playback error:", err);
      }
    }
  };

  // Toggle host microphone
  const toggleMic = async () => {
    if (!room?.localParticipant) return;
    const nextState = !isMicOn;
    try {
      await room.localParticipant.setMicrophoneEnabled(nextState);
      setIsMicOn(nextState);
      toast.info(nextState ? "Microphone active" : "Microphone muted");
    } catch {
      toast.error("Could not toggle microphone.");
    }
  };

  // Toggle host camera
  const toggleCam = async () => {
    if (!room?.localParticipant) return;
    const nextState = !isCamOn;
    try {
      await room.localParticipant.setCameraEnabled(nextState);
      setIsCamOn(nextState);
      toast.info(nextState ? "Camera enabled" : "Camera turned off");
      if (nextState) {
        const localVideoPub = Array.from(room.localParticipant.videoTrackPublications.values())[0];
        if (localVideoPub?.track && videoRef.current) {
          localVideoPub.track.attach(videoRef.current);
        }
      }
    } catch {
      toast.error("Could not toggle camera.");
    }
  };

  // End live stream (for Host)
  const handleEndStream = async () => {
    if (!confirm("Are you sure you want to end this live broadcast for all viewers?")) return;
    setIsEndingStream(true);
    try {
      await authFetch(`/live/${stream.id}/end`, { method: "POST" });
      toast.success("Broadcast ended.");
      // The server ended it for everyone, so no presence leave is needed.
      liveSessionStore.close(sessionId, "host-ended");
    } catch {
      toast.error("Failed to end broadcast.");
    } finally {
      setIsEndingStream(false);
    }
  };

  // Send a chat message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || sendingChat) return;

    setSendingChat(true);
    try {
      const res = await authFetch(`/live/${stream.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) throw new Error("Failed to send message.");
      setChatInput("");
      await pollMetricsAndChat();
      scrollToBottom();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSendingChat(false);
    }
  };

  const handlePinComment = async (msgId: number | string) => {
    if (!isHost) return;
    try {
      const res = await authFetch(`/live/${stream.id}/pin-comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: msgId }),
      });
      if (res.ok) {
        toast.success("Comment pinned to live broadcast!");
      }
    } catch {
      toast.error("Failed to pin comment.");
    }
  };

  const handleUnpinComment = async () => {
    if (!isHost) return;
    try {
      const res = await authFetch(`/live/${stream.id}/unpin-comment`, {
        method: "POST",
      });
      if (res.ok) {
        setPinnedComment(null);
        toast.success("Comment unpinned.");
      }
    } catch {
      toast.error("Failed to unpin comment.");
    }
  };

  const fetchRankings = async () => {
    setLoadingRankings(true);
    try {
      const res = await authFetch(`/live/${stream.id}/rankings`);
      if (res.ok) {
        const json = await res.json();
        // The API wraps bodies in an envelope ({ success, data }); unwrap it so
        // top_gifters / top_engagers are populated.
        setRankings(json?.data ?? json);
      }
    } catch {
    } finally {
      setLoadingRankings(false);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!stageContainerRef.current) return;
    if (!document.fullscreenElement) {
      stageContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Copy share link
  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: stream.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      toast.success("Live broadcast link copied!");
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      toast.error("Could not copy link.");
    }
  };

  const hostUsername = stream.host?.username ? `@${stream.host.username}` : stream.host?.name;

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[600px] w-full flex-col overflow-hidden bg-[#0A0D14] text-white lg:flex-row">
      {/* Gift celebration animation overlay */}
      <LiveGiftOverlay
        giftEvent={celebrationGift}
        onAnimationComplete={() => setCelebrationGift(null)}
      />

      {/* Gift Tray Modal */}
      <LiveGiftTrayModal
        isOpen={isGiftModalOpen}
        onClose={() => setIsGiftModalOpen(false)}
        recipientId={stream.host?.id || 1}
        recipientName={stream.host?.name || "Host"}
        streamId={stream.id}
        onGiftSent={(gift, amount) => {
          setTotalCoins((prev) => prev + (amount || 100));
          setCelebrationGift({
            sender: {
              id: 0,
              name: "You",
              username: "you",
            },
            gift: {
              id: gift?.id || 1,
              name: gift?.name || "Gift",
              icon: gift?.icon || "🎁",
              animation_type: "premium",
            },
            amount: amount || 100,
            currency: "NGN",
            sent_at: new Date().toISOString(),
          });
          void pollMetricsAndChat();
        }}
      />

      {/* Audio element for remote sound */}
      <audio ref={audioRef} autoPlay />

      {/* LEFT COLUMN: LIVE BROADCAST STAGE */}
      <div
        ref={stageContainerRef}
        className="relative flex flex-1 flex-col overflow-hidden bg-black"
      >
        {/* TOP VIDEO OVERLAY: Host Profile, LIVE badge, and stats */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4">
          <div className="flex items-center gap-3">
            {/* Only viewers leave through here. For a host this button would
                call end(), abandoning a stream that is still live server-side. */}
            {!isHost && (
              <button
                type="button"
                onClick={handleLeaveSession}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/60 text-white/90 backdrop-blur-md transition-colors hover:bg-black/80 hover:text-white border border-white/10"
                title="Leave broadcast"
              >
                <ArrowLeft weight="bold" className="h-4 w-4" />
              </button>
            )}
            {/* TikTok-style conic-gradient spinning LIVE ring */}
            <div className="relative shrink-0">
              <div
                className="absolute inset-0 animate-spin-slow rounded-full"
                style={{
                  background: "conic-gradient(from 0deg, #ef4444, #f97316, #ec4899, #ef4444)",
                  padding: "2.5px",
                  borderRadius: "9999px",
                }}
              >
                <div className="h-full w-full rounded-full bg-black" />
              </div>
              <Avatar className="relative h-10 w-10 ring-2 ring-black">
                <AvatarImage src={stream.host?.avatar_url ?? undefined} alt={stream.host?.name} />
                <AvatarFallback className="bg-primary/20 text-xs font-bold text-primary">
                  {stream.host?.name?.slice(0, 2).toUpperCase() || "LV"}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-1.5 py-0 text-[9px] font-black uppercase leading-4 tracking-wide text-white shadow ring-1 ring-black">
                LIVE
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold text-white">{stream.host?.name}</span>
              </div>
              <p className="truncate text-xs font-medium text-white/70">{hostUsername}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Viewer Count Badge */}
            <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/10">
              <Users weight="fill" className="h-3.5 w-3.5 text-blue-400" />
              <span>{viewerCount}</span>
            </div>

            {/* Total Likes Badge */}
            <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/10">
              <Heart weight="fill" className="h-3.5 w-3.5 text-rose-500" />
              <span>{likesCount}</span>
            </div>

            {/* Total Coins Earned Badge */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-1 text-xs font-bold text-amber-300 backdrop-blur-md">
              <GiftIcon weight="fill" className="h-3.5 w-3.5 text-amber-400" />
              <span>{totalCoins} Coins</span>
            </div>

            {/* Live Rankings / Leaderboard Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void fetchRankings();
                setIsLeaderboardOpen(true);
              }}
              className="h-8 rounded-full border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 px-2.5 gap-1.5"
              title="Live Rankings & Leaderboard"
            >
              <Trophy weight="fill" className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden md:inline text-xs font-semibold">Rankings</span>
            </Button>

            {/* Share Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="h-8 rounded-full border-white/20 bg-black/50 text-white hover:bg-white/20 hover:text-white"
            >
              {shareCopied ? <Check weight="bold" className="h-3.5 w-3.5 text-emerald-400" /> : <ShareNetwork weight="bold" className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* MAIN VIDEO / AUDIO CANVAS (Tap anywhere to send hearts!) */}
        <div
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("button") || target.closest("input") || target.closest("a") || target.closest(".interactive-card")) {
              return;
            }
            handleLike();
          }}
          className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0c1017] cursor-pointer select-none"
        >
          {connecting && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
              <Spinner weight="bold" className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-semibold text-white/80">Connecting to live broadcast…</p>
            </div>
          )}

          {connectionError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
              <WarningCircle weight="fill" className="h-10 w-10 text-red-500" />
              <p className="max-w-md text-sm text-red-200">{connectionError}</p>
              <Button size="sm" variant="outline" onClick={handleLeaveSession} className="mt-2 border-white/20 text-white">
                Back to Details
              </Button>
            </div>
          )}

          {/* Autoplay Audio Blocked Banner */}
          {audioBlocked && (
            <div className="absolute top-16 z-30 mx-auto flex items-center gap-3 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-xl shadow-red-600/30 animate-bounce">
              <SpeakerSimpleSlash weight="fill" className="h-5 w-5" />
              <span>Audio is muted by your browser</span>
              <button
                onClick={handleUnmuteAudio}
                className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-red-700 hover:bg-white/90"
              >
                Click to Unmute 🔊
              </button>
            </div>
          )}

          {/* Video Player */}
          {stream.stream_mode !== "audio" ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isHost}
              className="h-full w-full object-contain"
            />
          ) : (
            /* Audio Room Stage Visualizer */
            <div className="flex flex-col items-center justify-center gap-5">
              <div className="relative flex items-center justify-center">
                <div className="absolute h-40 w-40 rounded-full bg-primary/20 animate-ping" />
                <div className="absolute h-32 w-32 rounded-full bg-primary/30 animate-pulse" />
                <Avatar className="h-24 w-24 border-4 border-primary shadow-2xl">
                  <AvatarImage src={stream.host?.avatar_url ?? undefined} alt={stream.host?.name} />
                  <AvatarFallback className="bg-primary/30 text-2xl font-bold text-white">
                    {stream.host?.name?.slice(0, 2).toUpperCase() || "AU"}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold text-white">{stream.title}</h2>
                <p className="text-xs text-white/60">Live Audio Broadcast</p>
              </div>
            </div>
          )}

          {/* Floating Hearts Animation Canvas */}
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            {floatingHearts.map((heart) => (
              <div
                key={heart.id}
                className="absolute bottom-16 animate-float-heart"
                style={{
                  left: `${heart.x}%`,
                  color: heart.color,
                }}
              >
                <Heart weight="fill" className="h-7 w-7 drop-shadow-md" />
              </div>
            ))}
          </div>

          {/* Pinned Product Card (if available) */}
          {pinnedProduct && (
            <div className="interactive-card absolute bottom-20 left-4 z-20 max-w-sm rounded-xl border border-white/20 bg-black/80 p-3 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center gap-3">
                {pinnedProduct.image_url ? (
                  <img src={pinnedProduct.image_url} alt={pinnedProduct.title} className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
                    <ShoppingBag weight="fill" className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Featured Item</span>
                  <h4 className="truncate text-xs font-bold text-white">{pinnedProduct.title}</h4>
                  <p className="text-xs font-extrabold text-emerald-400">₦{(pinnedProduct.price / 100).toLocaleString()}</p>
                </div>
                <Button
                  size="sm"
                  className="h-8 bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500"
                  onClick={() => {
                    toast.info(`Purchasing ${pinnedProduct.title}…`);
                    void apiClient.post(`/live/${stream.id}/purchase`, { product_id: pinnedProduct.id }).then(() => {
                      toast.success("Order placed successfully!");
                    }).catch(() => {
                      toast.error("Could not complete order.");
                    });
                  }}
                >
                  Buy
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM OVERLAY + RIGHT-EDGE INTERACTION RAIL (TikTok-style) */}
        <div className="pointer-events-none absolute inset-0 z-20">
          {/* Bottom gradient info strip */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-4 pb-3 pt-20">
            <div className="pointer-events-auto flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h3 className="max-w-[200px] truncate text-sm font-bold text-white sm:max-w-xs">
                  {stream.title}
                </h3>
                <p className="mt-0.5 truncate text-xs font-medium text-white/70">
                  {hostUsername} {stream.community?.name ? `· ${stream.community.name}` : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Vertical interaction rail on the right edge */}
          <div className="pointer-events-auto absolute bottom-3 right-3 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleLike}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-md transition-transform hover:scale-110 active:scale-95"
              title="Like broadcast"
              aria-label="Like broadcast"
            >
              <Heart weight="fill" className="h-5 w-5 text-rose-500" />
            </button>
            <span className="text-[11px] font-bold text-white drop-shadow">{likesCount}</span>

            <button
              type="button"
              onClick={() => setIsGiftModalOpen(true)}
              className="mt-1 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-md transition-transform hover:scale-110 active:scale-95"
              title="Send a Gift"
              aria-label="Send a Gift"
            >
              <GiftIcon weight="fill" className="h-5 w-5 text-amber-400" />
            </button>
            <span className="text-[11px] font-bold text-amber-300 drop-shadow">{totalCoins}</span>

            <button
              type="button"
              onClick={() => { void fetchRankings(); setIsLeaderboardOpen(true); }}
              className="mt-1 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-md transition-transform hover:scale-110 active:scale-95"
              title="Live Rankings"
              aria-label="Live Rankings"
            >
              <Trophy weight="fill" className="h-5 w-5 text-amber-400" />
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-md transition-transform hover:scale-110 active:scale-95"
              title="Share broadcast"
              aria-label="Share broadcast"
            >
              {shareCopied ? <Check weight="bold" className="h-5 w-5 text-emerald-400" /> : <ShareNetwork weight="bold" className="h-5 w-5" />}
            </button>

            <div className="my-1 h-px w-8 bg-white/20" />

            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-md transition-transform hover:scale-110 active:scale-95"
              title="Toggle Fullscreen"
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <ArrowsIn weight="bold" className="h-4 w-4" /> : <ArrowsOut weight="bold" className="h-4 w-4" />}
            </button>

            {!isHost ? (
              <>
                <button
                  type="button"
                  onClick={toggleMute}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-md transition-transform hover:scale-110 active:scale-95"
                  title={isAudioMuted ? "Unmute" : "Mute"}
                  aria-label={isAudioMuted ? "Unmute" : "Mute"}
                >
                  {isAudioMuted ? <SpeakerSimpleSlash weight="bold" className="h-4 w-4" /> : <SpeakerHigh weight="bold" className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleLeaveSession}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-red-600/80 text-white backdrop-blur-md transition-transform hover:scale-110 active:scale-95"
                  title="Leave Broadcast"
                  aria-label="Leave Broadcast"
                >
                  <PhoneSlash weight="bold" className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void toggleMic()}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition-transform hover:scale-110 active:scale-95 ${
                    isMicOn ? "border-white/20 bg-black/50 text-white" : "border-red-500/40 bg-red-600 text-white"
                  }`}
                  title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                  aria-label={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {isMicOn ? <Microphone weight="bold" className="h-4 w-4" /> : <MicrophoneSlash weight="bold" className="h-4 w-4" />}
                </button>

                {stream.stream_mode !== "audio" && (
                  <button
                    type="button"
                    onClick={() => void toggleCam()}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition-transform hover:scale-110 active:scale-95 ${
                      isCamOn ? "border-white/20 bg-black/50 text-white" : "border-red-500/40 bg-red-600 text-white"
                    }`}
                    title={isCamOn ? "Turn Camera Off" : "Turn Camera On"}
                    aria-label={isCamOn ? "Turn Camera Off" : "Turn Camera On"}
                  >
                    {isCamOn ? <VideoCamera weight="bold" className="h-4 w-4" /> : <VideoCameraSlash weight="bold" className="h-4 w-4" />}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void handleEndStream()}
                  disabled={isEndingStream}
                  className="flex h-9 items-center gap-1 rounded-full border border-red-500/40 bg-red-600 px-2.5 text-white backdrop-blur-md transition-transform hover:scale-110 active:scale-95 disabled:opacity-60"
                  title="End Stream"
                >
                  {isEndingStream ? <Spinner weight="bold" className="h-3.5 w-3.5 animate-spin" /> : <PhoneSlash weight="bold" className="h-3.5 w-3.5" />}
                  <span className="text-[10px] font-bold">End</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: DEDICATED LIVE CHAT & GIFTING SIDEBAR */}
      <div className="flex h-80 w-full flex-col border-t border-white/10 bg-[#0F141C] lg:h-full lg:w-96 lg:border-t-0 lg:border-l">
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-[#131822]">
          <div className="flex items-center gap-2">
            <img src="/assets/murihspace-live-logo.png" alt="MurihSpace LIVE" className="h-5 w-auto object-contain opacity-90" draggable={false} />
          </div>
          <span className="text-[11px] font-semibold text-white/50">{chatMessages.length} messages</span>
        </div>

        {/* Pinned Comment Banner */}
        {pinnedComment && (
          <div className="mx-3 mt-2 flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs backdrop-blur-md">
            <div className="flex items-center gap-2 min-w-0">
              <PushPin weight="fill" className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <span className="font-bold text-primary mr-1.5">{pinnedComment.user.name}:</span>
                <span className="text-white/90">{pinnedComment.message}</span>
              </div>
            </div>
            {isHost && (
              <button
                type="button"
                onClick={handleUnpinComment}
                className="text-white/40 hover:text-white shrink-0 p-1"
                title="Unpin comment"
              >
                <X weight="bold" className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Chat Messages Feed (auto-scrolled to bottom) */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 scrollbar-thin scrollbar-thumb-white/10"
        >
          {chatMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-xs text-white/50">
              <Radio weight="fill" className="h-6 w-6 text-white/20 mb-2" />
              <span>Welcome to the live chat!</span>
              <span className="mt-0.5 text-[11px] text-white/30">Say hello to the host and viewers.</span>
            </div>
          ) : (
            chatMessages.map((msg) => {
              const isHostMsg = msg.user.id === stream.host?.id;

              if (msg.is_gift) {
                return (
                  <div
                    key={msg.id}
                    className="flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-amber-500/10 p-2.5 text-xs text-amber-200 shadow-md"
                  >
                    <span className="text-lg">🎁</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-extrabold text-amber-300">{msg.user.name}</span>
                      <p className="text-white font-medium">{msg.message}</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="group flex items-start gap-2.5 text-xs">
                  <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                    <AvatarImage src={msg.user.avatar ?? undefined} alt={msg.user.name} />
                    <AvatarFallback className="bg-white/10 text-[9px] font-bold text-white">
                      {msg.user.name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold ${isHostMsg ? "text-red-400 font-extrabold" : "text-blue-400"}`}>
                          {msg.user.name}
                        </span>
                        {isHostMsg && (
                          <span className="rounded bg-red-500/20 px-1 py-0.2 text-[9px] font-black uppercase text-red-400">
                            HOST
                          </span>
                        )}
                      </div>
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => handlePinComment(msg.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-white/40 hover:text-primary"
                          title="Pin comment"
                        >
                          <PushPin weight="bold" className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 break-words font-normal text-white/90 leading-relaxed">
                      {msg.message}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chat Action Footer: Text Input, Gift Button, Like Button */}
        <div className="border-t border-white/10 bg-[#131822] p-3 space-y-2">
          {/* Quick Reaction & Gift Bar */}
          <div className="flex items-center justify-between gap-2">
            {/* SEND GIFT BUTTON (Prominent & Glowing) */}
            {!isHost && (
              <Button
                type="button"
                onClick={() => setIsGiftModalOpen(true)}
                className="flex-1 h-9 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 font-extrabold text-xs text-white shadow-lg shadow-amber-500/20 hover:brightness-110 gap-1.5"
              >
                <GiftIcon weight="fill" className="h-4 w-4 animate-bounce" />
                <span>Send Gift</span>
              </Button>
            )}

            {/* SEND LIKE / HEART BUTTON */}
            <Button
              type="button"
              onClick={handleLike}
              className={`h-9 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-400 hover:bg-rose-600/30 gap-1.5 px-3 font-bold text-xs ${isHost ? "w-full justify-center" : ""}`}
            >
              <Heart weight="fill" className="h-4 w-4 text-rose-500" />
              <span>{likesCount}</span>
            </Button>
          </div>

          {/* Chat Form */}
          <form onSubmit={handleSendChat} className="flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Say something live…"
              className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white placeholder-white/40 focus:border-primary focus:bg-white/10 focus:outline-none"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!chatInput.trim() || sendingChat}
              className="h-8 w-8 rounded-xl p-0 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {sendingChat ? <Spinner weight="bold" className="h-3.5 w-3.5 animate-spin" /> : <PaperPlaneRight weight="fill" className="h-3.5 w-3.5" />}
            </Button>
          </form>
        </div>
      </div>

      {/* Live Rankings & Top Supporters Leaderboard Modal */}
      {isLeaderboardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#121620] p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Trophy weight="fill" className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Live Leaderboard</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLeaderboardOpen(false)}
                className="rounded-full p-1 text-white/60 hover:text-white hover:bg-white/10"
              >
                <X weight="bold" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                  <GiftIcon weight="fill" className="h-3.5 w-3.5" />
                  Top Supporters (Gifts)
                </h4>
                {loadingRankings ? (
                  <div className="flex justify-center py-4">
                    <Spinner weight="bold" className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : !rankings?.top_gifters?.length ? (
                  <p className="text-xs text-white/40 py-2">No gifts sent yet. Be the first supporter!</p>
                ) : (
                  <div className="space-y-2">
                    {rankings.top_gifters.map((g, idx) => (
                      <div key={g.user_id} className="flex items-center justify-between rounded-xl bg-white/5 p-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-black ${
                            idx === 0 ? "bg-amber-400 text-black" : idx === 1 ? "bg-slate-300 text-black" : idx === 2 ? "bg-amber-700 text-white" : "bg-white/10 text-white/60"
                          }`}>
                            {idx + 1}
                          </span>
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={g.avatar_url} />
                            <AvatarFallback>{g.name.slice(0, 1)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-bold text-white">{g.name}</span>
                        </div>
                        <span className="text-xs font-extrabold text-amber-300">🪙 {g.total_coins.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-2 flex items-center gap-1.5">
                  <Heart weight="fill" className="h-3.5 w-3.5" />
                  Top Engagers (Likes)
                </h4>
                {!rankings?.top_engagers?.length ? (
                  <p className="text-xs text-white/40 py-2">Tap the screen to appear on the leaderboard!</p>
                ) : (
                  <div className="space-y-2">
                    {rankings.top_engagers.map((e, idx) => (
                      <div key={e.user_id} className="flex items-center justify-between rounded-xl bg-white/5 p-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/60">
                            {idx + 1}
                          </span>
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={e.avatar_url} />
                            <AvatarFallback>{e.name.slice(0, 1)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-bold text-white">{e.name}</span>
                        </div>
                        <span className="text-xs font-extrabold text-rose-400">❤️ {e.total_likes.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
