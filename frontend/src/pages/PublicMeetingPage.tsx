import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { VideoCamera, SignIn, Copy, Check, ShareNetwork, ArrowLeft } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/common/SEOHead";
import { ShareModal } from "@/components/common/ShareModal";
import { useAuth } from "@/hooks/useAuth";
import { meetingUrl, absolute } from "@/lib/deepLinks";

// Room codes are one URL-safe path segment. No single shape is enforced when
// a meeting is created, so this stays permissive on purpose — a stricter
// pattern rejects real invites and turns a working link into a dead screen.
// `instant` is the reserved "start now" route rather than a room.
const ROOM_CODE_PATTERN = /^[a-z0-9_-]{3,64}$/;
const RESERVED_ROOM_CODES = new Set(["instant"]);

/**
 * Public landing page for a shared meeting invite (`/m/:code`).
 *
 * Every meeting endpoint is authenticated, so this page cannot fetch room
 * details without a session. Instead it shows the invite, hands the code to
 * the authenticated room route when a session exists, and otherwise sends the
 * visitor through login and back — which is what a recipient who taps the
 * link in a chat app actually needs.
 */
export function PublicMeetingPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const roomCode = useMemo(() => (code ?? "").trim().toLowerCase(), [code]);
  const isValid =
    ROOM_CODE_PATTERN.test(roomCode) && !RESERVED_ROOM_CODES.has(roomCode);
  const { isAuthenticated } = useAuth();
  const canonicalPath = isValid ? meetingUrl(roomCode) : "/m";
  const shareUrl = absolute(canonicalPath);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const join = () => {
    if (!isValid) return;
    if (isAuthenticated) {
      navigate(`/app/meeting/${roomCode}`);
      return;
    }
    navigate(`/login?next=${encodeURIComponent(canonicalPath)}`);
  };

  if (!isValid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-bold">This meeting link is not valid</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Meeting links look like <span className="font-mono">abc-def12-ghi</span>. Ask the host to
          share the link again.
        </p>
        <Button variant="outline" onClick={() => navigate("/app/meetings")}>
          Go to meetings
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="You're invited to a MurihSpace meeting"
        description={`Join room ${roomCode} on MurihSpace. Sign in to enter the video meeting.`}
        url={shareUrl}
        type="website"
      />

      <header className="p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <VideoCamera className="h-10 w-10 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">You're invited to a meeting</h1>
            <p className="text-sm text-muted-foreground">
              The host shared a MurihSpace video meeting with you.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2">
            <code className="rounded-md border bg-muted px-4 py-2 font-mono text-lg tracking-widest">
              {roomCode}
            </code>
            <Button variant="ghost" size="icon" onClick={copyCode} aria-label="Copy room code">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShareOpen(true)} aria-label="Share invite">
              <ShareNetwork className="h-4 w-4" />
            </Button>
          </div>

          <Button size="lg" className="w-full gap-2" onClick={join}>
            {isAuthenticated ? <VideoCamera className="h-4 w-4" /> : <SignIn className="h-4 w-4" />}
            {isAuthenticated ? "Join meeting" : "Sign in to join"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Meetings are private. You need a MurihSpace account to enter.
          </p>
        </div>
      </main>

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title="MurihSpace meeting invite"
        url={shareUrl}
        description={`Join my MurihSpace meeting (room ${roomCode})`}
        type="meeting"
      />
    </div>
  );
}