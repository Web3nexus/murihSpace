import { useState, useEffect, useCallback } from "react";
import { useConfirm } from "@/components/ui/DialogProvider";
import { Link } from "react-router";
import { Plus, Calendar, Trash2, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/common/UIStateComponents";
import { CreateEventModal } from "@/components/events/CreateEventModal";
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  published: "default",
  cancelled: "destructive",
  completed: "outline",
};

export function MyEventsPage() {
  const confirm = useConfirm();
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/my-events`, { headers: getAuthHeaders() });
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

  const handlePublish = async (id: number, status: string) => {
    try {
      const res = await fetch(`${API}/my-events/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      fetchEvents();
    } catch {
      console.error("Failed to publish event");
    }
  };

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: 'Delete Event', message: 'Delete this event?', variant: 'destructive' })) return;
    try {
      const res = await fetch(`${API}/my-events/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete");
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      console.error("Failed to delete event");
    }
  };

  if (isLoading) return <LoadingState message="Loading your events…" />;
  if (error) return <ErrorState title="Failed to load events" description={error} onRetry={fetchEvents} />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Events</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage your community events
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Event
        </Button>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Create your first event to engage your community."
          action={{ label: "Create Event", onClick: () => setIsModalOpen(true) }}
          icon={Calendar}
        />
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Link
                    to={`/app/events/${event.id}`}
                    className="font-semibold hover:text-primary transition-colors truncate"
                  >
                    {event.title}
                  </Link>
                  <Badge variant={STATUS_COLORS[event.status] as "default" | "secondary" | "destructive" | "outline"}>
                    {event.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(event.start_date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {event.registration_count ?? 0}{event.capacity ? `/${event.capacity}` : ""}
                  </span>
                  {event.community && <span>{event.community.name}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {event.status === "draft" && (
                  <Button size="sm" variant="outline" onClick={() => handlePublish(event.id, "published")}>
                    Publish
                  </Button>
                )}
                {event.status === "published" && (
                  <Button size="sm" variant="outline" onClick={() => handlePublish(event.id, "cancelled")}>
                    Cancel
                  </Button>
                )}
                <Button size="sm" variant="ghost" asChild>
                  <Link to={`/app/events/${event.id}`}>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(event.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateEventModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={fetchEvents}
      />
    </div>
  );
}
