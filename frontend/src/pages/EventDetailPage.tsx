import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router";
import {
  Calendar as Calendar,
  Clock as Clock,
  MapPin as MapPin,
  Users as Users,
  VideoCamera as Video,
  ArrowLeft as ArrowLeft,
  ArrowSquareOut as ExternalLink,
  CheckCircle as CheckCircle,
  XCircle as XCircle,
  ShareNetwork as ShareNetwork,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, NotFoundState } from "@/components/common/UIStateComponents";
import { SEOHead } from "@/components/common/SEOHead";
import { ShareModal } from "@/components/common/ShareModal";
import type { EventData } from "@/types/events";
import { env } from "@/config/env";
import { getAuthToken } from "@/lib/auth/token";
import { useAuth } from "@/hooks/useAuth";
import { eventUrl, absolute } from "@/lib/deepLinks";

const API = env.VITE_API_BASE_URL;

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  online: "Online",
  in_person: "In Person",
  hybrid: "Hybrid",
};

export interface EventDetailViewProps {
  /** Event id to load. Supplied by the router or read from the path. */
  eventId?: string;
  /**
   * Public mode renders the standalone share page at `/e/:id`: no dashboard
   * chrome, a sign-in prompt instead of registration, and SEO metadata so the
   * link unfurls with a title and cover image.
   */
  isPublic?: boolean;
}

/**
 * Event detail, shared by the authenticated dashboard route (`/app/events/:id`)
 * and the public share route (`/e/:id`).
 *
 * Keeping one implementation means a link opened without the app and the same
 * link opened inside it always describe the event identically.
 */
