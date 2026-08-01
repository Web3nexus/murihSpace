import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { Calendar, MapPin, Users, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/common/UIStateComponents";
import type { EventData } from "@/types/events";
import { env } from "@/config/env";
import { getAuthToken } from "@/lib/auth/token";

const API = env.VITE_API_BASE_URL;

const EVENT_TYPE_LABELS: Record<string, string> = {
  online: "Online",
  in_person: "In Person",
  hybrid: "Hybrid",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function EventsPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/events`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load events");
      const body = await res.json();
      setEvents(Array.isArray(body.data) ? body.data : body.data?.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchEvents]);

  const filtered = searchQuery
    ? events.filter((e) =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : events;

  if (isLoading) return <LoadingState message="Loading events…" />;
  if (error) return <ErrorState title="Failed to load events" description={error} onRetry={fetchEvents} />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover upcoming events in your communities
          </p>
        </div>
        <Button asChild>
          <Link to="/app/my-events">
            <Plus className="mr-2 h-4 w-4" />
            My Events
          </Link>
        </Button>
      </div>

      <Input
        placeholder="Search events…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-sm"
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No events found"
          description={searchQuery ? "Try a different search term." : "No upcoming events available."}
          icon={Calendar}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => (
            <Link
              key={event.id}
              to={`/app/events/${event.id}`}
              className="group rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold text-base group-hover:text-primary transition-colors line-clamp-2">
                  {event.title}
                </h3>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                </Badge>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>{formatDate(event.start_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {formatTime(event.start_date)} – {formatTime(event.end_date)}
                  </span>
                </div>
                {event.event_type !== "online" && event.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </div>
                )}
                {event.meeting_url && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate text-primary">Online link available</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>
                    {event.registration_count ?? 0}
                    {event.capacity ? ` / ${event.capacity}` : ""} registered
                  </span>
                </div>
                {event.community && (
                  <span className="truncate max-w-[120px]">{event.community.name}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
