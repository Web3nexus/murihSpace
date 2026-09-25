import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Copy,
  Eye,
  Lock,
  Play,
  Radio,
  ShareNetwork,
  SignIn,
  Spinner as Loader2,
  UserCircle,
  Users,
  VideoCamera,
  WarningCircle,
} from "@phosphor-icons/react";
import { AuthPromptModal } from "@/components/auth/AuthPromptModal";
import { BrandPreloader } from "@/components/common/BrandPreloader";
import { SEOHead } from "@/components/common/SEOHead";
import { Button } from "@/components/ui/button";
import { LiveKitVideoConference } from "@/components/video/LiveKitVideoConference";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/api/authFetch";

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

interface LiveStream {
  id: number;
  tracking_id: string;
  title: string;
  description: string | null;
  stream_mode: string;
  status: string;
  viewers_count: number;
  started_at: string | null;
  host: LiveHost | null;
  community: LiveCommunity | null;
}

interface ResolveData {
  stream: LiveStream;
  canonical_url: string;
  legacy: boolean;
}

interface JoinData {
  livekit: {
    token: string;
    host: string;
    room?: string;
    is_publisher: boolean;
  };
}

interface LiveKitAccess {
  token: string;
  host: string;
  room?: string;
  isPublisher: boolean;
}

type ErrorKind = "not-found" | "request" | null;

function unwrapPayload<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const root = payload as { message?: unknown; error?: unknown };
  if (typeof root.message === "string" && root.message.trim()) {
    return root.message;
  }
  if (typeof root.error === "string" && root.error.trim()) {
    return root.error;
  }

  return fallback;
}

