import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowsIn,
  ArrowsOut,
  Check,
  Gift as GiftIcon,
  Heart,
  Microphone,
  MicrophoneSlash,
  PaperPlaneRight,
  PhoneSlash,
  Radio,
  ShareNetwork,
  ShoppingBag,
  SpeakerHigh,
  SpeakerSimpleSlash,
  Spinner,
  Users,
  VideoCamera,
  VideoCameraSlash,
  WarningCircle,
} from "@phosphor-icons/react";
import {
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/api/authFetch";
import { apiClient } from "@/lib/api/client";

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
}

export function PublicLiveStage({ stream, liveKitAccess, isHost, onLeave }: Props) {
  // LiveKit state
  const [room, setRoom] = useState<Room | null>(null);
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
  }, [stream.id]);

  useEffect(() => {
    void pollMetricsAndChat();
    const interval = setInterval(pollMetricsAndChat, 3000);
    return () => clearInterval(interval);
  }, [pollMetricsAndChat]);

  // Scroll to bottom when messages list updates
  useEffect(() => {
    scrollToBottom(false);
  }, [chatMessages.length, scrollToBottom]);

  // Initialize and connect to LiveKit
  useEffect(() => {
    let currentRoom: Room | null = null;
    let isDisposed = false;

    const connectLiveKit = async () => {
      setConnecting(true);
      setConnectionError(null);

      try {
        const roomInstance = new Room({
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

        currentRoom = roomInstance;
        setRoom(roomInstance);

        const attachVideoTrack = (track: Track) => {
          if (videoRef.current && track.kind === Track.Kind.Video) {
            track.attach(videoRef.current);
          }
        };

        const attachAudioTrack = (track: Track) => {
          if (track.kind === Track.Kind.Audio) {
            if (audioRef.current) {
              track.attach(audioRef.current);
            } else {
              const el = track.attach();
              el.autoplay = true;
              document.body.appendChild(el);
            }
          }
        };

        // Attach tracks from participant
        const syncParticipantTracks = (participant: Participant) => {
          participant.trackPublications.forEach((pub: TrackPublication) => {
            if (pub.track) {
              if (pub.kind === Track.Kind.Video) attachVideoTrack(pub.track);
              if (pub.kind === Track.Kind.Audio) attachAudioTrack(pub.track);
            }
          });
        };

        roomInstance.on(RoomEvent.TrackSubscribed, (track: Track) => {
          if (track.kind === Track.Kind.Video) attachVideoTrack(track);
          if (track.kind === Track.Kind.Audio) attachAudioTrack(track);
        });

        roomInstance.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          setAudioBlocked(!roomInstance.canPlaybackAudio);
        });

        roomInstance.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
          syncParticipantTracks(p);
        });

        roomInstance.on(RoomEvent.Disconnected, () => {
          if (!isDisposed) {
            toast.info("Live broadcast disconnected.");
          }
        });

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

        // If viewer, sync any already published host tracks
        roomInstance.remoteParticipants.forEach((remote) => {
          syncParticipantTracks(remote);
        });

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
      if (currentRoom) {
        currentRoom.disconnect().catch(() => {});
      }
    };
  }, [isHost, liveKitAccess, stream.stream_mode]);

  // Handle Unmute Audio Banner click
  const handleUnmuteAudio = async () => {
    if (room) {
      try {
        await room.startAudio();
        setAudioBlocked(false);
        setIsAudioMuted(false);
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
      onLeave();
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

  // Spawn floating heart
  const handleLike = async () => {
    const id = Date.now() + Math.random();
    const x = Math.floor(Math.random() * 60) + 20; // 20% to 80% width
    const colors = ["#ef4444", "#ec4899", "#f59e0b", "#8b5cf6", "#06b6d4"];
    const color = colors[Math.floor(Math.random() * colors.length)];

    setFloatingHearts((prev) => [...prev.slice(-15), { id, x, color }]);
    setLikesCount((prev) => prev + 1);

    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
    }, 2000);

    try {
      await authFetch(`/live/${stream.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1 }),
      });
    } catch {
      // Ignore background like error
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
            <Avatar className="h-10 w-10 border-2 border-red-500 shadow-md shadow-red-500/30">
              <AvatarImage src={stream.host?.avatar_url ?? undefined} alt={stream.host?.name} />
              <AvatarFallback className="bg-primary/20 text-xs font-bold text-primary">
                {stream.host?.name?.slice(0, 2).toUpperCase() || "LV"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold text-white">{stream.host?.name}</span>
                <Badge variant="destructive" className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  LIVE
                </Badge>
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

        {/* MAIN VIDEO / AUDIO CANVAS */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0c1017]">
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
              <Button size="sm" variant="outline" onClick={onLeave} className="mt-2 border-white/20 text-white">
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
            <div className="absolute bottom-20 left-4 z-20 max-w-sm rounded-xl border border-white/20 bg-black/80 p-3 backdrop-blur-xl shadow-2xl">
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

        {/* BOTTOM VIDEO CONTROLS BAR */}
        <div className="z-20 flex items-center justify-between border-t border-white/10 bg-black/90 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-white/90 max-w-[280px] sm:max-w-md">
              {stream.title}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Host Controls */}
            {isHost && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleMic}
                  className={`h-9 w-9 rounded-full p-0 ${isMicOn ? "bg-white/10 text-white border-white/20" : "bg-red-600 text-white border-red-500 hover:bg-red-500"}`}
                  title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {isMicOn ? <Microphone weight="bold" className="h-4 w-4" /> : <MicrophoneSlash weight="bold" className="h-4 w-4" />}
                </Button>

                {stream.stream_mode !== "audio" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleCam}
                    className={`h-9 w-9 rounded-full p-0 ${isCamOn ? "bg-white/10 text-white border-white/20" : "bg-red-600 text-white border-red-500 hover:bg-red-500"}`}
                    title={isCamOn ? "Turn Camera Off" : "Turn Camera On"}
                  >
                    {isCamOn ? <VideoCamera weight="bold" className="h-4 w-4" /> : <VideoCameraSlash weight="bold" className="h-4 w-4" />}
                  </Button>
                )}

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleEndStream}
                  disabled={isEndingStream}
                  className="h-9 gap-1.5 rounded-full px-3 text-xs font-bold"
                >
                  {isEndingStream ? <Spinner weight="bold" className="h-3.5 w-3.5 animate-spin" /> : <PhoneSlash weight="bold" className="h-3.5 w-3.5" />}
                  End Stream
                </Button>
              </>
            )}

            {/* Viewer Controls */}
            {!isHost && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAudioMuted(!isAudioMuted)}
                  className="h-9 w-9 rounded-full border-white/20 bg-white/10 p-0 text-white hover:bg-white/20"
                  title={isAudioMuted ? "Unmute" : "Mute"}
                >
                  {isAudioMuted ? <SpeakerSimpleSlash weight="bold" className="h-4 w-4" /> : <SpeakerHigh weight="bold" className="h-4 w-4" />}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLeave}
                  className="h-9 rounded-full border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20"
                >
                  Leave
                </Button>
              </>
            )}

            {/* Fullscreen Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="h-9 w-9 rounded-full border-white/20 bg-white/10 p-0 text-white hover:bg-white/20"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <ArrowsIn weight="bold" className="h-4 w-4" /> : <ArrowsOut weight="bold" className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: DEDICATED LIVE CHAT & GIFTING SIDEBAR */}
      <div className="flex h-80 w-full flex-col border-t border-white/10 bg-[#0F141C] lg:h-full lg:w-96 lg:border-t-0 lg:border-l">
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-[#131822]">
          <div className="flex items-center gap-2">
            <Radio weight="fill" className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">Live Stream Chat</h2>
          </div>
          <span className="text-[11px] font-semibold text-white/50">{chatMessages.length} messages</span>
        </div>

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
                <div key={msg.id} className="flex items-start gap-2.5 text-xs">
                  <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                    <AvatarImage src={msg.user.avatar ?? undefined} alt={msg.user.name} />
                    <AvatarFallback className="bg-white/10 text-[9px] font-bold text-white">
                      {msg.user.name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
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
    </div>
  );
}
