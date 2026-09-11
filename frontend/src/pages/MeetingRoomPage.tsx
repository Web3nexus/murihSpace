import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  VideoCamera,
  Plus,
  ArrowRight,
  WarningCircle,
  CalendarCheck,
  Spinner,
  Users,
} from "@phosphor-icons/react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LiveKitVideoConference } from '@/components/video/LiveKitVideoConference';
import { authFetch } from '@/lib/api/authFetch';
import { useAuth } from '@/hooks/useAuth';

export function MeetingRoomPage() {
  const { roomCode, bookingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [inputCode, setInputCode] = useState('');
  const [isCreatingInstant, setIsCreatingInstant] = useState(false);
  const [instantError, setInstantError] = useState<string | null>(null);

  // If a bookingId is provided, join that booking's room directly
  if (bookingId) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/app/coaching" className="text-xs text-muted-foreground hover:text-foreground">
              ← Back to 1:1 Coaching
            </Link>
          </div>
          <span className="text-xs font-semibold text-primary">MurihSpace 1:1 Video Consultation</span>
        </div>

        <LiveKitVideoConference
          tokenEndpoint={`/coaching/bookings/${bookingId}/livekit-token`}
          roomTitle="1:1 Coaching & Consultation"
          onLeave={() => navigate('/app/coaching')}
        />
      </div>
    );
  }

  // If a roomCode is provided, join that room
  if (roomCode) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/app/meetings" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to Meetings Hub
          </Link>
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            Room Code: {roomCode}
          </span>
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
  const handleStartInstant = async () => {
    setIsCreatingInstant(true);
    setInstantError(null);
    try {
      const res = await authFetch('/meetings/instant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${user?.name ?? 'Creator'}'s Meeting` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to start instant meeting.');
      navigate(`/app/meeting/${data.code}`);
    } catch (err: unknown) {
      setInstantError(err instanceof Error ? err.message : 'Could not launch meeting.');
    } finally {
      setIsCreatingInstant(false);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().replace(/^https?:\/\/[^/]+\/app\/meeting\//, '');
    if (!clean) return;
    navigate(`/app/meeting/${clean}`);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 sm:py-12 space-y-10">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto space-y-3">
        <div className="h-14 w-14 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-sm">
          <VideoCamera weight="fill" className="h-7 w-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
          Video Meetings &amp; Conferences
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Premium HD video conference built directly into MurihSpace. Connect with clients, fans, and community members with crystal-clear audio and screen sharing.
        </p>
      </div>

      {instantError && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-2 max-w-md mx-auto">
          <WarningCircle weight="fill" className="h-5 w-5 shrink-0" />
          <span>{instantError}</span>
        </div>
      )}

      {/* Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Instant Meeting */}
        <div className="p-6 sm:p-8 rounded-3xl border border-border/80 bg-card shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6">
          <div className="space-y-3">
<div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Users weight="fill" className="h-6 w-6" />
                </div>
            <h2 className="text-xl font-bold text-foreground">Start an Instant Meeting</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Launch a meeting room right now. You'll get a shareable link that anyone with a MurihSpace account can join instantly.
            </p>
          </div>

          <Button
            onClick={handleStartInstant}
            disabled={isCreatingInstant}
            className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm gap-2 shadow-sm"
          >
            {isCreatingInstant ? (
              <Spinner weight="bold" className="h-4 w-4 animate-spin" />
            ) : (
              <Plus weight="bold" className="h-4 w-4" />
            )}
            Start Meeting Now
          </Button>
        </div>

        {/* Join by Code or Link */}
        <div className="p-6 sm:p-8 rounded-3xl border border-border/80 bg-card shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-secondary/15 text-foreground flex items-center justify-center">
              <VideoCamera weight="fill" className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Join with a Code or Link</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enter a meeting code or invitation URL provided by the meeting host to enter their conference room.
            </p>
          </div>

          <form onSubmit={handleJoinByCode} className="space-y-3">
            <div className="relative">
              <Input
                placeholder="e.g. mrh-abc-xyz or paste link"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                className="h-12 rounded-2xl text-xs font-mono pr-12 bg-muted/30"
              />
              <button
                type="submit"
                disabled={!inputCode.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                <ArrowRight weight="bold" className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 1:1 Coaching link */}
      <div className="p-6 rounded-3xl bg-muted/40 border border-border/60 max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 justify-center sm:justify-start">
            <CalendarCheck weight="fill" className="h-4 w-4 text-primary" />
            Looking for scheduled 1:1 consultations?
          </h3>
          <p className="text-xs text-muted-foreground">
            Manage your booked coaching sessions and client consultations in your 1:1 Coaching portal.
          </p>
        </div>
        <Button asChild variant="outline" className="h-9 rounded-xl text-xs font-semibold shrink-0">
          <Link to="/app/coaching">Go to 1:1 Coaching</Link>
        </Button>
      </div>
    </div>
  );
}

export default MeetingRoomPage;