function formatStartedAt(value: string | null): string {
  if (!value) {
    return "Live now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Live now";
  }

  return `Started ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function formatMode(mode: string): string {
  if (mode === "audio") {
    return "Audio room";
  }
  if (mode === "meeting") {
    return "Live conversation";
  }

  return "Video broadcast";
}

function copySearchTo(target: URL): void {
  const current = new URL(window.location.href);
  current.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });
}

function updateCanonicalAddress(canonicalUrl: string): void {
  try {
    const canonical = new URL(canonicalUrl, window.location.origin);
    copySearchTo(canonical);
    const nextAddress = `${canonical.pathname}${canonical.search}${canonical.hash}`;

    if (canonical.origin === window.location.origin) {
      window.history.replaceState(window.history.state, "", nextAddress);
      return;
    }

    window.location.replace(canonical.toString());
  } catch {
    return;
  }
}

export function PublicLivePage() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [canonicalUrl, setCanonicalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => Boolean(trackingId));
  const [errorKind, setErrorKind] = useState<ErrorKind>(() => trackingId ? null : "not-found");
  const [errorMessage, setErrorMessage] = useState(() => trackingId ? "" : "This live link is missing its stream reference.");
  const [authOpen, setAuthOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [liveKitAccess, setLiveKitAccess] = useState<LiveKitAccess | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const leaveSentRef = useRef(false);
  const joinedRef = useRef(false);

  useEffect(() => {
    let active = true;

    if (!trackingId) {
      return () => {
        active = false;
      };
    }

    const requestPath = `/live/resolve/${encodeURIComponent(trackingId)}${window.location.search}`;
    void authFetch(requestPath)
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message = getErrorMessage(payload, "This live link could not be resolved.");
          if (active) {
            setErrorKind(response.status === 404 ? "not-found" : "request");
            setErrorMessage(message);
          }
          return;
        }

        const resolved = unwrapPayload<ResolveData>(payload);
        if (!resolved?.stream?.tracking_id) {
          throw new Error("The live stream response was incomplete.");
        }

        if (!active) {
          return;
        }

        setStream(resolved.stream);
        setCanonicalUrl(resolved.canonical_url || null);
        if (resolved.legacy && resolved.canonical_url) {
          updateCanonicalAddress(resolved.canonical_url);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }
        setErrorKind("request");
        setErrorMessage(requestError instanceof Error ? requestError.message : "This live link could not be resolved.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [trackingId]);

  const streamId = stream?.id ?? null;
  const sendLeave = useCallback(() => {
    if (streamId === null || !joinedRef.current || leaveSentRef.current) {
      return;
    }

    joinedRef.current = false;
    leaveSentRef.current = true;
    void authFetch(`/live/${streamId}/leave`, { method: "POST" }).catch(() => undefined);
  }, [streamId]);

  useEffect(() => {
    return () => sendLeave();
  }, [sendLeave]);

  const handleJoin = useCallback(async () => {
    if (!stream || stream.status !== "live") {
      return;
    }

    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }

    setJoining(true);
    setJoinError("");

    try {
      const response = await authFetch(`/live/${stream.id}/join`, { method: "POST" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "We could not issue a live room pass."));
      }

      const joined = unwrapPayload<JoinData>(payload);
      const access = joined?.livekit;
      if (!access?.token || !access.host) {
        throw new Error("The live room did not return an access token.");
      }

      leaveSentRef.current = false;
      joinedRef.current = true;
      setLiveKitAccess({
        token: access.token,
        host: access.host,
        room: access.room,
        isPublisher: access.is_publisher === true,
      });
    } catch (requestError: unknown) {
      setJoinError(requestError instanceof Error ? requestError.message : "We could not join this live room.");
    } finally {
      setJoining(false);
    }
  }, [isAuthenticated, stream]);

  const handleLeave = useCallback(() => {
    sendLeave();
    setLiveKitAccess(null);
  }, [sendLeave]);

  const shareUrl = useMemo(() => {
    if (!stream) {
      return window.location.href;
    }

    const baseUrl = canonicalUrl || `${window.location.origin}/live/${encodeURIComponent(stream.tracking_id)}`;
    try {
      const share = new URL(baseUrl, window.location.origin);
      copySearchTo(share);
      return share.toString();
    } catch {
      return `${baseUrl}${window.location.search}`;
    }
  }, [canonicalUrl, stream]);

  const streamTitle = stream?.title;
  const handleShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: streamTitle ?? "Live on MurihSpace", url: shareUrl });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch {
      setShareCopied(false);
    }
  }, [shareUrl, streamTitle]);

  const seoDescription = stream?.description || (stream ? `Join ${stream.host?.name ?? "a creator"} live on MurihSpace.` : "Discover a live broadcast on MurihSpace.");
  const seoJsonLd = useMemo(() => {
    if (!stream) {
      return undefined;
    }

    return {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: stream.title,
      description: seoDescription,
      uploadDate: stream.started_at ?? undefined,
      ...(shareUrl ? { contentUrl: shareUrl } : {}),
    };
  }, [seoDescription, shareUrl, stream]);

  if (loading) {
    return <BrandPreloader fullScreen message="Resolving live link" />;
  }

  if (errorKind || !stream) {
    const notFound = errorKind === "not-found";
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SEOHead
          title={notFound ? "Live unavailable" : "Live link unavailable"}
          description="The requested MurihSpace live link is unavailable."
        />
        <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
          <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${notFound ? "bg-muted text-muted-foreground" : "bg-red-50 text-red-600"}`}>
            {notFound ? <Radio weight="fill" className="h-8 w-8" /> : <WarningCircle weight="fill" className="h-8 w-8" />}
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-secondary">MurihSpace live</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{notFound ? "This broadcast has moved" : "We could not open this broadcast"}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{errorMessage || "The link may be invalid, expired, or temporarily unavailable."}</p>
          <Link to="/" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-secondary transition-colors hover:text-secondary/80">
            <ArrowLeft weight="fill" className="h-4 w-4" />
            Back to MurihSpace
          </Link>
        </div>
      </div>
    );
  }

  if (liveKitAccess) {
    return (
      <div className="min-h-screen bg-[#131314] text-white">
        <SEOHead title={`${stream.title} · Live`} description={seoDescription} image={stream.host?.avatar_url ?? undefined} url={shareUrl} type="video.other" />
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#69a9ff]">Now live</p>
              <h1 className="mt-1 truncate text-lg font-bold text-white">{stream.title}</h1>
            </div>
            <Button variant="outline" size="sm" onClick={handleLeave} className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              Back to details
            </Button>
          </div>
          <LiveKitVideoConference
            directToken={liveKitAccess}
            roomTitle={stream.title}
            isHost={user?.id === stream.host?.id}
            isPublisher={liveKitAccess.isPublisher}
            onLeave={handleLeave}
          />
        </div>
      </div>
    );
  }

  const isLive = stream.status === "live";
  const hostName = stream.host?.name || "MurihSpace creator";
  const communityName = stream.community?.name;
  const viewerCount = Number(stream.viewers_count) || 0;
  const streamMode = formatMode(stream.stream_mode);
  const isHost = user?.id === stream.host?.id;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead
        title={`${stream.title} · Live on MurihSpace`}
        description={seoDescription}
        image={stream.host?.avatar_url ?? undefined}
        url={shareUrl}
        type="video.other"
        jsonLd={seoJsonLd}
      />

      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 text-sm font-extrabold tracking-tight transition-opacity hover:opacity-80">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
              <Radio weight="fill" className="h-4 w-4" />
            </span>
            <span>MurihSpace</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5 font-semibold">
              {shareCopied ? <Check weight="bold" className="h-3.5 w-3.5 text-emerald-600" /> : <ShareNetwork weight="fill" className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{shareCopied ? "Copied" : "Share"}</span>
            </Button>
            {!isAuthenticated && (
              <Button size="sm" onClick={() => setAuthOpen(true)} className="gap-1.5 font-bold">
                <SignIn weight="fill" className="h-3.5 w-3.5" />
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_15%_20%,rgba(33,100,182,0.13),transparent_38%),radial-gradient(circle_at_85%_10%,rgba(56,168,216,0.16),transparent_32%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft weight="fill" className="h-3.5 w-3.5" />
            Explore MurihSpace
          </Link>

          <section className="overflow-hidden rounded-[2rem] border border-border/80 bg-card shadow-[0_24px_80px_rgba(16,40,64,0.12)]">
            <div className="grid lg:grid-cols-[1.35fr_0.65fr]">
              <div className="relative overflow-hidden px-6 py-8 sm:px-10 sm:py-11">
                <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-secondary/10 blur-3xl" />
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] ${isLive ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground"}`}>
                      {isLive ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> : <Clock weight="fill" className="h-3 w-3" />}
                      {isLive ? "Live now" : "Broadcast ended"}
                    </span>
                    <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-secondary">{streamMode}</span>
                    {communityName && <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">{communityName}</span>}
                  </div>
                  <h1 className="mt-6 max-w-3xl text-3xl font-extrabold leading-[1.08] tracking-[-0.04em] text-foreground sm:text-5xl">{stream.title}</h1>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{stream.description || `${hostName} is live on MurihSpace. Settle in, say hello, and join the conversation.`}</p>

                  <div className="mt-8 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground">
                      {stream.host?.avatar_url ? <img src={stream.host.avatar_url} alt="" className="h-full w-full object-cover" /> : <UserCircle weight="fill" className="h-6 w-6" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{hostName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Host · {formatStartedAt(stream.started_at)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between border-t border-border/70 bg-primary/[0.035] px-6 py-8 sm:px-10 lg:border-l lg:border-t-0 lg:py-11">
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                      <Eye weight="fill" className="h-4 w-4 text-secondary" />
                      Watching now
                    </div>
                    <span className="text-2xl font-extrabold tracking-tight text-foreground">{viewerCount}</span>
                  </div>
                  <div className="mt-6 h-px bg-border/70" />
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Calendar weight="fill" className="h-4 w-4 text-secondary" />
                      <span>{formatStartedAt(stream.started_at)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Users weight="fill" className="h-4 w-4 text-secondary" />
                      <span>Live community session</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Lock weight="fill" className="h-4 w-4 text-secondary" />
                      <span>Sign-in required to enter</span>
                    </div>
                  </div>
                </div>

                <div className="mt-10">
                  {isLive ? (
                    <Button onClick={handleJoin} disabled={joining || authLoading} className="h-12 w-full gap-2 rounded-2xl bg-secondary text-sm font-extrabold text-secondary-foreground shadow-lg shadow-secondary/20 transition-transform hover:-translate-y-0.5 hover:bg-secondary/90">
                      {joining ? <Loader2 weight="fill" className="h-4 w-4 animate-spin" /> : isAuthenticated ? <Play weight="fill" className="h-4 w-4" /> : <SignIn weight="fill" className="h-4 w-4" />}
                      {joining ? "Preparing your room pass" : isAuthenticated ? isHost ? "Open live studio" : "Join the live room" : "Sign in to join"}
                    </Button>
                  ) : (
                    <div className="rounded-2xl border border-border bg-card/70 p-4 text-sm leading-6 text-muted-foreground">This broadcast has ended. Thanks for stopping by — the creator may have another live session soon.</div>
                  )}
                  {joinError && <p className="mt-3 text-xs font-semibold leading-5 text-red-600" role="alert">{joinError}</p>}
                  <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">You can keep this link and return to the live session anytime.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[1.5rem] border border-border/80 bg-card p-6 sm:p-7">
              <div className="flex items-center gap-2 text-sm font-extrabold text-foreground">
                <Radio weight="fill" className="h-4 w-4 text-secondary" />
                A room for real conversation
              </div>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Live on MurihSpace is a shared space for ideas, questions, and the people who make the internet feel more human. Enter with an account so you can participate, not just watch.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">Community-led</span>
                <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">Real-time</span>
                <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">Creator-first</span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[1.5rem] border border-secondary/15 bg-secondary p-6 text-secondary-foreground sm:p-7">
              <div className="pointer-events-none absolute -bottom-16 -right-8 h-44 w-44 rounded-full border-[24px] border-white/10" />
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                  <VideoCamera weight="fill" className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-lg font-extrabold">Ready when you are.</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-secondary-foreground/80">Bring your curiosity. The best live rooms start with one person saying hello.</p>
                <Button onClick={handleJoin} disabled={!isLive || joining || authLoading} variant="outline" className="mt-6 h-10 border-white/25 bg-white/10 font-bold text-white hover:bg-white/20 hover:text-white">
                  {isAuthenticated ? "Enter the room" : "Sign in to continue"}
                </Button>
              </div>
            </div>
          </section>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Copy weight="fill" className="h-3.5 w-3.5" /> Share this link with someone curious.</span>
            <span className="inline-flex items-center gap-1.5"><Lock weight="fill" className="h-3.5 w-3.5" /> Your viewing session is private.</span>
          </div>
        </div>
      </main>

      <AuthPromptModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        title="Join this live room"
        description="Sign in or create a MurihSpace account to enter the conversation with the community."
      />
    </div>
  );
}
