import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  VideoCamera,
  Plus,
  ArrowRight,
  WarningCircle,
  CalendarCheck,
  Spinner,
  Users,
  Crown,
  LockKey,
  Copy,
  Check,
  Clock,
  Trash,
  Monitor,
  ShieldCheck,
} from "@phosphor-icons/react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LiveKitVideoConference } from '@/components/video/LiveKitVideoConference';
import { authFetch } from '@/lib/api/authFetch';
import { useAuth } from '@/hooks/useAuth';

const RECENT_MEETINGS_KEY = 'murih_recent_meetings_v1';

interface RecentMeeting {
  code: string;
  timestamp: number;
}

function getStoredRecentMeetings(): RecentMeeting[] {
  try {
    const raw = localStorage.getItem(RECENT_MEETINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function storeRecentMeeting(code: string) {
  try {
    const clean = code.trim().toLowerCase();
    const existing = getStoredRecentMeetings().filter((m) => m.code !== clean);
    const updated = [{ code: clean, timestamp: Date.now() }, ...existing].slice(0, 4);
    localStorage.setItem(RECENT_MEETINGS_KEY, JSON.stringify(updated));
  } catch {
    // ignore localStorage errors
  }
}

function formatRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function MeetingRoomPage() {
  const { roomCode, bookingId } = useParams();
  const navigate = useNavigate();
  const { user, isCreatorOrAdmin } = useAuth();

  const [inputCode, setInputCode] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [isCreatingInstant, setIsCreatingInstant] = useState(false);
  const [instantError, setInstantError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [recentMeetings, setRecentMeetings] = useState<RecentMeeting[]>([]);

  useEffect(() => {
    setRecentMeetings(getStoredRecentMeetings());
  }, []);

  // Record room to recents if roomCode is mounted
  useEffect(() => {
    if (roomCode) {
      storeRecentMeeting(roomCode);
    }
  }, [roomCode]);

  // If a bookingId is provided, join that booking's room directly
  if (bookingId) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/app/coaching" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to 1:1 Coaching
          </Link>
          <span className="text-xs font-semibold text-primary">MurihSpace 1:1 Video Consultation</span>
        </div>

        <LiveKitVideoConference
          tokenEndpoint={`/coaching/bookings/${bookingId}/livekit-token`}
          roomTitle="1:1 Coaching &amp; Consultation"
          onLeave={() => navigate('/app/coaching')}
        />
      </div>
    );
  }

  // If a roomCode is provided, join that room
  if (roomCode) {
    const handleCopyRoom = () => {
      navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    };

    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-5">
        {/* Top Breadcrumb & Room Info */}
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/app/meetings"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            ← Back to Meetings Hub
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Room Code:</span>
            <button
              type="button"
              onClick={handleCopyRoom}
              className="text-xs font-mono bg-muted/80 hover:bg-muted text-foreground px-2.5 py-1 rounded-full border border-border/70 flex items-center gap-1.5 transition-colors"
              title="Click to copy code"
            >
              <span>{roomCode}</span>
              {copiedCode ? (
                <Check weight="bold" className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy weight="bold" className="w-3 h-3 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        <LiveKitVideoConference
          tokenEndpoint={`/meetings/${roomCode}/token`}
          roomTitle={`Meeting: ${roomCode}`}
          meetingCode={roomCode}
          onLeave={() => navigate('/app/meetings')}
        />
      </div>
    );
  }

  // Meetings Hub (when on /app/meetings)
  const handleStartInstant = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isCreatorOrAdmin) return;
    setIsCreatingInstant(true);
    setInstantError(null);
    try {
      const title = meetingTitle.trim() || `${user?.name ?? 'Creator'}'s Meeting`;
      const res = await authFetch('/meetings/instant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? 'Failed to start instant meeting.');
      }
      const code = data?.data?.code ?? data?.code;
      if (!code) {
        throw new Error('No meeting code was returned by the server.');
      }
      storeRecentMeeting(code);
      navigate(`/app/meeting/${code}`);
    } catch (err: unknown) {
      setInstantError(err instanceof Error ? err.message : 'Could not launch meeting.');
    } finally {
      setIsCreatingInstant(false);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode
      .trim()
      .replace(/^https?:\/\/[^/]+\/app\/meeting\//, '')
      .replace(/^\/app\/meeting\//, '')
      .replace(/^#\/app\/meeting\//, '')
      .trim();
    if (!clean) return;
    storeRecentMeeting(clean);
    navigate(`/app/meeting/${clean}`);
  };

  const handleClearRecents = () => {
    try {
      localStorage.removeItem(RECENT_MEETINGS_KEY);
      setRecentMeetings([]);
    } catch {
      // ignore
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-8">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Meetings &amp; Conferences
            </h1>
            <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5">
              WebRTC HD
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Join ongoing video meetings with a room code or host private encrypted conference calls.
          </p>
        </div>

        {user && (
          <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-full bg-muted/60 border border-border/80 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-muted-foreground">Signed in as</span>
            <span className="font-semibold text-foreground truncate max-w-[140px]">{user.name}</span>
            <Badge className="text-[10px] uppercase font-bold py-0 px-1.5 ml-1 bg-background text-muted-foreground border-border">
              {user.role}
            </Badge>
          </div>
        )}
      </div>

      {instantError && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center justify-between gap-2 max-w-2xl mx-auto animate-in fade-in">
          <div className="flex items-center gap-2">
            <WarningCircle weight="fill" className="h-5 w-5 shrink-0" />
            <span>{instantError}</span>
          </div>
          <button
            onClick={() => setInstantError(null)}
            className="text-xs hover:underline font-bold px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Quick Join Bar (Primary Action) ────────────────────── */}
      <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <VideoCamera weight="fill" className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Join a Meeting</h2>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            No installation needed · Works in browser
          </span>
        </div>

        <form onSubmit={handleJoinByCode} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Input
              placeholder="Enter meeting code (e.g. kwy-aqgw-vhh) or paste full link"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              className="h-12 rounded-xl text-sm font-mono bg-muted/40 border-border focus-visible:ring-primary pl-4 pr-10"
            />
            {inputCode && (
              <button
                type="button"
                onClick={() => setInputCode('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <Button
            type="submit"
            disabled={!inputCode.trim()}
            className="w-full sm:w-auto h-12 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm gap-2 shrink-0 shadow-sm transition-all"
          >
            <span>Join Meeting</span>
            <ArrowRight weight="bold" className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* ── Main Two-Column Hub Grid ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Left Column: Recent Rooms OR Meeting Features */}
        {recentMeetings.length > 0 ? (
          <div className="p-6 rounded-3xl bg-card border border-border shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock weight="fill" className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold text-foreground">Recently Visited Rooms</h3>
                </div>
                <button
                  type="button"
                  onClick={handleClearRecents}
                  className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                  title="Clear history"
                >
                  <Trash weight="bold" className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>

              <div className="space-y-2">
                {recentMeetings.map((item) => (
                  <div
                    key={item.code}
                    className="p-3 rounded-2xl bg-muted/40 hover:bg-muted/70 border border-border/60 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-bold text-foreground truncate">
                        {item.code}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatRelativeTime(item.timestamp)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/app/meeting/${item.code}`)}
                      className="h-8 px-3 rounded-lg text-xs font-semibold"
                    >
                      Rejoin
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
              Rooms persist so you can easily rejoin active calls with collaborators.
            </p>
          </div>
        ) : (
          <div className="p-6 rounded-3xl bg-card border border-border shadow-sm flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck weight="fill" className="h-5 w-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-foreground">Private &amp; Secure Conferencing</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect with clients, students, and community members in high definition with modern WebRTC encryption.
              </p>

              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2.5 text-xs text-foreground">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Monitor weight="fill" className="h-3.5 w-3.5" />
                  </div>
                  <span>Built-in Screen Sharing and Collaborative Live Chat</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-foreground">
                  <div className="h-6 w-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ShieldCheck weight="fill" className="h-3.5 w-3.5" />
                  </div>
                  <span>Encrypted Peer Connection with Zero Software Install</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-foreground">
                  <div className="h-6 w-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <Users weight="fill" className="h-3.5 w-3.5" />
                  </div>
                  <span>Real-time Mic Audio Level &amp; Camera Preview Lobby</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Tip: You can invite guests by copying your room link once joined.
            </p>
          </div>
        )}

        {/* Right Column: Host Instant Meeting (Creator) vs Role Locked (Member) */}
        {isCreatorOrAdmin ? (
          <div className="p-6 rounded-3xl bg-card border border-border shadow-sm flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Users weight="fill" className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Host Instant Meeting</h3>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
                  Host Privileges
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Generate a new meeting room instantly. You'll receive a shareable link that anyone can join from any browser.
              </p>

              <form onSubmit={handleStartInstant} className="space-y-3 pt-1">
                <Input
                  placeholder="Meeting topic (e.g. Design Review)"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  className="h-10 rounded-xl text-xs bg-muted/40 border-border"
                />
                <Button
                  type="submit"
                  disabled={isCreatingInstant}
                  className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-2 shadow-sm"
                >
                  {isCreatingInstant ? (
                    <Spinner weight="bold" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus weight="bold" className="h-4 w-4" />
                  )}
                  Start Meeting Now
                </Button>
              </form>
            </div>

            <p className="text-[11px] text-muted-foreground">
              As a creator or admin, your meetings feature unlimited duration and host moderation tools.
            </p>
          </div>
        ) : (
          <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-sm flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Crown weight="fill" className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Host Video Meetings</h3>
                </div>
                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1">
                  <LockKey weight="bold" className="w-3 h-3" />
                  Creator Feature
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Hosting conferences, private video rooms, and webinars is reserved for Creator and Pro accounts. Regular members can freely join any meeting as an attendee.
              </p>

              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 text-xs space-y-1">
                <p className="font-semibold text-foreground">Want to host your own meetings?</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Upgrade to a Creator profile to launch instant meetings, client coaching sessions, and group events.
                </p>
              </div>
            </div>

            <Button
              asChild
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-2 shadow-sm"
            >
              <Link to="/app/settings/upgrade">
                <Crown weight="bold" className="h-4 w-4 text-amber-300" />
                Upgrade to Creator Account
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* ── 1:1 Scheduled Consultations Footer ─────────────────── */}
      <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <CalendarCheck weight="fill" className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Looking for scheduled 1:1 video consultations?
            </h3>
            <p className="text-xs text-muted-foreground">
              Manage your client bookings, availability, and session links in your Coaching hub.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="h-9 px-4 rounded-xl text-xs font-semibold shrink-0">
          <Link to="/app/coaching">Go to 1:1 Coaching</Link>
        </Button>
      </div>
    </div>
  );
}

export default MeetingRoomPage;
