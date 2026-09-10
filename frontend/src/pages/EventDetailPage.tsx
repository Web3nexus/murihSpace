import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  Calendar as Calendar,
  Clock as Clock,
  MapPin as MapPin,
  Users as Users,
  VideoCamera as Video,
  ArrowLeft as ArrowLeft,
  ArrowSquareOut as ExternalLink,
  CheckCircle as CheckCircle,
  XCircle as XCircle
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, NotFoundState } from "@/components/common/UIStateComponents";
import type { EventData } from "@/types/events";
import { env } from "@/config/env";
import { getAuthToken } from "@/lib/auth/token";

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

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

  const handleRegister = async () => {
    if (!id) return;
    setIsRegistering(true);
    setRegistrationMessage(null);
    try {
      const res = await fetch(`${API}/events/${id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const body = await res.json();
      if (!res.ok) {
        setRegistrationMessage({ type: "error", text: body.message || "Registration failed." });
        return;
      }
      setRegistrationMessage({ type: "success", text: "You are registered for this event!" });
      fetchEvent();
    } catch {
      setRegistrationMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleCancelRegistration = async () => {
    if (!id) return;
    setIsRegistering(true);
    setRegistrationMessage(null);
    try {
      const res = await fetch(`${API}/events/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const body = await res.json();
      if (!res.ok) {
        setRegistrationMessage({ type: "error", text: body.message || "Cancellation failed." });
        return;
      }
      setRegistrationMessage({ type: "success", text: "Registration cancelled." });
      fetchEvent();
    } catch {
      setRegistrationMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setIsRegistering(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading event…" />;
  if (error) return <ErrorState title="Failed to load event" description={error} onRetry={fetchEvent} />;
  if (!event) return <NotFoundState title="Event not found" description="This event does not exist or has been removed." />;

  const isPast = new Date(event.end_date) < new Date();

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
        <ArrowLeft weight="fill" className="h-4 w-4" />
        Back
      </Button>

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
                  <Link to={`/app/communities/${event.community.slug}`} className="text-primary hover:underline">
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
              {event.is_registration_open ? (
                <Button onClick={handleRegister} disabled={isRegistering} size="lg">
                  {isRegistering ? "Registering…" : "Register for Event"}
                </Button>
              ) : (
                <Button disabled size="lg">
                  {event.is_full ? "Event Full" : "Registration Closed"}
                </Button>
              )}
              <Button variant="outline" onClick={handleCancelRegistration} disabled={isRegistering}>
                Cancel Registration
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