export function EventDetailView({ eventId, isPublic = false }: EventDetailViewProps) {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const id = eventId ?? params.id;

  const [event, setEvent] = useState<EventData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [isRegistered, setIsRegistered] = useState(false);

  // Read from the shared auth state so a token that has since expired is not
  // mistaken for a signed-in visitor.
  const { isAuthenticated } = useAuth();

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/events/${id}`, { headers: getAuthHeaders() });
      if (res.status === 404) {
        setEvent(null);
        return;
      }
      if (!res.ok) throw new Error("Failed to load event");
      const body = await res.json();
      setEvent(body.data?.data ?? body.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchEvent(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchEvent]);

  // The event payload carries no per-user registration flag, so the two
  // buttons can only be told apart by asking which registrations are ours.
  // Checked on both routes: a signed-in visitor arriving from a shared link
  // lands on /e/:id, and that is exactly where a duplicate register hurts.
  const refreshRegistration = useCallback(async () => {
    if (!id || !isAuthenticated) return;
    try {
      const res = await fetch(`${API}/my-registrations`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const body = await res.json();
      const rows: Array<{ event_id?: number }> = Array.isArray(body?.data) ? body.data : [];
      setIsRegistered(rows.some((row) => String(row.event_id) === String(id)));
    } catch {
      // Fail closed: a check we could not make must not leave a "Cancel
      // Registration" button in front of someone who never registered.
      setIsRegistered(false);
    }
  }, [id, isAuthenticated]);

  useEffect(() => { refreshRegistration(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [refreshRegistration]);

  const register = useCallback(
    async (path: "register" | "cancel", successText: string) => {
      if (!id) return;
      setIsRegistering(true);
      setRegistrationMessage(null);
      try {
        const res = await fetch(`${API}/events/${id}/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        });
        // A gateway can answer in HTML. Parsing it must not be reported to the
        // visitor as a network failure when the request itself went through.
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        if (!res.ok) {
          setRegistrationMessage({
            type: "error",
            text: body.message || (path === "register" ? "Registration failed." : "Cancellation failed."),
          });
          return;
        }
        setRegistrationMessage({ type: "success", text: successText });
        fetchEvent();
        refreshRegistration();
      } catch {
        setRegistrationMessage({ type: "error", text: "Network error. Please try again." });
      } finally {
        setIsRegistering(false);
      }
    },
    [id, fetchEvent, refreshRegistration],
  );

  const handleRegister = () => register("register", "You are registered for this event!");
  const handleCancelRegistration = () => register("cancel", "Registration cancelled.");

  // Public mode has no session to register with, so hand off to login and
  // return here afterwards.
  const handleSignInToRegister = () => {
    if (!id) return;
    navigate(`/login?next=${encodeURIComponent(eventUrl(id))}`);
  };

  if (isLoading) return <LoadingState message="Loading event…" />;
  if (error) return <ErrorState title="Failed to load event" description={error} onRetry={fetchEvent} />;
  if (!event) return <NotFoundState title="Event not found" description="This event does not exist or has been removed." />;

  const isPast = new Date(event.end_date) < new Date();
  const canRegister = !isPast && event.status === "published" && event.is_registration_open;
  const shareUrl = absolute(eventUrl(event.id));

  const body = (
    <div className={isPublic ? "max-w-3xl mx-auto p-4 space-y-6" : "max-w-3xl mx-auto p-4 space-y-6"}>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft weight="fill" className="h-4 w-4" />
          Back
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)} className="gap-2">
          <ShareNetwork weight="fill" className="h-4 w-4" />
          Share
        </Button>
      </div>

      <div className="rounded-lg border-none bg-card overflow-hidden">
        {event.cover_url && (
          <img
            src={event.cover_url}
            alt={event.title}
            className="w-full h-48 object-cover"
          />
        )}

        <div className="p-4 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{event.title}</h1>
                <Badge variant="secondary">{EVENT_TYPE_LABELS[event.event_type]}</Badge>
              </div>
              {event.community && (
                <p className="text-sm text-muted-foreground">
                  Hosted by{" "}
                  <Link to={`/c/${event.community.slug}`} className="text-primary hover:underline">
                    {event.community.name}
                  </Link>
                </p>
              )}
            </div>
            <Badge variant={event.status === "published" ? "default" : "secondary"}>
              {event.status}
            </Badge>
          </div>

          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-3">
              <Calendar weight="fill" className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(event.start_date)}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock weight="fill" className="h-4 w-4 text-muted-foreground" />
              <span>
                {formatTime(event.start_date)} – {formatTime(event.end_date)}
              </span>
            </div>
            {(event.event_type === "in_person" || event.event_type === "hybrid") && event.location && (
              <div className="flex items-center gap-3">
                <MapPin weight="fill" className="h-4 w-4 text-muted-foreground" />
                <span>{event.location}</span>
              </div>
            )}
            {(event.event_type === "online" || event.event_type === "hybrid") && event.meeting_url && (
              <div className="flex items-center gap-3">
                <Video weight="fill" className="h-4 w-4 text-muted-foreground" />
                <a
                  href={event.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Join online <ExternalLink weight="fill" className="h-3 w-3" />
                </a>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Users weight="fill" className="h-4 w-4 text-muted-foreground" />
              <span>
                {event.registration_count ?? 0}{event.capacity ? ` / ${event.capacity}` : ""} registered
                {event.is_full && " — Full"}
              </span>
            </div>
          </div>

          {event.description && (
            <div className="pt-2">
              <h2 className="font-semibold mb-2">About this event</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {registrationMessage && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                registrationMessage.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {registrationMessage.type === "success" ? (
                <CheckCircle weight="fill" className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle weight="fill" className="h-4 w-4 shrink-0" />
              )}
              {registrationMessage.text}
            </div>
          )}

          {!isPast && event.status === "published" && (
            <div className="flex gap-3 pt-2">
              {isPublic && !isAuthenticated ? (
                <Button onClick={handleSignInToRegister} size="lg">
                  Sign in to register
                </Button>
              ) : isRegistered ? (
                <Button disabled size="lg">
                  You are registered
                </Button>
              ) : canRegister ? (
                <Button onClick={handleRegister} disabled={isRegistering} size="lg">
                  {isRegistering ? "Registering…" : "Register for Event"}
                </Button>
              ) : (
                <Button disabled size="lg">
                  {event.is_full ? "Event Full" : "Registration Closed"}
                </Button>
              )}
              {isAuthenticated && isRegistered && (
                <Button variant="outline" onClick={handleCancelRegistration} disabled={isRegistering}>
                  Cancel Registration
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title={event.title}
        url={shareUrl}
        description={event.description ?? undefined}
        imageUrl={event.cover_url ?? undefined}
        type="event"
      />
    </div>
  );

  if (!isPublic) return body;

  return (
    <>
      <SEOHead
        title={`${event.title} · MurihSpace Event`}
        description={
          event.description ??
          `Join ${event.creator?.name ?? "a host"} for ${event.title} on MurihSpace.`
        }
        image={event.cover_url ?? undefined}
        url={shareUrl}
        type="website"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Event",
          name: event.title,
          description: event.description ?? undefined,
          startDate: event.start_date,
          endDate: event.end_date,
          eventStatus: event.status === "published" ? "https://schema.org/EventScheduled" : undefined,
          eventAttendanceMode:
            event.event_type === "in_person"
              ? "https://schema.org/OfflineEventAttendanceMode"
              : "https://schema.org/OnlineEventAttendanceMode",
          location: event.location ?? undefined,
          image: event.cover_url ?? undefined,
          url: shareUrl,
          organizer: event.creator
            ? { "@type": "Person", name: event.creator.name }
            : undefined,
        }}
      />
      <div key={location.pathname}>{body}</div>
    </>
  );
}

/** Authenticated dashboard route: `/app/events/:id`. */
export function EventDetailPage() {
  return <EventDetailView />;
}

/** Public share route: `/e/:id`. */
export function PublicEventPage() {
  return <EventDetailView isPublic />;
}