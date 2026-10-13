import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { N2User as Users, Heart, Discount as Gift, Play, Video as VideoCamera } from "@/components/icons";
import { Radio, ShareNetwork, Broadcast } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth/token";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

interface LiveHost {
  id: number;
  name: string;
  username?: string | null;
  avatar?: string | null;
  role?: string;
}

interface LiveCommunity {
  id: number;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
}

interface LiveStream {
  id: number;
  tracking_id: string;
  title: string;
  description?: string | null;
  stream_mode: string;
  status: string;
  viewers_count?: number;
  likes_count?: number;
  total_coins_earned?: number;
  started_at?: string | null;
  host?: LiveHost | null;
  community?: LiveCommunity | null;
}

interface LiveListResponse {
  data?: LiveStream[];
  meta?: Record<string, unknown>;
}

function getToken(): string | null {
  return getAuthToken();
}

async function fetchLiveStreams(): Promise<LiveStream[]> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/live`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as LiveListResponse;
  // The API wraps every body in an envelope ({ success, data }), and /live
  // returns a paginator inside it, so the streams live at data.data.
  const payload = (json as { data?: LiveListResponse | LiveStream[] }).data;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray((payload as LiveListResponse).data)) {
    return (payload as LiveListResponse).data as LiveStream[];
  }
  return [];
}

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function compactNumber(n?: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export default function LiveDiscoverPage() {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchLiveStreams();
      setStreams(data);
      setError(null);
    } catch {
      setStreams((prev) => {
        if (prev.length === 0) {
          setError("Could not load live streams. Please try again.");
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      fetchLiveStreams()
        .then((data) => {
          if (!active) return;
          setStreams(data);
          setError(null);
        })
        .catch(() => {
          if (!active) return;
          setStreams((prev) => {
            if (prev.length === 0) {
              setError("Could not load live streams. Please try again.");
            }
            return prev;
          });
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    refresh();
    timerRef.current = setInterval(refresh, 30000);
    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const totalViewers = streams.reduce((sum, s) => sum + (s.viewers_count || 0), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* ── Header ── */}
      <div className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <div className="absolute inset-0 rounded-full bg-destructive/10 animate-pulse" />
              <Broadcast weight="fill" className="relative h-5 w-5" />
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-base font-extrabold text-foreground">
                Live Now
                <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
                  </span>
                  {streams.length ? `${streams.length} active` : "Live"}
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Watch broadcasts happening right now{totalViewers > 0 ? ` · ${compactNumber(totalViewers)} viewers` : ""}.
              </p>
            </div>
          </div>

          <Link
            to="/app/audio-rooms"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow hover:opacity-90 transition-opacity"
          >
            <VideoCamera weight="fill" className="h-3.5 w-3.5" />
            Go Live
          </Link>
        </div>
      </div>

      <div className="flex-1 p-5">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl border border-border bg-card" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Broadcast weight="fill" className="h-7 w-7" />
            </div>
            <p className="text-sm font-bold text-foreground">Could not load live streams</p>
            <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => { setLoading(true); void load(); }}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors"
            >
              Try again
            </button>
          </div>
        ) : streams.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 py-24 text-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary/10 text-secondary">
              <Radio weight="fill" className="h-10 w-10" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white">
                <Users weight="fill" className="h-2.5 w-2.5" />
              </span>
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-foreground">Nobody is live right now</h2>
              <p className="max-w-sm text-xs text-muted-foreground">
                Be the first to go live, start an audio room, or schedule a broadcast and invite your community.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/app/audio-rooms"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow hover:opacity-90 transition-opacity"
              >
                <VideoCamera weight="fill" className="h-3.5 w-3.5" />
                Go Live Now
              </Link>
              <Link
                to="/app/events"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-colors"
              >
                <ShareNetwork weight="fill" className="h-3.5 w-3.5" />
                Schedule an Event
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {streams.map((stream) => (
              <LiveStreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LiveStreamCard({ stream }: { stream: LiveStream }) {
  const isAudio = stream.stream_mode === "audio";
  const hostName = stream.host?.name ?? "Streamer";
  const hostUsername = stream.host?.username ? `@${stream.host.username}` : "";
  const hasCover = Boolean(stream.community?.cover_url);

  return (
    <Link
      to={`/live/${stream.tracking_id}`}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* ── Cover / Preview ── */}
      <div
        className={cn(
          "relative flex aspect-video w-full items-center justify-center overflow-hidden",
          hasCover ? "bg-black" : "bg-gradient-to-br from-[#102840] via-[#0b2740] to-[#081827]",
        )}
      >
        {hasCover && stream.community?.cover_url ? (
          <img
            src={stream.community.cover_url}
            alt={stream.community.name}
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
        ) : isAudio ? (
          <AudioRoomArt name={hostName} />
        ) : (
          <div className="text-center">
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary/15 text-secondary">
              <VideoCamera weight="fill" className="h-8 w-8" />
              <span className="absolute -inset-1 rounded-full border border-secondary/30" />
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />

        {/* LIVE badge */}
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-destructive px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          Live
        </span>

        {/* Viewer count */}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
          <Users weight="fill" className="h-3 w-3 text-sky-300" />
          {compactNumber(stream.viewers_count)}
        </span>

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-md transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 scale-90">
            <Play weight="fill" className="h-5 w-5 -translate-x-[1px]" />
          </div>
        </div>

        {/* Bottom overlay: host + stats */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={stream.host?.avatar ?? ""}
              alt={hostName}
              className="h-6 w-6 shrink-0 rounded-full border border-white/40 object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white drop-shadow">{hostName}</p>
              <p className="truncate text-[10px] text-white/70">
                {stream.community?.name ? `${stream.community.name} · ` : ""}{timeAgo(stream.started_at) || "Live"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 backdrop-blur-md">
              <Heart weight="fill" className="h-2.5 w-2.5 text-rose-400" />
              {compactNumber(stream.likes_count)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-md">
              <Gift weight="fill" className="h-2.5 w-2.5 text-amber-400" />
              {compactNumber(stream.total_coins_earned)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex items-center gap-3 p-3">
        <Avatar className="h-10 w-10 shrink-0 border border-border">
          <AvatarImage src={stream.host?.avatar ?? undefined} alt={hostName} />
          <AvatarFallback className="bg-secondary/10 text-secondary">{hostName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-foreground">{stream.title || "Untitled Broadcast"}</h3>
          <p className="truncate text-xs text-muted-foreground">{hostUsername || `@${stream.host?.username ?? "host"}`}</p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
            isAudio ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive",
          )}
        >
          {isAudio ? <Radio weight="fill" className="h-3 w-3" /> : <VideoCamera weight="fill" className="h-3 w-3" />}
          {isAudio ? "Audio" : "Video"}
        </span>
      </div>
    </Link>
  );
}

function AudioRoomArt({ name }: { name: string }) {
  return (
    <div className="relative">
      <div className="absolute -inset-6 animate-ping rounded-full bg-secondary/20" />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20 text-secondary ring-2 ring-secondary/40">
        <Radio weight="fill" className="h-8 w-8" />
      </div>
      <span className="sr-only">{name}</span>
    </div>
  );
}